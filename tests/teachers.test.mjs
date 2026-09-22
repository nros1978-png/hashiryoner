import test from 'node:test';
import assert from 'node:assert/strict';
import {initial,changeTeacher,teacherNames,validateBooking} from '../public/domain.js';

const date='2026-09-22';

test('admin can add, sort and remove teacher names',()=>{
 let state=initial();
 state=changeTeacher(state,'addTeacher','  שרה   כהן  ',true);
 state=changeTeacher(state,'addTeacher','אבי לוי',true);
 assert.deepEqual(teacherNames(state),['אבי לוי','שרה כהן']);
 state=changeTeacher(state,'removeTeacher','אבי לוי',true);
 assert.deepEqual(teacherNames(state),['שרה כהן']);
});

test('teacher list changes require admin and reject duplicates',()=>{
 let state=changeTeacher(initial(),'addTeacher','שרה כהן',true);
 assert.throws(()=>changeTeacher(state,'addTeacher','שרה כהן',true));
 assert.throws(()=>changeTeacher(state,'removeTeacher','שרה כהן',false));
});

test('bookings must use a name from the configured teacher list',()=>{
 const state=changeTeacher(initial(),'addTeacher','שרה כהן',true);
 const booking={resource:'laptops',date,period:1,quantity:1,name:'שרה כהן',className:'ה׳2',recurring:false};
 validateBooking(state,booking,false,date);
 assert.throws(()=>validateBooking(state,{...booking,name:'שם חופשי'},false,date));
});
