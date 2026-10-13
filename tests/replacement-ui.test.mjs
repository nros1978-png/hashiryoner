import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as domain from '../public/domain.js';
import {replacementPlan} from '../public/replacement.js';
import {prepareFixedApproval} from '../public/fixed-approval.js';

// Exercise the real demo event/mutation path without a live Firebase account.
async function ui(answer){
 const elements=new Map(),dialogs=[],storage=new Map();
 const element=()=>({hidden:false,open:false,value:'',innerHTML:'',textContent:'',children:[],classList:{add(){},remove(){},toggle(){}},close(){this.open=false;}});
 const document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},querySelectorAll:()=>[],addEventListener(){},body:{append(){}},createElement(){
  const dialog=element();dialogs.push(dialog);let closed;
  dialog.addEventListener=(_,fn)=>{closed=fn;};dialog.remove=()=>{};
  dialog.showModal=()=>queueMicrotask(()=>{dialog.returnValue=answer;closed();});return dialog;
 }};
 const localStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)};
 const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
 const params={...domain,today:()=> '2026-10-12',replacementPlan,prepareFixedApproval,document,localStorage,window:{addEventListener(){}},crypto,setTimeout:()=>0,clearTimeout(){},confirm:()=>true};
 const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
 const app=await new AsyncFunction(...Object.keys(params),source+'\nreturn {mutate, setup(s){state=s;admin=true;},getState(){return state;}};')(...Object.values(params));
 return {app,dialogs};
}
const b={id:'existing',owner:'other',resource:'front',date:'2026-10-14',period:1,quantity:1,name:'מורה קיים',className:'ח',recurring:false,exceptions:[]};
test('UI previews impacted teacher and cancellation leaves everything unchanged and can be retried',async()=>{
 const {app,dialogs}=await ui('cancel'),state=domain.initial();state.bookings=[b];app.setup(state);
 const payload={bookings:[{...b,recurring:true,until:'2026-10-28',name:'מורה חדש'}]};
 await assert.rejects(app.mutate('bookBatch',payload),/לא שונה/);
 assert.deepEqual(app.getState(),state);assert.match(dialogs[0].innerHTML,/מורה קיים/);assert.match(dialogs[0].innerHTML,/אישור והחלפת/);
 await assert.rejects(app.mutate('bookBatch',payload),/לא שונה/);assert.equal(dialogs.length,2);
});
test('UI confirmed request replaces conflict and preserves request ownership',async()=>{
 const {app}=await ui('approve'),state=domain.initial();state.bookings=[b];
 state.fixedRequests=[{id:'request',owner:'teacher',status:'pending',bookings:[{...b,date:'2026-10-07',recurring:true,until:'2026-10-28',name:'מורה חדש'}]}];app.setup(state);
 await app.mutate('approveRequest',{id:'request'});
 const next=app.getState();assert.equal(next.bookings.length,1);assert.equal(next.bookings[0].owner,'teacher');assert.equal(next.bookings[0].date,'2026-10-14');assert.equal(next.fixedRequests[0].status,'approved');
});
