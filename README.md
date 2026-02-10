# POKI Backend

NestJS + Prisma 기반의 백엔드 초기 세팅입니다. 아래에 현재 폴더 구조, 설치해야 할 것, 로컬 실행 방법, 기능 개발 흐름을 정리했습니다.

**요약**
- 런타임: Node.js, 패키지 매니저: `pnpm`
- DB: PostgreSQL (`docker-compose.yml` 제공)
- ORM: Prisma (`prisma/schema.prisma`)
- 인증: JWT (`AuthModule`)
- 외부 AI 서비스 연동: FastAPI 서버 클라이언트 (`FastApiClient`)
- API 문서: Swagger (`/api-docs`)

**폴더 구조**
- `src/main.ts`: 앱 부트스트랩, Swagger, 전역 예외 필터 등록
- `src/app.module.ts`: 루트 모듈, 전역 설정 및 모듈 구성
- `src/common/filters`: 전역 예외 필터
- `src/infra/prisma`: Prisma 전역 DI (`PrismaService`, `PrismaModule`)
- `src/infra/fastapi`: FastAPI 연동 클라이언트
- `src/modules/auth`: 인증 모듈 (JWT, 로그인/회원가입)
- `src/modules/user`: 유저 모듈 (예시 조회 API)
- `src/modules/ai`: AI 모듈 (FastAPI 연동 예시)
- `prisma/schema.prisma`: 데이터베이스 스키마
- `prisma/migrations`: Prisma 마이그레이션
- `test`: e2e 테스트 설정 및 샘플
- `docker-compose.yml`: 로컬 PostgreSQL

**필수 설치**
- Node.js (LTS 권장)
- `pnpm`
- Docker Desktop (로컬 DB 사용할 경우)

**설치**
```bash
pnpm install
```

**환경 변수**
아래 변수들이 코드에서 사용됩니다. 프로젝트 루트에 `.env`를 생성하세요.

- `DATABASE_URL`: PostgreSQL 연결 문자열
- `JWT_SECRET`: JWT 서명 키
- `AI_SERVER_URL`: FastAPI 서버 베이스 URL
- `PORT`: 서버 포트 (기본 3000)

예시:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/poki?schema=public"
JWT_SECRET="change-me"
AI_SERVER_URL="http://localhost:8000"
PORT=3000
```

**로컬 DB 실행**
```bash
docker-compose up -d
```

**Prisma 사용**
- 스키마 변경 후 마이그레이션 생성 및 적용
```bash
pnpm prisma migrate dev
```

- Prisma Client 재생성
```bash
pnpm prisma generate
```

**실행**
```bash
# 개발 모드
pnpm run start:dev

# 일반 실행
pnpm run start

# 프로덕션 빌드 후 실행
pnpm run build
pnpm run start:prod
```

**API 문서**
- `http://localhost:3000/api-docs`

**기능 개발 흐름 (권장)**
1. `src/modules/<feature>`에 모듈/서비스/컨트롤러 생성
2. DTO는 `src/modules/<feature>/dto`에 정의
3. DB 작업은 `PrismaService`로 처리 (`src/infra/prisma/prisma.service.ts`)
4. 외부 서비스 연동은 `src/infra`에 클라이언트로 분리
5. `src/app.module.ts`에 새 모듈 등록
6. 필요 시 Swagger 데코레이터 추가

**예시: 새 기능 모듈 추가**
```bash
nest g module modules/feature
nest g service modules/feature
nest g controller modules/feature
```

**테스트**
```bash
# 단위 테스트
pnpm run test

# e2e 테스트
pnpm run test:e2e

# 커버리지
pnpm run test:cov
```

**배포/운영 가이드**
- 환경별 `.env`를 분리해서 관리하는 것을 권장합니다. 예: `.env.development`, `.env.staging`, `.env.production`
- 공통 변수는 동일 키로 유지하고 값만 환경별로 교체하세요.
- 운영 환경에서는 반드시 `JWT_SECRET`을 안전하게 관리하세요.
- DB 마이그레이션은 배포 파이프라인에서 명시적으로 실행하도록 구성하세요.

**환경별 .env 예시**
- 개발(로컬)
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/poki?schema=public"
JWT_SECRET="dev-secret"
AI_SERVER_URL="http://localhost:8000"
PORT=3000
```
- 스테이징
```env
DATABASE_URL="postgresql://<user>:<pass>@<host>:5432/poki?schema=public"
JWT_SECRET="<staging-secret>"
AI_SERVER_URL="https://staging-ai.example.com"
PORT=3000
```
- 프로덕션
```env
DATABASE_URL="postgresql://<user>:<pass>@<host>:5432/poki?schema=public"
JWT_SECRET="<prod-secret>"
AI_SERVER_URL="https://ai.example.com"
PORT=3000
```

**CI/CD 권장 흐름(예시)**
1. 의존성 설치: `pnpm install --frozen-lockfile`
2. 정적 검사: `pnpm run lint`
3. 테스트: `pnpm run test` (필요 시 `pnpm run test:e2e`)
4. 빌드: `pnpm run build`
5. DB 마이그레이션: `pnpm prisma migrate deploy`
6. 런타임 실행: `pnpm run start:prod`

**개발 규칙/컨벤션**
- 폴더 구조는 `src/modules/<feature>` 단위로 유지합니다.
- 컨트롤러/서비스/모듈 파일명은 `*.controller.ts`, `*.service.ts`, `*.module.ts` 규칙을 사용합니다.
- DTO는 각 모듈의 `dto` 폴더에 두고 `class-validator` 데코레이터로 유효성 규칙을 정의합니다.
- 외부 연동은 `src/infra` 아래에 클라이언트로 분리합니다.
- DB 접근은 `PrismaService`만 사용하고, 서비스 레이어에서 호출합니다.
- 예외 처리는 `HttpException` 또는 하위 예외 클래스를 사용합니다.
- 전역 예외 포맷은 `GlobalExceptionFilter`가 담당합니다.
- 현재 전역 `ValidationPipe`는 설정되어 있지 않습니다. 필요 시 `src/main.ts`에 추가하세요.
- Lint/Format은 `pnpm run lint`, `pnpm run format`을 사용합니다.

**현재 구현된 API (간단 요약)**
- `POST /auth/signup`: 회원가입 (예시, 구현 예정)
- `POST /auth/login`: 로그인 (JWT 발급)
- `GET /auth/me`: JWT 인증 필요
- `GET /users`: 유저 목록 조회
- `GET /ai/test`: FastAPI 연동 테스트

**주의 사항**
- `AuthService.signup`은 아직 로직이 비어 있습니다.
- `AI_SERVER_URL`이 없으면 `AiService` 호출이 실패합니다.
- `JWT_SECRET`이 없으면 기본 키(`dev-secret`)로 동작합니다.

필요한 섹션이나 상세 문서를 더 추가하고 싶으면 알려주세요.
