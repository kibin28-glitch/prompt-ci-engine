# promptci GitHub Action Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let any repo run `promptci` regression tests automatically on every PR via a reusable GitHub Action, with results posted as a PR comment and the CI check failing on regressions.

**Architecture:** A new public repo, `kibin28-glitch/promptci-action`, hosts a composite GitHub Action (no Docker, no JS build step) that shells out to `npx @kibin28-glitch/promptci run` on the caller's own runner, reads the resulting `tests/results/latest.json`, and posts/updates a single marker-tagged PR comment via `gh`. `prompt-ci-engine` gets two small non-code changes (stop gitignoring the baseline, document CI usage) so a checked-out CI runner actually has a baseline to compare against.

**Tech Stack:** GitHub composite action (`action.yml`), Node.js (comment formatting script), `gh` CLI (already present on `ubuntu-latest` runners), the existing `@kibin28-glitch/promptci` npm package.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-07-github-action-design.md`
- No Docker image, no JS bundling/build step for the action — pure composite action using shell steps and the `gh`/`node` binaries already on `ubuntu-latest`.
- `prompt-ci-engine`'s CLI code (`src/`) is NOT modified. Only `.gitignore` and `README.md` change in that repo.
- PR comment upsert uses the `<!-- promptci-action -->` marker via `gh pr view --json comments --jq` + `gh api -X PATCH`, never `gh pr comment --edit-last`.
- Action inputs: `openai-api-key` (required), `promptci-token` (optional), `dashboard-url` (optional, default `https://prompt-ci-dashboard.vercel.app`), `github-token` (optional, default `${{ github.token }}`).
- baseline snapshots (`.promptci/baseline/`) must be committed to git, not gitignored — CI runners have no access to a contributor's local filesystem.
- No automated test framework in either repo — verification is `npm run build`-equivalent checks plus the manual PR-based tests described in each task.

---

## File Structure

| File | Repo | Status | Responsibility |
|---|---|---|---|
| `action.yml` | `promptci-action` (new repo) | Create | Composite action definition: run promptci, comment on PR, fail on regression |
| `format-comment.js` | `promptci-action` | Create | Reads `tests/results/latest.json` + captured CLI stdout, prints the PR comment markdown |
| `README.md` | `promptci-action` | Create | Usage docs for repo owners adding this action |
| `.gitignore` | `prompt-ci-engine` | Modify | Remove `.promptci/baseline/` so baselines can be committed |
| `.promptci/baseline/greeting.txt` | `prompt-ci-engine` | Commit (already exists on disk, currently untracked) | Example baseline, needed for `prompt-ci-engine`'s own dogfood workflow |
| `README.md` | `prompt-ci-engine` | Modify | Add "CI에서 사용하기 (GitHub Actions)" section |
| `.github/workflows/promptci.yml` | `prompt-ci-engine` | Create | Dogfoods the new action on `prompt-ci-engine`'s own example prompt |

---

### Task 1: `promptci-action` repo + `action.yml`

**Files:**
- Create repo: `kibin28-glitch/promptci-action` (public, on GitHub)
- Create: `action.yml` (repo root)

**Interfaces:**
- Produces: the composite action itself, referenced elsewhere as `uses: kibin28-glitch/promptci-action@v1`. Depends on `format-comment.js` existing at `${{ github.action_path }}/format-comment.js` (created in Task 2) — `action.yml` references that path but the file doesn't need to exist yet for this task's own verification (YAML syntax only).

- [ ] **Step 1: Create the GitHub repository**

```bash
mkdir -p ~/development/promptci-action
cd ~/development/promptci-action
git init
gh repo create kibin28-glitch/promptci-action --public --source=. --remote=origin --description "GitHub Action: run promptci regression tests on every PR"
```

