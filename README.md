# here-vite

Vercel에 바로 배포할 수 있도록 정리한 최소 Vite + React 프로젝트입니다.

## 로컬 실행

```bash
npm install
npm run dev
```

## 빌드

```bash
npm run build
```

## GitHub 업로드 후 Vercel 배포

1. 이 폴더 전체를 GitHub repo에 업로드합니다.
2. Vercel에서 해당 repo를 Import 합니다.
3. Framework Preset이 `Vite`로 잡히는지 확인합니다.
4. Deploy 합니다.

## 포함 파일

- `src/App.jsx`: 기존 here.jsx 내용을 옮긴 메인 앱 컴포넌트
- `src/main.jsx`: React 엔트리 파일
- `src/index.css`: 전역 기본 스타일
- `index.html`: 루트 HTML
- `package.json`: Vite/React 실행 설정
