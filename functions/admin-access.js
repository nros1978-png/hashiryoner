export const OWNER_EMAIL='nros1978@gmail.com';
export function normalizeEmail(value){
 if(typeof value!=='string')throw Error('יש להזין כתובת מייל תקינה.');
 const email=value.trim().toLowerCase();
 if(email.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('יש להזין כתובת מייל תקינה.');
 return email;
}
export function hasAdminAccess(auth,emails=[]){
 const token=auth?.token;
 return token?.email_verified===true&&token.firebase?.sign_in_provider==='google.com'&&typeof token.email==='string'&&(token.email.toLowerCase()===OWNER_EMAIL||emails.includes(token.email.toLowerCase()));
}
export function changeAdmins(emails,action,value){
 const email=normalizeEmail(value),next=[...new Set(emails)].filter(e=>e!==OWNER_EMAIL);
 if(email===OWNER_EMAIL)throw Error('לא ניתן לשנות את הרשאת המנהל הראשי.');
 if(action==='addAdmin'){if(next.includes(email))throw Error('לכתובת הזו כבר יש הרשאת ניהול.');if(next.length>=50)throw Error('ניתן להוסיף עד 50 מנהלים.');return [...next,email].sort();}
 if(action==='removeAdmin')return next.filter(e=>e!==email);
 throw Error('פעולה לא מוכרת.');
}
