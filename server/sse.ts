// 프로바이더의 SSE 스트림을 클라이언트용 이벤트로 변환하는 순수 함수들.
// 부수효과(Bun.serve, fetch)가 없어 단위 테스트가 가능하다.
import { stripCodeFences, ensureRenderCall } from './generator';

export interface Delta {
  text: string;
  error?: string;
}

// 클라이언트(src/utils/parseStreamEvents.ts)와 맞물린 NDJSON 이벤트 형식.
export type StreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'done'; code: string }
  | { type: 'error'; error: string };

const TRUNCATED_MESSAGE = '생성된 코드가 너무 길어 잘렸습니다. 더 간단한 컴포넌트를 요청해주세요.';
// 스트림이 시작된 뒤에는 HTTP 상태를 바꿀 수 없어, index.ts의 503/429 변환과 같은 문구를 여기서 쓴다.
const OVERLOADED_MESSAGE = 'API 서버가 일시적으로 과부하 상태입니다. 잠시 후 다시 시도해주세요.';
const RATE_LIMIT_MESSAGE = '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.';

function safeParse<T>(payload: string): T | null {
  try {
    return JSON.parse(payload) as T;
  } catch {
    return null;
  }
}

/**
 * 누적 버퍼(rest)에 새 청크를 이어 붙이고, 완성된 `data:` 라인의 페이로드를 꺼낸다.
 * 줄바꿈으로 끝나지 않은 마지막 조각은 rest로 돌려줘 다음 청크와 이어 처리한다.
 */
export function parseSseLines(
  rest: string,
  chunk: string,
): { payloads: string[]; rest: string } {
  const lines = (rest + chunk).split(/\r?\n/);
  const remaining = lines.pop() ?? '';
  const payloads = lines
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice('data:'.length).trim());
  return { payloads, rest: remaining };
}

export function extractAnthropicDelta(payload: string): Delta {
  const event = safeParse<{
    type?: string;
    delta?: { type?: string; text?: string; stop_reason?: string };
    error?: { type?: string; message?: string };
  }>(payload);
  if (!event) return { text: '' };

  if (event.type === 'error') {
    if (event.error?.type === 'overloaded_error') return { text: '', error: OVERLOADED_MESSAGE };
    if (event.error?.type === 'rate_limit_error') return { text: '', error: RATE_LIMIT_MESSAGE };
    return { text: '', error: event.error?.message ?? 'Claude API stream error' };
  }
  if (event.type === 'message_delta' && event.delta?.stop_reason === 'max_tokens') {
    return { text: '', error: TRUNCATED_MESSAGE };
  }
  if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
    return { text: event.delta.text ?? '' };
  }
  return { text: '' };
}

export function extractGoogleDelta(payload: string): Delta {
  const event = safeParse<{
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
      finishReason?: string;
    }>;
  }>(payload);
  if (!event) return { text: '' };

  const candidate = event.candidates?.[0];
  const text = candidate?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';

  if (candidate?.finishReason === 'MAX_TOKENS') {
    return { text, error: TRUNCATED_MESSAGE };
  }
  return { text };
}

/**
 * 프로바이더 SSE 바이트 스트림을 이벤트(delta* → done | error)로 변환한다.
 * done의 코드는 stripCodeFences/ensureRenderCall로 보정한다. 모델이 프롬프트를 어기기 때문이다.
 */
export async function* streamEvents(
  chunks: AsyncIterable<Uint8Array>,
  extract: (payload: string) => Delta,
): AsyncGenerator<StreamEvent> {
  const decoder = new TextDecoder();
  let rest = '';
  let full = '';

  // 마지막 라인이 개행 없이 끝나도 버리지 않도록 종료 시 빈 개행 청크를 한 번 더 처리한다.
  async function* withFlush() {
    for await (const chunk of chunks) yield decoder.decode(chunk, { stream: true });
    yield '\n';
  }

  for await (const text of withFlush()) {
    const parsed = parseSseLines(rest, text);
    rest = parsed.rest;

    for (const payload of parsed.payloads) {
      const delta = extract(payload);
      if (delta.text) {
        full += delta.text;
        yield { type: 'delta', text: delta.text };
      }
      if (delta.error) {
        yield { type: 'error', error: delta.error };
        return;
      }
    }
  }

  yield { type: 'done', code: ensureRenderCall(stripCodeFences(full)) };
}
