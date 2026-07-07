# promptci GitHub Action 설계

## 배경

`promptci`는 지금 로컬 터미널에서 수동으로 `promptci run`을 실행해야 회귀 여부를 알 수 있다. 개발자가 PR을 올릴 때마다 자동으로 회귀테스트가 돌고, 결과가 PR에 코멘트로 남는다면 리뷰 과정에 자연스럽게 녹아든다.

이 스펙은 그 automation을 **새 저장소의 가벼운 GitHub composite action**으로 구현한다. 웹훅을 받는 자체 서버나 GitHub App은 만들지 않는다 — GitHub Actions 러너가 이미 체크아웃/실행/시크릿 관리를 다 해주기 때문에, 우리는 그 위에서 실행되는 스크립트만 제공하면 된다.

## 목표

- 사용자가 자기 저장소의 워크플로우 파일에 `uses: kibin28-glitch/promptci-action@v1` 한 줄만 추가하면 PR마다 자동으로 회귀테스트가 돈다.
- 결과가 PR 코멘트로 남는다 (prompt별 PASS/FAIL, 대시보드 업로드 시 링크 포함).
- 회귀가 발견되면 해당 CI 체크가 실패해서, 브랜치 보호 규칙과 연동해 머지를 막을 수 있다.
- 같은 PR에 push가 여러 번 일어나도 코멘트가 매번 새로 쌓이지 않고 기존 코멘트가 갱신된다.

## 목표가 아닌 것 (out of scope)

- GitHub App, 웹훅 수신 서버 — 이번 이터레이션에서는 만들지 않는다.
- 우리 서버에서 사용자 코드를 대신 실행하는 것 — 실행은 항상 사용자의 GitHub Actions 러너에서, 사용자의 OpenAI 키로 이루어진다.
- baseline을 원격(대시보드)에 저장/동기화하는 기능 — baseline은 git에 커밋하는 방식으로 해결한다.
- 여러 CI 플랫폼 지원 (GitLab CI, CircleCI 등) — GitHub Actions만 지원한다.
- Action의 Marketplace 등록/버저닝 정책 고도화 — `@v1` 태그 하나로 시작한다.

## 아키텍처

### 새 저장소: `kibin28-glitch/promptci-action`

Docker 이미지나 JS 번들 빌드가 필요 없는 **composite action**으로 만든다. GitHub 호스티드 러너(`ubuntu-latest`)에 기본 설치된 `gh`, `jq`, `node`를 그대로 활용한다.

`action.yml`:

```yaml
name: 'promptci'
description: 'Run promptci regression tests and comment results on the PR'
inputs:
  openai-api-key:
    description: 'OpenAI API key used to run the prompts'
    required: true
  promptci-token:
    description: 'Personal promptci dashboard token (optional). If set, results are uploaded and the comment includes a report link.'
    required: false
  dashboard-url:
    description: 'promptci dashboard URL to upload results to'
    required: false
    default: 'https://prompt-ci-dashboard.vercel.app'
  github-token:
    description: 'Token used to post the PR comment'
    required: false
    default: ${{ github.token }}
runs:
  using: 'composite'
  steps:
    - uses: actions/setup-node@v4
      with:
        node-version: '20'
    - name: Run promptci
      id: run
      shell: bash
      continue-on-error: true
      env:
        OPENAI_API_KEY: ${{ inputs.openai-api-key }}
        PROMPTCI_TOKEN: ${{ inputs.promptci-token }}
        PROMPTCI_DASHBOARD_URL: ${{ inputs.dashboard-url }}
      run: |
        if [ -n "${{ inputs.promptci-token }}" ]; then
          npx @kibin28-glitch/promptci run --upload | tee /tmp/promptci-stdout.txt
        else
          npx @kibin28-glitch/promptci run | tee /tmp/promptci-stdout.txt
        fi
    - name: Comment on PR
      if: always() && github.event_name == 'pull_request'
      shell: bash
      env:
        GH_TOKEN: ${{ inputs.github-token }}
      run: |
        node "${{ github.action_path }}/format-comment.js" tests/results/latest.json /tmp/promptci-stdout.txt > /tmp/promptci-comment.md
        gh pr comment "${{ github.event.pull_request.number }}" \
          --body-file /tmp/promptci-comment.md \
          --edit-last --create-if-none
    - name: Fail if regression found
      if: always() && steps.run.outcome == 'failure'
      shell: bash
      run: exit 1
```

