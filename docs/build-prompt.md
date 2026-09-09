# Min Journal — 신규 빌드 프롬프트 (Claude Code)

## 0. 역할과 목표

너는 이 프로젝트의 단독 개발자다. CRT(Candle Range Theory) 전략 기반 **1인용 매매일지 웹앱 "Min Journal"** 을 빈 저장소에서부터 완성한다.

- 기존에 다른 매매일지 앱이 있지만 **참조하지 않는다.** 이 프로젝트는 완전히 독립적인 새 코드베이스다.
- 데이터 이관은 없다. 빈 DB에서 시작한다.
- **하나의 반응형 코드베이스가 PC와 모바일을 모두 커버한다.** 별도 `/mobile` 라우트를 만들지 않는다.

---

## 1. 참고 파일

저장소에 `docs/` 폴더를 만들고 아래 파일들을 넣은 뒤 작업한다.

| 파일 | 성격 | 취급 |
| --- | --- | --- |
| `docs/README.md` | 화면별 스펙·디자인 토큰·데이터 모델 핸드오프 문서 | **1차 기준(single source of truth).** 색상/px/카피는 전부 확정값이다. |
| `docs/design-canvas.html` | 10개 목업이 들어있는 디자인 캔버스 | **2차 기준.** README에 없는 정확한 수치는 인라인 스타일에서 직접 읽어라. |
| `docs/support.js` | 캔버스를 브라우저에서 렌더링하기 위한 런타임 | **읽지도 말고 수정하지도 마라.** 사람이 목업을 눈으로 확인할 때만 필요하므로 `design-canvas.html` 옆에 그대로 둔다. |

규칙:

- `support.js`는 앱 코드가 아니다. 여기서 어떤 패턴도 가져오지 마라.
- 캔버스의 껍데기(`.dv-turn`, `.dv-card`, `.dv-opt`, id 배지, 설명 문단, 폰 베젤)는 **앱의 일부가 아니다.** 각 목업 **안쪽**만 이식한다.
- 목업의 인라인 스타일을 그대로 복붙하지 마라. 토큰화된 CSS 변수 + Tailwind 유틸리티 + 재사용 컴포넌트로 재구성한다.
- README와 캔버스가 충돌하면 README를 따르고, 충돌 지점을 작업 로그에 남긴다.

---

## 2. 확정된 기술 결정 (변경 금지)

```
Framework   Next.js 15 (App Router) + React 19 + TypeScript (strict)
Styling     Tailwind CSS v4 (@theme로 디자인 토큰 정의) + globals.css의 CSS 변수
Data        Supabase — Postgres + Auth + Storage
DB access   @supabase/supabase-js + @supabase/ssr (ORM 없음)
Types       supabase gen types typescript → src/lib/database.types.ts
Migrations  supabase/migrations/*.sql (Supabase CLI)
Charts      직접 작성한 인라인 SVG (에쿼티 커브, 스파크라인, 밸런스/1R 듀얼 라인)
            → 라이브러리 쓰지 마라. 목업의 스트로크/필/캡션 스펙을 그대로 재현해야 한다.
Icons       lucide-react (16–20px). 목업의 ✕ ‹ › ▾ ✓ 글리프를 아이콘으로 치환.
Font        Pretendard (npm `pretendard` 패키지로 self-host, CDN 금지)
Forms       react-hook-form + zod
State       서버 상태는 Server Component + Server Action. 클라이언트 전역 상태는
            폼 드래프트와 필터 정도이므로 zustand 하나만 사용.
Deploy      Vercel
```

**금지 사항**

- Prisma, Drizzle 등 추가 ORM 도입 금지.
- Recharts / Chart.js / D3 등 차트 라이브러리 도입 금지.
- shadcn/ui 등 컴포넌트 킷 전체 도입 금지. 필요한 프리미티브는 직접 만든다.
- localStorage에 이미지 저장 금지. 첨부는 Supabase Storage.

---

## 3. 인증

단일 사용자다. 과하게 만들지 마라.

- Supabase Auth 이메일 + 비밀번호 로그인 한 개.
- `middleware.ts`에서 미인증 시 `/login`으로 리다이렉트.
- 모든 테이블에 `user_id uuid not null references auth.users(id)` 를 두고 RLS 정책은 `auth.uid() = user_id` 단일 규칙.
- 회원가입 UI는 만들지 않는다. 계정은 Supabase 대시보드에서 수동 생성한다고 가정하고, README에 그 절차를 적어라.

---

## 4. 데이터 모델

`docs/README.md`의 "State Management" + "Data model additions" 절을 그대로 구현한다. SQL 스키마의 뼈대는 다음과 같다. (컬럼 누락 여부는 README와 대조해서 스스로 검증할 것)

