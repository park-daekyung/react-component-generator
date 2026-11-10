// PreToolUse 훅: `git commit` 실행 전에 `bun run test`를 돌려 실패하면 커밋을 차단한다.
// exit 2 = 도구 호출 차단, stderr는 에이전트에게 전달된다.
const input = JSON.parse(await Bun.stdin.text())
const command: string = input?.tool_input?.command ?? ''

const isCommit = /(^|[;&|(]\s*|\s)git\s+(-[^\s]+\s+(\S+\s+)?)*commit(\s|$)/.test(command)
if (!isCommit) process.exit(0)

const result = Bun.spawnSync(['bun', 'run', 'test'], {
  cwd: process.env.CLAUDE_PROJECT_DIR ?? process.cwd(),
  stdout: 'pipe',
  stderr: 'pipe',
})

if (result.exitCode !== 0) {
  console.error('테스트가 실패해 커밋을 차단했습니다. 모든 테스트를 통과시킨 뒤 다시 커밋하세요.\n')
  console.error(result.stdout.toString())
  console.error(result.stderr.toString())
  process.exit(2)
}
