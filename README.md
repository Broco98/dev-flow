# dev-flow

> 코드에서 자동 추출하는 **계층형 프로젝트 그래프**

TS/JS 코드를 정적 분석해서 **"기능(진입점) → 프로세스(호출 체인) → 데이터(타입/모델) 흐름"**을
UML 없이 **드릴다운 가능한 인터랙티브 그래프**로 보여주는 도구입니다.

- 처음엔 크게(API/핸들러 단위) 보고, 노드를 클릭하면 내부 함수·모델 호출로 **펼쳐(semantic zoom)** 볼 수 있습니다.
- 어떤 기능이 어떤 프로세스·데이터 흐름을 가지는지, 문서를 따로 그리지 않아도 코드만으로 파악합니다.

> 상태: **Phase 1 완료** — TS/JS · Express 진입점 · 호출 그래프 · 타입/모델 흐름 · 웹 뷰어.
> 설계는 [`docs/superpowers/specs/2026-06-28-dev-flow-design.md`](docs/superpowers/specs/2026-06-28-dev-flow-design.md),
> 구현 계획은 [`docs/superpowers/plans/2026-06-28-dev-flow-phase1.md`](docs/superpowers/plans/2026-06-28-dev-flow-phase1.md) 참고.

## 아키텍처

언어 무관 **그래프 IR(JSON)**을 유일한 계약으로 두고, 분석기와 뷰어를 완전히 분리합니다
(LSP / tree-sitter 패턴). 언어를 추가할 때는 IR·뷰어는 그대로 두고 **분석기 플러그인만** 추가합니다.

```
┌──────────────────────┐   ┌─────────────────┐   ┌──────────────────────────┐
│  @dev-flow/analyzer   │   │  @dev-flow/ir    │   │  @dev-flow/viewer        │
│  ts-morph 정적 분석   │──▶│  zod 스키마 +     │──▶│  React + @xyflow/react   │
│  (Phase1 = TS/Express)│   │  IR(JSON) 계약    │   │  Tailwind + shadcn + zustand │
│  bun으로 TS 직접 실행 │   │  zod에만 의존     │   │  드릴다운 / 상세 패널      │
└──────────────────────┘   └─────────────────┘   └──────────────────────────┘
```

- **`@dev-flow/ir`** — 그래프 IR의 zod 스키마 + 추론 타입. 의존성은 **zod 단 하나** (브라우저 안전).
- **`@dev-flow/analyzer`** — ts-morph로 코드를 분석해 IR(JSON)을 생성하는 CLI/라이브러리.
- **`@dev-flow/viewer`** — IR을 받아 인터랙티브 그래프로 렌더하는 웹 앱. 분석기를 import하지 않습니다.

bun의 **isolated linker**가 "ir은 zod에만 의존" 경계를 install 단계에서 강제합니다.

## 기술 스택

- **런타임/패키지 매니저**: [bun](https://bun.sh) (workspaces + catalog + `linker="isolated"`)
- **언어**: TypeScript 6 (`moduleResolution: bundler`, ir는 빌드 단계 없이 `exports`→소스)
- **분석**: [ts-morph](https://ts-morph.com) 28
- **IR 검증**: [zod](https://zod.dev) 4
- **뷰어**: React 19 · [@xyflow/react](https://reactflow.dev) 12 · Tailwind CSS v4 · [shadcn/ui](https://ui.shadcn.com) · lucide-react · [zustand](https://zustand.docs.pmnd.rs) 5
- **테스트**: [Vitest](https://vitest.dev) 4

## 요구 사항

- **bun** ≥ 1.3.2 (`.bun-version`은 1.3.14로 고정)
- **Node.js** ≥ 20.19 — Vite/Vitest가 Node shebang으로 실행됩니다 (bun은 분석기 TS를 직접 실행)

## 시작하기

```bash
bun install        # isolated linker로 의존성 설치
bun run typecheck  # 3개 패키지 전체 타입 체크
bun run test       # 전체 테스트 (vitest)
```

## 사용법

### 1. 프로젝트를 분석해 IR 생성

분석기 CLI에 대상 프로젝트의 `tsconfig.json` 경로를 넘기면 정규화된 IR(JSON)을 stdout으로 출력합니다.

```bash
# 동봉된 Express 픽스처로 시험
bun run packages/analyzer/src/cli.ts packages/analyzer/test/fixtures/express-app/tsconfig.json

# 본인 프로젝트를 분석해 뷰어가 읽는 위치에 저장
bun run packages/analyzer/src/cli.ts /path/to/your/tsconfig.json > packages/viewer/public/graph.json
```

해석 불가한 동적 호출 등은 `unresolved` 노드로 표시되고, 건너뛴 항목은 `warnings[]`에 누적되어
stderr로도 알려줍니다.

### 2. 뷰어로 그래프 탐색

```bash
bun run dev:viewer   # Vite 개발 서버 실행 → 브라우저에서 /graph.json 로드
```

- 최상위에는 **진입점(예: `GET /users`)**만 보입니다.
- 노드를 클릭하면 그 노드가 호출하는 **함수·모델**이 펼쳐집니다 (드릴다운).
- 노드를 선택하면 **상세 패널**에 `file:line`·종류·시그니처가 표시됩니다.

## 그래프 IR

`@dev-flow/ir`이 정의하는 언어 무관 계약 (`schemaVersion: "1.0.0"`):

**노드 종류** — `entrypoint`(method/route) · `function`(signature?) · `module` · `model`(modelKind) · `unresolved`

**엣지 종류**
- `call` — 프로세스(제어 흐름): entrypoint→function, function→function, function→unresolved
- `contains` — 구조(소속): module→function
- `dataTouch` — 데이터 흐름: function→model (`meta.access` read/write · `meta.dataType`)

최상위 문서: `{ schemaVersion, language, nodes[], edges[], warnings[] }`

## 프로젝트 구조

```
packages/
  ir/        @dev-flow/ir       — zod IR 스키마 + 타입 (계약, zod에만 의존)
  analyzer/  @dev-flow/analyzer — ts-morph 분석기 + CLI
  viewer/    @dev-flow/viewer   — Vite/React 그래프 뷰어
docs/superpowers/
  specs/     설계 스펙
  plans/     구현 계획 (TDD 태스크별)
```

## 로드맵 (Phase 2+)

- Tauri 데스크톱 셸 + 소스 파일 점프
- 멀티 언어 분석기 (Python `ast`, Go `go/ast` 등) — IR/뷰어 재사용
- 진짜 데이터플로우(값 추적), Express 외 프레임워크 진입점
- ORM 인식(TypeORM `@Entity`, Prisma) 데이터 흐름
- 자동 레이아웃(dagre/elk), 모듈 그룹화 시각화, 증분/워치 분석

## 개발

각 패키지는 독립적으로 실행됩니다.

```bash
bun run --filter '@dev-flow/analyzer' test       # 한 패키지만 테스트
bunx vitest run packages/viewer/test/viewer.test.tsx   # 단일 테스트 파일
bun run --filter '@dev-flow/viewer' typecheck    # 한 패키지만 타입 체크
```

분석기와 뷰어는 런타임 코드를 공유하지 않으며, 오직 `@dev-flow/ir`을 통해서만 연결됩니다.
이 덕분에 양쪽을 IR 픽스처로 완전히 분리해 테스트할 수 있습니다.
