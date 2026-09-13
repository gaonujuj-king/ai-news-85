# 배움의 파도

유치원 교사를 위한 개인용 AI·교육 뉴스·영상 큐레이션 웹앱입니다. 최신 후보는 Google News RSS에서 가져오며, **Gemini API 키나 `.env` 파일 없이** 작동합니다.

## 작동 방식

- `index.html`: 휴대폰 화면용 앱
- `api/recommendations.js`: Vercel에서 실행되는 단 하나의 RSS 수집 서버 함수
- `public/`: Vercel이 휴대폰에 제공하는 웹앱 파일

`file:///...`로 직접 열면 새 추천 기능은 작동하지 않습니다. Vercel에 배포된 `https://...vercel.app` 주소에서 사용해야 합니다.

## 배포 전 확인

이 프로젝트는 Vercel의 기본 Node.js Serverless Function 형식으로 구성되어 있습니다. 서버 함수는 GET과 POST 요청 모두에서 RSS 콘텐츠를 반환하며, API 키·환경 변수·외부 패키지가 필요하지 않습니다.

## Vercel 배포

1. GitHub에서 **빈 새 저장소**를 만듭니다. README를 추가하지 않아도 됩니다.
2. 이 프로젝트를 GitHub 저장소에 올립니다.
3. [Vercel](https://vercel.com/new)에 로그인하고 **Add New → Project**를 누릅니다.
4. GitHub의 새 저장소를 선택합니다.
5. Framework Preset은 `Other`로 두고 **Deploy**를 누릅니다.
6. 배포가 `Ready`가 되면 나온 `https://...vercel.app` 주소를 엽니다.

## 휴대폰에 설치

- Android Chrome: 메뉴 → **홈 화면에 추가**
- iPhone Safari: 공유 버튼 → **홈 화면에 추가**

배포 주소에서 홈의 **새 추천 받기**를 누르면 최신 AI·교육 기사와 영상이 표시됩니다. 컴퓨터를 켜 둘 필요가 없습니다.
