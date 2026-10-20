import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initial,roomList,activeResources,bookablePeriods,resourceRows,bookingPeriods,validateBooking,validateBookingBatch,validateSettings,at,available,lessonLabel,changeRoom} from '../functions/domain.js';
import {replacementPlan} from '../functions/replacement.js';
const now='2026-10-20',booking=(extra={})=>({id:'visit',resource:'innovation',date:now,period:2,quantity:1,name:'מורה',className:'ז',topic:'רובוטיקה',innovationSingle:true,recurring:false,exceptions:[],...extra});
test('innovation appears once in existing custom room configurations and remains removable',()=>{
 const s={...initial(),rooms:[{id:'front',name:'קדמי',active:true}]};
 assert.equal(activeResources(s).filter(([id])=>id==='innovation').length,1);
 const removed=changeRoom(s,'removeRoom',{id:'innovation'},true,now);
 assert.equal(activeResources(removed).some(([id])=>id==='innovation'),false);
 const alias={...s,rooms:[{id:'room-existing',name:'מרכז חדשנות',active:true}]};
 assert.equal(roomList(alias).length,1);assert.deepEqual(bookablePeriods(alias,'room-existing',4),[5,6]);
});
test('Tuesday and Thursday lessons are separately bookable; Friday is coordination-only',()=>{
 const s=initial();assert.deepEqual(resourceRows(s,'innovation'),[2,3,5,6]);
 for(const [date,period] of [['2026-10-20',2],['2026-10-20',3],['2026-10-22',5],['2026-10-22',6]]){
  const b=booking({date,period});validateBooking(s,b,false,now);assert.deepEqual(bookingPeriods(s,b),[period]);
 }
 for(const [date,period] of [['2026-10-21',2],['2026-10-20',4],['2026-10-22',4],['2026-10-23',2],['2026-10-23',1],['2026-10-24',2]])assert.throws(()=>validateBooking(s,booking({date,period}),false,now),/מרכז החדשנות/);
 assert.equal(lessonLabel(s,'innovation',5),'שיעור 5');
});
test('single lesson leaves the next lesson free and still requires a desired topic',()=>{
 const s=initial();s.bookings=[booking()];
 assert.equal(at(s,'innovation',now,2).length,1);assert.equal(at(s,'innovation',now,3).length,0);assert.equal(available(s,'innovation',now,3),1);
 assert.throws(()=>validateBooking(s,booking(),false,now),/אין מספיק/);
 for(const topic of ['',undefined,'   ','a'.repeat(201)])assert.throws(()=>validateBooking(initial(),booking({topic}),false,now),/נושא רצוי/);
});
test('innovation schedule is independent of general school periods',()=>{
 const s={...initial(),periods:[0,0,0,0,0,0,0]};
 validateBooking(s,booking({date:'2026-10-22',period:5}),false,now);
 s.bookings=[booking()];assert.doesNotThrow(()=>validateSettings(s,85,s.periods,now));
});
test('fixed innovation visits retain independent lessons and exceptions',()=>{
 const s=initial(),b=booking({recurring:true,until:'2026-11-03'});validateBookingBatch(s,[b],true,now);
 s.bookings=[b];const plan=replacementPlan(s,[{...b,date:'2026-10-27',until:'2026-10-27'}],now);
 assert.deepEqual(plan.conflicts[0].dates,['2026-10-27']);
 assert.equal(at(plan.state,'innovation','2026-10-27',3).length,0);
 assert.equal(at(plan.state,'innovation','2026-11-03',2).length,1);
});
test('server and browser domain rules are identical',()=>assert.equal(readFileSync(new URL('../functions/domain.js',import.meta.url),'utf8'),readFileSync(new URL('../public/domain.js',import.meta.url),'utf8')));
test('separate lessons can coexist; legacy paired bookings still occupy both lessons',()=>{
 const s=initial();validateBookingBatch(s,[booking(),booking({period:3})],false,now);
 s.bookings=[booking({innovationSingle:false})];assert.equal(at(s,'innovation',now,3).length,1);
 assert.throws(()=>validateBooking(s,booking({period:3}),false,now));
 const plan=replacementPlan(s,[booking()],now);
 assert.equal(at(plan.state,'innovation',now,3).length,1);assert.equal(at(plan.state,'innovation',now,2).length,0);
 assert.equal(plan.state.bookings[0].innovationSingle,true);
});
test('partly replacing a legacy fixed pair preserves the untouched hour on affected dates',()=>{
 const s=initial();s.bookings=[booking({innovationSingle:false,recurring:true,until:'2026-11-03'})];
 const plan=replacementPlan(s,[booking({period:3,recurring:true,until:'2026-10-27'})],now);
 assert.equal(at(plan.state,'innovation',now,2).length,1);assert.equal(at(plan.state,'innovation',now,3).length,0);
 assert.equal(at(plan.state,'innovation','2026-11-03',3).length,1);
});
