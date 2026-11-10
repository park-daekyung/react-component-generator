import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { doneResponse } from './test/streamMock';

function stubFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async (url: string) => {
      if (url === '/api/config') {
        return { ok: true, json: async () => ({ envKeys: { anthropic: false, google: false } }) };
      }
      return doneResponse('render(<A />)');
    }),
  );
}

describe('App 스트리밍 UX', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('생성 중에는 코드 탭에 실시간 코드를 보여주고, 완료되면 미리보기 탭으로 전환한다', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const encoder = new TextEncoder();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => {
        if (url === '/api/config') {
          return { ok: true, json: async () => ({ envKeys: { anthropic: false, google: false } }) };
        }
        return {
          ok: true,
          body: new ReadableStream<Uint8Array>({
            async start(controller) {
              controller.enqueue(encoder.encode('{"type":"delta","text":"const Live = 1;"}\n'));
              await gate;
              controller.enqueue(encoder.encode('{"type":"done","code":"const Live = 1;\\nrender(<div />)"}\n'));
              controller.close();
            },
          }),
        };
      }),
    );
    localStorage.setItem('rcg:apiKey', JSON.stringify('AIza-key'));

    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByRole('textbox'), '카드');
    await user.click(screen.getByRole('button', { name: '컴포넌트 생성' }));

    expect(await screen.findByText('const Live = 1;')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '코드' })).toHaveAttribute('aria-selected', 'true');

    release();

    await waitFor(() =>
      expect(screen.getByRole('tab', { name: '미리보기' })).toHaveAttribute('aria-selected', 'true'),
    );
  });
});

describe('App 상태 영속화', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
    stubFetch();
  });

  it('저장된 Provider와 API 키를 복원한다', () => {
    localStorage.setItem('rcg:provider', JSON.stringify('anthropic'));
    localStorage.setItem('rcg:apiKey', JSON.stringify('sk-ant-saved'));
    render(<App />);

    expect(screen.getByLabelText('AI 제공자')).toHaveValue('anthropic');
    expect(screen.getByLabelText('API Key')).toHaveValue('sk-ant-saved');
  });

  it('저장된 Provider 값이 유효하지 않으면 기본값 google을 쓴다', () => {
    localStorage.setItem('rcg:provider', JSON.stringify('openai'));
    render(<App />);

    expect(screen.getByLabelText('AI 제공자')).toHaveValue('google');
  });

  it('API 키를 입력하면 새로고침 후에도 유지된다', async () => {
    const user = userEvent.setup();
    const first = render(<App />);
    await user.type(screen.getByLabelText('API Key'), 'AIza-typed');
    first.unmount();

    render(<App />);
    expect(screen.getByLabelText('API Key')).toHaveValue('AIza-typed');
  });

  it('Provider를 바꾸면 선택은 저장되고 키는 비워진 채 저장된다', async () => {
    const user = userEvent.setup();
    localStorage.setItem('rcg:apiKey', JSON.stringify('AIza-old'));
    const first = render(<App />);
    await user.selectOptions(screen.getByLabelText('AI 제공자'), 'anthropic');
    first.unmount();

    render(<App />);
    expect(screen.getByLabelText('AI 제공자')).toHaveValue('anthropic');
    expect(screen.getByLabelText('API Key')).toHaveValue('');
  });

  it('제출한 프롬프트가 히스토리에 남고 새로고침 후에도 보인다', async () => {
    const user = userEvent.setup();
    localStorage.setItem('rcg:apiKey', JSON.stringify('AIza-key'));
    const first = render(<App />);
    await user.type(screen.getByRole('textbox'), '로그인 폼');
    await user.click(screen.getByRole('button', { name: '컴포넌트 생성' }));
    await screen.findByRole('button', { name: '로그인 폼' });
    first.unmount();

    render(<App />);
    expect(screen.getByRole('button', { name: '로그인 폼' })).toBeInTheDocument();
  });
});
