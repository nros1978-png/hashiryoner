import {dates,occurs,available,bookingPeriods,validateBookingBatch} from './domain.js?v=15';

// Validate new bookings before expanding dates, then remove only matching occurrences.
export function replacementPlan(state,bookings,now){
 validateBookingBatch({...state,bookings:[]},bookings,true,now);
 const slots=new Map(),laptopDemand=new Map();
 for(const b of bookings)for(const period of bookingPeriods(state,b)){
  const key=JSON.stringify([b.resource,period]);
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
  const candidates=new Set(bookingPeriods(state,b).flatMap(p=>[...(slots.get(JSON.stringify([b.resource,p]))||[])]));
  const matching=[...candidates].filter(d=>occurs(b,d)&&(b.resource!=='laptops'||available(state,'laptops',d,b.period)<laptopDemand.get(JSON.stringify([d,b.period])))).sort();
  if(!matching.length){remaining.push(b);continue;}
  const periods=bookingPeriods(state,b).filter(p=>matching.some(d=>slots.get(JSON.stringify([b.resource,p]))?.has(d)));
  conflicts.push({booking:{...b},dates:matching,periods});
  if(b.recurring)remaining.push({...b,exceptions:[...new Set([...(b.exceptions||[]),...matching])].sort()});
  // If an old two-lesson visit is only partly replaced, retain its other lesson.
  if(bookingPeriods(state,b).length>1)for(const date of matching)for(const period of bookingPeriods(state,b)){
   if(!slots.get(JSON.stringify([b.resource,period]))?.has(date))remaining.push({...b,id:b.id+'-retained-'+date+'-'+period,date,period,innovationSingle:true,recurring:false,until:null,exceptions:[]});
  }
 }
 const next={...state,bookings:remaining};
 validateBookingBatch(next,bookings,true,now);
 return {state:next,conflicts};
}

