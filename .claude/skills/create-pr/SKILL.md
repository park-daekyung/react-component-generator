---
name: create-pr
description: 현재 브랜치의 커밋과 diff를 분석해 KR/EN 템플릿 기반 PR 본문을 작성하고 GitHub Pull Request를 생성한다. subagent(fork)에서 실행되어 메인 대화 컨텍스트를 오염시키지 않는다. "PR 만들어줘", "풀리퀘 올려줘", "PR 생성", "create a PR", "open a pull request" 같은 요청이나 작업을 마치고 리뷰를 올리려는 맥락이면 사용자가 스킬 이름을 말하지 않아도 반드시 이 스킬을 사용한다. 본문 언어는 프로젝트의 커밋과 문서에서 자동 감지하며, 인자 `ko`/`en`으로 강제할 수 있다.
context: fork
allowed-tools: Read Glob Grep Bash
---

# Create PR

현재 브랜치를 분석해 PR 본문을 작성하고 `gh pr create`로 Pull Request를 만든다.

이 스킬은 fork된 subagent에서 실행된다. 메인 대화의 맥락을 볼 수 없으므로 변경 의도는 전부 git 기록(커밋 메시지, diff)과 프로젝트 문서에서 직접 파악한다. 파일 편집 도구가 없으므로 본문은 파일로 저장하지 않고 Bash heredoc으로 `gh`에 전달한다.

## 인자

- `ko`: 한국어 본문. `references/pr-template-ko.md` 사용.
- `en`: 영어 본문. `references/pr-template-en.md` 사용.
- `--base <브랜치>`: 대상 브랜치. 생략하면 저장소의 기본 브랜치.
- `--draft`: Draft PR로 생성.

언어 인자가 없으면 프로젝트의 언어를 자동 감지한다 (아래 "언어 결정" 참고).

## 언어 결정

PR은 팀이 평소 쓰는 언어로 올라가야 읽는 사람에게 자연스럽다. 그래서 인자가 없으면 프로젝트가 실제로 쓰는 글에서 한글 비율을 재서 정한다. 아래 순서로 판단하고, 앞 단계에서 결론이 나면 멈춘다.

1. 인자로 `ko` 또는 `en`이 주어졌으면 그대로 따른다.
2. 최근 커밋 제목 20개를 본다. 커밋은 팀이 가장 꾸준히 쓰는 글이다.
3. 커밋에서 판단할 수 없으면 `README.md` 앞 50줄을 본다. 커밋이 없거나 영문자가 30자 미만일 때가 해당한다.
4. 둘 다 판단할 수 없으면 `ko`로 한다.

한글 비율은 `한글 글자 수 / (한글 글자 수 + 영문자 수)`다. **0.3 이상이면 `ko`, 미만이면 `en`** 이다. 한글 문장에도 `AGENTS.md`, `bun` 같은 영어 식별자가 섞이므로 기준을 0.5가 아니라 0.3으로 낮췄다.

```bash
sample=$(git log -20 --format='%s')
ko=$(printf '%s' "$sample" | grep -o -P '[\x{AC00}-\x{D7A3}]' | wc -l)
en=$(printf '%s' "$sample" | grep -o '[A-Za-z]' | wc -l)
echo "ko=$ko en=$en"   # ko / (ko + en) >= 0.3 이면 ko
```

3단계는 같은 명령에서 `sample=$(head -50 README.md)`로 바꿔 쓴다.

결정한 언어와 근거(예: "커밋 20개 기준 한글 59% -> ko")를 결과 보고에 반드시 적는다. 감지가 틀렸을 때 사용자가 `en`이나 `ko` 인자로 바로 바로잡을 수 있게 하기 위해서다.

## 절차

### 1. 사전 점검

```bash
git rev-parse --is-inside-work-tree
git branch --show-current
gh auth status
git status --short
gh repo view --json defaultBranchRef -q .defaultBranchRef.name
```

다음 경우에는 PR을 만들지 않고 이유를 보고한 뒤 끝낸다.

- git 저장소가 아니거나 `gh`에 로그인되어 있지 않다.
- 현재 브랜치가 기본 브랜치(main, master)다. PR은 작업 브랜치에서 만든다. 브랜치 생성은 사용자가 정하게 한다.
- `origin` 리모트가 없다.
- 기본 브랜치 대비 커밋이 0개다.

커밋하지 않은 변경(`git status --short` 결과가 있음)이 있으면 PR 본문에 포함되지 않는다. 중단하지 말고 결과 보고에서 알린다. 이 스킬은 커밋을 만들지 않는다.

