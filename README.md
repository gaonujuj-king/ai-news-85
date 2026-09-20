# AI 인사이트 데일리

공개 Google News RSS를 이용하는 모바일 뉴스 브리핑 앱입니다. 뉴스 수집과 표시에 유료 AI API나 API 키를 사용하지 않습니다. 요약은 RSS 설명문을 줄여 표시합니다.

## 기준 배포와 프로젝트 구조

운영 기준은 **Vercel + 공유 비밀번호 로그인**입니다. 앱 화면과 정적 리소스의 유일한 원본은 `docs/`입니다. 루트와 `public/`에 있던 이전 앱 사본은 제거했습니다.

- `docs/`: 앱 화면, 아이콘, PWA 설정, 저장된 뉴스 JSON
- `lib/briefing.js`: 공통 RSS 수집·분류·중복 제거·정렬
- `lib/published-briefing.js`: GitHub에서 예약 수집 결과 조회, 5분 캐시, 실패 시 이전 데이터 제공
- `lib/auth.js`: 공유 비밀번호와 세션 쿠키 검증
- `api/app.js`: 인증 후 허용된 앱 파일과 뉴스 제공
- `api/login.js`, `api/logout.js`: 로그인·로그아웃
- `scripts/refresh-news.mjs`: 공통 수집기로 `docs/data/latest.json` 생성
- `.github/workflows/daily-news.yml`: 한국 시간 오전 7:30 예정 수집 작업
- `tests/app.test.js`: 인증과 공통 수집기 회귀 검사

`api/`에는 HTTP 요청을 처리하는 함수만 둡니다. 공통 모듈은 `lib/`에서 관리합니다. 삭제된 `server.mjs`와 이전 `/api/recommendations` 방식은 사용하지 않습니다.

## 매일 자동 갱신

`Google News RSS → GitHub Actions → main의 docs/data/latest.json → Vercel 인증 → 앱`

- GitHub Actions가 한국 시간 오전 7:30 예정으로 실행되어 JSON을 갱신합니다. 수동 실행과 수집 코드 변경 시에도 실행됩니다. GitHub 실행 상황에 따라 지연될 수 있습니다.
- Vercel은 로그인 후 GitHub의 최신 JSON을 읽습니다. 뉴스만 바뀔 때는 Vercel 재배포가 필요하지 않습니다. 함수의 5분 캐시와 GitHub 배포 캐시만큼 반영이 늦어질 수 있습니다.
- GitHub 조회 실패 시 함수가 보유한 마지막 정상 데이터 또는 배포에 포함된 JSON을 표시합니다. 앱에 마지막 갱신 시각과 이전 데이터 사용 여부를 표시합니다.
- 마지막 수집으로부터 36시간이 지나면 갱신 지연으로 표시합니다. 실패한 작업은 GitHub Actions에서 확인하고 다시 실행할 수 있습니다.

추가 AI API 키, 데이터베이스, Vercel 배포용 예약 토큰은 필요하지 않습니다. 공개 저장소를 사용하므로 뉴스 JSON 자체는 공개 자료입니다. 저장소를 비공개로 전환하면 현재 조회 방식도 변경해야 합니다.

## Vercel 설정

- 저장소: `gaonujuj-king/ai-news-85`
- 앱 주소: https://ai-news-85.vercel.app/
- Root Directory: 저장소 루트
- Framework Preset: Other (`vercel.json`의 `framework: null`)
- Output Directory: `.` (`vercel.json`에서 명시)
- 환경 변수: `APP_PASSWORD`를 Production에 설정하고 재배포

모든 앱 파일 요청은 `api/app.js`의 인증 검사를 통과해야 합니다. `docs`나 `public`을 별도 정적 배포 폴더로 지정하지 마세요. 비밀번호와 `.env`는 커밋하지 않습니다. 비밀번호 입력은 HTTPS 환경에서 사용합니다.

비밀번호 보호는 Vercel 앱 접근을 제한합니다. 공개 GitHub 저장소의 코드와 뉴스 JSON까지 비공개로 바꾸지는 않습니다. Vercel 전환이 확인되면 기존 GitHub Pages 공개 배포를 비활성화해야 합니다.

## 로컬 검증

Node.js 22 이상에서 실행합니다. Vercel과 Actions는 Node.js 22를 기준으로 합니다.

```powershell
npm test
```

검사는 테스트용 비밀번호와 가상 RSS를 사용하며 실제 비밀번호나 외부 네트워크가 필요하지 않습니다.

```powershell
npm run refresh
```

이 명령은 인터넷을 사용해 `docs/data/latest.json`을 변경합니다. 루트 `index.html`이나 `public/` 대신 `docs/index.html`을 수정하세요. 앱 전체 확인은 Vercel의 인증 경로를 포함해야 합니다.

## 2026-09-20 배포 점검

- Vercel 루트와 뉴스 JSON이 로그인 쿠키 없이 HTTP 200으로 응답했습니다. 뉴스 갱신 시각은 `2026-09-19T11:55:20.499Z`였습니다.
- GitHub Pages도 공개 상태이며 뉴스 갱신 시각은 `2026-09-20T00:16:36.650Z`였습니다.
- 같은 날 GitHub 뉴스 수집과 Pages 배포 작업의 성공 기록을 확인했습니다.
- 따라서 로컬 인증 코드와 실제 Vercel 서비스가 일치하는지 재배포 후 확인해야 합니다. 위 내용은 수정 전 원격 상태이며, 로컬 수정만으로 운영 사이트가 변경되지는 않습니다.

## 아직 남은 기능

검색·주제 필터·보관함 영구 저장·실제 영상 수집·자동 푸시/메일 발송은 후속 단계입니다. 현재는 앱을 열어 브리핑을 확인하는 방식이며, 알림 스위치는 예약 발송 기능을 의미하지 않습니다.
