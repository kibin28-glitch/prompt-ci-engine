# promptci

Regression testing for your LLM prompts. When you change a prompt or swap models, `promptci` runs your saved test cases against a baseline and tells you if quality regressed — in your terminal, before it ships.

![promptci catching a regression](docs/assets/demo.svg)

## Install

```bash
npx @kibin28-glitch/promptci init
```

Or install globally:

```bash
npm install -g @kibin28-glitch/promptci
```

## Usage

```bash
# 1. Scaffold a config + example prompt/test cases
promptci init

# 2. Save your current prompt output as the baseline
promptci snapshot

# 3. Change your prompt, then check for regressions
promptci run

# 4. Publish the result as a shareable report
promptci run --upload
```

`promptci run --upload` posts results to a dashboard and prints a report URL — see it live at [prompt-ci-dashboard.vercel.app](https://prompt-ci-dashboard.vercel.app).

## Configuration

`promptci init` creates a `.promptci.yml`:

```yaml
model: gpt-4o-mini
threshold: 0.7
prompts:
  - name: greeting
    file: examples/prompts/greeting.txt
    testcases: examples/testcases/greeting.cases.json
```

Test cases support either an `expectedContains` substring check or an LLM-judge quality score against the baseline output.

## Environment variables

| Variable | Purpose |
|---|---|
| `OPENAI_API_KEY` | Required to call the OpenAI API |
| `PROMPTCI_DASHBOARD_URL` | Dashboard to upload results to (`--upload`) |
| `PROMPTCI_TOKEN` | Stable token for rate-limit tracking on uploads |

## CI에서 사용하기 (GitHub Actions)

PR마다 자동으로 회귀테스트를 돌리고 결과를 코멘트로 남기려면 [promptci-action](https://github.com/kibin28-glitch/promptci-action)을 사용하세요:

1. `promptci snapshot`으로 만든 `.promptci/baseline`을 git에 커밋하세요 — CI 러너는 로컬 baseline에 접근할 수 없습니다.
2. 저장소 Settings → Secrets and variables → Actions에 `OPENAI_API_KEY`를 등록하세요.
3. `.github/workflows/promptci.yml`을 추가하세요:

```yaml
on: [pull_request]
jobs:
  promptci:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
      - uses: kibin28-glitch/promptci-action@v1
        with:
          openai-api-key: ${{ secrets.OPENAI_API_KEY }}
```

대시보드에 결과를 올리고 코멘트에 리포트 링크를 포함하려면 `promptci-token` 입력값도 추가하세요 (`/dashboard`에서 발급).

## License

MIT
