import { useState, useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';

function read<T>(key: string, initial: T, parse?: (raw: unknown) => T | null): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored === null) return initial;
    const raw: unknown = JSON.parse(stored);
    if (!parse) return raw as T;
    return parse(raw) ?? initial;
  } catch {
    return initial;
  }
}

export function useLocalStorage<T>(
  key: string,
  initial: T,
  parse?: (raw: unknown) => T | null,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => read(key, initial, parse));

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // 용량 초과·접근 차단 시에도 메모리 상태는 유지한다
    }
  }, [key, value]);

  return [value, setValue];
}
