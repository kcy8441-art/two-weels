# Two Wheels

저장소: [kcy8441-art/two-weels](https://github.com/kcy8441-art/two-weels)

개인 정비사 한 명과 고객을 위한 반응형 바이크 정비 이력 서비스입니다.

## 실행

Node.js 24 LTS와 pnpm 11을 권장합니다.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

- [정비사 데모](http://127.0.0.1:3000/admin?demo=1)
- [고객 데모](http://127.0.0.1:3000/my/vehicles?demo=1)
- [회원가입](http://127.0.0.1:3000/signup)

Supabase 환경 변수가 없는 개발 환경에서만 데모가 기본 허용됩니다. 데이터와 사진은 해당 브라우저의 IndexedDB에 저장됩니다. 실제 개인정보를 넣지 마세요. 데모의 고객 화면 전환은 편의용 시뮬레이션이며 실제 사용자 간 보안 경계가 아닙니다. 실제 권한은 Supabase의 세션·RLS·RPC에서 적용합니다.

프로덕션에서 데모가 꼭 필요하면 빌드 전에 `NEXT_PUBLIC_ENABLE_DEMO=true`를 명시합니다. 운영 환경에서는 기본값 `false`를 유지하세요. 데모 데이터는 Supabase로 자동 이관하지 않습니다.

## 구현 기능

- 반응형 정비사 대시보드·고객 포털
- 고객·차량 등록/수정, 차대번호 복사
- 정비 날짜·주행거리·상태·자유 입력 작업 내용과 추가 메모
- 사진 먼저 저장, 사진별 설명, 여러 사진 묶기·설명·순서 변경
- 항목별 공개 선택, 공개 미리보기, 작성본과 고객 공개본 분리
- 자동 저장·수동 저장·버전 충돌 감지
- 이메일·비밀번호 가입/로그인과 비밀번호 재설정 코드
- 가입 전 고객 차량 초대, 초대 수락·폐기·재발급
- 과거 정비 기록, 차량 양도 전 공개 내용 검토와 권한 이전

실제 Auth 메일·Storage·Edge Function의 클라우드 통합 검증은 Supabase 연결 후 수행해야 합니다. 사진은 JPG/PNG/WebP 원본 10MB 이하, UI에서 정비 건당 최대 40장입니다. 긴 변 1600px의 JPG로 변환해 업로드합니다. HEIC 자동 변환은 아직 지원하지 않습니다.

## Supabase 연결

1. 전용 Supabase 프로젝트를 만듭니다. 개발과 운영은 별도 프로젝트를 권장합니다.
2. `.env.example`을 `.env.local`로 복사하고 프로젝트 URL 및 **Publishable key**를 입력합니다. service-role/secret 키는 Next.js 공개 환경 변수에 넣지 않습니다.
3. Supabase CLI를 공식 경로로 설치하고 로그인한 다음 연결합니다.

```sh
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
supabase functions deploy photo
supabase secrets set APP_ORIGINS=http://127.0.0.1:3000,https://YOUR_APP_DOMAIN
```

`supabase/migrations/202610240001_initial.sql`은 새로운 전용 프로젝트에 적용하는 초기 마이그레이션입니다. 기존 다른 서비스가 사용하는 프로젝트에 적용하지 마세요. 로컬 테스트는 `supabase start` 및 `supabase db reset`으로 실행할 수 있습니다(Docker 필요).

4. Supabase Auth의 Email 설정에서 Confirm Email을 끕니다. 가입은 인증 메일 없이 완료하도록 기획했습니다.
5. Auth의 Site URL과 Redirect URL에 실제 앱 도메인과 `/auth/confirm`을 등록합니다. 로컬에서는 `http://127.0.0.1:3000`을 사용합니다.
6. 비밀번호 재설정용 운영 SMTP를 연결합니다. Recover password 이메일 템플릿 링크는 다음과 같이 설정합니다.

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">비밀번호 재설정</a>
```

7. 일반 회원가입으로 정비사 본인 계정을 만든 후 Supabase SQL Editor에서 그 계정만 관리자로 지정합니다.

```sql
insert into private.admin_users(user_id)
select id from auth.users where email = 'YOUR_ADMIN_EMAIL';
```

관리자 테이블은 한 계정만 허용합니다. 고객 가입 화면에는 역할 선택이 없고, 일반 고객은 관리자 등록 함수를 호출할 수 없습니다. 초기 관리자 등록 후 다시 로그인하거나 시작 화면으로 이동하세요.

## Vercel 배포

1. 이 프로젝트를 사용자 소유 저장소에 올리고 Vercel에서 Import합니다.
2. Framework preset은 Next.js, 설치는 `pnpm install --frozen-lockfile`, 빌드는 `pnpm build`입니다.
3. Node.js 24.x를 선택합니다.
4. 환경 변수 두 개와 `NEXT_PUBLIC_ENABLE_DEMO=false`를 설정합니다.
5. Supabase Auth 허용 URL과 Edge Function의 `APP_ORIGINS`를 배포 도메인으로 갱신합니다.
6. Preview 환경은 개발용 Supabase를 사용하고 운영 DB를 공유하지 않습니다.

현재 Supabase 프로젝트·Vercel 계정 연결·외부 배포는 수행하지 않았습니다.

## 검증

```sh
pnpm typecheck
pnpm test
pnpm build
```

DB 통합 테스트는 PGlite(PostgreSQL)를 사용해 **실제 초기 마이그레이션**을 실행합니다. Auth 사용자·Storage 메타데이터 스키마만 테스트에서 대체하고 RLS, RPC 권한, 공개본 분리, 사진 권한, 초대 재사용, 양도 전후 접근을 검증합니다. 클라우드 Auth/Storage/메일/Deno 런타임 전체를 대체하는 테스트는 아닙니다.

## 코드와 문서

- `app/`: Next.js App Router와 인증 콜백
- `components/`: 반응형 화면, 정비 편집기, 데이터 상태
- `lib/`: 도메인 모델, 입력 검증, 로컬 데모, Supabase 어댑터
- `supabase/`: 초기 마이그레이션, Edge Function, 로컬 설정
- `tests/`: 공개 규칙과 DB 권한 테스트
- [PRD](./PRD.md), [기술기획](./TECH_SPEC.md), [디자인 시스템](./DESIGN_SYSTEM.md)

## 운영 연결 전 남은 확인

- Supabase 프로젝트 생성 및 마이그레이션 적용
- 실제 계정으로 가입·복구 메일·초대·사진 업로드/열람 통합 확인
- 실제 모바일 브라우저·카메라에서 검증
- 브라우저에서 등록→저장→공개→고객 열람→양도 흐름 확인
- 초대 만료(초기값 7일), 필수 입력값, 공개 취소·삭제 정책 확정
- HEIC 지원, 대량 이력 페이지네이션, 파일 정리·백업과 복구 절차

작성본의 정비 항목·사진 배치·메모는 첫 구현에서 `service_records.draft` JSONB로 함께 저장해 원자적인 자동 저장과 버전 검사를 적용했습니다. 파일 메타데이터와 공개본·공개 사진 연결은 별도 테이블입니다. 실제 사진은 비공개 Storage에 저장되고 매 요청을 인증하는 Edge Function을 통해 제공합니다.
