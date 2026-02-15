# 보강 주석(Enriched Annotation) 시스템 설계

> **문서 ID**: DECISION-003
> **결정일**: 2026-02-13
> **참여자**: PM, TPO
> **상태**: 확정
> **연결 문서**: PLAN-001, TECH-DESIGN-001, DESIGN-001, DECISION-002

---

## 1. 개념 정의

### 보강 주석(Enriched Annotation)이란?

코드 인덱싱 시 LLM이 소스코드를 분석하여 생성하는 **별도 파일에 저장되는 추론 기반 주석**이다. 원본 소스코드는 절대 수정하지 않으며, `.impact/annotations/` 폴더에 별도 관리한다.

### 핵심 원칙

| 원칙 | 설명 |
|------|------|
| **원본 불변** | 원본 소스코드에는 어떠한 수정도 하지 않는다 |
| **별도 파일 관리** | 보강 주석은 `.impact/annotations/` 폴더에 독립 저장 |
| **1:1 매핑** | 원본 파일 경로와 보강 주석 파일이 1:1로 대응 |
| **변경 감지** | 원본 파일의 해시값으로 변경 여부를 추적 |
| **신뢰도 표시** | LLM이 추론한 내용이므로 각 항목에 confidence 점수를 부여 |
| **사용자 수정 가능** | PM/개발자가 보강 주석을 수정/보완할 수 있으며, 수동 수정은 보호됨 |

### 기존 시스템과의 관계

```
[기존] 코드 주석 (// 정책: ...) → Layer 3 정책 분석에서 추출
[신규] 보강 주석 (annotations/*.yaml) → Layer 3 + Layer 4를 보강하는 지속적 분석 결과 저장소
```

보강 주석은 기존 정책 사전(policies.json)을 대체하지 않는다. 기존 정책 사전은 "코드 주석에서 직접 추출한 정책"이고, 보강 주석은 "LLM이 코드를 분석하여 추론한 비즈니스 로직/정책/함수 설명"이다. 두 시스템은 상호 보완적으로 동작한다.

---

## 2. PM 관점 분석

### 보강 주석이 PM에게 주는 가치

1. **레거시 시스템 분석 가능**: 주석이 전혀 없는 레거시 시스템도 LLM이 코드를 분석하여 비즈니스 로직을 추론해 두므로, 영향도 분석의 품질이 크게 향상된다.

2. **분석 일관성 향상**: DECISION-002에서 식별된 "시스템별 분석 품질 편차" 문제를 근본적으로 해소한다. Layer 3(정책 분석)의 신뢰도가 0%에 가깝던 시스템도 보강 주석 생성 후 50~70%까지 향상될 수 있다.

3. **누적 학습 효과**: 한 번 분석한 내용이 저장되어 재분석 시 참조되므로, 시간이 지날수록 분석이 더 빠르고 정확해진다.

4. **코드 기반 정책서 역생성**: 보강 주석에 축적된 비즈니스 로직/정책 정보를 바탕으로 "이 시스템에 어떤 정책이 있는지" 정책서를 자동 생성할 수 있다. PM이 개발팀 없이도 시스템의 비즈니스 규칙을 파악할 수 있다.

### 보강 주석의 정확도/신뢰도 관리

LLM 추론이므로 오류가 존재할 수 있다. 이를 관리하기 위한 전략:

| 전략 | 설명 |
|------|------|
| **confidence 점수** | 각 보강 주석 항목에 0.0~1.0 신뢰도 점수 부여 |
| **추론 근거 표시** | `inferred_from` 필드로 "왜 이렇게 추론했는지" 근거 표시 |
| **사용자 검증** | PM/개발자가 보강 주석을 검토하고 수정할 수 있는 UI 제공 |
| **수동 수정 보호** | 사용자가 수정한 항목은 `userModified: true` 플래그로 보호하여 재분석 시 덮어쓰지 않음 |
| **신뢰도 임계값** | confidence 0.5 미만인 항목은 "확인 필요" 마커를 부착하여 PM에게 검증 요청 |
| **변경 이력 추적** | 보강 주석이 생성/수정된 이력을 추적하여 투명성 확보 |

### 코드 기반 정책서 역생성의 PM 활용도

