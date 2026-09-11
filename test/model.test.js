import test from 'node:test';
import assert from 'node:assert/strict';
import { createEventLog } from '../src/log.js';
import { applyFrame, cursorFor, ResyncRequired } from '../public/model.js';

test('duplicate frames do not apply an increment twice', () => {
  const log=createEventLog({stream:'session'});
  let state=applyFrame(null,log.resume(null)[0]); log.append();
  const [frame]=log.resume(cursorFor(state));
  state=applyFrame(state,frame);
  assert.equal(applyFrame(state,frame),state); assert.equal(state.value,1);
});

test('gaps and inconsistent totals request recovery instead of guessing', () => {
  const log=createEventLog({stream:'session'}); const state=applyFrame(null,log.resume(null)[0]);
  log.append(); log.append(); const [first,second]=log.resume(cursorFor(state));
  assert.throws(()=>applyFrame(state,second),ResyncRequired);
  assert.throws(()=>applyFrame(state,{...first,data:{...first.data,value:999}}),ResyncRequired);
  assert.throws(()=>applyFrame(null,first),ResyncRequired);
});

test('expired history and a server restart converge through snapshot replacement', () => {
  const log=createEventLog({capacity:2,stream:'before'}); let state=applyFrame(null,log.resume(null)[0]);
  for (let i=0;i<5;i++) log.append();
  state=applyFrame(state,log.resume(cursorFor(state))[0]); assert.equal(state.value,5);
  const restarted=createEventLog({stream:'after'});
  state=applyFrame(state,restarted.resume(cursorFor(state))[0]);
  assert.equal(state.value,0); assert.equal(state.stream,'after');
});

test('invalid IDs, missing stream IDs and stale snapshots are not accepted', () => {
  const log=createEventLog({stream:'session'}); const original=log.resume(null)[0];
  log.append(); const state=applyFrame(null,log.resume(null)[0]);
  assert.throws(()=>applyFrame(state,original),ResyncRequired);
  assert.throws(()=>applyFrame(null,{...original,id:'other:0'}),ResyncRequired);
  assert.throws(()=>applyFrame(null,{event:'snapshot',id:'undefined:0',data:{sequence:0,value:0}}),ResyncRequired);
});
