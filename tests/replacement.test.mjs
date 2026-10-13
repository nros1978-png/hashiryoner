import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {replacementPlan} from '../functions/replacement.js';
import {initial,occurs} from '../functions/domain.js';
const now='2026-10-12',b=(extra={})=>({id:'old',owner:'other',resource:'front',date:'2026-10-14',period:1,quantity:1,name:'מורה',className:'ח',recurring:true,until:'2026-10-28',exceptions:[],...extra});
test('only same-resource same-period matching dates are replaced; original state remains unchanged',()=>{
 const s=initial();s.bookings=[b({recurring:false}),b({id:'room',resource:'back'}),b({id:'period',period:2}),b({id:'future',date:'2026-11-04',until:'2026-11-25'})];
 const before=structuredClone(s),plan=replacementPlan(s,[b()],now);
 assert.equal(plan.conflicts.length,1);assert.deepEqual(plan.conflicts[0].dates,['2026-10-14']);
 assert.deepEqual(s,before);assert.deepEqual(plan.state.bookings.map(x=>x.id),['room','period','future']);
});
test('recurring exceptions preserve non-overlapping future and past dates and existing exceptions',()=>{
 const s=initial();s.bookings=[b({date:'2026-10-07',until:'2027-06-30',exceptions:['2026-10-21']})];
 const plan=replacementPlan(s,[b()],now),old=plan.state.bookings[0];
 assert.deepEqual(plan.conflicts[0].dates,['2026-10-14','2026-10-28']);
 assert.deepEqual(old.exceptions,['2026-10-14','2026-10-21','2026-10-28']);
 assert.equal(occurs(old,'2026-10-07'),true);assert.equal(occurs(old,'2026-11-04'),true);
});
test('laptops preserve existing reservations when capacity is sufficient, including exact fit',()=>{
 const s=initial();s.bookings=[b({id:'one',resource:'laptops',quantity:10,recurring:false}),b({id:'two',resource:'laptops',quantity:5,recurring:false})];
 const plan=replacementPlan(s,[b({resource:'laptops',quantity:3})],now);
 assert.equal(plan.conflicts.length,0);assert.deepEqual(plan.state.bookings,s.bookings);
 const exact=replacementPlan(s,[b({resource:'laptops',quantity:70})],now);
 assert.equal(exact.conflicts.length,0);assert.equal(exact.state.bookings.length,2);
});
test('laptop shortage replaces reservations only on shortage dates',()=>{
 const s=initial();s.bookings=[b({id:'series',resource:'laptops',quantity:40}),b({id:'full',resource:'laptops',quantity:40,recurring:false})];
 const plan=replacementPlan(s,[b({resource:'laptops',quantity:10})],now);
 assert.equal(plan.conflicts.length,2);assert.deepEqual(plan.conflicts.map(c=>c.dates),[['2026-10-14'],['2026-10-14']]);
 assert.equal(plan.state.bookings.length,1);assert.deepEqual(plan.state.bookings[0].exceptions,['2026-10-14']);
 assert.equal(occurs(plan.state.bookings[0],'2026-10-21'),true);
});
test('combined new laptop demand is used when detecting shortages',()=>{
 const s=initial();s.bookings=[b({resource:'laptops',quantity:40})];
 const plan=replacementPlan(s,[b({resource:'laptops',quantity:25}),b({resource:'laptops',quantity:25})],now);
 assert.equal(plan.conflicts.length,1);assert.equal(plan.conflicts[0].dates.length,3);
});
test('invalid or internally overlapping new batches never produce a replacement plan',()=>{
 for(const bookings of [[],[b(),b()],[b({date:'bad'})],[b({resource:'unknown'})],[b({resource:'laptops',quantity:100})]])assert.throws(()=>replacementPlan(initial(),bookings,now));
});
test('browser and server plan helpers remain identical',()=>{
 for(const file of ['replacement.js','fixed-approval.js'])assert.equal(readFileSync(new URL('../functions/'+file,import.meta.url),'utf8'),readFileSync(new URL('../public/'+file,import.meta.url),'utf8'));
});