- PM이 새로운 프로젝트를 담당할 때 "이 시스템에 어떤 비즈니스 규칙이 있는지" 빠르게 파악
- 기획서 작성 시 기존 정책과 충돌하는지 사전 확인
- 시스템 간 정책 비교를 통해 정책 불일치 발견
- 정책서를 기반으로 개발팀과 정책 논의 시 공통 문서로 활용

---

## 3. TPO 관점 분석

### 기술적 타당성

보강 주석 생성은 기존 인덱싱 파이프라인의 확장이다. 현재 파이프라인의 Step [3.5](정책 주석 추출)과 Step [4.5](프로파일 생성) 사이에 "보강 주석 생성" 단계를 삽입하는 형태로, 기존 아키텍처를 크게 변경하지 않으면서 구현 가능하다.

### 구현 복잡도 평가

| 컴포넌트 | 복잡도 | 이유 |
|---------|--------|------|
| 보강 주석 파일 관리 | 낮음 | YAML 파일 읽기/쓰기, 디렉토리 관리 |
| sourceHash 기반 변경 감지 | 낮음 | crypto 모듈의 md5/sha256 해시 비교 |
| LLM 기반 주석 생성 | 중간 | 프롬프트 엔지니어링, 구조화 출력 파싱 |
| 증분 업데이트 (diff 병합) | 중간 | 기존 주석과 신규 분석 결과의 병합 로직 |
| 사용자 수정 보호 | 낮음 | userModified 플래그 체크 |
| 정책서 역생성 | 중간 | 보강 주석에서 정책 항목 수집 및 MD 문서 생성 |
| 재분석 시 참조 | 중간 | 기존 보강 주석을 LLM 컨텍스트에 포함하는 로직 |

---

## 4. 보강 주석 파일 구조 설계

### 디렉토리 구조

```
.impact/
├── annotations/                          # 보강 주석 루트
│   ├── meta.json                         # 보강 주석 전체 메타 정보
│   ├── {시스템명}/                        # 시스템별 디렉토리
│   │   ├── {모듈경로}.annotations.yaml   # 원본 파일과 1:1 매핑
│   │   └── ...
│   └── _policies/                        # 역생성된 정책서
│       ├── {시스템명}.policies.md         # 시스템별 정책서
│       └── all-policies.md               # 전체 정책서 통합본
```

### 파일 경로 규칙

원본 파일 경로와 보강 주석 파일의 매핑:

```
원본: src/services/shipping/calculateFee.ts
주석: .impact/annotations/commerce/src/services/shipping/calculateFee.ts.annotations.yaml

원본: src/api/reviews.ts
주석: .impact/annotations/commerce/src/api/reviews.ts.annotations.yaml
```

- 시스템명은 프로젝트 등록 시 자동 또는 수동으로 지정
- 경로 구분자는 OS에 관계없이 `/` 사용 (YAML 파일 내)
- 확장자: `.annotations.yaml`

### 파일 크기 관리 전략

| 규칙 | 값 | 설명 |
|------|-----|------|
| 파일당 최대 크기 | 500KB | 이를 초과하면 모듈 단위로 분할 |
| 분할 기준 | 함수/클래스 단위 | 대형 파일은 함수별 분할 파일 생성 |
| 전체 최대 크기 | 프로젝트당 100MB | 초과 시 confidence가 낮은 항목부터 정리 |

---

## 5. 보강 주석 스키마 설계 (상세)

### AnnotationFile 스키마

