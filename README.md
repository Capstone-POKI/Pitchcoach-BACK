# POKI Backend

NestJS + Prisma 기반 백엔드입니다.
현재 구현의 중심은 `Auth`이며, Swagger에는 `Auth API`만 노출되도록 설정되어 있습니다.

## 1) Tech Stack
- Node.js 20
- NestJS 11
- pnpm
- PostgreSQL + Prisma
- JWT (`@nestjs/jwt`, `passport-jwt`)
- Validation (`class-validator`, `ValidationPipe`)
- Swagger (`@nestjs/swagger`)

## 2) Project Structure
- `src/main.ts`
  - 전역 `ValidationPipe` 적용 (`whitelist`, `forbidNonWhitelisted`, `transform`)
  - 전역 `GlobalExceptionFilter` 적용
  - Swagger 문서 생성 (`include: [AuthModule]`)
- `src/app.module.ts`
  - `ConfigModule`, `PrismaModule`, `AuthModule`, `UserModule`, `AiModule`, `FastApiModule` 등록
- `src/modules/auth`
  - `AuthController`: `/api/auth/signup`, `/api/auth/login`, `/api/auth/me`
  - `AuthService`: 회원가입/로그인, bcrypt 해시, JWT 발급, refresh token hash 저장
  - `JwtStrategy`: access token 검증 + 삭제 유저/refresh 토큰 차단
- `src/modules/user`
  - `GET /users` (Swagger에는 미노출)
- `src/modules/ai`
  - `GET /ai/test` (Swagger에는 미노출)
- `src/infra/prisma`
  - Prisma 전역 DI (`PrismaService`, `PrismaModule`)
- `src/infra/fastapi`
  - 외부 FastAPI 연동 클라이언트
- `prisma/schema.prisma`
  - `User`, `Pitch` 모델 및 enum 정의
- `prisma/migrations`
  - DB 마이그레이션 이력

## 3) Environment Variables
루트 `.env` 파일 필요:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/poki?schema=public"
JWT_SECRET="change-me"
AI_SERVER_URL="http://localhost:8000"
PORT=3000
```

주의:
- `JWT_SECRET` 누락 시 앱이 시작 단계에서 에러로 종료됩니다.
- `AI_SERVER_URL`은 `GET /ai/test` 호출 시 사용됩니다.

## 4) Local Setup
```bash
pnpm install
pnpm prisma generate
pnpm prisma migrate dev
pnpm run start:dev
```

서버 기본 주소:
- App: `http://localhost:3000`
- Swagger: `http://localhost:3000/api-docs`

## 5) Swagger Policy
현재 Swagger는 Auth만 노출합니다.

```ts
SwaggerModule.createDocument(app, config, {
  include: [AuthModule],
});
```

즉, `users`, `ai` API는 실제로 호출 가능하지만 문서에는 표시되지 않습니다.

## 6) API Overview

### 6.1 Auth (Swagger 노출)
Base path: `/api/auth`

#### POST `/api/auth/signup`
설명:
- 이메일/전화번호 중복 검사
- 비밀번호 bcrypt 해시 저장
- access/refresh 토큰 발급
- refresh 토큰 해시와 만료 시각 저장

Request body:
```json
{
  "name": "홍길동",
  "email": "user@example.com",
  "phone": "010-1234-5678",
  "password": "Passw0rd!"
}
```

성공 응답 예시:
```json
{
  "user_id": "uuid",
  "email": "user@example.com",
  "name": "홍길동",
  "is_profile_complete": false,
  "access_token": "...",
  "refresh_token": "...",
  "message": "회원가입이 완료되었습니다. 추가 정보를 입력해주세요."
}
```

실패 케이스:
- `409 EMAIL_ALREADY_EXISTS`
- `409 PHONE_ALREADY_EXISTS`

#### POST `/api/auth/login`
설명:
- 이메일 + 비밀번호 검증
- 삭제 계정(`isDeleted=true`) 로그인 차단
- 성공 시 access/refresh 토큰 재발급