이 브랜치에 이미 열린 PR이 있는지 확인한다.

```bash
gh pr list --head "$(git branch --show-current)" --state open --json number,url
```

있으면 새로 만들지 않고 그 URL을 알려주고 끝낸다. 중복 PR은 리뷰를 분산시킨다.

### 2. 변경 분석

기준 브랜치는 `--base` 또는 기본 브랜치다. 원격 최신 상태를 반영하려고 `origin/<base>`와 비교한다.

```bash
git fetch origin <base>
git log origin/<base>..HEAD --format='%h %s%n%b---'
git diff origin/<base>...HEAD --stat
git diff origin/<base>...HEAD
```

diff가 너무 크면 `--stat`으로 구조를 파악한 뒤 핵심 파일만 읽는다. 읽을 때 다음을 파악한다.

- **무엇을** 바꿨는가 (사용자에게 보이는 변화 위주)
- **왜** 바꿨는가 (커밋 본문, 이슈 번호, 코드 주석에서 단서를 찾는다. 추측으로 채우지 않는다.)
- 테스트가 추가되거나 수정되었는가
- 주의가 필요한 변경인가 (API 변경, 설정·의존성 변경, 마이그레이션)

프로젝트에 `AGENTS.md`나 `CLAUDE.md`가 있으면 읽고 테스트·빌드 명령어를 PR 본문의 검증 항목에 반영한다. `.github/pull_request_template.md`가 있으면 이 스킬의 템플릿보다 그것을 우선한다.

### 3. 제목과 본문 작성

"언어 결정" 절차로 언어를 정한다. 템플릿은 필요할 때만 읽는다. 선택된 언어의 파일 하나만 `Read`한다.

- 한국어: `references/pr-template-ko.md`
- 영어: `references/pr-template-en.md`

두 파일은 같은 구조다. 템플릿의 각 섹션을 채우되, 해당 내용이 없는 섹션은 비워 두지 말고 "해당 없음"(`N/A`)으로 쓴다.

제목 규칙:

- 70자 이내. 커밋 컨벤션을 따른다 (`feat:`, `fix:`, `refactor:`, `chore:` + 요약).
- 커밋이 하나면 그 커밋 제목을 기반으로 한다. 여러 개면 전체를 아우르는 요약을 쓴다.
- 한국어 모드는 한국어 요약, 영어 모드는 영어 요약. 마침표를 붙이지 않는다.

본문 규칙:

- 사실만 쓴다. 실행하지 않은 테스트를 "통과"로 쓰지 않는다. 검증 항목은 실제로 확인한 것만 체크하고, 확인하지 못한 것은 체크를 비워 둔다.
- 스크린샷이나 이슈 번호 등 알 수 없는 정보를 지어내지 않는다. 모르면 `N/A`로 둔다.
- 본문 맨 끝에 다음 줄을 붙인다.

```
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

### 4. 푸시와 PR 생성

현재 브랜치가 원격에 없거나 뒤처져 있으면 푸시한다. 푸시는 현재 작업 브랜치에만 하고, 강제 푸시(`--force`)는 쓰지 않는다.

```bash
git push -u origin "$(git branch --show-current)"
```

푸시가 거부되면(원격에 다른 커밋이 있음) 강제로 밀지 말고 원인을 보고하고 끝낸다.

본문은 heredoc으로 전달해 줄바꿈과 한글이 깨지지 않게 한다. `--draft`가 주어졌으면 플래그를 추가한다.

```bash
gh pr create --base <base> --title "<제목>" --body "$(cat <<'EOF'
<완성된 본문>
EOF
)"
```

### 5. 결과 보고

사용자에게 다음만 간결하게 보고한다. subagent의 결과만 메인 대화로 돌아가므로 이 보고가 곧 전부다.

- 생성된 PR URL
- 제목, 대상 브랜치, 포함된 커밋 수
- 사용한 언어와 결정 근거
- 알려야 할 사항 (커밋되지 않은 변경, 건너뛴 검증 항목 등)

PR이 만들어지지 않았다면 이유와 사용자가 할 수 있는 다음 행동을 알린다.

## 금지 사항

- `git push --force`, `--no-verify`, 기본 브랜치로의 직접 푸시.
- 커밋 생성, 파일 수정, 브랜치 삭제. 이 스킬은 PR 생성만 한다.
- `gh pr merge`, `gh pr close` 등 PR 생성 이후 단계. 사용자가 요청하지 않으면 하지 않는다.
- API 키나 `.env` 내용을 본문에 포함하는 것. diff에 시크릿이 보이면 PR을 만들지 말고 알린다.