```yaml
# .impact/annotations/{시스템명}/{파일경로}.annotations.yaml

# 메타 정보
file: src/services/shipping.ts           # 원본 파일 경로
system: commerce                          # 소속 시스템
lastAnalyzed: "2026-02-13T10:00:00Z"      # 마지막 분석 시각
sourceHash: "abc123def456"                # 원본 파일 SHA-256 해시 (변경 감지용)
analyzerVersion: "1.0.0"                  # 분석에 사용된 엔진 버전
llmModel: "claude-sonnet-4"               # 분석에 사용된 LLM 모델

# 파일 레벨 요약
fileSummary:
  description: "배송비 계산 서비스. 주문 금액, 멤버스 여부, 배송 지역에 따라 배송비를 산출하는 핵심 비즈니스 로직 모듈"
  confidence: 0.90
  businessDomain: "배송/물류"
  keywords: ["배송비", "무료배송", "멤버스", "배송 지역"]

# 함수/메서드 레벨 보강 주석
annotations:
  - line: 42
    endLine: 78
    function: calculateShippingFee
    signature: "(order: Order, user: User) => number"
    original_comment: null                  # 원본 주석 없음
    enriched_comment: "배송비 계산 함수. 멤버스 여부(isMember)에 따라 무료배송을 판단하고, 주문 금액 3만원 이상 시 일반 사용자도 무료배송 적용. 제주/도서산간 지역은 추가 배송비 3,000원 부과."
    confidence: 0.85
    type: business_logic                    # business_logic | utility | data_access | integration | config
    userModified: false                     # 사용자가 수동 수정했는지 여부
    lastModifiedBy: null                    # 수동 수정 시 수정자 정보
    inferred_from: "isMember 변수 체크 후 shippingFee = 0 설정, orderAmount >= 30000 조건문, region === 'jeju' || region === 'island' 분기"
    policies:
      - name: "멤버스 무료배송"
        description: "컬리 멤버스 가입자에게 무료배송 적용"
        confidence: 0.80
        category: "배송"
        inferred_from: "isMember 변수 체크 후 shippingFee = 0 설정"
      - name: "3만원 이상 무료배송"
        description: "주문 금액 3만원 이상 시 일반 사용자도 무료배송"
        confidence: 0.85
        category: "배송"
        inferred_from: "orderAmount >= 30000 조건문에서 shippingFee = 0"
      - name: "제주/도서산간 추가 배송비"
        description: "제주 및 도서산간 지역은 추가 배송비 3,000원 부과"
        confidence: 0.75
        category: "배송"
        inferred_from: "region === 'jeju' || region === 'island' 분기에서 additionalFee = 3000"
    relatedFunctions: ["applyFreeShipping", "calculateAdditionalFee"]
    relatedApis: ["/api/v1/shipping/calculate"]

  - line: 95
    endLine: 120
    function: applyDiscount
    signature: "(order: Order, coupons: Coupon[], memberDiscount: boolean) => Order"
    original_comment: "// 할인 적용"          # 원본 주석 있음 (간략)
    enriched_comment: "할인 적용 함수. 쿠폰 할인과 멤버스 할인을 순차 적용하며, 중복 할인 제한 로직을 포함. 쿠폰 할인이 이미 적용된 경우 멤버스 할인을 적용하지 않음(택1). 할인 금액의 상한선은 주문 금액의 50%."
    confidence: 0.90
    type: business_logic
    userModified: false
    lastModifiedBy: null
    inferred_from: "if (couponApplied && memberDiscount) 조건문에서 하나만 적용, discountLimit = orderAmount * 0.5 상한선 로직"
    policies:
      - name: "할인 중복 적용 제한"
        description: "쿠폰 할인과 멤버스 할인 동시 적용 불가 (택1)"
        confidence: 0.75
        category: "프로모션"
        inferred_from: "if (couponApplied && memberDiscount) 조건문에서 하나만 적용"
      - name: "할인 상한선"
        description: "할인 금액은 주문 금액의 50%를 초과할 수 없음"
        confidence: 0.80
        category: "프로모션"
        inferred_from: "discountLimit = orderAmount * 0.5 상한선 로직"
    relatedFunctions: ["applyCouponDiscount", "applyMemberDiscount"]
    relatedApis: ["/api/v1/cart/discount"]
```

### meta.json 스키마

```json
{
  "version": "1.0.0",
  "createdAt": "2026-02-13T10:00:00Z",
  "lastUpdatedAt": "2026-02-13T14:30:00Z",
  "totalFiles": 45,
  "totalAnnotations": 312,
  "totalPolicies": 28,
  "systems": {
    "commerce": { "files": 20, "annotations": 180, "policies": 15 },
    "logistics": { "files": 15, "annotations": 92, "policies": 8 },
    "promotion": { "files": 10, "annotations": 40, "policies": 5 }
  },
  "avgConfidence": 0.78,
  "lowConfidenceCount": 12,
  "userModifiedCount": 5
}
```

---

## 6. 생성/업데이트 파이프라인

### 보강 주석 생성 파이프라인

인덱싱 파이프라인의 기존 Step [3.5]와 Step [4.5] 사이에 삽입:

