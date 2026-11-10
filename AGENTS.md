# AGENTS.md

## Operational Commands

패키지 매니저와 런타임은 `bun`으로 고정한다. npm, yarn, pnpm은 쓰지 않는다 (`bun.lock` 사용).

```bash
bun install          # 의존성 설치
bun run dev          # API 서버(3002) + Vite(5173) 동시 실행
bun run server       # API 서버만 실행 (bun --watch)
bun run test         # vitest run (전체 테스트)
bun run test:watch   # vitest watch
bun run lint         # eslint .
bun run build        # tsc -b && vite build
```

작업 완료 전 `bun run lint`, `bun run test`, `bun run build`를 통과시킨다.

## Golden Rules

### Immutable

- 테스트는 반드시 `bun run test`로 실행한다. `bun test`(Bun 내장 러너)는 쓰지 않는다. jsdom 환경, `src/test/setup.ts`, `include` 패턴이 모두 `vite.config.ts:16-21`의 vitest 설정에 있어서 Bun 러너는 이를 읽지 않는다.
- 서버 `process.env`의 API 키 값을 클라이언트 응답에 넣지 않는다. `/api/config`는 `!!ENV_KEYS.x` 불리언만 반환한다 (`server/index.ts:150-153`). 키 값, 키가 포함된 URL을 로그나 에러 메시지에 남기지 않는다. Gemini 호출 URL은 쿼리스트링에 키를 포함한다 (`server/index.ts:99`).
- 생성 코드 규약(import 금지, `render(<Name />)` 호출, 순수 JS)은 SYSTEM_PROMPT(`server/index.ts:11,12,20`)와 react-live `noInline` 미리보기(`src/components/LivePreview.tsx:95`)가 서로 맞물려 있다. 한쪽만 바꾸지 않는다.

### Do

- 서버의 순수 로직은 `server/generator.ts`, `server/fallback.ts`처럼 부수효과 없는 모듈에 두고 옆에 `*.test.ts`를 만든다 (`server/generator.ts:1-2`).
- 포트 3002를 바꾸면 `server/index.ts:139`와 `vite.config.ts:11`의 프록시 대상을 함께 바꾼다.
- 프로바이더나 모델을 추가하면 `src/types/index.ts`의 `Provider`, 서버의 `Provider`/`ENV_KEYS`/분기(`server/index.ts:57-62,183-186`)를 같이 수정한다. `Provider` 타입은 서버와 클라이언트에 각각 따로 정의되어 있다.

### Don't

- `server/index.ts`를 테스트에서 import하지 않는다. import 즉시 `Bun.serve`가 실행된다 (`server/index.ts:138`). 테스트하려는 로직은 별도 모듈로 분리한다.
- `stripCodeFences`, `ensureRenderCall`을 "프롬프트가 이미 금지하니까" 하며 제거하지 않는다. 프롬프트가 펜스 금지(`server/index.ts:16`)와 render 호출(`:12`)을 요구해도 모델이 어기므로 서버에서 한 번 더 보정한다 (`server/index.ts:188`, `server/generator.ts:7-9,17`).
- 서버 에러 메시지에서 상태 코드 문자열을 빼지 않는다. 503/429 응답 변환이 `message.includes('503')`, `message.includes('429')`에 의존한다 (`server/index.ts:194,201`). 새 외부 호출은 `Error(\`... error: ${response.status}\`)` 형태를 유지한다.
- 한 프로바이더에만 있는 보호 로직이 있음을 잊지 않는다. 모델 폴백(`server/index.ts:135`)과 `MAX_TOKENS` 잘림 감지(`:123`)는 Gemini에만 있고 Anthropic 경로(`:68-96`)에는 없다. 공통 동작을 바꿀 때는 두 경로를 모두 확인한다.

## Project Context

프롬프트로 React 컴포넌트를 생성하고 react-live로 미리보기하는 웹 앱.

Tech Stack: React 19, TypeScript, Vite, react-live, Bun (API 서버), Vitest, Testing Library, ESLint.

## Standards & References

- 사용자 안내와 실행 방법은 `README.md`를 따른다. 여기에 반복하지 않는다.
- 커밋 메시지: `<타입>: <요약>` 한국어, 50자 안팎, 마침표 없음. 타입은 feat, fix, refactor, chore. 상세는 `.claude/skills/commit/SKILL.md`.
- Maintenance Policy: 이 문서의 규칙이나 인용한 파일·라인이 코드와 어긋나면 작업 중에 발견한 즉시 수정을 제안한다.

## Context Map

- **[API 서버 수정 (Bun)](./server/AGENTS.md)** — 라우팅, 외부 AI API 호출, 에러 변환, 서버 순수 로직 작업 시.
- **[클라이언트 UI 수정 (React)](./src/AGENTS.md)** — 컴포넌트, 훅, 스타일, 프론트엔드 테스트 작업 시.
