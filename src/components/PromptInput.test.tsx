import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PromptInput } from './PromptInput';

describe('PromptInput', () => {
  it('프롬프트가 비어 있으면 생성 버튼이 비활성이다', () => {
    render(<PromptInput onGenerate={vi.fn()} isLoading={false} />);
    expect(screen.getByRole('button', { name: '컴포넌트 생성' })).toBeDisabled();
  });

  it('입력하면 버튼이 활성화되고 클릭 시 입력값으로 onGenerate가 호출된다', async () => {
    const onGenerate = vi.fn();
    const user = userEvent.setup();
    render(<PromptInput onGenerate={onGenerate} isLoading={false} />);

    await user.type(screen.getByRole('textbox'), '프로필 카드');
    const submit = screen.getByRole('button', { name: '컴포넌트 생성' });
    expect(submit).toBeEnabled();

    await user.click(submit);
    expect(onGenerate).toHaveBeenCalledWith('프로필 카드');
  });

  it('로딩 중에는 생성 버튼이 비활성이고 "생성 중..." 을 보여준다', () => {
    render(<PromptInput onGenerate={vi.fn()} isLoading={true} />);
    expect(screen.getByRole('button', { name: '생성 중...' })).toBeDisabled();
  });

  it('500자를 넘으면 에러 메시지를 보여준다', () => {
    render(<PromptInput onGenerate={vi.fn()} isLoading={false} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '가'.repeat(501) } });
    expect(screen.getByRole('alert')).toHaveTextContent('프롬프트는 500자 이하로 입력해주세요.');
  });

  it('500자를 넘으면 생성 버튼이 비활성이다', () => {
    render(<PromptInput onGenerate={vi.fn()} isLoading={false} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '가'.repeat(501) } });
    expect(screen.getByRole('button', { name: '컴포넌트 생성' })).toBeDisabled();
  });

  it('500자 이하면 에러 없이 생성 버튼이 활성이다', () => {
    render(<PromptInput onGenerate={vi.fn()} isLoading={false} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '가'.repeat(500) } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '컴포넌트 생성' })).toBeEnabled();
  });

  it('500자를 넘은 상태에서 Ctrl+Enter를 눌러도 onGenerate가 호출되지 않는다', () => {
    const onGenerate = vi.fn();
    render(<PromptInput onGenerate={onGenerate} isLoading={false} />);
    const textbox = screen.getByRole('textbox');
    fireEvent.change(textbox, { target: { value: '가'.repeat(501) } });
    fireEvent.keyDown(textbox, { key: 'Enter', ctrlKey: true });
    expect(onGenerate).not.toHaveBeenCalled();
  });

  it('현재 글자 수를 "n/500" 형태로 보여준다', () => {
    render(<PromptInput onGenerate={vi.fn()} isLoading={false} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '가'.repeat(12) } });
    expect(screen.getByText('12/500')).toBeInTheDocument();
  });
});