```
[기존 Step 3.5] 정책 사전 추출 (코드 주석 기반)
    │
    ▼
[신규 Step 3.6] 보강 주석 생성/업데이트
    │
    ├── (a) 기존 보강 주석 파일 존재 확인
    │       └── 있으면: sourceHash 비교로 변경 여부 확인
    │       └── 없으면: 신규 생성 대상
    │
    ├── (b) 변경된 파일에 대해 LLM 분석 요청
    │       └── 입력: 소스코드 + 기존 보강 주석(있으면) + 프로젝트 컨텍스트
    │       └── 출력: 구조화된 보강 주석 YAML
    │
    ├── (c) 기존 보강 주석과 신규 분석 결과 병합
    │       └── userModified: true인 항목은 보존
    │       └── 변경된 함수만 업데이트
    │       └── 삭제된 함수의 주석은 제거
    │
    ├── (d) confidence 점수 산출
    │       └── LLM 응답의 구조화 성공 여부
    │       └── 추론 근거의 구체성
    │       └── 기존 주석과의 일치도 (원본 주석이 있는 경우)
    │
    └── (e) YAML 파일 저장 + meta.json 업데이트
    │
    ▼
[기존 Step 3.7] 수동 정책 사전 로드
```

### 증분 업데이트 전략

```
[증분 업데이트 흐름]

1. sourceHash 비교
   ├── 해시 동일 → 이 파일의 보강 주석은 최신 상태 → SKIP
   └── 해시 다름 → 재분석 필요

2. 재분석 대상 결정
   ├── 파일 전체가 변경됨 → 전체 재분석 (기존 보강 주석을 참조 컨텍스트로 제공)
   └── 일부 함수만 변경됨 → 해당 함수만 재분석 (git diff 활용)

3. 기존 보강 주석 병합
   ├── userModified: true인 항목 → 절대 덮어쓰지 않음
   ├── 변경된 함수 → 새 분석 결과로 교체 (confidence 비교 후 더 높은 것 선택)
   ├── 변경되지 않은 함수 → 기존 보강 주석 유지
   └── 삭제된 함수 → 보강 주석에서 제거 (archived 처리)

4. sourceHash 및 lastAnalyzed 업데이트
```

### 재분석 시 기존 보강 주석 참조

보강 주석의 핵심 가치 중 하나는 **재분석 시 기존 분석 결과를 참조하여 일관성을 높이는 것**이다.

```
[재분석 시 LLM 프롬프트 구성]

<context>
이 파일에 대해 이전에 분석한 보강 주석이 있습니다:
{기존 보강 주석 YAML}
</context>

<source>
{변경된 소스코드}
</source>

<instruction>
1. 기존 분석 결과를 참조하여 변경된 부분만 업데이트하세요.
2. 기존 분석과 일관된 용어와 설명 스타일을 유지하세요.
3. 변경으로 인해 기존 정책이 영향을 받는 경우 명시하세요.
4. 새로운 비즈니스 로직이 추가된 경우 policies에 추가하세요.
</instruction>
```

---

## 7. 코드 기반 정책서 역생성

### 개요

보강 주석의 `policies` 필드에 축적된 정책/비즈니스 로직 정보를 수집하여, 시스템별 정책서를 Markdown 문서로 자동 생성한다.

### 정책서 생성 파이프라인

```
[Step 1] 보강 주석에서 정책 항목 수집
    │
    ├── annotations/*.yaml에서 policies 필드 추출
    ├── type: business_logic인 항목의 policies만 대상
    └── confidence 0.5 이상인 정책만 포함 (임계값 설정 가능)
    │
    ▼
[Step 2] 시스템별 그룹핑
    │
    ├── 시스템명 + 카테고리별 분류
    ├── 중복 정책 탐지 및 병합
    └── 정책 간 관련성 분석 (같은 함수/모듈에서 추출된 정책 연결)
    │
    ▼
[Step 3] LLM을 활용한 정책서 정리
    │
    ├── 수집된 정책을 자연어로 정리
    ├── 카테고리별 구조화
    ├── 정책 간 충돌/모순 탐지
    └── PM이 이해할 수 있는 비기술적 표현으로 변환
    │
    ▼
[Step 4] Markdown 정책서 생성
    │
    ├── 시스템별 정책서: .impact/annotations/_policies/{시스템명}.policies.md
    └── 전체 통합 정책서: .impact/annotations/_policies/all-policies.md
```

