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

### 2. 웹 대시보드 (설계 완료, 코드 작성 전 — 다음 단계는 💻 Senior Developer)
목적: CLI 실행 결과를 웹에 업로드해서 공유 가능한 URL(`/r/{runId}`)로 볼 수 있게 함. 로그인 없이 시작 (2단계에서 로그인/GitHub App 연동 추가 예정).

확정된 설계:
- 신규 저장소 `prompt-ci-dashboard` (Next.js App Router + Supabase + Vercel 배포)
- DB 스키마: `runs` 테이블 (id uuid, token text, created_at, payload jsonb)
- `token`은 진짜 인증이 아니라 업로드 출처 구분/rate-limit용 (24시간 100건 제한, SQL count로 체크)
- 데이터 흐름: CLI `promptci run --upload` → `POST /api/runs` → DB insert → 공유 URL 반환 → CLI가 콘솔에 URL 출력
- 폴더 구조:
  ```
  prompt-ci-dashboard/
  ├── app/page.tsx                  # 랜딩
  ├── app/r/[runId]/page.tsx        # 리포트 조회 페이지
  ├── app/api/runs/route.ts         # 업로드 API
  ├── lib/supabase.ts
  ├── lib/rateLimit.ts
  └── supabase/migrations/0001_runs.sql
  ```
  CLI 쪽에는 `src/upload/uploadResult.ts` + `run.ts`에 `--upload` 옵션 추가 필요

**다음 할 일**: Supabase 프로젝트 생성 → 💻 Senior Developer 단계로 위 설계 그대로 코드 작성.

## 참고
- 실제 OpenAI API 키가 있어야 CLI의 `run` 명령을 끝까지 테스트 가능
- 웹 대시보드 진행하려면 supabase.com에서 무료 프로젝트 하나 미리 만들어두면 좋음
