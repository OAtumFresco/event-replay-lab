export class ResyncRequired extends Error {}

export function applyFrame(state, frame) {
  const data = frame?.data;
  if (!data || typeof data.stream !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(data.stream)
      || !Number.isSafeInteger(data.sequence) || data.sequence < 0
      || !Number.isSafeInteger(data.value) || data.value < 0
      || frame.id !== `${data.stream}:${data.sequence}`) throw new ResyncRequired('Invalid event');
  if (frame.event === 'snapshot') {
    if (state && state.stream === data.stream && data.sequence < state.sequence) throw new ResyncRequired('Stale snapshot');
    return {stream:data.stream, sequence:data.sequence, value:data.value};
  }
  if (frame.event !== 'increment' || !state || state.stream !== data.stream) throw new ResyncRequired('Snapshot required');
  if (data.sequence <= state.sequence) return state;
  if (data.sequence !== state.sequence + 1 || !Number.isSafeInteger(data.delta) || data.delta < 1 || data.delta > 5
      || state.value + data.delta !== data.value) throw new ResyncRequired('Event gap or inconsistent value');
  return {stream:data.stream, sequence:data.sequence, value:data.value};
}

export const cursorFor = state => state ? `${state.stream}:${state.sequence}` : null;
