import { describe, it, expect } from 'vitest';
import { validatePrompt, MAX_PROMPT_LENGTH } from './validatePrompt';

describe('validatePrompt', () => {
  it('최대 길이는 500자다', () => {
    expect(MAX_PROMPT_LENGTH).toBe(500);
  });

  it('500자 이하면 유효하다', () => {
    expect(validatePrompt('가'.repeat(500))).toEqual({ valid: true });
  });

  it('500자를 넘으면 에러 메시지와 함께 무효다', () => {
    const result = validatePrompt('가'.repeat(501));
    expect(result.valid).toBe(false);
    expect(result.error).toBe('프롬프트는 500자 이하로 입력해주세요.');
  });

  it('빈 문자열은 길이 검증에서는 유효하다', () => {
    expect(validatePrompt('')).toEqual({ valid: true });
  });
});