### 정책서 출력 형식

```markdown
# 컬리 커머스 시스템 정책서

> 자동 생성일: 2026-02-13
> 소스: 코드 기반 보강 주석 분석
> 총 정책: 15건 (높은 신뢰도 10건, 확인 필요 5건)

## 배송 정책 (4건)

### 1. 멤버스 무료배송 [신뢰도: 80%]
- **설명**: 컬리 멤버스 가입자에게 무료배송 적용
- **관련 코드**: src/services/shipping/calculateFee.ts (line 42)
- **추론 근거**: isMember 변수 체크 후 shippingFee = 0 설정
- **관련 함수**: calculateShippingFee()

### 2. 3만원 이상 무료배송 [신뢰도: 85%]
- **설명**: 주문 금액 3만원 이상 시 일반 사용자도 무료배송
- **관련 코드**: src/services/shipping/calculateFee.ts (line 55)
- **추론 근거**: orderAmount >= 30000 조건문에서 shippingFee = 0

...

## 프로모션 정책 (3건)

### 1. 할인 중복 적용 제한 [신뢰도: 75%] [확인 필요]
- **설명**: 쿠폰 할인과 멤버스 할인 동시 적용 불가 (택1)
...
```

### 명령어

- `/impact annotations generate` : 보강 주석 수동 생성 (특정 파일/디렉토리)
- `/impact annotations view [파일경로]` : 특정 파일의 보강 주석 조회
- `/impact annotations edit [파일경로]` : 보강 주석 수동 편집
- `/impact policies generate` : 보강 주석 기반 정책서 역생성
- `/impact policies view --generated` : 생성된 정책서 조회

---

## 8. 신뢰도 시스템 통합

### Layer 3 점수 재산출 로직

보강 주석이 존재하는 시스템은 Layer 3(주석/문서 기반 정책 분석) 점수가 자동으로 상승한다.

**기존 Layer 3 점수 산출**:
```
- 정책 주석 1건 이상 존재: +40
- 정책 주석 5건 이상: +20 (밀도 보너스)
- README 정책 섹션 존재: +20
- 수동 정책 입력(policies.yaml) 존재: +20
```

**보강 주석 반영 후 Layer 3 점수 산출**:
```
[기존 점수 산출 유지]
- 정책 주석 1건 이상 존재: +40
- 정책 주석 5건 이상: +20 (밀도 보너스)
- README 정책 섹션 존재: +20
- 수동 정책 입력(policies.yaml) 존재: +20

[보강 주석 보너스] (신규)
- 보강 주석 파일 존재: +15
- 보강 주석의 평균 confidence >= 0.7: +10 (추가)
- 보강 주석 내 policies 항목 5건 이상: +10 (추가)
- 사용자가 검증/수정한 보강 주석 존재: +5 (추가)

[최대 점수: 100]
```

### 신뢰도 향상 시뮬레이션

**Before (보강 주석 없음)**:
```
프로젝트: kurly-legacy-settlement (Express.js)
- Layer 1: 60/100 (비표준 라우팅, 폴백 분석)
- Layer 2: 75/100 (import 그래프 성공)
- Layer 3: 10/100 (정책 주석 0건, README 정책 없음)
- Layer 4: 55/100 (LLM 추론 부분 성공)
→ 종합 신뢰도: 52% (Low Confidence)
```

**After (보강 주석 생성 후)**:
```
프로젝트: kurly-legacy-settlement (Express.js)
- Layer 1: 60/100 (변화 없음)
- Layer 2: 75/100 (변화 없음)
- Layer 3: 45/100 (보강 주석 +15, 평균 confidence 0.72이므로 +10, policies 8건 +10)
- Layer 4: 70/100 (보강 주석을 참조하여 LLM 추론 정확도 향상)
→ 종합 신뢰도: 64% (Medium Confidence)
```

Layer 3 점수가 10 → 45, Layer 4 점수가 55 → 70으로 향상되어, 종합 신뢰도가 52% → 64%로 Low에서 Medium으로 개선된다.

---

## 9. 성능/비용 분석

### 최초 보강 주석 생성

