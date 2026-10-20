import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initial,roomList,activeResources,bookablePeriods,resourceRows,bookingPeriods,validateBooking,validateBookingBatch,validateSettings,at,available,lessonLabel,changeRoom} from '../functions/domain.js';
import {replacementPlan} from '../functions/replacement.js';
const now='2026-10-20',booking=(extra={})=>({id:'visit',resource:'innovation',date:now,period:2,quantity:1,name:'מורה',className:'ז',topic:'רובוטיקה',recurring:false,exceptions:[],...extra});
test('innovation appears once in existing custom room configurations and remains removable',()=>{
 const s={...initial(),rooms:[{id:'front',name:'קדמי',active:true}]};
 assert.equal(activeResources(s).filter(([id])=>id==='innovation').length,1);
 const removed=changeRoom(s,'removeRoom',{id:'innovation'},true,now);
 assert.equal(activeResources(removed).some(([id])=>id==='innovation'),false);
 const alias={...s,rooms:[{id:'room-existing',name:'מרכז חדשנות',active:true}]};
 assert.equal(roomList(alias).length,1);assert.deepEqual(bookablePeriods(alias,'room-existing',4),[5]);
});
test('only Tuesday 2–3, Thursday 5–6 and Friday 2–3 can be booked',()=>{
 const s=initial();assert.deepEqual(resourceRows(s,'innovation'),[2,5]);
 for(const [date,period] of [['2026-10-20',2],['2026-10-22',5],['2026-10-23',2]]){
  const b=booking({date,period});validateBooking(s,b,false,now);assert.deepEqual(bookingPeriods(s,b),[period,period+1]);
 }
 for(const [date,period] of [['2026-10-21',2],['2026-10-20',3],['2026-10-22',6],['2026-10-23',1],['2026-10-24',2]])assert.throws(()=>validateBooking(s,booking({date,period}),false,now),/מרכז החדשנות/);
 assert.equal(lessonLabel(s,'innovation',5),'שיעורים 5–6');
});
test('two-period bookings block both lessons and require a desired topic',()=>{
 const s=initial();s.bookings=[booking()];
 assert.equal(at(s,'innovation',now,2).length,1);assert.equal(at(s,'innovation',now,3).length,1);assert.equal(available(s,'innovation',now,3),0);
 assert.throws(()=>validateBooking(s,booking(),false,now),/אין מספיק/);
 for(const topic of ['',undefined,'   ','a'.repeat(201)])assert.throws(()=>validateBooking(initial(),booking({topic}),false,now),/נושא רצוי/);
});
test('innovation schedule is independent of general school periods',()=>{
 const s={...initial(),periods:[0,0,0,0,0,0,0]};
 validateBooking(s,booking({date:'2026-10-22',period:5}),false,now);
 s.bookings=[booking()];assert.doesNotThrow(()=>validateSettings(s,85,s.periods,now));
});
test('fixed innovation requests, overlap replacement and exceptions preserve both-period occupancy',()=>{
 const s=initial(),b=booking({recurring:true,until:'2026-11-03'});validateBookingBatch(s,[b],true,now);
 s.bookings=[b];const plan=replacementPlan(s,[{...b,date:'2026-10-27',until:'2026-10-27'}],now);
 assert.deepEqual(plan.conflicts[0].dates,['2026-10-27']);
 assert.equal(at(plan.state,'innovation','2026-10-27',3).length,0);
 assert.equal(at(plan.state,'innovation','2026-11-03',3).length,1);
});
test('server and browser domain rules are identical',()=>assert.equal(readFileSync(new URL('../functions/domain.js',import.meta.url),'utf8'),readFileSync(new URL('../public/domain.js',import.meta.url),'utf8')));