```sql
-- accounts
id, user_id, name, currency, starting_capital, started_at,
risk_mode ('percent'|'fixed'), risk_percent, fixed_risk_amount,
drawdown_limit_percent, created_at, updated_at

-- models  (Playbook)
id, user_id, name, description, rules jsonb,       -- 순서 있는 문자열 배열
status ('active'|'retired'), sort_order, reference_image_path,
created_at, updated_at

-- trades
id, user_id, account_id, date, instrument,
direction ('long'|'short'),
session ('asia'|'london'|'ny_am'|'ny_pm'),
htf_pairing, range_high, range_low,
sweep_side ('low'|'high'|'both'|'none'),
entry, stop, target, exit, size,
model_id, confirmation, result ('win'|'loss'|'be'),
exit_reason, hold_minutes,
r_value_at_entry,                                  -- 로그 시점 1R 금액, 고정
tags text[], notes, created_at, updated_at

-- attachments
id, user_id, trade_id, storage_path, width, height, caption, created_at

-- cash_movements
id, user_id, account_id, date, type ('deposit'|'withdrawal'),
amount, currency, note, created_at

-- weekly_reviews
id, user_id, iso_week, what_worked, what_didnt, one_change,
focus_items jsonb,                                  -- [{text, checked}]
created_at, updated_at

-- drafts
user_id (PK), payload jsonb, updated_at             -- 진행 중인 트레이드 1건

-- settings
user_id (PK), locale ('ko'|'en'), pnl_convention ('kr'|'west'),
default_instrument, default_session, r_precision
```

**파생값은 DB에 저장하지 않는다.** `plannedR`, `realizedR`, `offPlan`, `rangeSize`, `pnlAmount`, 잔고 시리즈, 1R 시리즈, 원장(ledger)은 전부 순수 함수로 계산한다. 예외는 `r_value_at_entry` 하나뿐이며, 이것은 로그 시점에 동결되어 이후 리스크 설정을 바꿔도 절대 재작성되지 않는다.

---

## 5. 도메인 로직 — `src/lib/domain/`

순수 함수로 분리하고 **Vitest 단위 테스트를 반드시 함께 작성한다.** UI보다 이 계산이 먼저 맞아야 한다.

```
rangeSize   = rangeHigh - rangeLow
risk        = |entry - stop|
plannedR    = |target - entry| / risk
realizedR   = (exit - entry) / risk,  short이면 부호 반전
offPlan     = sweepSide === 'none' || entry가 레인지 중앙 구간에 위치
pnlAmount   = realizedR * rValueAtEntry
```

집계 셀렉터(메모이제이션): 월 누적 R, 승률, 기대값, 평균 익절/손절, 연승, 룰 준수율, 모델별 집계, 세션별 집계, 스윕 사이드별 승률, 캘린더용 일별 순R 맵, 에쿼티 커브 시리즈.

자본 관련: 잔고 시리즈(시작자본 + 입출금 + 트레이드 손익, 날짜순), 1R 시리즈(각 시점 잔고 × riskPercent), 순입금, 트레이딩 손익, **시간가중수익률**(입금이 수익률을 부풀리지 않도록), 최고 잔고와 현재 드로다운.

테스트 필수 케이스: 롱/숏 부호, 손실 트레이드, 브레이크이븐, 출금 후 1R 하락, 입금일 이전 트레이드의 `rValueAtEntry` 불변, 잔고 초과 출금 차단, 드로다운 한도 도달.

---

## 6. 디자인 토큰

`docs/README.md`의 "Design Tokens" 절 전체를 `src/app/globals.css`의 CSS 변수 + Tailwind `@theme`로 옮긴다. 하드코딩된 hex를 컴포넌트에 흩뿌리지 마라.

핵심 주의점:

- **손익 색은 한국식이다.** 상승 `#f04452`(빨강), 하락 `#3182f6`(파랑).
- 하락 색과 액센트 색이 **같은 hue**다. 액센트 `#3182f6`는 **버튼과 선택 상태에만** 쓰고 그 외에는 절대 쓰지 마라. 안 그러면 두 의미가 섞인다.
- `settings.pnl_convention`으로 서구식(초록 상승/빨강 하락) 전환이 가능해야 한다. 색을 하드코딩하지 말고 `--pnl-gain` / `--pnl-loss` 변수를 런타임에 스왑한다.
- 그림자는 거의 쓰지 않는다. 면과 라운드로 레이어를 구분한다. 시트/모달만 `0 6px 24px rgba(0,0,0,.12)`.
- 상태: hover는 뉴트럴 면이 한 단계 진해짐(`#f2f4f6` → `#e8ebee`), 액센트는 `#3182f6` → `#1b64da`. focus-visible은 2px `#3182f6` 링에 2px 오프셋. disabled는 40% 투명도.
- 모션은 150–200ms ease-out만. 데이터 카드에 등장 애니메이션 금지. `prefers-reduced-motion` 존중.

