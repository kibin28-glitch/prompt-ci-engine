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

### 4. 실제 OpenAI 호출 포함 end-to-end 테스트 완료 (2026-07-06)
- `prompt-ci-engine/.env`에 `OPENAI_API_KEY`, `PROMPTCI_DASHBOARD_URL`, `PROMPTCI_TOKEN` 설정 완료
- `promptci run --upload` 실행 → gpt-4o-mini 실제 호출 → 케이스 PASS → 대시보드 업로드 → 리포트 URL 확인 (HTTP 200)
- CLI → 웹 대시보드 전체 파이프라인이 실사용 조건에서 정상 동작함을 확인

### 5. GitHub 공개 + npm 배포 완료 (2026-07-07)
- `prompt-ci-engine` → https://github.com/kibin28-glitch/prompt-ci-engine (public)
- `prompt-ci-dashboard` → https://github.com/kibin28-glitch/prompt-ci-dashboard (public)
- npm 패키지명 `promptci`는 기존 `prompt`/`prompts`와 유사하다는 이유로 npm이 거부 → `@kibin28-glitch/promptci`로 스코프 변경 후 배포 성공
- 설치: `npx @kibin28-glitch/promptci init` (동작 확인됨 — `--help` 정상 출력)
- 랜딩 페이지(`app/page.tsx`)의 GitHub/npm 링크 및 설치 안내 문구 실제 주소로 교체, Vercel 재배포 완료
- 각 저장소에 사용자용 README 작성 완료

**다음 할 일 (선택)**:
1. 실제 사용할 프롬프트/테스트케이스를 `examples/` 대신 프로젝트에 맞게 추가
2. 로그인/GitHub App 연동 등 2단계 기능 (PROJECT_STATUS.md 상단 로드맵 참고)
3. npm 계정 2FA 복구 코드(recovery codes)를 대화 중 노출한 적 있어 재발급 권장

## 참고
- MVP 전체 사이클(로컬 개발 → GitHub 공개 → npm 배포 → 웹 대시보드 배포 → 실사용 테스트)이 실사용 조건에서 검증 완료됨
