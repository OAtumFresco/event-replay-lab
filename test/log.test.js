import test from 'node:test';
import assert from 'node:assert/strict';
import { createEventLog } from '../src/log.js';

test('replay contains only missing events, in order, including the retention boundary', () => {
  const log = createEventLog({capacity:3,stream:'session'});
  for (let i=0;i<5;i++) log.append();
  assert.equal(log.retainedCount,3);
  assert.deepEqual(log.resume('session:2').map(f=>f.id),['session:3','session:4','session:5']);
  assert.deepEqual(log.resume('session:4').map(f=>f.id),['session:5']);
  assert.deepEqual(log.resume('session:5'),[]);
  assert.equal(log.resume('session:1')[0].data.reason,'history-expired');
});

test('initial, malformed, previous-generation and future cursors receive explicit snapshots', () => {
  const log = createEventLog({stream:'new-stream'}); log.append();
  for (const [cursor, reason] of [[null,'initial'],['broken','invalid-cursor'],['new-stream:01','invalid-cursor'],['new-stream:999999999999999999','invalid-cursor'],['old-stream:1','stream-changed'],['new-stream:2','cursor-ahead']]) {
    const [frame] = log.resume(cursor);
    assert.equal(frame.event,'snapshot'); assert.equal(frame.data.reason,reason);
    assert.equal(frame.data.value,1); assert.equal(frame.id,'new-stream:1');
  }
});

test('subscription moves from replay to live events and releases resources on unsubscribe', () => {
  const log = createEventLog({stream:'session'}); log.append();
  const received=[]; const unsubscribe=log.subscribe('session:0',frame=>received.push(frame.id));
  log.append(); assert.deepEqual(received,['session:1','session:2']);
  assert.equal(log.listenerCount,1); unsubscribe(); unsubscribe();
  log.append(); assert.equal(received.length,2); assert.equal(log.listenerCount,0);
});

test('a failed consumer cannot stop other consumers or mutate retained history', () => {
  const log = createEventLog({stream:'session'}); const received=[];
  log.subscribe('session:0',()=>{throw new Error('Disconnected');});
  log.subscribe('session:0',frame=>received.push(frame.id));
  log.append(); assert.deepEqual(received,['session:1']); assert.equal(log.listenerCount,1);
  const copy = log.resume('session:0'); copy[0].data.value=999;
  assert.equal(log.resume('session:0')[0].data.value,1);
});

test('invalid writes do not advance the sequence', () => {
  const log=createEventLog();
  for (const delta of [-1,0,1.5,6,Infinity,'1']) assert.throws(()=>log.append(delta),RangeError);
  assert.equal(log.state().sequence,0);
});