---

## 7. 라우트

```
/                     Dashboard        (목업 1a / 모바일 1d-home)
/trades               Trade log        (2a)
/trades/[id]          Trade detail     (2b)
/trades/new           New trade        (1b / 모바일은 1d-quicklog 4단계 위저드)
/calendar             Calendar         (1c / 모바일 1d-calendar)
/review               Weekly review    (2c)
/playbook             Playbook         (2d)
/capital              Capital          (3a, 입출금 모달 3b)
/settings             Settings         (목업 없음 — 같은 카드 어휘로 직접 설계)
/login                로그인
```

내비게이션: PC는 상단 바(Dashboard / Trades / Calendar / Playbook / Capital + "New trade" 기본 버튼). 모바일은 하단 탭바. "New trade"는 PC에서 전체 페이지, 모바일에서 전체 화면 시트.

---

## 8. 반응형 규칙

README "Responsive rules"를 그대로 따른다.

- **≥1200px** — 목업 그대로. 히어로 2단, 스탯 4단, 분석 카드 2단.
- **900–1199px** — 스탯 2×2, 분석 카드 세로 적층, 트레이드 행은 그리드 유지하되 "planned R" 컬럼 제거.
- **<900px** — 단일 컬럼. 트레이드 행은 모바일 2줄 리스트(왼쪽에 종목+서브라인, 오른쪽에 R). 대시보드 히어로는 모바일 히어로 카드로 교체. 폼 섹션 1단. **캘린더는 7컬럼을 유지**하고 셀 높이만 42px로 줄이며 값은 축약 표기.
- 터치 타깃 최소 44px. 작은 화면에서 기본 CTA는 하단 고정(sticky).

모바일 화면(1d, 3b-mobile)은 별도 페이지가 아니라 **같은 라우트의 <900px 상태**다.

---

## 9. i18n

- 모든 카피는 번역 가능한 문자열로 관리한다. 하드코딩 금지.
- `ko` / `en` 두 사전. **기본값 `ko`.**
- 목업 카피가 그대로 확정 문구다. PC 목업(1a–1c, 2a–2d, 3a)은 영어, 모바일 목업(1d, 3b-mobile)은 한국어인데, 이건 언어 차이가 아니라 **동일 문자열의 두 로케일 값**이다. 예: `dashboard.hero.label` = `{ ko: "이번 달 누적", en: "Month to date" }`.
- 라이브러리는 쓰지 말고 타입 세이프한 사전 객체 + `useT()` 훅으로 충분히 구현한다.

---

## 10. 빌드 순서

각 Phase 끝에서 `pnpm build`, `pnpm test`, `pnpm lint`가 전부 통과해야 하고, 통과 후 커밋한다. **Phase를 건너뛰거나 합치지 마라.**

**Phase 0 — 기반**
Next.js 15 스캐폴딩, TypeScript strict, Tailwind v4, Pretendard self-host, 디자인 토큰을 CSS 변수와 `@theme`로 정의, 토큰 데모 페이지(`/dev/tokens`)로 색·타입·라운드·간격을 눈으로 확인. Vitest 설정. Supabase 프로젝트 연결과 환경변수 문서화.

**Phase 1 — 데이터 계층**
SQL 마이그레이션 전체 작성, RLS 정책, Storage 버킷(`chart-shots`, private), 타입 생성, Supabase 클라이언트(server/client/middleware) 래퍼. 로그인 화면과 미들웨어 가드.

**Phase 2 — 도메인 로직**
5절의 순수 함수와 셀렉터를 전부 구현하고 단위 테스트를 통과시킨다. **UI는 아직 손대지 마라.** 이 단계가 프로젝트에서 제일 중요하다.

**Phase 3 — 디자인 시스템 프리미티브**
Button, Input, Select, Segmented, Chip/Tag, Card, StatCard, BarRow(7–8px 프로그레스 행), Dropzone, Textarea, Modal/Sheet, TopBar, BottomTabBar, EmptyState. 그리고 인라인 SVG 차트 3종: `EquityCurve`, `Sparkline`, `BalanceAndRValueChart`. **RangeDiagram은 차트가 아니라 레이아웃이므로 div로 만든다.**
`/dev/components` 페이지에서 전부 렌더해 목업과 대조한다.

