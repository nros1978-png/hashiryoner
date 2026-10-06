import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as domain from '../functions/domain.js';
import * as access from '../functions/admin-access.js';

// Execute the callable handler with an in-memory server-only Firestore adapter.
function server(){
 const records=new Map();
 const doc=path=>({path,get:async()=>snapshot(path)});
 const snapshot=path=>({exists:records.has(path),data:()=>structuredClone(records.get(path))});
 const db={doc,runTransaction:async fn=>fn({get:async ref=>snapshot(ref.path),set:(ref,value)=>records.set(ref.path,structuredClone(value))})};
 class HttpsError extends Error{constructor(code,message){super(message);this.code=code;}}
 const params={...domain,...access,HttpsError,onCall:(_,handler)=>handler,initializeApp:()=>{},getFirestore:()=>db,defineSecret:()=>({value:()=>''}),randomUUID:()=>crypto.randomUUID(),nodemailer:{}};
 const source=readFileSync(new URL('../functions/index.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replace('export const manage=','const manage=');
 const manage=new Function(...Object.keys(params),source+'\nreturn manage;')(...Object.values(params));
 return {manage,records};
}
const auth=email=>({uid:email,token:{email,email_verified:true,firebase:{sign_in_provider:'google.com'}}});
test('callable hides admin list and rejects privilege escalation',async()=>{
 const {manage,records}=server(),teacher=auth('teacher@school.org');
 await assert.rejects(manage({data:{action:'adminAccess'}}),e=>e.code==='unauthenticated');
 assert.deepEqual(await manage({auth:teacher,data:{action:'adminAccess'}}),{admin:false,emails:[],ownerEmail:null});
 await assert.rejects(manage({auth:teacher,data:{action:'addAdmin',email:teacher.token.email}}),e=>e.code==='permission-denied');
 assert.equal(records.size,0);
});
test('owner grants access before first sign-in; delegated admin works and revocation is enforced',async()=>{
 const {manage,records}=server(),owner=auth(access.OWNER_EMAIL),extra=auth('extra@school.org');
 const grant=await manage({auth:owner,data:{action:'addAdmin',email:' EXTRA@School.org '}});
 assert.deepEqual(grant.emails,[access.OWNER_EMAIL,'extra@school.org']);
 assert.equal((await manage({auth:extra,data:{action:'adminAccess'}})).admin,true);
 await manage({auth:extra,data:{action:'addTeacher',name:'מורה חדש'}});
 assert.deepEqual(domain.teacherNames(records.get('school/state')),['מורה חדש']);
 await assert.rejects(manage({auth:extra,data:{action:'removeAdmin',email:access.OWNER_EMAIL}}));
 await manage({auth:owner,data:{action:'removeAdmin',email:'extra@school.org'}});
 assert.equal((await manage({auth:extra,data:{action:'adminAccess'}})).admin,false);
 await assert.rejects(manage({auth:extra,data:{action:'addTeacher',name:'מורה נוסף'}}));
 await assert.rejects(manage({auth:extra,data:{action:'addAdmin',email:'other@school.org'}}),e=>e.code==='permission-denied');
 assert.deepEqual(domain.teacherNames(records.get('school/state')),['מורה חדש']);
});
