# Prompt CI Engine — 진행 상황 요약

## 프로젝트 목표
개발자가 LLM 프롬프트/모델 버전을 바꿨을 때, 저장된 테스트 케이스로 자동 회귀 테스트를 돌려주는 도구.
- 타겟: 글로벌 개발자/테크인
- 최종 형태: 웹 SaaS (CLI → 웹 대시보드 순으로 단계적 확장)
- 1인 사이드프로젝트, MVP 속도 최우선

이 프로젝트는 기존 `자취생존(jss)` Flutter 앱과 완전히 무관한 별개 프로젝트다 (jss는 그대로 유지, 삭제하지 않음).

## 작업 방식 (반드시 지킬 것)
매 미션마다 아래 3단계를 순서대로, 각 단계마다 사용자 승인 받고 진행:
1. **📋 PM** — 요구사항 분석, edge case 도출, 파일/폴더 구조 제안
2. **🛠️ Tech Lead** — 라이브러리/SDK 선정, 데이터 흐름 설계
3. **💻 Senior Developer** — 실제 동작하는 Node.js/TypeScript 코드 작성

원칙: MVP 속도 최우선, 오버엔지니어링 금지 (아직 필요 없는 추상화/테스트 인프라는 나중으로 미룸).

## 지금까지 완료된 것

### 1. CLI 엔진 (완료, 로컬 검증됨)
위치: `~/development/prompt-ci-engine` (독립 git 저장소, 초기 커밋 완료)

기능: `promptci init` (설정/예제 생성) → `promptci snapshot` (현재 프롬프트를 baseline으로 저장) → `promptci run` (baseline vs 현재 버전 비교, OpenAI 호출, contains-match 또는 LLM-judge 채점, 콘솔 리포트 + `tests/results/latest.json` 저장, 회귀 시 exit code 1)

스택: TypeScript + commander + js-yaml + openai SDK + dotenv (의존성 최소화)

검증 완료: 타입체크 통과, init/snapshot 명령 정상 동작, API 키 없을 때 에러 메시지 정상 출력. 실제 OpenAI 호출까지의 end-to-end는 API 키 필요해서 미검증 (사용자가 `.env`에 키 넣고 `npm run dev -- run`으로 직접 테스트 필요).

### 2. 웹 대시보드 (💻 Senior Developer 코드 작성 완료, 로컬 빌드/타입체크 통과 — 배포 전)
목적: CLI 실행 결과를 웹에 업로드해서 공유 가능한 URL(`/r/{runId}`)로 볼 수 있게 함. 로그인 없이 시작 (2단계에서 로그인/GitHub App 연동 추가 예정).

위치: `~/development/prompt-ci-dashboard` (독립 git 저장소, 초기 커밋 완료). Next.js 16 App Router + TypeScript + Tailwind + `@supabase/supabase-js`.

구현 완료:
- `app/page.tsx` — 랜딩 페이지
- `app/r/[runId]/page.tsx` — 리포트 조회 페이지 (동적 렌더링, Supabase에서 조회, 없으면 404, pass/fail 배지 + 케이스별 baseline/current/eval 비교, 실패 케이스 빨강/성공 초록 강조)
- `app/api/runs/route.ts` — 업로드 API (`POST`): token/payload 검증 → rate limit 체크(429) → DB insert → `{ runId }` 반환
- `lib/supabase.ts` — 서버용 Supabase 클라이언트 (`NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`)
- `lib/rateLimit.ts` — `checkRateLimit(token)`, 24시간 내 100건 이상이면 false
- `supabase/migrations/0001_runs.sql` — `runs` 테이블(id uuid, token text, created_at, payload jsonb) + 인덱스
- CLI 쪽: `src/upload/uploadResult.ts` (신규) + `src/cli.ts`/`src/commands/run.ts`에 `--upload` 옵션 추가 — `PROMPTCI_DASHBOARD_URL`, `PROMPTCI_TOKEN` 환경변수 사용, 토큰 없으면 랜덤 생성 후 안내 출력. (commit 완료)

검증 완료: 두 저장소 모두 `npm run build`/타입체크 통과. Supabase 자격증명 없이도 빌드되도록 리포트 페이지/API 라우트에 `export const dynamic = "force-dynamic"` 적용.

### 3. 배포 완료 (2026-07-06)
- Supabase 프로젝트 생성 + `0001_runs.sql` 마이그레이션 적용 완료 (`runs` 테이블 존재 확인됨)
- `prompt-ci-dashboard/.env.local`에 `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` 설정 완료
- Vercel 프로젝트 생성 + 배포 완료: **https://prompt-ci-dashboard.vercel.app** (`kimkibin-s-projects/prompt-ci-dashboard`)
- 같은 환경변수 2개를 Vercel 프로젝트(Production)에도 등록 후 재배포 완료
- 더미 payload로 `POST /api/runs` → `GET /r/{runId}` 파이프라인 end-to-end 검증 완료 (HTTP 200, PASSED 배지/케이스 내용 정상 렌더링)


### 4. GitHub 로그인 + 개인 대시보드 완료 (2026-07-07)
- Supabase Auth GitHub OAuth 연동, `/login` → `/auth/callback` → `/dashboard` 플로우 구현
- `/dashboard`에서 개인 API 토큰 발급/재발급 후 `PROMPTCI_TOKEN`으로 사용 → `promptci run --upload` 결과가 계정에 연결되어 목록에 표시됨
- 기존 익명 업로드(`/r/{runId}` 공유 링크)는 그대로 유지 (토큰 미등록 시 `user_id`는 null)
- 스펙: `prompt-ci-dashboard/docs/superpowers/specs/2026-07-07-github-login-dashboard-design.md`
- 실제 GitHub 로그인 → 토큰 발급 → `promptci run --upload` → 대시보드에 run 표시까지 end-to-end 검증 완료

### 5. GitHub Actions 연동 완료 (2026-07-07)
- `promptci-action` (composite action, `kibin28-glitch/promptci-action@v1`): PR마다 자동 회귀테스트 실행, 결과를 PR 코멘트로 등록/갱신(마커 기반 upsert), 회귀 시 체크 실패
- 실제 PR 2개(pass/fail)로 end-to-end 검증 완료, 그 과정에서 발견한 실버그 2건(npx self-name collision, GraphQL/REST 댓글 ID 불일치) 원인 규명 후 수정
- 스펙/계획: `docs/superpowers/specs/2026-07-07-github-action-design.md`, `docs/superpowers/plans/2026-07-07-github-action.md`

### 6. GTM 1단계: GitHub Marketplace 등록 완료 (2026-07-11)
- `promptci-action`, `prompt-ci-engine`에 누락돼 있던 MIT LICENSE 파일 추가
- `action.yml`에 마켓플레이스 브랜딩(`icon`/`color`) 추가, 마켓플레이스 이름 충돌("promptci"가 기존 액션/이름과 겹침) → `PromptCI Regression Check`로 변경해 해결
- 3개 저장소에 GitHub topics 등록 (검색 노출용)
- 대시보드에 Open Graph/Twitter 카드 메타데이터 추가 (외부 공유 링크 미리보기용)
- README에 실제 `promptci run` 실행(정상/회귀 케이스)을 녹화한 터미널 데모(SVG) 삽입 — asciinema로 녹화 후 애니메이션 SVG로 변환
- **GitHub Marketplace 등록 완료**: https://github.com/marketplace/actions/promptci-regression-check
- 남은 GTM 항목: README/링크 공유용 Show HN 게시(초안 작성됨, 게시는 사용자 본인 계정으로 진행 필요)

