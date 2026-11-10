# src/AGENTS.md

## Module Context

Vite로 빌드되는 React 19 클라이언트. `/api/*` 요청은 Vite 프록시를 거쳐 `server/`로 간다. 상태는 `App.tsx`와 `hooks/useComponentGenerator.ts`의 React state에만 있다.

## Tech Stack & Constraints

- API 호출은 상대 경로 `/api/...`만 쓴다 (`hooks/useComponentGenerator.ts:23`, `App.tsx:25`). `http://localhost:3002`를 하드코딩하지 않는다. 프록시는 `vite.config.ts:9-14`에 있다.
- 상태 라이브러리, 라우터, CSS 프레임워크는 없다. 추가하지 않고 `useState`와 커스텀 훅으로 해결한다.
- 컴포넌트 파일은 컴포넌트만 export한다. `react-refresh/only-export-components` 규칙이 켜져 있다 (`eslint.config.js:16`). 상수나 훅은 `hooks/`, `types/`나 파일 내부 비공개 상수로 둔다 (`App.tsx:8`의 `PROVIDER_CONFIG`처럼).

## Implementation Patterns

- 스타일은 `App.css`의 클래스로 작성하고 상태 변형은 `block--modifier` 형태를 쓴다 (`tab--active`, `key-status--ready`).
- 새 UI 창은 기존 `window` / `window-title` / `window-body` 구조를 재사용한다 (`App.tsx:67-73`).
- 접근성 속성(`aria-label`, `role="alert"`, `role="status"`)은 기존 패턴을 따른다 (`App.tsx:55,128,168`).

## Testing Strategy

- 실행: `bun run test src`. 각 테스트 후 `cleanup`은 `src/test/setup.ts`가 자동 처리하므로 테스트에서 직접 호출하지 않는다.
- 패턴: `render` + `screen.getByRole(..., { name })` + `userEvent.setup()` (`components/PromptInput.test.tsx`). 셀렉터는 역할과 접근 가능한 이름 기준으로 쓴다.
- 테스트 경계: 테스트가 있는 것은 `PromptInput`뿐이다. `App`, `ComponentCard`, `CodeView`, `LivePreview`, `useComponentGenerator`는 테스트가 없다. 이 파일들을 수정하면 변경 범위에 맞는 테스트를 추가한다. `LivePreview`는 react-live를 렌더하므로 테스트 시 jsdom 제약을 확인한다.

## Local Golden Rules

### Immutable

- API 키는 `App.tsx`의 React state(`apiKey`)에만 둔다. `localStorage`, `sessionStorage`, 쿠키, URL에 저장하지 않는다 (src 전체에 저장소 접근이 없음을 확인했다).
- `LiveProvider`에 `scope`를 전달하지 않는다 (`components/LivePreview.tsx:95`). AI가 생성한 코드가 앱 페이지에서 그대로 실행되므로, 앱 state, 키, 함수를 scope로 넘기면 생성 코드가 접근할 수 있다.

### Do

- 생성 요청은 항상 `App.tsx`의 `handleGenerate`를 거친다. 재생성도 같은 함수를 쓴다 (`App.tsx:185`). 이 함수에 키 유무 검증이 있으므로 (`App.tsx:34`) 우회하는 호출 경로를 만들지 않는다.
- `provider`는 요청에 항상 명시해서 보낸다 (`hooks/useComponentGenerator.ts:26`). 클라이언트 기본값은 `google`(`App.tsx:16`)이고 서버 기본값은 `anthropic`(`server/index.ts:161`)으로 서로 다르다. 생략하면 의도와 다른 프로바이더가 호출된다.
- 프로바이더를 추가하면 `PROVIDER_CONFIG`(`App.tsx:8-11`)와 `envKeys` 초기값(`App.tsx:17-20`)에 항목을 추가한다. 타입 정의와 서버 쪽 수정은 루트 `AGENTS.md`를 따른다.
- 프로바이더를 바꿀 때 입력한 키를 비우는 동작(`App.tsx:41-44`)을 유지한다. 다른 프로바이더에 키가 잘못 전송되는 것을 막는다.
- `apiKey`는 값이 있을 때만 body에 포함한다 (`hooks/useComponentGenerator.ts:26`의 `...(apiKey && { apiKey })`). 빈 문자열을 보내면 서버가 `.env` 키로 폴백하지 못한다 (`server/index.ts:65`).

### Don't

- 미리보기 새로고침의 `key={previewKey}` 리마운트(`components/ComponentCard.tsx:70`)를 상태 리셋 등 다른 방식으로 바꾸지 않는다. 애니메이션 컴포넌트를 처음부터 다시 실행하려면 리마운트가 필요하다.
- `PromptInput`의 버튼 문구 `컴포넌트 생성`, `생성 중...`을 마음대로 바꾸지 않는다. 테스트가 이 이름으로 버튼을 찾는다 (`components/PromptInput.test.tsx`). 바꾸면 테스트를 함께 수정한다.
