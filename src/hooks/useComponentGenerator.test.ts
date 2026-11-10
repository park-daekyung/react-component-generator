import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useComponentGenerator } from './useComponentGenerator';
import { doneResponse, ndjsonResponse } from '../test/streamMock';

const STORAGE_KEY = 'rcg:components';

function mockGenerateOnce(code: string) {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => doneResponse(code)));
}

describe('useComponentGenerator 영속화', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('생성한 컴포넌트가 재마운트 후에도 복원된다', async () => {
    mockGenerateOnce('render(<A />)');
    const first = renderHook(() => useComponentGenerator());
    await act(() => first.result.current.generate('카드', undefined, 'google'));
    first.unmount();

    const second = renderHook(() => useComponentGenerator());
    expect(second.result.current.components).toHaveLength(1);
    expect(second.result.current.components[0].prompt).toBe('카드');
    expect(second.result.current.components[0].code).toBe('render(<A />)');
  });

  it('복원된 컴포넌트의 createdAt은 Date 객체다', async () => {
    mockGenerateOnce('render(<A />)');
    const first = renderHook(() => useComponentGenerator());
    await act(() => first.result.current.generate('카드', undefined, 'google'));
    first.unmount();

    const second = renderHook(() => useComponentGenerator());
    expect(second.result.current.components[0].createdAt).toBeInstanceOf(Date);
  });

  it('삭제한 컴포넌트는 재마운트 후 복원되지 않는다', async () => {
    mockGenerateOnce('render(<A />)');
    const first = renderHook(() => useComponentGenerator());
    await act(() => first.result.current.generate('카드', undefined, 'google'));
    act(() => first.result.current.removeComponent(first.result.current.components[0].id));
    first.unmount();

    const second = renderHook(() => useComponentGenerator());
    expect(second.result.current.components).toHaveLength(0);
  });

  it('형식이 잘못된 저장 항목은 무시한다', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { id: '1', prompt: 'ok', code: 'c', createdAt: '2026-01-01T00:00:00.000Z' },
        { id: 2, prompt: 'bad' },
        'garbage',
      ]),
    );
    const { result } = renderHook(() => useComponentGenerator());
    expect(result.current.components.map((c) => c.id)).toEqual(['1']);
  });
});

describe('useComponentGenerator 스트리밍', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('delta 이벤트가 오면 streaming.code에 누적된다', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const encoder = new TextEncoder();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        body: new ReadableStream<Uint8Array>({
          async start(controller) {
            controller.enqueue(encoder.encode('{"type":"delta","text":"const A"}\n'));
            await gate;
            controller.enqueue(encoder.encode('{"type":"done","code":"const A = 1"}\n'));
            controller.close();
          },
        }),
      }),
    );

    const { result } = renderHook(() => useComponentGenerator());
    let promise!: Promise<void>;
    act(() => {
      promise = result.current.generate('카드', undefined, 'google');
    });

    await vi.waitFor(() => expect(result.current.streaming?.code).toBe('const A'));
    expect(result.current.streaming?.prompt).toBe('카드');

    release();
    await act(() => promise);
  });

  it('done 이벤트가 오면 최종 코드로 컴포넌트를 추가하고 streaming을 비운다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () =>
        ndjsonResponse([
          { type: 'delta', text: 'raw' },
          { type: 'done', code: 'final code' },
        ]),
      ),
    );

    const { result } = renderHook(() => useComponentGenerator());
    await act(() => result.current.generate('카드', undefined, 'google'));

    expect(result.current.components[0].code).toBe('final code');
    expect(result.current.streaming).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('error 이벤트가 오면 에러를 설정하고 컴포넌트를 추가하지 않는다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () =>
        ndjsonResponse([
          { type: 'delta', text: 'partial' },
          { type: 'error', error: '코드가 잘렸습니다' },
        ]),
      ),
    );

    const { result } = renderHook(() => useComponentGenerator());
    await act(() => result.current.generate('카드', undefined, 'google'));

    expect(result.current.error).toBe('코드가 잘렸습니다');
    expect(result.current.components).toHaveLength(0);
    expect(result.current.streaming).toBeNull();
  });

  it('done 이벤트 없이 스트림이 끊기면 에러를 설정하고 컴포넌트를 추가하지 않는다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () => ndjsonResponse([{ type: 'delta', text: 'partial' }])),
    );

    const { result } = renderHook(() => useComponentGenerator());
    await act(() => result.current.generate('카드', undefined, 'google'));

    expect(result.current.error).toContain('중간에 끊겼습니다');
    expect(result.current.components).toHaveLength(0);
  });

  it('청크 경계에서 라인이 잘려 도착해도 이어 붙여 처리한다', async () => {
    const encoder = new TextEncoder();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        body: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoder.encode('{"type":"do'));
            controller.enqueue(encoder.encode('ne","code":"split ok"}\n'));
            controller.close();
          },
        }),
      }),
    );

    const { result } = renderHook(() => useComponentGenerator());
    await act(() => result.current.generate('카드', undefined, 'google'));

    expect(result.current.components[0].code).toBe('split ok');
  });

  it('HTTP 에러 응답이면 JSON의 error 메시지를 설정한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: '요청이 너무 많습니다.' }) }),
    );

    const { result } = renderHook(() => useComponentGenerator());
    await act(() => result.current.generate('카드', undefined, 'google'));

    expect(result.current.error).toBe('요청이 너무 많습니다.');
    expect(result.current.streaming).toBeNull();
  });
});
