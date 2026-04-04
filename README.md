# here. pro

현장형 익명 커뮤니티 `here.`의 프론트엔드 MVP 확장 버전입니다.

## 포함된 기능
- 지역 선택 + GPS 기반 가까운 지역 진입
- 공간 리스트 / 공간 미리보기 / 인기 랭킹
- 공간별 익명 대화
- 24시간 자동 소멸 메시지(TTL)
- 빠른 현장 정보 입력(한 줄 업데이트)
- 분위기 태그 투표
- 오늘의 질문 / 질문 등록
- 메시지 반응(리액션)
- 신고 / 차단 / 내 메시지 삭제
- 8초 쿨다운 기반 도배 방지
- 금칙어 차단 예시
- 공유 링크 복사
- 간단 운영 대시보드
- BroadcastChannel + localStorage 기반 탭 간 동기화

## 실행 방법
```bash
npm install
npm run dev
```

## 배포
Vercel import 후 아래 설정이면 됩니다.
- Framework Preset: Vite
- Build Command: `npm run build`
- Output Directory: `dist`

## 실제 서비스로 확장 시 필요한 백엔드
현재 버전은 로컬 저장소 기반 프론트 데모/MVP입니다.
실제 운영용으로 가려면 아래를 붙이세요.
- Auth / Device ID
- Realtime 서버(Supabase Realtime, Ably, Socket.IO 등)
- DB(Postgres/Supabase)
- 관리자 신고 처리 API
- 위치 위변조/어뷰징 방지
- 콘텐츠 모더레이션
- Analytics 적재
