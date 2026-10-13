import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareFixedApproval} from '../functions/fixed-approval.js';
import {initial,weekday,validateBookingBatch} from '../functions/domain.js';
const now='2026-10-12';
const booking=(extra={})=>({resource:'back',date:'2026-10-07',period:6,quantity:1,name:'מורה',className:'ח',recurring:true,until:'2027-06-30',exceptions:[],...extra});
test('old request advances by whole weeks and retains weekday, end and original request',()=>{
 const original=booking(),[next]=prepareFixedApproval([original],now);
 assert.equal(next.date,'2026-10-14');assert.equal(weekday(next.date),weekday(original.date));
 assert.equal(next.until,'2027-06-30');assert.equal(original.date,'2026-10-07');
 validateBookingBatch(initial(),[next],true,now);
 assert.equal(prepareFixedApproval([booking({date:'2026-09-23'})],now)[0].date,'2026-10-14');
});
test('today and future dates are not moved',()=>{
 for(const date of [now,'2026-10-14'])assert.equal(prepareFixedApproval([booking({date})],now)[0].date,date);
 assert.equal(prepareFixedApproval([booking({date:'2026-10-05'})],now)[0].date,now);
});
test('all remaining dates and other batch entries are checked for conflicts',()=>{
 const s=initial(),next=prepareFixedApproval([booking()],now);
 s.bookings.push(booking({date:'2026-10-07',recurring:false}));
 validateBookingBatch(s,next,true,now); // Past conflict does not block future approval.
 s.bookings.push(booking({date:'2027-06-23',recurring:false}));
 assert.throws(()=>validateBookingBatch(s,next,true,now),/2027-06-23/);
 assert.throws(()=>validateBookingBatch(initial(),prepareFixedApproval([booking(),booking()],now),true,now));
});
test('expired and invalid requests remain blocked, including partly expired batches',()=>{
 for(const extra of [{until:'2026-10-08'},{date:'bad'},{until:'bad'},{until:'2026-09-01'},{date:'2025-09-01',until:'2027-06-30'}])assert.throws(()=>prepareFixedApproval([booking(extra)],now));
 assert.throws(()=>prepareFixedApproval([booking(),booking({until:'2026-10-08'})],now),/לא נותרו/);
 assert.equal(prepareFixedApproval([booking({until:'2026-10-14'})],now)[0].date,'2026-10-14');
});
