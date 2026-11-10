// PreToolUse 훅: 코드를 쓰거나 수정하기 직전에 .claude/rules/tdd.md 핵심 규칙을 additionalContext로 주입한다.
const input = JSON.parse(await Bun.stdin.text())
const filePath: string = (input?.tool_input?.file_path ?? '').replaceAll('\\', '/')

// tdd.md "TDD가 불필요하다" 대상(문서, 설정, 타입 정의)과 .claude 자체 파일은 건너뛴다.
const exempt =
  /\.(md|json|css)$/.test(filePath) ||
  /(^|\/)\.claude\//.test(filePath) ||
  /(^|\/)types\//.test(filePath) ||
  /(^|\/)(vite\.config|eslint\.config)\.[jt]s$/.test(filePath)
if (exempt) process.exit(0)

const isTest = /\.test\.[jt]sx?$/.test(filePath)

const reminder = isTest
  ? `[TDD 리마인더] 테스트 파일 작성 중입니다. RED 단계 규칙: 하나의 동작 = 하나의 테스트, 이름은 기대 동작을 서술합니다. 작성 후 반드시 \`bun run test\`로 실행해 "기능 미구현"이라는 올바른 이유로 실패하는지 확인하세요. import 오류나 오타로 실패하면 테스트를 고칩니다. 처음부터 통과하면 테스트를 의심하세요.`
  : `[TDD 리마인더] 프로덕션 코드를 수정하려 합니다. .claude/rules/tdd.md는 Rigid 규칙입니다.
1. 이 변경을 덮는 실패하는 테스트를 이미 작성하고 \`bun run test\`로 실패를 확인했습니까? 아니라면 지금 수정을 멈추고 RED부터 시작하세요.
2. 테스트보다 프로덕션 코드를 먼저 썼다면 그 코드를 삭제하고 RED부터 재시작합니다. 참고용 보관(주석, 별도 파일)도 금지입니다.
3. GREEN은 테스트를 통과시키는 최소한의 코드만 작성합니다(YAGNI). 기존 테스트를 고쳐서 맞추지 않습니다.
4. 버그 수정은 재현 테스트를 먼저 작성하고 실패를 확인한 뒤 고칩니다.
5. "단순하다", "나중에 추가", "시간 없다", "프로토타입" 같은 변명은 허용되지 않습니다. 경계가 모호하면 TDD를 적용합니다.`

console.log(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext: reminder,
    },
  }),
)
