import { applyFrame, cursorFor } from './model.js';
const $ = id => document.getElementById(id);
let state = null;
let source = null;
let received = 0;
const status = message => { $('status').textContent = message; };

function showServer(data) {
  $('server-value').textContent = data.value;
  $('server-sequence').textContent = `Sequence ${data.sequence} · stream ${data.stream.slice(0,8)}`;
}
async function refreshServer() {
  try {
    const response = await fetch('/api/state',{signal:AbortSignal.timeout(5000)});
    if (!response.ok) throw new Error();
    showServer(await response.json());
  } catch { status('Server unavailable. The subscriber will reconnect when it returns.'); }
}
function receive(event) {
  if (event.target !== source) return;
  try {
    const frame = {event:event.type,id:event.lastEventId,data:JSON.parse(event.data)};
    const next = applyFrame(state,frame);
    if (next === state) return;
    state = next; received++;
    $('client-value').textContent = state.value;
    $('client-sequence').textContent = `Applied through sequence ${state.sequence}`;
    $('cursor').textContent = `Cursor ${cursorFor(state)}`;
    $('frame-count').textContent = received;
    const row = document.createElement('li');
    row.textContent = frame.event === 'snapshot' ? `Snapshot at ${state.sequence} · ${frame.data.reason}` : `Event ${state.sequence} · +${frame.data.delta} → ${state.value}`;
    $('frames').prepend(row);
    while ($('frames').children.length > 30) $('frames').lastElementChild.remove();
    status(frame.event === 'snapshot' ? `State recovered from a snapshot (${frame.data.reason}).` : `Applied event ${state.sequence}.`);
    showServer(state);
  } catch {
    status('A gap or invalid event was detected. Requesting a fresh snapshot.');
    connect(true);
  }
}
function connect(fresh = false) {
  source?.close();
  const cursor = fresh ? null : cursorFor(state);
  source = new EventSource('/events'+(cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''));
  source.addEventListener('snapshot',receive);
  source.addEventListener('increment',receive);
  source.onopen = () => { status('Connected. Waiting for the next event.'); };
  source.onerror = () => { status('Connection interrupted. Retrying with the last received event ID.'); };
  $('connection').textContent = 'Disconnect subscriber';
  refreshServer();
}
$('connection').addEventListener('click',() => {
  if (source) {
    source.close(); source = null;
    $('connection').textContent = 'Reconnect subscriber';
    status('Subscriber disconnected. Server actions still work.');
  } else connect();
});
async function increment(count) {
  $('increment').disabled = true; $('overflow').disabled = true;
  let completed = 0;
  try {
    for (; completed < count; completed++) {
      const response = await fetch('/api/increment',{method:'POST',headers:{'X-Lab-Action':'increment'},signal:AbortSignal.timeout(5000)});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      showServer(await response.json());
    }
    if (!source) status(`Added ${completed} event(s). Reconnect the subscriber to recover.`);
  } catch {
    status(`Confirmed ${completed} action(s). The last request has an unknown outcome; it was not retried.`);
    await refreshServer();
  } finally { $('increment').disabled = false; $('overflow').disabled = false; }
}
$('increment').addEventListener('click',() => increment(1));
$('overflow').addEventListener('click',() => increment(25));
connect();
