import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as domain from '../functions/domain.js';
import * as access from '../functions/admin-access.js';
import {prepareFixedApproval} from '../functions/fixed-approval.js';
import {replacementPlan} from '../functions/replacement.js';
import {createHash} from 'node:crypto';

// Execute the callable handler with an in-memory server-only Firestore adapter.
function server(){
 const records=new Map();
 const doc=path=>({path,get:async()=>snapshot(path)});
 const snapshot=path=>({exists:records.has(path),data:()=>structuredClone(records.get(path))});
 const db={doc,runTransaction:async fn=>{
  const writes=[];
  const result=await fn({get:async ref=>snapshot(ref.path),set:(ref,value)=>writes.push([ref.path,structuredClone(value)]),update:(ref,value)=>writes.push([ref.path,{...records.get(ref.path),...structuredClone(value)}])});
  for(const [path,value] of writes)records.set(path,value);
  return result;
 }};
 class HttpsError extends Error{constructor(code,message){super(message);this.code=code;}}
 const params={...domain,...access,prepareFixedApproval,replacementPlan,createHash,today:()=> '2026-10-12',HttpsError,onCall:(_,handler)=>handler,initializeApp:()=>{},getFirestore:()=>db,defineSecret:()=>({value:()=>''}),randomUUID:()=>crypto.randomUUID(),nodemailer:{}};
 const source=readFileSync(new URL('../functions/index.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replace('export const manage=','const manage=');
 const manage=new Function(...Object.keys(params),source+'\nreturn manage;')(...Object.values(params));
 return {manage,records};
}
const auth=email=>({uid:email,token:{email,email_verified:true,firebase:{sign_in_provider:'google.com'}}});
test('pending old series is approved from next weekly date, without duplicate approval',async()=>{
 const {manage,records}=server(),b={resource:'back',date:'2026-10-07',period:6,quantity:1,name:'מורה',className:'ח',recurring:true,until:'2027-06-30'};
 records.set('fixedRequests/test',{bookings:[b],owner:'teacher',status:'pending'});
 const next=await manage({auth:auth(access.OWNER_EMAIL),data:{action:'approveRequest',id:'test'}});
 assert.equal(next.bookings[0].date,'2026-10-14');assert.equal(next.bookings[0].until,b.until);assert.equal(next.bookings[0].owner,'teacher');
 assert.equal(records.get('fixedRequests/test').status,'approved');
 await assert.rejects(manage({auth:auth(access.OWNER_EMAIL),data:{action:'approveRequest',id:'test'}}));
 assert.equal(records.get('school/state').bookings.length,1);
});
test('conflicts leave request pending and do not partially book a batch',async()=>{
 const {manage,records}=server(),b={resource:'back',date:'2026-10-07',period:6,quantity:1,name:'מורה',className:'ח',recurring:true,until:'2027-06-30'};
 const state=domain.initial();state.bookings.push({...b,date:'2026-10-21',recurring:false});records.set('school/state',state);
 records.set('fixedRequests/test',{bookings:[{...b,resource:'front'},b],owner:'teacher',status:'pending'});
 await assert.rejects(manage({auth:auth(access.OWNER_EMAIL),data:{action:'approveRequest',id:'test'}}),/לבדוק ולאשר/);
 assert.equal(records.get('fixedRequests/test').status,'pending');assert.deepEqual(records.get('school/state'),state);
});
test('preview does not write; confirmed approval releases only overlapping recurring dates',async()=>{
 const {manage,records}=server(),owner=auth(access.OWNER_EMAIL);
 const b={id:'old',owner:'other',resource:'back',date:'2026-10-07',period:6,quantity:1,name:'מורה אחר',className:'ח',recurring:true,until:'2027-06-30',exceptions:[]};
 const state=domain.initial();state.bookings=[b];records.set('school/state',state);
 records.set('fixedRequests/test',{bookings:[{...b,date:'2026-10-07',until:'2026-10-28',name:'מורה חדש'}],owner:'teacher',status:'pending'});
 const before=structuredClone([...records]);
 const preview=await manage({auth:owner,data:{action:'previewFixed',id:'test'}});
 assert.deepEqual([...records],before);
 assert.deepEqual(preview.conflicts[0].dates,['2026-10-14','2026-10-21','2026-10-28']);
 const next=await manage({auth:owner,data:{action:'approveRequest',id:'test',overwriteToken:preview.token}});
 const old=next.bookings.find(b=>b.id==='old');
 assert.equal(domain.occurs(old,'2026-10-14'),false);assert.equal(domain.occurs(old,'2026-11-04'),true);assert.equal(domain.occurs(old,'2026-10-07'),true);
 assert.equal(next.bookings[1].owner,'teacher');assert.equal(records.get('fixedRequests/test').status,'approved');
});
test('stale or missing confirmation cannot overwrite new bookings; non-admin cannot preview or overwrite',async()=>{
 const {manage,records}=server(),owner=auth(access.OWNER_EMAIL),b={resource:'front',date:'2026-10-14',period:1,quantity:1,name:'מורה',className:'ח',recurring:true,until:'2026-10-28',exceptions:[]};
 const preview=await manage({auth:owner,data:{action:'previewFixed',bookings:[b]}});
 const state=domain.initial();state.bookings.push({...b,id:'late',recurring:false,owner:'other'});records.set('school/state',state);
 await assert.rejects(manage({auth:owner,data:{action:'bookBatch',bookings:[b],overwriteToken:preview.token}}),/לבדוק ולאשר/);
 await assert.rejects(manage({auth:owner,data:{action:'bookBatch',bookings:[b]}}),/לבדוק ולאשר/);
 assert.deepEqual(records.get('school/state'),state);
 const teacher=auth('teacher@school.org');
 await assert.rejects(manage({auth:teacher,data:{action:'previewFixed',bookings:[b]}}));
 await assert.rejects(manage({auth:teacher,data:{action:'bookBatch',bookings:[b],overwriteToken:preview.token}}));
 const fresh=await manage({auth:owner,data:{action:'previewFixed',bookings:[b]}});
 const next=await manage({auth:owner,data:{action:'bookBatch',bookings:[b],overwriteToken:fresh.token}});
 assert.equal(next.bookings.length,1);assert.notEqual(next.bookings[0].id,'late');
});
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
