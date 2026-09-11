import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter, once } from 'node:events';
import { createLabServer } from '../src/server.js';
import { createEventLog } from '../src/log.js';
import { attachSse } from '../src/sse.js';

async function start(t,options={}) {
  const {server,log}=createLabServer(options);
  server.listen(0,'127.0.0.1'); await once(server,'listening');
  t.after(async()=>{const closed=new Promise(resolve=>server.close(resolve));server.closeAllConnections();await closed;});
  return {log,url:`http://127.0.0.1:${server.address().port}`};
}

async function openStream(t,url,headers={}) {
  const abort=new AbortController(); t.after(()=>abort.abort());
  const response=await fetch(url,{headers,signal:abort.signal});
  assert.equal(response.status,200); assert.match(response.headers.get('content-type'),/text\/event-stream/);
  const reader=response.body.getReader(); const decoder=new TextDecoder(); let buffer='';
  return {abort,async next() {
    // Tests have a deadline so a missing frame is a failure, never a hung suite.
    const deadline=setTimeout(()=>abort.abort(new Error('Timed out waiting for an SSE frame')),2000);
    try {
      while (true) {
        const boundary=buffer.indexOf('\n\n');
        if (boundary>=0) {
          const block=buffer.slice(0,boundary); buffer=buffer.slice(boundary+2);
          const data=block.match(/^data: (.+)$/m);
          if (!data) continue;
          return {event:block.match(/^event: (.+)$/m)[1],id:block.match(/^id: (.+)$/m)[1],data:JSON.parse(data[1])};
        }
        const {value,done}=await reader.read(); if(done) throw new Error('Stream closed before the next frame');
        buffer+=decoder.decode(value,{stream:true});
      }
    } finally {clearTimeout(deadline);}
  }};
}

test('HTTP reconnect respects Last-Event-ID over an older query cursor and continues live',async t=>{
  const {url,log}=await start(t,{log:createEventLog({stream:'session'})});
  for(let i=0;i<3;i++) log.append();
  const stream=await openStream(t,url+'/events?cursor=session%3A0',{'Last-Event-ID':'session:2'});
  assert.equal((await stream.next()).id,'session:3');
  const response=await fetch(url+'/api/increment',{method:'POST',headers:{'X-Lab-Action':'increment'}});
  assert.equal(response.status,201); assert.equal((await stream.next()).id,'session:4');
});

test('HTTP reconnect outside the retained window receives one snapshot then live events',async t=>{
  const {url,log}=await start(t,{log:createEventLog({stream:'session',capacity:2})});
  for(let i=0;i<5;i++) log.append();
  const stream=await openStream(t,url+'/events?cursor=session%3A0');
  const snapshot=await stream.next(); assert.equal(snapshot.event,'snapshot');
  assert.equal(snapshot.data.reason,'history-expired'); assert.equal(snapshot.data.value,5);
  log.append(); assert.equal((await stream.next()).id,'session:6');
});

test('connection caps and write origin checks reject excess work',async t=>{
  const {url}=await start(t,{maxClients:1});
  const first=await openStream(t,url+'/events'); await first.next();
  assert.equal((await fetch(url+'/events')).status,503);
  assert.equal((await fetch(url+'/api/increment',{method:'POST'})).status,400);
  assert.equal((await fetch(url+'/api/increment',{method:'POST',headers:{'X-Lab-Action':'increment',Origin:'https://unrelated.example'}})).status,403);
  assert.equal((await fetch(url+'/.env')).status,404);
});

test('backpressure disconnects a slow consumer and releases its subscription',()=>{
  const log=createEventLog();
  const response=new EventEmitter(); let writable=true; let destroyed=false;
  response.writeHead=()=>{};
  response.write=()=>writable;
  response.destroy=()=>{destroyed=true;response.emit('close');};
  attachSse(response,log,null);
  assert.equal(log.listenerCount,1);
  writable=false; log.append();
  assert.equal(destroyed,true); assert.equal(log.listenerCount,0);
});

test('a normal socket close releases the listener; cleanup is idempotent',()=>{
  const log=createEventLog(); const response=new EventEmitter();
  response.writeHead=()=>{};response.write=()=>true;response.destroy=()=>{};
  const cleanup=attachSse(response,log,null); assert.equal(log.listenerCount,1);
  response.emit('close'); cleanup(); assert.equal(log.listenerCount,0);
});
