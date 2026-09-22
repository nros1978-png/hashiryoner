export const resources=[['laptops','מחשבים ניידים'],['computers','חדר מחשבים'],['kisufim','חדר כיסופים'],['meeting','חדר ישיבות'],['lop','חדר לו״פ'],['front','בית מדרש קדמי'],['back','בית מדרש אחורי']];
export const roomList=s=>s.rooms??resources.slice(1).map(([id,name])=>({id,name,active:true}));
export const activeResources=s=>[resources[0],...roomList(s).filter(r=>r.active).map(r=>[r.id,r.name])];
export const teacherNames=s=>Array.isArray(s.teachers)?s.teachers.filter(x=>typeof x==='string'&&x.trim()).map(x=>x.trim()):[];
export function changeTeacher(s,action,name,admin){
 if(!admin)throw Error('נדרשת הרשאת מנהל.');
 name=typeof name==='string'?name.trim().replace(/\s+/g,' '):'';
 if(!name||name.length>80)throw Error('יש להזין שם מורה עד 80 תווים.');
 const teachers=teacherNames(s);
 if(action==='addTeacher'){
  if(teachers.includes(name))throw Error('השם כבר נמצא ברשימת המורים.');
  teachers.push(name);teachers.sort((a,b)=>a.localeCompare(b,'he'));
 }else if(action==='removeTeacher'){
  if(!teachers.includes(name))throw Error('שם המורה לא נמצא.');
  teachers.splice(teachers.indexOf(name),1);
 }else throw Error('פעולה לא מוכרת.');
 return {...s,teachers};
}
export function changeRoom(s,action,payload,admin,now=today()){
 if(!admin)throw Error('נדרשת הרשאת מנהל.');
 const rooms=roomList(s).map(r=>({...r}));
 if(action==='addRoom'){
 const name=typeof payload.name==='string'?payload.name.trim():'';
 if(!name||name.length>60)throw Error('יש להזין שם חדר עד 60 תווים.');
 if(name===resources[0][1]||rooms.some(r=>r.active&&r.name===name))throw Error('כבר קיים חדר בשם הזה.');
 const archived=rooms.find(r=>!r.active&&r.name===name);
 if(archived)archived.active=true;else{
 if(typeof payload.id!=='string'||!/^room-[a-zA-Z0-9-]+$/.test(payload.id)||rooms.some(r=>r.id===payload.id))throw Error('מזהה חדר אינו תקין.');
 rooms.push({id:payload.id,name,active:true});}
 }else if(action==='removeRoom'){
 const room=rooms.find(r=>r.id===payload.id&&r.active);if(!room)throw Error('החדר לא נמצא.');
 if(s.bookings.some(b=>b.resource===room.id&&dates(b).some(d=>d>=now)))throw Error('לחדר יש שיריונים עתידיים. יש לבטל אותם לפני הסרת החדר.');
 room.active=false;
 }else throw Error('פעולה לא מוכרת.');
 return {...s,rooms};
}
export const dayNames=['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
export const initial=()=>({capacity:85,periods:[6,8,7,6,7,3,0],bookings:[],teachers:[]});
export const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export function validDate(s){return typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!isNaN(Date.parse(s))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;}
export const weekday=d=>new Date(d+'T12:00:00Z').getUTCDay();
export function addDays(d,n){const t=new Date(d+'T12:00:00Z');t.setUTCDate(t.getUTCDate()+n);return t.toISOString().slice(0,10);}
export const occurs=(b,d)=> b.recurring ? d>=b.date&&d<=b.until&&weekday(d)===weekday(b.date)&&!(b.exceptions||[]).includes(d):b.date===d;
export const at=(s,r,d,p)=>s.bookings.filter(b=>b.resource===r&&b.period===p&&occurs(b,d));
export const available=(s,r,d,p)=>(r==='laptops'?s.capacity:1)-at(s,r,d,p).reduce((n,b)=>n+b.quantity,0);
export function dates(b){if(!b.recurring)return [b.date];const out=[];for(let d=b.date;d<=b.until;d=addDays(d,7))if(!(b.exceptions||[]).includes(d))out.push(d);return out;}
export function validateBooking(s,b,admin=false,now=today()){
 if(!activeResources(s).some(([id])=>id===b.resource)||!validDate(b.date)||b.date<now)throw Error('יש לבחור משאב ותאריך תקינים, מהיום והלאה.');
 if(!Number.isInteger(b.period)||b.period<1||b.period>s.periods[weekday(b.date)])throw Error('השיעור אינו קיים ביום זה.');
 if(!Number.isInteger(b.quantity)||b.quantity<1||(b.resource!=='laptops'&&b.quantity!==1))throw Error('כמות המחשבים אינה תקינה.');
 if(typeof b.name!=='string'||!b.name.trim()||b.name.length>80||typeof b.className!=='string'||!b.className.trim()||b.className.length>80)throw Error('יש למלא שם מורה וכיתה או קבוצה, עד 80 תווים.');
 if(teacherNames(s).length&&!teacherNames(s).includes(b.name.trim()))throw Error('יש לבחור שם מתוך רשימת המורים.');
 if(b.recurring&&(!admin||!validDate(b.until)||b.until<b.date||b.until>addDays(b.date,366)))throw Error('שיריון קבוע דורש מנהל ותאריך סיום בטווח של שנה.');
 for(const d of dates(b))if(available(s,b.resource,d,b.period)<b.quantity)throw Error('אין מספיק מקום בתאריך '+d+'. ייתכן שמורה אחר כבר שריין.');
}
export function validateSettings(s,capacity,periods,now=today()){
 if(!Number.isInteger(capacity)||capacity<0||capacity>10000||!Array.isArray(periods)||periods.length!==7||periods.some(n=>!Number.isInteger(n)||n<0||n>12)||periods[6]!==0)throw Error('יש להזין כמות תקינה ומספר שיעורים בין 0 ל־12.');
 const next={...s,capacity,periods};
 for(const b of s.bookings)for(const d of dates(b).filter(d=>d>=now)){
 if(b.period>periods[weekday(d)])throw Error('קיים שיריון בשיעור שביקשת להסיר: '+d);
 if(available(next,b.resource,d,b.period)<0)throw Error('הכמות החדשה נמוכה מהכמות שכבר שוריינה בתאריך '+d+'. ההזמנות נשמרו; יש לטפל בהתנגשות לפני העדכון.');
 }
 return next;
}
