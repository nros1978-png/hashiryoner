import {onCall,HttpsError} from 'firebase-functions/v2/https';
import {initializeApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {defineSecret} from 'firebase-functions/params';
import {randomUUID} from 'node:crypto';
import nodemailer from 'nodemailer';
import {initial,validateBooking,validateBookingBatch,validateSettings,validDate,today,weekday,occurs,changeRoom,changeTeacher,teacherNames,roomList,resources,dayNames} from './domain.js';
initializeApp();
const ADMIN_EMAIL='nros1978@gmail.com';
const smtpUser=defineSecret('SMTP_USER');
const smtpPass=defineSecret('SMTP_PASS');
const isAdmin=request=>request.auth?.token.email===ADMIN_EMAIL&&request.auth.token.email_verified===true;
const resourceName=(state,id)=>id==='laptops'?resources[0][1]:roomList(state).find(r=>r.id===id)?.name||id;
const fixedBookings=input=>{
 if(!Array.isArray(input)||!input.length||input.length>72)throw Error('יש לבחור בין שיעור אחד ל־72 שיעורים קבועים.');
 return input.map(x=>({resource:x?.resource,date:x?.date,period:x?.period,quantity:x?.quantity,name:x?.name,className:x?.className,recurring:true,until:x?.until,exceptions:[]}));
};
export const manage=onCall({region:'europe-west1',maxInstances:5,secrets:[smtpUser,smtpPass]},async request=>{
 if(!request.auth)throw new HttpsError('unauthenticated','נדרשת כניסה.');
 const admin=isAdmin(request);
 const data=request.data||{},ref=getFirestore().doc('school/state');
 if(data.action==='listRequests'){
  const query=admin?getFirestore().collection('fixedRequests').where('status','==','pending'):getFirestore().collection('fixedRequests').where('owner','==',request.auth.uid);
  const snap=await query.get();
  return snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')).slice(0,100);
 }
 let notification;
 try{const next=await getFirestore().runTransaction(async tx=>{
 const snap=await tx.get(ref);let state=snap.exists?snap.data():initial();
 if(data.action==='book'){
 const x=data.booking||{},b={resource:x.resource,date:x.date,period:x.period,quantity:x.quantity,name:x.name,className:x.className,recurring:x.recurring===true,until:x.recurring===true?x.until:null,exceptions:[],id:randomUUID(),owner:request.auth.uid};
 validateBooking(state,b,admin);if(state.bookings.length>=2000)throw Error('המערכת הגיעה למגבלת ההזמנות. נדרש ארכוב על ידי מנהל המערכת.');state.bookings.push(b);
 }else if(data.action==='bookBatch'){
 if(!admin)throw Error('נדרשת הרשאת מנהל.');const bookings=fixedBookings(data.bookings);validateBookingBatch(state,bookings,true);
 if(state.bookings.length+bookings.length>2000)throw Error('המערכת הגיעה למגבלת ההזמנות. נדרש ארכוב על ידי מנהל המערכת.');state.bookings.push(...bookings.map(b=>({...b,id:randomUUID(),owner:request.auth.uid})));
 }else if(data.action==='cancel'){
 const b=state.bookings.find(b=>b.id===data.id);if(!b||(!admin&&b.owner!==request.auth.uid))throw Error('אין הרשאה לביטול שיריון זה.');state.bookings=state.bookings.filter(b=>b.id!==data.id);
 }else if(data.action==='exception'){
 const b=state.bookings.find(b=>b.id===data.id);if(!b?.recurring||(!admin&&b.owner!==request.auth.uid)||!validDate(data.date)||data.date<today()||!occurs(b,data.date))throw Error('לא ניתן לשחרר שיריון זה.');b.exceptions=[...b.exceptions,data.date];
 }else if(data.action==='addRoom'||data.action==='removeRoom'){
 state=changeRoom(state,data.action,{name:data.name,id:data.action==='addRoom'?'room-'+randomUUID():data.id},admin);
 }else if(data.action==='addTeacher'||data.action==='removeTeacher'){
 state=changeTeacher(state,data.action,data.name,admin);
 }else if(data.action==='requestFixed'){
 const bookings=fixedBookings(data.bookings),b=bookings[0];
 if(!teacherNames(state).length)throw Error('המנהל עדיין לא הזין רשימת מורים.');
 validateBookingBatch(state,bookings,true);
 const id=randomUUID(),createdAt=new Date().toISOString();
 tx.set(getFirestore().doc('fixedRequests/'+id),{bookings,owner:request.auth.uid,status:'pending',createdAt});
 const schedule=bookings.map(x=>`יום ${dayNames[weekday(x.date)]}, שיעור ${x.period}`).join('\n');
 notification={subject:`השיריוּנר: בקשה חדשה לשיריון קבוע מאת ${b.name}`,text:`התקבלה בקשה לשיריון קבוע.\n\nמורה: ${b.name}\nכיתה / קבוצה: ${b.className}\nמשאב: ${resourceName(state,b.resource)}\nמועדים שבועיים:\n${schedule}\nעד תאריך: ${b.until}${b.resource==='laptops'?`\nמספר מחשבים בכל מועד: ${b.quantity}`:''}\n\nיש להיכנס למסך הניהול בשיריוּנר כדי לאשר או לדחות את הבקשה.`};
 }else if(data.action==='approveRequest'||data.action==='rejectRequest'){
 if(!admin||typeof data.id!=='string')throw Error('נדרשת הרשאת מנהל.');
 const requestRef=getFirestore().doc('fixedRequests/'+data.id),requestSnap=await tx.get(requestRef);
 if(!requestSnap.exists||requestSnap.data().status!=='pending')throw Error('הבקשה אינה ממתינה לאישור.');
 const pending=requestSnap.data();
 if(data.action==='approveRequest'){
  const source=Array.isArray(pending.bookings)&&pending.bookings.length?pending.bookings:pending.booking?[pending.booking]:[],bookings=fixedBookings(source);validateBookingBatch(state,bookings,true);
  if(state.bookings.length+bookings.length>2000)throw Error('המערכת הגיעה למגבלת ההזמנות.');
  state.bookings.push(...bookings.map(b=>({...b,id:randomUUID(),owner:pending.owner})));tx.update(requestRef,{status:'approved',decidedAt:new Date().toISOString()});
 }else tx.update(requestRef,{status:'rejected',decidedAt:new Date().toISOString()});
 }else if(data.action==='cancelRequest'){
 if(typeof data.id!=='string')throw Error('בקשה לא תקינה.');
 const requestRef=getFirestore().doc('fixedRequests/'+data.id),requestSnap=await tx.get(requestRef);
 if(!requestSnap.exists||requestSnap.data().owner!==request.auth.uid||requestSnap.data().status!=='pending')throw Error('לא ניתן לבטל את הבקשה.');
 tx.update(requestRef,{status:'cancelled',decidedAt:new Date().toISOString()});
 }else if(data.action==='settings'){
 if(!admin)throw Error('נדרשת הרשאת מנהל.');state=validateSettings(state,data.capacity,data.periods);
 }else throw Error('פעולה לא מוכרת.');
 tx.set(ref,state);return state;
 });
 if(notification){try{const user=smtpUser.value();const transport=nodemailer.createTransport({host:'smtp.gmail.com',port:465,secure:true,auth:{user,pass:smtpPass.value()}});await transport.sendMail({from:`"השיריוּנר" <${user}>`,to:user,...notification});}catch(err){console.error('Fixed booking request email failed',err);}}
 return next;}catch(err){throw new HttpsError('failed-precondition',err.message);}
});
