// /api/generate가 보내는 NDJSON 스트림 이벤트. server/index.ts의 StreamEvent와 맞물려 있다.
export type StreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'done'; code: string }
  | { type: 'error'; error: string };

/** 누적 버퍼(rest)에 새 청크를 이어 붙이고, 완성된 라인을 이벤트로 파싱한다. */
export function parseStreamEvents(
  rest: string,
  chunk: string,
): { events: StreamEvent[]; rest: string } {
  const lines = (rest + chunk).split('\n');
  const remaining = lines.pop() ?? '';
  const events = lines
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line) as StreamEvent);
  return { events, rest: remaining };
}