- [ ] **Step 2: Write `action.yml`**

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
        COMMENT_ID=$(gh pr view "${{ github.event.pull_request.number }}" --json comments \
          --jq '.comments[] | select(.body | contains("<!-- promptci-action -->")) | .id' | head -n 1)
        if [ -n "$COMMENT_ID" ]; then
          gh api -X PATCH "repos/${{ github.repository }}/issues/comments/$COMMENT_ID" -F body=@/tmp/promptci-comment.md
        else
          gh pr comment "${{ github.event.pull_request.number }}" --body-file /tmp/promptci-comment.md
        fi
    - name: Fail if regression found
      if: always() && steps.run.outcome == 'failure'
      shell: bash
      run: exit 1
```

- [ ] **Step 3: Verify YAML syntax**

Run: `node -e "require('js-yaml') ? '' : ''" 2>/dev/null; python3 -c "import yaml; yaml.safe_load(open('action.yml'))" && echo "valid YAML"`

Expected: `valid YAML` printed, no exception.

(If `python3`/`yaml` isn't available, alternatively run `npx -y js-yaml action.yml > /dev/null && echo "valid YAML"`.)

- [ ] **Step 4: Commit and push**

```bash
git add action.yml
git commit -m "Add composite action definition"
git branch -M main
git push -u origin main
```

---

### Task 2: `format-comment.js`

**Files:**
- Create: `format-comment.js` (repo root of `promptci-action`)

**Interfaces:**
- Consumes: `process.argv[2]` = path to `tests/results/latest.json` (an array of `RunResult`, shape: `{ promptName: string, timestamp: string, threshold: number, cases: Array<{ input: object, baselineOutput: string, currentOutput: string, eval: { pass: boolean, score: number, reason: string } }>, passed: boolean }` — this exact shape is produced by `prompt-ci-engine`'s existing `runCommand`); `process.argv[3]` = path to a text file containing the captured stdout of `promptci run`/`promptci run --upload`.
- Produces: markdown printed to stdout, starting with the literal line `<!-- promptci-action -->`, consumed by `action.yml`'s "Comment on PR" step (Task 1) via `> /tmp/promptci-comment.md`.

- [ ] **Step 1: Write `format-comment.js`**

```js
#!/usr/bin/env node
const fs = require("fs");

const [, , latestJsonPath, stdoutPath] = process.argv;

if (!latestJsonPath) {
  console.error("Usage: format-comment.js <latest.json path> <stdout capture path>");
  process.exit(1);
}

console.log("<!-- promptci-action -->");
console.log("## promptci results");
console.log("");

if (!fs.existsSync(latestJsonPath)) {
  console.log(
    "⚠️ promptci did not produce `tests/results/latest.json` — the run failed before any prompt was tested. Check the workflow logs for details.",
  );
  process.exit(0);
}

const results = JSON.parse(fs.readFileSync(latestJsonPath, "utf8"));

for (const result of results) {
  const total = result.cases.length;
  const passCount = result.cases.filter((c) => c.eval.pass).length;
  const icon = result.passed ? "✅" : "❌";
  const status = result.passed ? "PASSED" : "FAILED";
  console.log(`${icon} **${result.promptName}** — ${status} (${passCount}/${total} cases)`);
}

let reportUrl = null;
if (stdoutPath && fs.existsSync(stdoutPath)) {
  const stdout = fs.readFileSync(stdoutPath, "utf8");
  const match = stdout.match(/^Report: (.+)$/m);
  if (match) {
    reportUrl = match[1].trim();
  }
}

if (reportUrl) {
  console.log("");
  console.log(`📊 [Full report](${reportUrl})`);
}
```

- [ ] **Step 2: Make it executable and verify with sample data**

```bash
cd ~/development/promptci-action
chmod +x format-comment.js
mkdir -p /tmp/promptci-plan-test
cat > /tmp/promptci-plan-test/latest.json << 'EOF'
[
  {
    "promptName": "greeting",
    "timestamp": "2026-07-07T00:00:00.000Z",
    "threshold": 0.7,
    "passed": true,
    "cases": [
      { "input": {"name": "Alex"}, "baselineOutput": "Hi Alex", "currentOutput": "Hi Alex", "eval": {"pass": true, "score": 1, "reason": "exact match"} }
    ]
  }
]
EOF
printf 'Prompt: greeting\nRESULT: PASSED\nReport: https://prompt-ci-dashboard.vercel.app/r/test-id\n' > /tmp/promptci-plan-test/stdout.txt
node format-comment.js /tmp/promptci-plan-test/latest.json /tmp/promptci-plan-test/stdout.txt
```

Expected output:
```
<!-- promptci-action -->
## promptci results

