import test from 'node:test';
import assert from 'node:assert/strict';
import {OWNER_EMAIL,normalizeEmail,hasAdminAccess,changeAdmins} from '../functions/admin-access.js';
const google=email=>({token:{email,email_verified:true,firebase:{sign_in_provider:'google.com'}}});
test('verified Google accounts only, including the protected owner',()=>{
 assert.equal(hasAdminAccess(google(OWNER_EMAIL)),true);
 assert.equal(hasAdminAccess(google('extra@school.org'),['extra@school.org']),true);
 assert.equal(hasAdminAccess(google('other@school.org'),['extra@school.org']),false);
 assert.equal(hasAdminAccess(null),false);
 assert.equal(hasAdminAccess({token:{email:OWNER_EMAIL,email_verified:true}}),false);
 const unverified=google(OWNER_EMAIL);unverified.token.email_verified=false;
 assert.equal(hasAdminAccess(unverified),false);
 const password=google(OWNER_EMAIL);password.token.firebase.sign_in_provider='password';
 assert.equal(hasAdminAccess(password),false);
});
test('normalize, grant, revoke and protect owner',()=>{
 assert.equal(normalizeEmail(' Extra@School.org '),'extra@school.org');
 assert.deepEqual(changeAdmins([],'addAdmin',' Extra@School.org '),['extra@school.org']);
 assert.throws(()=>changeAdmins(['extra@school.org'],'addAdmin','extra@school.org'));
 assert.deepEqual(changeAdmins(['extra@school.org'],'removeAdmin','extra@school.org'),[]);
 assert.equal(hasAdminAccess(google('extra@school.org'),[]),false);
 for(const action of ['addAdmin','removeAdmin'])assert.throws(()=>changeAdmins([],action,OWNER_EMAIL));
 for(const value of ['',null,'abc','x@y','x @school.org'])assert.throws(()=>normalizeEmail(value));
 assert.throws(()=>changeAdmins(Array.from({length:50},(_,i)=>`${i}@school.org`),'addAdmin','new@school.org'));
});