`format-comment.js`는 저장소에 함께 커밋되는 작은 Node 스크립트로, `tests/results/latest.json`(`RunResult[]`, `prompt-ci-engine`의 기존 `run` 명령이 항상 생성하는 파일)을 읽어 다음 형태의 마크다운을 표준출력으로 내보낸다:

```markdown
<!-- promptci-action -->
## promptci results

✅ **greeting** — PASSED (1/1 cases)
❌ **summary** — FAILED (2/3 cases)

📊 [Full report](https://prompt-ci-dashboard.vercel.app/r/xxxx)
```

- 첫 줄의 `<!-- promptci-action -->` 마커는 코멘트를 식별하기 위한 용도이며 렌더링되지 않는다 (향후 다른 방식의 upsert가 필요해지면 이 마커로 검색할 수 있음; 지금은 `gh pr comment --edit-last`만으로 충분).
- `promptci-token`이 없으면(익명 실행) "Full report" 줄은 생략한다.
- 대시보드 업로드 URL은 CLI의 표준출력(`Report: <url>`)이 아니라 `latest.json`에 각 run이 이미 갖고 있는 정보만으로는 얻을 수 없으므로, `promptci run --upload`의 표준출력을 함께 캡처해 그 중 `Report: `로 시작하는 줄을 파싱해 사용한다. (`format-comment.js`는 두 개의 인자를 받는다: `latest.json` 경로, CLI 표준출력 캡처 파일 경로.)

### `prompt-ci-engine` 쪽 변경

1. `.gitignore`에서 `.promptci/baseline/` 항목 제거.
2. `README.md`에 "CI에서 사용하기" 섹션 추가: `promptci snapshot` 실행 후 `.promptci/baseline`을 커밋해야 CI 러너가 baseline을 가질 수 있다는 안내, 그리고 위 워크플로우 YAML 예시.
3. **CLI 코드 자체(`src/`)는 변경하지 않는다** — `run`, `--upload`, `tests/results/latest.json` 출력은 이미 존재한다.

## 에러 처리

- `OPENAI_API_KEY` 미설정: 기존 CLI 동작 그대로 에러 메시지 출력 후 종료 코드 1 — Action은 이를 "회귀 발견"과 동일하게 실패로 처리한다 (설정 실수와 실제 회귀를 코멘트에서 구분하지는 않는다; 워크플로우 로그를 보면 구분 가능).
- baseline이 커밋되지 않은 저장소에서 실행: CLI가 "No baseline found... Run promptci snapshot first" 에러를 내며 실패 → 위와 동일하게 처리.
- `pull_request` 이벤트가 아닌 트리거(예: `push`)로 실행된 경우: "Comment on PR" 스텝은 `github.event_name == 'pull_request'` 조건으로 건너뛴다. 회귀 시 CI 실패 자체는 그대로 발생한다.
- `latest.json`이 아예 생성되지 않은 경우(예: `promptci.yml` 설정 자체가 잘못됨): `format-comment.js`는 파일이 없으면 "promptci run 자체가 실행되지 못했습니다" 같은 안내 코멘트를 대신 출력한다 (빈 코멘트나 스크립트 크래시 대신).

## 테스트/검증 계획

- `promptci-action` 저장소에 예시 저장소(더미 prompt + baseline 커밋)를 두고, 실제 PR을 열어 워크플로우가 도는지 수동 확인.
- 회귀 없는 경우(PASSED 코멘트 + 체크 초록) / 회귀 있는 경우(FAILED 코멘트 + 체크 빨강) 둘 다 수동으로 재현해 확인.
- 같은 PR에 커밋을 두 번 push했을 때 코멘트가 새로 쌓이지 않고 갱신되는지 확인.
- `promptci-token` 없이 실행했을 때 코멘트에 "Full report" 링크가 빠지는지 확인.
