import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useComponentGenerator } from './useComponentGenerator';

const STORAGE_KEY = 'rcg:components';

function mockGenerateOnce(code: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ code }) }),
  );
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
