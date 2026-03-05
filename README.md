# Risk Evaluation System

체크리스트 기반 **정보보안 위험평가 관리 시스템**입니다.
ISMS / ISO27001 통제항목을 기준으로 현황 기록, 취약 식별, 위험평가, 대응, 잔여 위험 재평가, 보고서 생성까지 **전체 위험관리 프로세스**를 웹 기반으로 수행할 수 있습니다.

---

# Overview

이 시스템은 다음과 같은 보안 관리 활동을 지원합니다.

1. 보안 통제 체크리스트 관리
2. 통제 이행 현황 기록
3. 취약 항목 식별
4. 위험도 평가 (Likelihood / Impact)
5. 위험 대응 전략 수립
6. 잔여 위험 재평가
7. 위험평가 결과 보고서 생성

전체 흐름은 다음과 같습니다.

```
Checklist
   ↓
Status 작성
   ↓
Vulnerability 식별
   ↓
Risk Evaluation
   ↓
Risk Treatment
   ↓
Residual Risk
   ↓
Report
```

---

# Main Features

## 1. Checklist Management

보안 통제 항목을 관리합니다.

지원 항목

* ISMS
* ISO27001

체크리스트 항목 구조

* Type
* Domain
* Area
* Code
* Question
* Guide

---

## 2. Status Management

각 통제 항목에 대해 실제 운영 환경의 상태를 기록합니다.

입력 항목

* 현황(Status)
* 증적(Evidence 업로드)

지원 기능

* 이미지 썸네일 미리보기
* 증적 파일 업로드
* 파일 삭제

---

## 3. Vulnerability Identification

체크리스트 결과를 기반으로 취약 여부를 식별합니다.

결과 상태

* 양호
* 취약

취약 항목은 이후 위험 평가 단계로 전달됩니다.

---

## 4. Risk Evaluation

취약 항목에 대해 위험도를 평가합니다.

평가 요소

Likelihood

* Unlikely
* Likely
* Highly Likely

Impact

* Low
* Medium
* High

Risk Matrix

```
Likelihood \ Impact

            Low   Medium   High
Highly      6      3        1
Likely      8      5        2
Unlikely    9      7        4
```

Risk Level

* High
* Medium
* Low

---

## 5. Risk Treatment

식별된 위험에 대한 대응 전략을 정의합니다.

전략 유형

* 수용 (Accept)
* 감소 (Mitigate)
* 회피 (Avoid)
* 이전 (Transfer)

---

## 6. Residual Risk

대응 조치 이후 남아있는 위험을 재평가합니다.

평가 항목

* Residual Likelihood
* Residual Impact

---

## 7. Report Generation

취약 항목 기반 위험평가 결과 보고서를 생성합니다.

보고서 포함 내용

* 결과 요약
* 취약 도메인 분포
* 취약 상세 목록
* 현황
* 사유
* 증적 링크

지원 기능

* PDF 저장
* 인쇄

---

# System Architecture

```
React
  │
  │ UI
  ▼
Supabase Auth
  │
  ▼
Supabase Database
  │
  ▼
Checklist Data
```

---

# Authentication

로그인은 **Google OAuth 기반 Supabase 인증**을 사용합니다.

제한 사항

* `@muhayu.com` 계정만 로그인 가능

도메인 검증 로직

```
if (!email.endsWith("@muhayu.com")) {
  signOut()
}
```

---

# Tech Stack

Frontend

* React
* TailwindCSS
* Lucide Icons

Backend

* Supabase

Database

* PostgreSQL (Supabase)

Auth

* Google OAuth

---

# Project Structure

```
src
 ├─ components
 │   ├─ LoginPage.jsx
 │   ├─ DashboardPanel.jsx
 │   ├─ ChecklistPanel.jsx
 │   ├─ StatusWritePanel.jsx
 │   ├─ VulnIdentifyPanel.jsx
 │   ├─ RiskEvaluatePanel.jsx
 │   ├─ RiskTreatmentPanel.jsx
 │   ├─ ResidualRiskPanel.jsx
 │   └─ ApprovePanel.jsx
 │
 ├─ ui
 │   └─ Button.jsx
 │
 ├─ lib
 │   └─ supabaseClient.js
 │
 └─ App.jsx
```

---

# Installation

## 1. Repository Clone

```
git clone https://github.com/your-repo/risk-evaluation-system.git
cd risk-evaluation-system
```

## 2. Install Dependencies

```
npm install
```

## 3. Environment Variables

`.env`

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

## 4. Run

```
npm run dev
```

---

# Deployment

추천 배포 환경

* Vercel
* Cloudflare Pages

배포 전 설정

Supabase

Authentication → Redirect URL

```
https://your-domain
```

---

# Security Notes

본 시스템은 다음 보안 요구사항을 고려하여 설계되었습니다.

* 회사 계정 기반 인증
* 도메인 기반 접근 제한
* 증적 파일 관리
* 위험 평가 이력 관리

---

# Future Improvements

* 사용자 권한 관리 (RBAC)
* 위험 추적 대시보드
* CSV / Excel export
* 자동 위험 분석
* 감사 로그

---

# License

Internal Project

---

# Author

Security Consultant

Information Security / R
