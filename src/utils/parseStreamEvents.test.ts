import { describe, expect, it } from 'vitest';
import { parseStreamEvents } from './parseStreamEvents';

describe('parseStreamEvents', () => {
  it('완성된 라인을 이벤트로 파싱한다', () => {
    const { events, rest } = parseStreamEvents('', '{"type":"delta","text":"a"}\n{"type":"done","code":"x"}\n');
    expect(events).toEqual([
      { type: 'delta', text: 'a' },
      { type: 'done', code: 'x' },
    ]);
    expect(rest).toBe('');
  });

  it('개행으로 끝나지 않은 조각은 rest로 남기고 다음 청크와 이어 붙인다', () => {
    const first = parseStreamEvents('', '{"type":"delta","te');
    expect(first.events).toEqual([]);

    const second = parseStreamEvents(first.rest, 'xt":"a"}\n');
    expect(second.events).toEqual([{ type: 'delta', text: 'a' }]);
  });

  it('빈 줄은 무시한다', () => {
    const { events } = parseStreamEvents('', '\n{"type":"error","error":"e"}\n\n');
    expect(events).toEqual([{ type: 'error', error: 'e' }]);
  });
});