| 항목 | 값 | 비고 |
|------|-----|------|
| 파일당 LLM 호출 | 1회 | 파일당 1회 분석 요청 |
| 파일당 입력 토큰 | ~2,000~5,000 | 소스코드 크기에 따라 변동 |
| 파일당 출력 토큰 | ~500~1,500 | 보강 주석 YAML |
| 파일당 소요 시간 | ~3~8초 | LLM 응답 시간 포함 |
| 병렬 처리 | 5~10 파일 동시 | rate limit 고려 |
| 10만 LOC 프로젝트 예상 | ~200파일 x 5초 = ~17분 (10병렬 시) | 최초 1회만 |
| 비용 예상 (10만 LOC) | ~$2~5 | Claude Sonnet 기준 |

### 증분 업데이트

| 항목 | 값 | 비고 |
|------|-----|------|
| 변경 파일만 재분석 | sourceHash 비교로 필터 | 대부분 10% 미만 |
| 재분석 시 기존 주석 참조 | 추가 입력 ~500 토큰 | 컨텍스트로 제공 |
| 일반적 업데이트 시간 | 1~3분 | 변경 파일 20개 기준 |

### 대규모 프로젝트 전략 (10만+ LOC)

| 전략 | 설명 |
|------|------|
| **우선순위 기반 분석** | 핵심 비즈니스 로직 파일(services/, api/)을 우선 분석 |
| **점진적 생성** | 최초 인덱싱 시 전체를 한 번에 하지 않고, 분석 요청 시 필요한 파일만 생성 |
| **배치 처리** | `/impact annotations generate --all` 명령으로 백그라운드 일괄 생성 |
| **캐시 활용** | sourceHash가 동일한 파일은 SKIP |
| **비용 상한선** | 설정 파일에서 1회 분석당 최대 비용 설정 가능 |

---

## 10. MVP 범위 결정

### MVP에 포함 (Phase 1)

| # | 기능 | 우선순위 | 이유 |
|---|------|---------|------|
| 1 | 보강 주석 자동 생성 (인덱싱 시) | HIGH | 핵심 기능, Layer 3 신뢰도 향상 |
| 2 | 보강 주석 파일 관리 (.impact/annotations/) | HIGH | 기본 인프라 |
| 3 | sourceHash 기반 변경 감지 | HIGH | 증분 업데이트의 전제 |
| 4 | 증분 업데이트 (변경 파일만 재분석) | HIGH | 성능/비용 효율 |
| 5 | 재분석 시 기존 보강 주석 참조 | HIGH | 일관성 향상의 핵심 |
| 6 | 영향도 분석 시 보강 주석 참조 | HIGH | 분석 품질 향상 |
| 7 | Layer 3 신뢰도 점수 재산출 | MEDIUM | 기존 신뢰도 시스템과 통합 |
| 8 | CLI: `/impact annotations generate` | MEDIUM | 수동 생성 트리거 |
| 9 | CLI: `/impact annotations view` | MEDIUM | 조회 기능 |

### Phase 2로 이동

| # | 기능 | 이유 |
|---|------|------|
| 1 | 보강 주석 수동 편집 UI (웹) | 웹 UI 복잡도 높음, CLI 편집으로 대체 가능 |
| 2 | 코드 기반 정책서 역생성 | 보강 주석 축적 후 의미 있음 |
| 3 | 정책 간 충돌/모순 자동 탐지 | 고급 분석 기능 |
| 4 | 보강 주석 내보내기/가져오기 | 팀 간 공유 기능 |
| 5 | 보강 주석 검증 UI (신뢰도 낮은 항목 일괄 검증) | 웹 UI 기능 |

> **근거**: MVP에서는 보강 주석의 "생성 + 참조"에 집중하여 핵심 가치(분석 품질 향상)를 검증한다. 정책서 역생성과 수동 편집 UI는 보강 주석이 충분히 축적된 후에 더 효과적이므로 Phase 2로 이동한다.

---

## 11. 사용자 플로우

### 플로우 1: 최초 인덱싱 시 보강 주석 자동 생성

