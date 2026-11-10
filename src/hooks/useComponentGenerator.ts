import { useState, useCallback } from 'react';
import type { GeneratedComponent, Provider } from '../types';
import { useLocalStorage } from './useLocalStorage';

import { parseStreamEvents } from '../utils/parseStreamEvents';

export interface StreamingState {
  prompt: string;
  code: string;
}

interface UseComponentGeneratorReturn {
  components: GeneratedComponent[];
  isLoading: boolean;
  error: string | null;
  streaming: StreamingState | null;
  generate: (prompt: string, apiKey: string | undefined, provider: Provider) => Promise<void>;
  removeComponent: (id: string) => void;
  clearAll: () => void;
}

function parseComponents(raw: unknown): GeneratedComponent[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.flatMap((item) => {
    if (
      typeof item !== 'object' || item === null ||
      typeof item.id !== 'string' ||
      typeof item.prompt !== 'string' ||
      typeof item.code !== 'string'
    ) {
      return [];
    }
    const createdAt = new Date(item.createdAt);
    if (Number.isNaN(createdAt.getTime())) return [];
    return [{ id: item.id, prompt: item.prompt, code: item.code, createdAt }];
  });
}

export function useComponentGenerator(): UseComponentGeneratorReturn {
  const [components, setComponents] = useLocalStorage<GeneratedComponent[]>(
    'rcg:components',
    [],
    parseComponents,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streaming, setStreaming] = useState<StreamingState | null>(null);

  const generate = useCallback(async (prompt: string, apiKey: string | undefined, provider: Provider) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, ...(apiKey && { apiKey }), provider }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to generate component');
      }
      if (!res.body) {
        throw new Error('Failed to generate component');
      }

      setStreaming({ prompt, code: '' });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let rest = '';
      let finalCode: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const parsed = parseStreamEvents(rest, decoder.decode(value, { stream: true }));
        rest = parsed.rest;

        for (const event of parsed.events) {
          if (event.type === 'delta') {
            setStreaming((prev) => prev && { ...prev, code: prev.code + event.text });
          } else if (event.type === 'error') {
            throw new Error(event.error);
          } else {
            finalCode = event.code;
          }
        }
      }

      if (finalCode === null) {
        throw new Error('응답이 중간에 끊겼습니다. 다시 시도해주세요.');
      }

      const newComponent: GeneratedComponent = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        prompt,
        code: finalCode,
        createdAt: new Date(),
      };

      setComponents((prev) => [newComponent, ...prev]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      setStreaming(null);
      setIsLoading(false);
    }
  }, [setComponents]);

  const removeComponent = useCallback((id: string) => {
    setComponents((prev) => prev.filter((c) => c.id !== id));
  }, [setComponents]);

  const clearAll = useCallback(() => {
    setComponents([]);
  }, [setComponents]);

  return { components, isLoading, error, streaming, generate, removeComponent, clearAll };
}
