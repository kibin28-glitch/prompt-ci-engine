# promptci

Regression testing for your LLM prompts. When you change a prompt or swap models, `promptci` runs your saved test cases against a baseline and tells you if quality regressed — in your terminal, before it ships.

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

## License

MIT
