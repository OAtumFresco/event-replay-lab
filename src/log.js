import { randomUUID } from 'node:crypto';

export function parseCursor(cursor) {
  if (typeof cursor !== 'string') return null;
  const match = /^([a-zA-Z0-9_-]{1,64}):(0|[1-9][0-9]*)$/.exec(cursor);
  if (!match || !Number.isSafeInteger(Number(match[2]))) return null;
  return {stream:match[1], sequence:Number(match[2])};
}

export function createEventLog({capacity = 20, stream = randomUUID()} = {}) {
  if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > 10_000) throw new RangeError('Invalid capacity');
  if (!parseCursor(`${stream}:0`)) throw new TypeError('Invalid stream identifier');
  let sequence = 0;
  let value = 0;
  const events = [];
  const listeners = new Set();
  const state = () => ({stream, sequence, value});
  function snapshot(reason) {
    return {event:'snapshot', id:`${stream}:${sequence}`, data:{...state(), reason}};
  }
  function resume(cursor) {
    if (!cursor) return [snapshot('initial')];
    const parsed = parseCursor(cursor);
    if (!parsed) return [snapshot('invalid-cursor')];
    if (parsed.stream !== stream) return [snapshot('stream-changed')];
    if (parsed.sequence > sequence) return [snapshot('cursor-ahead')];
    const firstAvailable = events[0]?.data.sequence ?? sequence + 1;
    if (parsed.sequence < firstAvailable - 1) return [snapshot('history-expired')];
    return events.filter(event => event.data.sequence > parsed.sequence).map(event => structuredClone(event));
  }
  return {
    state,
    resume,
    append(delta = 1) {
      if (!Number.isSafeInteger(delta) || delta < 1 || delta > 5) throw new RangeError('Delta must be an integer from 1 to 5');
      if (!Number.isSafeInteger(value + delta) || !Number.isSafeInteger(sequence + 1)) throw new RangeError('Counter capacity reached');
      value += delta; sequence++;
      const frame = Object.freeze({event:'increment', id:`${stream}:${sequence}`, data:Object.freeze({...state(),delta})});
      events.push(frame);
      if (events.length > capacity) events.shift();
      for (const listener of listeners) {
        try { if (listener(frame) === false) listeners.delete(listener); }
        catch { listeners.delete(listener); }
      }
      return state();
    },
    subscribe(cursor, listener) {
      // This synchronous block cannot interleave with an HTTP append in this process.
      for (const frame of resume(cursor)) if (listener(frame) === false) return () => {};
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    get listenerCount() { return listeners.size; },
    get retainedCount() { return events.length; },
  };
}