```
1. PM이 `/impact init /path/to/project` 실행
2. 기존 인덱싱 파이프라인 실행 (파일 스캔 → AST 파싱 → 구조 추출 → 정책 추출)
3. [신규] 보강 주석 생성 단계:
   "보강 주석을 생성합니다... (LLM이 코드를 분석하여 비즈니스 로직을 추론합니다)"
   "[1/45] src/services/shipping/calculateFee.ts 분석 중..."
   "[2/45] src/services/cart/discount.ts 분석 중..."
   ...
   "보강 주석 생성 완료: 45개 파일, 312개 함수 분석, 28개 정책 추론"
4. 프로파일 생성 시 보강 주석 정보 반영
5. 결과 표시에 "보강 주석 현황" 섹션 추가
```

### 플로우 2: 영향도 분석 시 보강 주석 활용

```
1. PM이 `/impact analyze` 실행
2. 인덱스 매칭 (Step 3)에서 보강 주석도 함께 검색
3. LLM 영향도 분석 (Step 4)에서 보강 주석을 추가 컨텍스트로 제공
   → "이 함수는 '멤버스 무료배송' 정책과 관련된 배송비 계산 함수입니다 (보강 주석 참조)"
4. 분석 결과에 보강 주석에서 추론된 정책 정보 반영
5. 신뢰도 점수 산출 시 보강 주석 존재 여부 반영
```

### 플로우 3: 코드 변경 후 증분 업데이트

```
1. 개발팀이 코드 변경 → PM이 git pull
2. `/impact reindex` 또는 `/impact analyze` 실행 시 변경 감지
3. sourceHash가 변경된 파일만 재분석:
   "변경 감지: 5개 파일 변경됨"
   "보강 주석 업데이트 중... (5개 파일 재분석)"
   "사용자 수정 보강 주석 2건은 보존됩니다."
4. 업데이트 완료 후 변경 요약:
   "보강 주석 업데이트 완료: 5개 파일 재분석, 3개 정책 변경 감지"
```

---

## 12. 리스크 및 대응

| 리스크 | 심각도 | 대응 방안 |
|--------|--------|----------|
| **LLM 추론 오류** | 높음 | confidence 점수로 신뢰도 표시, 사용자 검증 경로 제공, "확인 필요" 마커 부착 |
| **LLM 비용 증가** | 중간 | 증분 업데이트로 최소화, 비용 상한선 설정, 점진적 생성 전략 |
| **대규모 프로젝트 시간** | 중간 | 우선순위 기반 분석, 병렬 처리, 백그라운드 일괄 생성 |
| **보강 주석과 실제 코드의 괴리** | 중간 | sourceHash 기반 변경 감지, 오래된 주석에 "outdated" 경고 표시 |
| **저장 공간 증가** | 낮음 | 파일당 500KB 제한, 프로젝트당 100MB 제한, 정리 명령 제공 |
| **사용자 수정 충돌** | 낮음 | userModified 플래그로 보호, 충돌 시 사용자 수정본 우선 |
| **PM의 보강 주석 오해** | 중간 | UI에서 "LLM이 추론한 내용이며 확인이 필요할 수 있습니다" 안내 항상 표시 |

---

## 사용자 관점 검토

이 결정이 PM(사용자)에게 미치는 영향:

1. **긍정적 영향**
   - 주석 없는 레거시 시스템도 의미 있는 수준의 영향도 분석이 가능해짐
   - DECISION-002에서 식별된 "시스템별 분석 품질 편차" 문제가 크게 완화됨
   - 분석을 반복할수록 정확도가 향상되는 "학습 효과"
   - Phase 2에서 정책서 역생성이 추가되면 PM의 시스템 이해도가 크게 향상

2. **주의 사항**
   - LLM 추론 결과이므로 100% 정확하지 않을 수 있음을 PM이 인지해야 함
   - confidence 점수가 낮은 항목은 반드시 개발팀 확인이 필요
   - 최초 보강 주석 생성 시 추가 시간(~17분)과 비용($2~5)이 발생
   - 보강 주석의 양이 많아지면 "어디까지가 확실한 정보인지" 판단이 어려울 수 있음

3. **대응**
   - 모든 보강 주석에 "LLM이 추론한 내용입니다" 표시
   - confidence 점수를 시각적으로 명확하게 구분 (높음=초록, 낮음=주황)
   - 사용자가 검증/수정할 수 있는 경로 제공 (CLI + Phase 2에서 웹 UI)
