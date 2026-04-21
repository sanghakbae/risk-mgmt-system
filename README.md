# Risk Management System

ISMS 및 ISO27001 통제 항목을 기준으로 체크리스트 관리, 이행 현황 기록, 취약 식별, 위험도 평가, 위험 대응, 잔여 위험 재평가, 보고서 생성을 수행하는 웹 기반 위험관리 시스템입니다.

운영 도메인:

```text
https://rms.sanghak.kr
```

## Overview

전체 업무 흐름은 다음 순서로 진행됩니다.

```text
Checklist
→ Status 작성
→ Vulnerability 식별
→ Risk Evaluation
→ Risk Treatment
→ Residual Risk
→ Report
```

각 단계는 선행 단계 완료 여부에 따라 입력이 잠깁니다. 예를 들어 위험도 평가는 취약 식별 단계가 완료된 뒤 입력할 수 있고, 위험 대응은 위험도 산정이 완료된 뒤 입력할 수 있습니다.

## Main Features

### Dashboard

- 전체 체크리스트 진행률 요약
- 도메인별 취약/양호/미입력 현황
- 상위 위험 도메인 확인

### Checklist

- ISMS 및 ISO27001 통제 항목 관리
- CSV 업로드 및 기존 데이터 병합
- `likelihood`와 `impact`가 포함된 업로드 데이터는 `risk = impact * likelihood` 기준으로 자동 재계산

### Status

- 통제 항목별 운영 현황 입력
- 증적 파일 업로드 및 삭제
- 이미지 증적 미리보기

### Vulnerability

- 통제 항목별 결과를 `양호` 또는 `취약`으로 식별
- 취약 항목은 Risk Evaluation 단계의 평가 대상이 됩니다.

### Risk Evaluation

위험도는 곱셈 방식으로 계산합니다.

```text
Risk = Impact × Likelihood
```

Likelihood:

```text
1 = Unlikely
2 = Likely
3 = Highly Likely
```

Impact:

```text
1 = Low
2 = Medium
3 = High
```

Risk level:

```text
1~3 = Low
4~6 = Medium
7~9 = High
```

예시:

```text
Likelihood = Likely(2)
Impact = Medium(2)
Risk = 2 × 2 = 4
Risk Level = Medium
```

기존 DB의 `risk` 값이 현재 계산식과 다르면 Risk Evaluation 화면에서 재계산 배너가 표시됩니다. `Risk 재계산` 버튼을 누르면 저장된 `risk` 컬럼을 `impact * likelihood` 기준으로 일괄 보정합니다.

### Risk Treatment

취약 항목에 대한 대응 전략을 관리합니다.

전략 유형:

```text
수용 (Accept)
감소 (Mitigate)
회피 (Avoid)
전가 (Transfer)
```

ISMS는 DoA, ISO27001은 ARL 기준을 사용합니다.

```text
ISMS    = DoA (Degree of Assurance)
ISO27001 = ARL (Acceptable Risk Level)
```

DoA/ARL은 허용 가능한 최대 Risk 값입니다.

```text
Risk <= DoA/ARL → 허용 가능
Risk > DoA/ARL  → 조치 필요
```

Treatment 화면에서는 `Risk <= DoA/ARL`인 항목의 처리 전략이 무조건 `수용`으로 고정됩니다. 사용자가 다른 전략을 저장해 둔 기존 데이터가 있어도 화면과 저장 payload는 `수용`을 적용합니다.

처리 전략 안내 패널은 접기/펼치기를 지원합니다.

### Residual Risk

위험 대응 이후 잔여 위험을 다시 평가합니다.

잔여 위험도도 동일하게 계산합니다.

```text
Residual Risk = Residual Impact × Residual Likelihood
```

잔여 위험 우선 확인 목록은 DoA/ARL 기준을 초과한 항목을 우선 표시합니다.

### Report

- 취약 항목 기반 보고서 생성
- 현황, 사유, 증적, 위험도, 대응 내용 확인
- 인쇄 및 PDF 저장 흐름 지원

