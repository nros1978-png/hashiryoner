import {validDate,addDays} from './domain.js';

// Rebase only pending approvals, never existing series or new booking input.
export function prepareFixedApproval(bookings,now){
 if(!validDate(now))throw Error('תאריך האישור אינו תקין.');
 return bookings.map(b=>{
  if(!validDate(b.date)||!validDate(b.until)||b.until<b.date||b.until>addDays(b.date,366))throw Error('שיריון קבוע דורש תאריך התחלה וסיום תקינים בטווח של שנה.');
  const elapsed=(Date.parse(now+'T12:00:00Z')-Date.parse(b.date+'T12:00:00Z'))/86400000;
  const date=elapsed>0?addDays(b.date,7*Math.ceil(elapsed/7)):b.date;
  if(date>b.until)throw Error('לא נותרו מועדים לאישור באחד השיריונים המבוקשים. יש להגיש בקשה מעודכנת.');
  return {...b,date};
 });
}