**Phase 4 — New trade + Trade detail**
폼이 먼저다. 데이터가 있어야 나머지 화면을 확인할 수 있다.
- CRT 순서(맥락 → 레인지·스윕 → 실행 → 차트·노트)를 그대로 따르는 폼.
- 매 키 입력마다 파생값 재계산(레인지 크기, 스윕 사이드, R:R, off-plan 자동 판정).
- 검증: 종목·날짜·진입·손절 필수, 손절 ≠ 진입, 레인지 상단 > 하단, 타겟이 진입 기준 손절 반대편에 있는지는 **경고만 하고 막지 않는다.** 숫자 필드는 천 단위 구분자와 브로커 복붙을 허용.
- 몇 초마다 드래프트 자동 저장, 헤더에 "Draft saved · HH:mm", 복귀 시 복원.
- 첨부: 드래그앤드롭 + 파일 선택, 다중 이미지, 썸네일과 삭제, 타입·용량 검증, 상세 화면에서 라이트박스.
- 모바일에서는 같은 폼이 4단계 위저드로 동작한다.
- Trade detail은 동일한 RangeDiagram을 읽기 전용으로 재사용하되, 확장 구간과 청산 지점을 나타내는 3px `#f04452` 세그먼트가 추가된다.

**Phase 5 — Dashboard + Calendar**
Phase 2의 셀렉터를 그대로 붙인다. 캘린더 히트 스케일은 README 표를 정확히 따르고, 일별 호버 툴팁(순R, 건수, 최고/최악 트레이드)과 클릭 시 그날 트레이드 목록, ‹ › 월 이동 + 키보드 화살표를 구현한다.

**Phase 6 — Trade log**
필터(기간, 종목, 세션, 모델, 스윕 사이드, 결과, off-plan only)와 정렬 가능한 컬럼. **필터 상태는 URL 쿼리에 산다**(북마크 가능해야 함). 요약 행과 페이저는 필터에 반응해서 재계산된다. CSV 내보내기는 필터된 집합만, 가져오기는 컬럼 매핑 단계와 거부된 행 미리보기를 포함한다.

**Phase 7 — Playbook + Weekly review**
Playbook은 한 번에 하나만 펼쳐지고, 룰 목록은 인라인 편집이 가능하며, 모델을 은퇴시켜도 과거 트레이드는 그대로 두고 이후 매칭만 off-plan으로 표시한다. 대시보드의 모델 분석은 여기 정렬 순서를 따른다.
Weekly review는 주 선택기, 요일별 막대, 태그 빈도, 다음 주 포커스 체크리스트(체크 해제 상태면 다음 주로 이월).

**Phase 8 — Capital**
잔고/1R 듀얼 라인 차트, 원장(입출금 + 트레이드를 날짜순으로 병합한 **셀렉터** — 별도 테이블로 저장하지 마라), 리스크 설정 카드, 드로다운 가드. 입출금 모달에는 "잔고 변화 후"와 "1R이 $X에서 $Y로 이동" 미리보기가 들어간다. 리스크 % 변경은 이후 트레이드에만 적용되며 변경 시 경고를 띄운다. 잔고를 초과하는 출금은 차단한다. 계좌가 드로다운 한도 2% 이내로 근접하면 트레이드 폼에서 경고한다.

**Phase 9 — 마감**
모든 통계 화면의 빈 상태(목업에 없으므로 같은 카드 어휘로 직접 설계 — 첫 트레이드를 기록하도록 유도). Settings 화면. PWA manifest + 아이콘(폰 홈 화면 추가용). 키보드 포커스 순회 점검. Vercel 배포와 환경변수 문서화.

---

## 11. 작업 방식

- 각 Phase 시작 전에 무엇을 만들지 3–5줄로 먼저 요약하고 진행해라.
- 화면 구현 후 스크린샷을 찍어 목업과 직접 대조하고, 어긋난 값을 수정해라. 눈으로 확인하지 않은 채 "완료"라고 말하지 마라.
- 스펙에 없어서 스스로 결정한 사항은 `docs/decisions.md`에 한 줄씩 기록해라.
- 막히거나 README 스펙이 모순되면 임의로 넘겨짚지 말고 **멈추고 질문해라.**
- 커밋 메시지는 영어, Phase 번호를 접두사로. 예: `phase-2: add R calculation selectors + tests`

## 12. 첫 턴에 할 일

1. `docs/README.md`와 `docs/design-canvas.html`을 끝까지 읽는다.
2. 저장소를 초기화하고 Phase 0을 완료한다.
3. Phase 0 결과와 함께, README를 읽으며 발견한 **모순이나 빠진 스펙 목록**을 보고한다.
