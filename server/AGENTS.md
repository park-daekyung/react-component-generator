# server/AGENTS.md

## Module Context

Bun 런타임에서 실행되는 AI API 프록시. `index.ts`가 HTTP 라우팅과 외부 API 호출을 담당하고, `generator.ts`, `fallback.ts`는 순수 함수만 둔다.

## Tech Stack & Constraints

- 런타임은 Bun (`Bun.serve`, `process.env`). 별도 프레임워크는 쓰지 않는다.
- 외부 API 호출은 전역 `fetch`만 사용한다. SDK나 axios를 추가하지 않는다 (`index.ts:69,101`).
- 환경변수는 `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`만 사용하고 모듈 로드 시점에 한 번 읽는다 (`index.ts:59-62`).

## Implementation Patterns

- 모든 `Response.json`에 `CORS_HEADERS`를 넘긴다. 에러 응답도 예외가 아니다 (`index.ts:155,172,178,190,197,203,210,217`). 누락하면 브라우저에서 CORS 오류로 보여 원인 파악이 어려워진다.
- 사용자에게 보이는 에러 메시지는 한국어, 서버 내부 검증 메시지(`Prompt is required` 등)는 영어로 이미 섞여 있다. 새 메시지는 인접한 메시지의 언어를 따른다.
- Gemini 모델 우선순위는 `GOOGLE_MODELS` 배열 순서가 곧 폴백 순서다 (`index.ts:5`).

## Testing Strategy

- 실행: `bun run test server` (vitest, jsdom 환경이 적용되지만 서버 테스트는 DOM을 쓰지 않는다).
- 테스트가 있는 곳: `generator.ts`, `fallback.ts`. 테스트가 없는 곳: `index.ts`의 라우팅, `callAnthropic`, `callGoogleModel`. 이 경계는 "import하면 서버가 뜨는 파일은 테스트하지 않는다"는 구조에서 나온다. 새 로직은 순수 모듈로 빼서 테스트한다.

## Local Golden Rules

- Do: 새 라우트를 추가할 때 `OPTIONS` 프리플라이트 처리(`index.ts:141-143`)가 새 경로에도 통하는지 확인한다.
- Do: 새 에러 경로를 만들면 `index.ts:191-212`의 catch 블록 변환 규칙(503, 429, 그 외 500)에 맞는지 확인한다.
- Don't: 요청 body의 `apiKey`를 로그에 출력하거나 응답에 되돌려주지 않는다 (`index.ts:161,167`).
- Don't: `withModelFallback`이 마지막 에러만 던진다는 점을 무시하고 중간 실패 정보를 사용자 메시지에 기대하지 않는다 (`fallback.ts:11-19`).