### Admin

관리자 메뉴는 admin 권한 사용자만 접근할 수 있습니다.

Admin Security:

- 허용 이메일 도메인 설정
- 세션 만료 시간 설정
- 감사 로그 보관 기간 설정
- ISMS DoA / ISO27001 ARL 기준 설정

DoA/ARL 선택 가능 값:

```text
1, 2, 3, 4, 6, 9
```

Admin Audit Logs:

- 관리자 작업 이력 조회

Admin Access:

- 사용자 역할 조회 및 변경
- 앱 접근 권한 관리

## Authentication

인증은 Supabase Auth와 Google OAuth를 사용합니다.

앱 흐름:

```text
Frontend
→ Supabase Auth Google OAuth 시작
→ Google 로그인
→ Supabase callback
→ 앱 redirect URL로 복귀
→ Supabase session/JWT로 DB 접근
```

현재 기본 허용 이메일 도메인:

```text
muhayu.com
```

Supabase URL Configuration 권장값:

```text
Site URL:
https://rms.sanghak.kr

Redirect URLs:
https://rms.sanghak.kr
http://localhost:5173
http://localhost:5174
```

Google Cloud Console 설정:

```text
Authorized JavaScript origins:
https://rms.sanghak.kr
http://localhost:5173
http://localhost:5174

Authorized redirect URI:
https://zpkvnlipirbfuwpfxyja.supabase.co/auth/v1/callback
```

## Tech Stack

Frontend:

- React
- Vite
- Tailwind CSS
- Lucide Icons

Backend:

- Supabase Auth
- Supabase Database
- PostgreSQL

## Project Structure

```text
src
├─ api
│  ├─ admin.js
│  └─ checklist.js
├─ components
│  ├─ AdminAccessPanel.jsx
│  ├─ AdminAuditLogsPanel.jsx
│  ├─ AdminSecurityPanel.jsx
│  ├─ ApprovePanel.jsx
│  ├─ ChecklistPanel.jsx
│  ├─ DashboardPanel.jsx
│  ├─ LoginPage.jsx
│  ├─ ResidualPanel.jsx
│  ├─ RiskEvaluatePanel.jsx
│  ├─ RiskTreatmentPanel.jsx
│  ├─ StatusWritePanel.jsx
│  └─ VulnIdentifyPanel.jsx
├─ lib
│  └─ supabaseClient.js
├─ ui
│  └─ Button.jsx
├─ utils
│  ├─ evidence.js
│  └─ riskPolicy.js
├─ App.jsx
└─ main.jsx
```

## Installation

```bash
git clone git@github-sanghakbae:sanghakbae/risk-mgmt-system.git
cd risk-mgmt-system
npm install
```

Create `.env.local`:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_ADMIN_EMAILS=
VITE_SUPABASE_READ_CHECKLIST=1
VITE_SUPABASE_WRITE_CHECKLIST=0
```

Run locally:

```bash
npm run dev
```

If port `5173` is already in use, Vite may use another port such as `5174`. That port must also be listed in Supabase Redirect URLs for local OAuth login.

## Build

```bash
npm run build
```

The production build outputs static files to `dist`.

## Deployment

This repository is configured for GitHub Pages deployment.

Custom domain file:

```text
public/CNAME
```

Current CNAME:

```text
rms.sanghak.kr
```

Vite base path is `/`, which is required for serving from the custom domain root.

## Security Notes

- Google OAuth is handled through Supabase Auth.
- Browser session storage is used so the app session is cleared when the browser/tab session ends.
- App-level session timeout is enforced in addition to Supabase token expiry.
- Admin actions are written to audit logs.
- Domain-based login restriction is loaded from `security_settings.allowed_domain`.

## Current Risk Rules

```text
Risk = Impact × Likelihood

1~3 = Low
4~6 = Medium
7~9 = High

ISMS DoA / ISO27001 ARL:
Risk <= 기준값 → 허용 가능
Risk > 기준값  → 조치 필요
```

## License

Internal Project
