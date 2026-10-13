import {dates,occurs,available,validateBookingBatch} from './domain.js';

// Validate new bookings before expanding dates, then remove only matching occurrences.
export function replacementPlan(state,bookings,now){
 validateBookingBatch({...state,bookings:[]},bookings,true,now);
 const slots=new Map(),laptopDemand=new Map();
 for(const b of bookings){
  const key=JSON.stringify([b.resource,b.period]);
  if(!slots.has(key))slots.set(key,new Set());
  for(const date of dates(b)){
   slots.get(key).add(date);
   if(b.resource==='laptops'){
    const demandKey=JSON.stringify([date,b.period]);
    laptopDemand.set(demandKey,(laptopDemand.get(demandKey)||0)+b.quantity);
   }
  }
 }
 const conflicts=[],remaining=[];
 for(const b of state.bookings){
  const matching=[...(slots.get(JSON.stringify([b.resource,b.period]))||[])].filter(d=>occurs(b,d)&&(b.resource!=='laptops'||available(state,'laptops',d,b.period)<laptopDemand.get(JSON.stringify([d,b.period])))).sort();
  if(!matching.length){remaining.push(b);continue;}
  conflicts.push({booking:{...b},dates:matching});
  if(b.recurring)remaining.push({...b,exceptions:[...new Set([...(b.exceptions||[]),...matching])].sort()});
 }
 const next={...state,bookings:remaining};
 validateBookingBatch(next,bookings,true,now);
 return {state:next,conflicts};
}

