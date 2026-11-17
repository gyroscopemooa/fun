# 2026-11-15 내부 테스트 빌드

서명된 AAB 생성·bundletool 검증·서명 인증서 일치 확인·release 린트 통과(오류 0, 경고 16). 버전 0.1.0-internal.1, 버전코드 1, compile/target SDK 36. 실기기 실행과 Play 업로드는 하지 않았다. 산출물은 output/android-internal, 키 보관은 UPLOAD_SIGNING.md 참고. 아래 11월 14일 기록의 빌드 미실행 문구는 과거 상태다.

# ManyTool Android 개발판

## 현재 동작 (2026-11-14)

- 앱 실행 시 https://manytool.net/ 웹 메인을 바로 연다. 별도 도구 목록 홈은 제거했다.
- 같은 출처의 전체 도구·다국어 화면을 탐색한다. 홈·뒤로·새로고침을 제공하고 시작 화면에서는 종료 확인을 한다.
- 무아레쥬메·트랜스트림 등 외부 HTTPS 링크는 사용자 조작 시 시스템 브라우저로 연다. 외부 페이지에는 네이티브 브리지를 주입하지 않는다.
- 웹 PG와 심사용 결제·크레딧 경로는 계속 차단한다. Play 구매는 비활성이다. 전체 도구 화면이 열린다는 것이 유료 실행·모든 기능 호환 검증을 뜻하지 않는다.
- 파일 선택기는 accept MIME 형식을 반영한다. 복수 선택은 최대 20개, 파일당 최대 32MB다. 크기를 알 수 없는 클라우드 파일은 UI 스레드 밖에서 제한된 읽기로 검사한다. 취소/탐색 이후 오래된 선택은 전달하지 않는다.
- blob 및 base64 data 결과와 자사 HTTPS 공개 파일을 시스템 저장 위치 선택기로 저장한다. 현재 저장 데이터 최대 8MB, 리디렉션/인증이 필요한 파일은 미지원이다. API 다운로드는 api.manytool.net/files/만 허용한다.
- 오류·렌더러 종료 복구와 화면 이동 후 오래된 다운로드 결과 무시를 적용한다.
- 승인된 손바닥 아이콘, 많은 도구 - ManyTool 이름, 안드로이드 적응형 아이콘을 반영했다.

## 남은 작업

웹 Google 로그인 세션을 앱으로 안전하게 인계하는 인증 복귀, Play 결제·지갑 연결, 카메라/마이크/위치 권한, 사진 파일 공유, 큰 파일 저장, 실기기 검증은 남아 있다. 브라우저 Google 로그인은 WebView에 자동 공유되지 않는다. 계정 화면은 지원되지 않는 임베디드 OAuth 실행을 차단한다.

이번 변경에서는 앱 빌드·APK 생성·배포를 하지 않았다. 과거 별도 작업 폴더의 debug APK 기록은 이 버전의 검증 결과가 아니다. 전체 Java 구문 파싱은 Android SDK 타입 검사나 실제 설치 테스트를 대신하지 않는다.

## 검증

순수 Java 정책 테스트: NavigationPolicy, FileSelectionPolicy, CreditReadiness와 tests/PolicyTest.java를 JDK17로 검사한다. HybridBridgePolicy와 tests/HybridBridgeTest.java는 별도 브리지 정책을 검사한다. tests/ParseSources.java는 JavaCompiler의 parse만 호출하고 앱 소스를 컴파일하지 않는다.

APK 테스트를 시작할 때에는 Android SDK를 사용하는 빌드/린트와 실제 기기에서 사진 선택 취소·재선택·클라우드 사진·저장·뒤로가기·외부 링크·오프라인 복구를 확인해야 한다.
