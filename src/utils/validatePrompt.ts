export const MAX_PROMPT_LENGTH = 500;

export interface PromptValidation {
  valid: boolean;
  error?: string;
}

/** 프롬프트 길이가 최대 길이(500자)를 넘지 않는지 검증한다. */
export function validatePrompt(prompt: string): PromptValidation {
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return { valid: false, error: `프롬프트는 ${MAX_PROMPT_LENGTH}자 이하로 입력해주세요.` };
  }
  return { valid: true };
}
