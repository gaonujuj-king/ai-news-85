# AI 인사이트 데일리

AI 트렌드, AI 에이전트, 바이브 코딩, 교육의 변화, 창업과 일을 매일 모아 보는 **무료 모바일 PWA**입니다. API 키·유료 AI 모델·서버가 필요하지 않습니다.

## 무료 구조

`Google News RSS → GitHub Actions(매일 07:30 KST) → docs/data/latest.json → GitHub Pages → 휴대폰 홈 화면`

- 공개 RSS의 제목, 출처, 날짜, 원문 링크를 수집합니다. 기사 전문을 복제하지 않습니다.
- GitHub Actions가 하루 한 번 JSON 파일을 갱신하고 GitHub Pages가 그 파일을 제공합니다.
- 요약은 RSS 설명문을 그대로 짧게 보여 주므로 AI API 비용이 없습니다.
- 첫 버전은 **앱을 열었을 때 최신 브리핑을 보여 주는 방식**입니다. 완전한 푸시 알림이나 이메일 발송은 별도 푸시/메일 서비스와 계정 설정이 필요합니다.

## 무료 배포: GitHub Pages

1. GitHub에서 이 프로젝트를 **공개(public) 저장소**로 올립니다.
2. 저장소의 **Settings → Pages**에서 `Deploy from a branch`를 선택합니다.
3. 브랜치는 `main`, 폴더는 `/docs`를 선택하고 저장합니다.
4. **Actions** 탭에서 `Update daily AI briefing`을 열고 `Run workflow`를 한 번 실행합니다. 첫 브리핑 JSON이 생성됩니다.
5. Pages가 제공한 주소를 휴대폰에서 엽니다.

무료 GitHub Pages는 공개 저장소를 전제로 하므로, 앱 코드와 생성된 브리핑 JSON은 공개됩니다. 개인 계정·개인정보·비공개 메모는 이 저장소에 넣지 마세요.

## 휴대폰에 설치

- Android Chrome: 메뉴 → **홈 화면에 추가**
- iPhone Safari: 공유 → **홈 화면에 추가**

브라우저 알림은 기기와 브라우저 정책에 따라 제한될 수 있습니다. 비용 없이 매일 확실하게 받아보려면, 우선 홈 화면의 앱을 열어 확인하는 방법이 가장 안정적입니다.

## 로컬 확인

```powershell
npm run refresh
npm start
```

그 뒤 `http://localhost:8787/public/`을 열면 됩니다. `npm run refresh`는 인터넷 연결이 필요합니다.
