import {dates,occurs,validateBookingBatch} from './domain.js';

// Validate new bookings before expanding dates, then remove only matching occurrences.
export function replacementPlan(state,bookings,now){
 validateBookingBatch({...state,bookings:[]},bookings,true,now);
 const slots=new Map();
 for(const b of bookings){
  const key=JSON.stringify([b.resource,b.period]);
  if(!slots.has(key))slots.set(key,new Set());
  for(const date of dates(b))slots.get(key).add(date);
 }
 const conflicts=[],remaining=[];
 for(const b of state.bookings){
  const matching=[...(slots.get(JSON.stringify([b.resource,b.period]))||[])].filter(d=>occurs(b,d)).sort();
  if(!matching.length){remaining.push(b);continue;}
  conflicts.push({booking:{...b},dates:matching});
  if(b.recurring)remaining.push({...b,exceptions:[...new Set([...(b.exceptions||[]),...matching])].sort()});
 }
 const next={...state,bookings:remaining};
 validateBookingBatch(next,bookings,true,now);
 return {state:next,conflicts};
}

