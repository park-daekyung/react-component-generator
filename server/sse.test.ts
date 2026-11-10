import { describe, expect, it } from 'vitest';
import {
  parseSseLines,
  extractAnthropicDelta,
  extractGoogleDelta,
  streamEvents,
  type StreamEvent,
} from './sse';

const encoder = new TextEncoder();

async function* chunksOf(...parts: string[]) {
  for (const part of parts) yield encoder.encode(part);
}

async function collect(gen: AsyncIterable<StreamEvent>) {
  const events: StreamEvent[] = [];
  for await (const event of gen) events.push(event);
  return events;
}

const googleLine = (text: string, finishReason?: string) =>
  `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text }] }, finishReason }] })}\n\n`;

describe('streamEvents', () => {
  it('delta를 순서대로 내보내고 마지막에 done을 낸다', async () => {
    const events = await collect(
      streamEvents(chunksOf(googleLine('const A = 1;'), googleLine(' render(<A />)')), extractGoogleDelta),
    );
    expect(events).toEqual([
      { type: 'delta', text: 'const A = 1;' },
      { type: 'delta', text: ' render(<A />)' },
      { type: 'done', code: 'const A = 1; render(<A />)' },
    ]);
  });

  it('done 코드는 코드펜스를 제거한다', async () => {
    const events = await collect(
      streamEvents(chunksOf(googleLine('```jsx\nrender(<A />)\n```')), extractGoogleDelta),
    );
    expect(events.at(-1)).toEqual({ type: 'done', code: 'render(<A />)' });
  });

  it('done 코드에 render 호출이 없으면 주입한다', async () => {
    const events = await collect(streamEvents(chunksOf(googleLine('const Card = () => null;')), extractGoogleDelta));
    expect(events.at(-1)).toEqual({ type: 'done', code: 'const Card = () => null;\n\nrender(<Card />);' });
  });

  it('라인 중간에서 끊긴 청크를 이어 붙여 처리한다', async () => {
    const line = googleLine('ab');
    const events = await collect(streamEvents(chunksOf(line.slice(0, 20), line.slice(20)), extractGoogleDelta));
    expect(events[0]).toEqual({ type: 'delta', text: 'ab' });
  });

  it('개행 없이 끝난 마지막 data 라인도 처리한다', async () => {
    const events = await collect(streamEvents(chunksOf(googleLine('a').trimEnd()), extractGoogleDelta));
    expect(events[0]).toEqual({ type: 'delta', text: 'a' });
  });

  it('에러 델타를 만나면 error를 내고 done 없이 끝난다', async () => {
    const events = await collect(
      streamEvents(chunksOf(googleLine('partial', 'MAX_TOKENS'), googleLine('never')), extractGoogleDelta),
    );
    expect(events.map((e) => e.type)).toEqual(['delta', 'error']);
  });

  it('JSON이 아닌 data 라인은 무시한다', async () => {
    const events = await collect(streamEvents(chunksOf('data: [DONE]\n\n', googleLine('a')), extractGoogleDelta));
    expect(events).toEqual([
      { type: 'delta', text: 'a' },
      { type: 'done', code: 'a' },
    ]);
  });
});

describe('extractAnthropicDelta 에러 변환', () => {
  it('overloaded_error는 503 한국어 메시지로 변환한다', () => {
    const payload = JSON.stringify({ type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } });
    expect(extractAnthropicDelta(payload).error).toContain('과부하');
  });

  it('rate_limit_error는 429 한국어 메시지로 변환한다', () => {
    const payload = JSON.stringify({ type: 'error', error: { type: 'rate_limit_error', message: 'slow down' } });
    expect(extractAnthropicDelta(payload).error).toContain('요청이 너무 많습니다');
  });

  it('stop_reason이 max_tokens면 잘림 에러를 반환한다', () => {
    const payload = JSON.stringify({ type: 'message_delta', delta: { stop_reason: 'max_tokens' } });
    expect(extractAnthropicDelta(payload).error).toContain('너무 길어');
  });
});

describe('parseSseLines', () => {
  it('완성된 data 라인의 JSON 페이로드를 추출한다', () => {
    const { payloads, rest } = parseSseLines('', 'data: {"a":1}\n\ndata: {"a":2}\n\n');
    expect(payloads).toEqual(['{"a":1}', '{"a":2}']);
    expect(rest).toBe('');
  });

  it('줄바꿈으로 끝나지 않은 마지막 조각은 rest로 남긴다', () => {
    const { payloads, rest } = parseSseLines('', 'data: {"a":1}\n\ndata: {"a"');
    expect(payloads).toEqual(['{"a":1}']);
    expect(rest).toBe('data: {"a"');
  });

  it('이전 청크의 rest와 이어 붙여 처리한다', () => {
    const { payloads } = parseSseLines('data: {"a"', ':1}\n\n');
    expect(payloads).toEqual(['{"a":1}']);
  });

  it('data가 아닌 라인(event:, 주석)은 무시한다', () => {
    const { payloads } = parseSseLines('', 'event: content_block_delta\ndata: {"a":1}\n\n: ping\n\n');
    expect(payloads).toEqual(['{"a":1}']);
  });

  it('CRLF 줄바꿈도 처리한다', () => {
    const { payloads } = parseSseLines('', 'data: {"a":1}\r\n\r\n');
    expect(payloads).toEqual(['{"a":1}']);
  });
});

describe('extractAnthropicDelta', () => {
  it('content_block_delta의 text_delta 텍스트를 반환한다', () => {
    const payload = JSON.stringify({
      type: 'content_block_delta',
      delta: { type: 'text_delta', text: 'const A' },
    });
    expect(extractAnthropicDelta(payload)).toEqual({ text: 'const A' });
  });

  it('텍스트가 없는 이벤트는 빈 텍스트를 반환한다', () => {
    expect(extractAnthropicDelta(JSON.stringify({ type: 'message_start' }))).toEqual({ text: '' });
  });

  it('error 이벤트는 error 메시지를 반환한다', () => {
    const payload = JSON.stringify({ type: 'error', error: { message: 'Overloaded' } });
    expect(extractAnthropicDelta(payload)).toEqual({ text: '', error: 'Overloaded' });
  });
});

describe('extractGoogleDelta', () => {
  it('candidates의 parts 텍스트를 이어 붙여 반환한다', () => {
    const payload = JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'ab' }, { text: 'cd' }] } }],
    });
    expect(extractGoogleDelta(payload)).toEqual({ text: 'abcd' });
  });

  it('finishReason이 MAX_TOKENS면 잘림 에러를 반환한다', () => {
    const payload = JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'x' }] }, finishReason: 'MAX_TOKENS' }],
    });
    expect(extractGoogleDelta(payload).error).toContain('너무 길어');
  });

  it('candidates가 없으면 빈 텍스트를 반환한다', () => {
    expect(extractGoogleDelta('{}')).toEqual({ text: '' });
  });
});