Request body:
```json
{
  "email": "user@example.com",
  "password": "Passw0rd!"
}
```

성공 응답 예시:
```json
{
  "user_id": "uuid",
  "email": "user@example.com",
  "name": "홍길동",
  "is_profile_complete": false,
  "access_token": "...",
  "refresh_token": "..."
}
```

실패 케이스:
- `401 INVALID_CREDENTIALS`

#### GET `/api/auth/me`
설명:
- `Authorization: Bearer <access_token>` 필요
- JWT 검증 후 사용자 프로필 반환

성공 응답 예시:
```json
{
  "user_id": "uuid",
  "email": "user@example.com",
  "name": "홍길동",
  "phone": "010-1234-5678",
  "auth_type": "EMAIL",
  "gender": null,
  "education": null,
  "business_field": null,
  "business_duration": null,
  "is_profile_complete": false
}
```

실패 케이스:
- `401 UNAUTHORIZED`

### 6.2 기타 API (Swagger 미노출)
- `GET /users`
- `GET /ai/test`

## 7) Validation Rules

### SignupDto
- `name`: 빈 값 불가
- `email`: 이메일 형식
- `phone`: `01x-xxxx-xxxx` 형식 검증
- `password`: 영문/숫자/특수문자 포함 8~16자

### LoginDto
- `email`: 이메일 형식 + 빈 값 불가
- `password`: 문자열, 빈 값 불가, 8~16자

## 8) Auth/Security Details
- Access token TTL: `1h`
- Refresh token TTL: `7d`
- refresh token은 DB에 평문 저장하지 않고 `refreshTokenHash` 저장
- 로그인/회원가입 시 `lastLoginAt`, `refreshTokenExpiresAt` 갱신
- `JwtStrategy`에서 다음 토큰 차단:
  - `sub` 없는 토큰
  - `type=refresh` 토큰 (보호 API 접근 차단)
  - 삭제 유저의 토큰

## 9) Database Schema (Summary)

### User
핵심 필드:
- 식별/인증: `id`, `email`, `phone`, `password`, `authType`
- 프로필: `name`, `gender`, `education`, `businessField`, `businessDuration`
- 상태: `isProfileComplete`, `isDeleted`, `deletedAt`
- 인증 보안: `refreshTokenHash`, `refreshTokenExpiresAt`, `lastLoginAt`
- 통계: `totalPitchesCount`, `completedPitchesCount`

### Pitch
핵심 필드:
- 관계: `userId` (User 1:N)
- 내용: `title`, `pitchType`, `durationMinutes`, `hasNotice`, `noticeType`
- 상태: `status`, `isDeleted`, `deletedAt`

## 10) Error Response Format
전역 예외 필터 기준:

```json
{
  "success": false,
  "statusCode": 401,
  "message": "토큰이 유효하지 않습니다",
  "path": "/api/auth/me",
  "timestamp": "2026-02-12T00:00:00.000Z"
}
```

## 11) Test
```bash
# unit
pnpm run test

# auth flow 회귀 테스트 3개
pnpm run test -- src/modules/auth/auth.flow.spec.ts

# e2e
pnpm run test:e2e
```

`src/modules/auth/auth.flow.spec.ts` 검증 항목:
1. 정상 로그인 -> `/me` 성공
2. 삭제 계정 로그인 -> 401
3. refresh 토큰으로 보호 API 접근 -> 401

## 12) CI
`.github/workflows/ci.yml`
1. `pnpm install --frozen-lockfile`
2. `pnpm prisma generate`
3. `pnpm run --if-present test`
4. `pnpm run build`

## 13) Common Issues
- Swagger에 users/ai가 안 보임
  - 정상입니다. 현재 문서 노출 범위를 `AuthModule`로 제한했습니다.
- `JWT_SECRET is required`로 서버가 시작 실패
  - `.env`에 `JWT_SECRET`을 설정하세요.
- Prisma 타입 오류
  - `pnpm prisma generate` 후 재빌드하세요.
