import {onCall,HttpsError} from 'firebase-functions/v2/https';
import {initializeApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {randomUUID} from 'node:crypto';
import {initial,validateBooking,validateSettings,validDate,occurs,changeRoom} from './domain.js';
initializeApp();
export const manage=onCall({region:'europe-west1',maxInstances:5},async request=>{
 if(!request.auth)throw new HttpsError('unauthenticated','נדרשת כניסה.');
 const admin=request.auth.token.email==='nros1978@gmail.com'&&request.auth.token.email_verified===true;
 const data=request.data||{},ref=getFirestore().doc('school/state');
 try{return await getFirestore().runTransaction(async tx=>{
 const snap=await tx.get(ref);let state=snap.exists()?snap.data():initial();
 if(data.action==='book'){
 const x=data.booking||{},b={resource:x.resource,date:x.date,period:x.period,quantity:x.quantity,name:x.name,className:x.className,recurring:x.recurring===true,until:x.recurring===true?x.until:null,exceptions:[],id:randomUUID(),owner:request.auth.uid};
 validateBooking(state,b,admin);if(state.bookings.length>=2000)throw Error('המערכת הגיעה למגבלת ההזמנות. נדרש ארכוב על ידי מנהל המערכת.');state.bookings.push(b);
 }else if(data.action==='cancel'){
 const b=state.bookings.find(b=>b.id===data.id);if(!b||(!admin&&b.owner!==request.auth.uid))throw Error('אין הרשאה לביטול שיריון זה.');state.bookings=state.bookings.filter(b=>b.id!==data.id);
 }else if(data.action==='exception'){
 const b=state.bookings.find(b=>b.id===data.id);if(!admin||!b?.recurring||!validDate(data.date)||!occurs(b,data.date))throw Error('לא ניתן לשחרר שיריון זה.');b.exceptions=[...b.exceptions,data.date];
 }else if(data.action==='addRoom'||data.action==='removeRoom'){
 state=changeRoom(state,data.action,{name:data.name,id:data.action==='addRoom'?'room-'+randomUUID():data.id},admin);
 }else if(data.action==='settings'){
 if(!admin)throw Error('נדרשת הרשאת מנהל.');state=validateSettings(state,data.capacity,data.periods);
 }else throw Error('פעולה לא מוכרת.');
 tx.set(ref,state);return state;
 });}catch(err){throw new HttpsError('failed-precondition',err.message);}
});