✅ **greeting** — PASSED (1/1 cases)

📊 [Full report](https://prompt-ci-dashboard.vercel.app/r/test-id)
```

- [ ] **Step 3: Verify the missing-file fallback path**

```bash
node format-comment.js /tmp/promptci-plan-test/does-not-exist.json /tmp/promptci-plan-test/stdout.txt
```

Expected output:
```
<!-- promptci-action -->
## promptci results

⚠️ promptci did not produce `tests/results/latest.json` — the run failed before any prompt was tested. Check the workflow logs for details.
```

- [ ] **Step 4: Commit and push**

```bash
git add format-comment.js
git commit -m "Add PR comment formatter"
git push
```

---

### Task 3: `promptci-action` README

**Files:**
- Create: `README.md` (repo root of `promptci-action`)

**Interfaces:**
- Consumes: nothing (documentation only)

- [ ] **Step 1: Write `README.md`**

```markdown
# promptci-action

Run [promptci](https://github.com/kibin28-glitch/prompt-ci-engine) regression tests on every pull request, and post the results as a PR comment.

## Usage

1. Commit your `promptci` baseline (`promptci snapshot` writes it to `.promptci/baseline/`) — a CI runner has no access to your local filesystem, so the baseline must live in the repo.
2. Add `OPENAI_API_KEY` as a repository secret (Settings → Secrets and variables → Actions).
3. Add `.github/workflows/promptci.yml`:

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

If a prompt regresses, the job fails (so branch protection can block the merge) and a comment like this appears on the PR:

```
## promptci results

❌ **greeting** — FAILED (0/1 cases)
```

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `openai-api-key` | yes | — | OpenAI API key used to run the prompts |
| `promptci-token` | no | — | Personal [promptci dashboard](https://prompt-ci-dashboard.vercel.app) token. If set, results are uploaded and the PR comment includes a report link |
| `dashboard-url` | no | `https://prompt-ci-dashboard.vercel.app` | Dashboard to upload results to |
| `github-token` | no | `${{ github.token }}` | Token used to post/update the PR comment |

## License

MIT
```

- [ ] **Step 2: Commit and push**

```bash
git add README.md
git commit -m "Add usage README"
git push
```

---

### Task 4: `prompt-ci-engine` — commit baseline, update `.gitignore` and `README.md`

**Files:**
- Modify: `.gitignore` (repo root of `prompt-ci-engine`)
- Commit: `.promptci/baseline/greeting.txt` (already exists on disk, currently untracked because of the old `.gitignore` rule)
- Modify: `README.md`

**Interfaces:**
- Consumes: nothing new
- Produces: a `prompt-ci-engine` checkout that has its baseline committed, which Task 5's workflow run depends on

- [ ] **Step 1: Remove the baseline ignore rule**

In `/Users/kimkibin/development/prompt-ci-engine/.gitignore`, change:

```
node_modules/
dist/
.env
.promptci/baseline/
tests/results/
```

to:

```
node_modules/
dist/
.env
tests/results/
```

- [ ] **Step 2: Add the CI section to `README.md`**

In `/Users/kimkibin/development/prompt-ci-engine/README.md`, insert this new section between `## Environment variables` and `## License`:

```markdown
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
```
```

(Note: the outer markdown code fence above is just to show you the edit; when you actually edit `README.md`, insert the inner content — starting at `## CI에서 사용하기` and ending at the `대시보드에 결과를...` line — as real file content, not nested inside another fence.)

- [ ] **Step 3: Stage and commit**

```bash
cd /Users/kimkibin/development/prompt-ci-engine
git add .gitignore README.md
git add -f .promptci/baseline/greeting.txt
git commit -m "Allow committing promptci baselines; document GitHub Actions usage"
git push
```

- [ ] **Step 4: Verify the baseline is tracked**

Run: `git ls-files .promptci/`
Expected: `.promptci/baseline/greeting.txt` is listed.

---

### Task 5: Dogfood workflow + manual end-to-end verification

**Files:**
- Create: `.github/workflows/promptci.yml` (repo root of `prompt-ci-engine`)

**Interfaces:**
- Consumes: `kibin28-glitch/promptci-action@v1` (won't exist as a resolvable tag until Task 6 tags `v1` — see Step 1 note below), the `OPENAI_API_KEY` secret

This task can only be fully exercised after Task 6 (tagging `v1`). Do Task 6 first if you're executing linearly, or point this workflow at the `main` branch of `promptci-action` temporarily and switch to `@v1` once it exists — the plan assumes Task 6 has already happened by the time you run Step 3 below.

- [ ] **Step 1: Write the workflow file**

```yaml
# .github/workflows/promptci.yml
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

- [ ] **Step 2: Add the OpenAI secret and commit the workflow**

```bash
cd /Users/kimkibin/development/prompt-ci-engine
gh secret set OPENAI_API_KEY --body "<the same key already in .env>"
git add .github/workflows/promptci.yml
git commit -m "Dogfood promptci-action on this repo's own example prompt"
git push
```

- [ ] **Step 3: Open a passing test PR**

```bash
git checkout -b test/promptci-action-pass
git commit --allow-empty -m "Trigger promptci-action (expect PASS)"
git push -u origin test/promptci-action-pass
gh pr create --title "Test promptci-action (pass)" --body "Manual verification for docs/superpowers/plans/2026-07-07-github-action.md Task 5" --head test/promptci-action-pass --base main
```

Wait for the check to finish (`gh pr checks --watch`), then confirm:
- The check named after the workflow job (`promptci`) is green.
- The PR has exactly one comment starting with `## promptci results`, showing `✅ **greeting** — PASSED (1/1 cases)`.

- [ ] **Step 4: Push a second commit to the same PR and confirm the comment updates in place**

```bash
git commit --allow-empty -m "Second push (expect comment to update, not duplicate)"
git push
```

Wait for the check to finish again, then confirm the PR still has exactly one `promptci results` comment (same comment, updated timestamp) — not two.

- [ ] **Step 5: Open a failing test PR**

`examples/testcases/greeting.cases.json`'s only case checks `expectedContains: "Alex"` against the **current** prompt's live output only (see `src/runner/runRegression.ts` — `containsMatch` is evaluated against `currentOutput`, independent of the baseline). So the deterministic way to force a failure is to change the current prompt so its output can no longer contain "Alex":

```bash
git checkout main
git pull
git checkout -b test/promptci-action-fail
```

Edit `examples/prompts/greeting.txt` so its full content is exactly:

```
Say a generic friendly greeting without using any names, in one sentence.
```

```bash
git add examples/prompts/greeting.txt
git commit -m "Remove name from prompt to trigger a regression (test)"
git push -u origin test/promptci-action-fail
gh pr create --title "Test promptci-action (fail)" --body "Manual verification for Task 5 — expect a failing check" --head test/promptci-action-fail --base main
```

Wait for the check, then confirm:
- The check is red (failed).
- The PR comment shows `❌ **greeting** — FAILED (...)`.

- [ ] **Step 6: Clean up the test PRs and branches**

```bash
gh pr close test/promptci-action-pass --delete-branch
gh pr close test/promptci-action-fail --delete-branch
git checkout main
git pull
```

---

### Task 6: Tag the `v1` release

**Files:** none (git tag only, in `promptci-action`)

- [ ] **Step 1: Tag and push**

```bash
cd ~/development/promptci-action
git checkout main
git pull
git tag v1
git push origin v1
```

- [ ] **Step 2: Verify**

Run: `gh release view v1 --repo kibin28-glitch/promptci-action 2>&1 || git ls-remote --tags origin`
Expected: the `v1` tag is listed (a formal GitHub Release is optional — the tag alone is enough for `uses: kibin28-glitch/promptci-action@v1` to resolve).
