# 매니툴 Android 앱 기반 (개발판)

웹 도구 화면은 기존 manytool.net에서 재사용하고, 파일 선택·저장·탐색은 Android에서 담당하는 하이브리드 구조입니다. [브리지 경계](../../docs/hybrid-app.md)를 확인하세요.
**스토어 제출용 완성 앱이 아닙니다. debug APK 빌드·서명 검증은 완료했으나 출시 AAB·실기기 검증은 아직 하지 않았습니다.**

## 현재 코드 범위

- Android 8(API 26)+ 네이티브 Java WebView 셸, 홈·뒤로·새로고침, 오류 상태.
- 안전한 도구 허용 목록. 이미지 도구, 사진 글자 추출, JSON, 날짜 계산부터 연결합니다.
- 시스템 문서 선택기로 파일 업로드(최대 20개), 취소·반복 선택 시 이전 콜백 정리.
- 파일 저장: 사용자가 시스템 저장 위치 선택. 같은 출처의 공개 HTTPS 파일 또는 페이지에서 생성한 blob을 최대 8MB까지 저장.
- 외부 로그인·영상·결제는 활성화하지 않고 준비 상태를 명시합니다.
- URL host/scheme/port 검증, HTTP·SSL 오류·외부 탐색·결제 요청 차단, 명시적 origin·메인 프레임에만 한정된 WebMessage 네이티브 브리지.
- 위치/카메라/마이크 권한 요청 거부, 제3자 쿠키 거부, 디버깅 및 앱 백업 비활성.
- 데이터 지우기는 사용자 확인 후 WebStorage·앱 쿠키만 삭제하며 저장한 파일은 유지합니다.

**전체 웹 도구가 이 개발판에서 모두 열리는 것은 아닙니다.** 현재 원격 웹페이지에는 개별구매/크레딧 UI가 남아 있을 수 있습니다. 앱 전용 결제/도구 카탈로그를 연결하기 전까지 무료 도구 허용 목록과 요청 차단으로 제한합니다. 운영 웹을 수정하지 않았습니다. 서버 엔드포인트 차단은 방어 계층이지 Play 정책 준수를 보장하지 않습니다.

## 빌드

Android Studio에서 `mobile/android`를 Gradle 프로젝트로 엽니다. JDK 17, Android SDK 35 및 Build Tools, Gradle 8.11.1을 사용합니다. Android Gradle Plugin은 8.9.2입니다.

```sh
# Gradle이 설치된 개발 환경
cd mobile/android
gradle :app:assembleDebug
# 순수 정책 테스트(JDK 필요)
./test-policy.sh
```

이 초기 프로젝트에는 Gradle wrapper 바이너리를 넣지 않았습니다. Android Studio 또는 설치된 Gradle로 동기화하세요. SDK/Gradle의 공식 설치 절차와 라이선스를 확인하세요. 실제 릴리스 전에 최신 Play target SDK 요건을 다시 확인해야 합니다.

## 검증 기록

- navigation/billing 순수 Java 정책: 22개 assertion 통과.
- 전체 Java 소스 Android API 35 시그니처 컴파일 통과: Eclipse ECJ 3.40.0 + JRE 21, 공식 Android 35 jar에서 JDK 중복 패키지를 제외한 API 검사. 이는 Android Gradle/D8 패키징을 대신하지 않습니다.
- manifest/network XML parse와 설정 정적 검사 통과.
- **Gradle assembleDebug·lintDebug·debug APK 서명 검증 완료.** 공식 SDK35와 JDK17/Gradle8.11.1로 빌드했습니다. 에뮬레이터·실기기 업로드/저장·공유·Play 실구매는 미검증입니다. 개발용 APK이며 스토어 출시본이 아닙니다.
- Java 경고: 구형 Android 호환용 insets/파일 접근 차단/back API의 deprecated 경고가 남습니다.

## 크레딧 연결 상태

현재 `CreditReadiness`는 false이며 네이티브 결제를 시작하지 않습니다. BillingClient 8 상품 조회·구매·복원, 네이티브 가격 패널과 인증 API 어댑터, 서버 구매 검증·멱등 적립·consume 코드를 추가했습니다. **앱 로그인 세션 연결과 환불/취소 동기화, 실제 Play 설정과 테스트는 남아 있습니다.** 상세 범위는 [PLAY_BILLING.md](PLAY_BILLING.md)를 확인하세요. 가격만 정하면 출시할 수 있는 단계는 아닙니다.

새 도구가 기존 공통 지갑의 크레딧을 쓸 경우 서버/웹 변경으로 추가할 수 있지만, 새로운 기기 권한이나 결제 SDK·네이티브 동작은 앱 업데이트와 테스트가 필요합니다.

## 남은 앱 작업 / 제품 한계

- iOS 앱은 이 작업 범위에서 생성하지 않았습니다.
- 외부 SNS 로그인 브라우저, 인증 영상/스토리, 공유받기, 백그라운드·대용량 다운로드, 카메라·음성 권한은 미구현입니다.
- blob 저장은 작은 파일 검증용입니다. DOCX 등 MIME별 파일명 개선, 대용량 스트리밍, 프로세스 종료 후 재개는 후속 작업입니다.
- 선택 문서 업로드와 blob 저장은 실제 Android WebView 버전별로 테스트해야 합니다.
- Android 회전/프로세스 재생성 시 홈으로 돌아오고 진행 중 저장은 취소됩니다. 세션/문서 bytes를 인스턴스 상태나 디스크에 남기지 않습니다.
- 테스트할 항목: 파일 선택 취소 후 재시도, 20개/초과, 파일 생성 실패, 8MB 초과, 저장 취소, 빠른 홈/뒤로, 도중 회전, 네트워크·SSL 오류, 외부 결제 팝업·리디렉션 차단.
- 스토어 심사용 앱 차별성·접근성·아이콘·설명·개인정보·Data Safety·계정 삭제 등 준비가 필요합니다. WebView 포장만으로 스토어 승인을 보장하지 않습니다.
- 영상 다운로드는 콘텐츠 권한과 서비스/스토어 정책 검토가 필요하며 로그인 성공만으로 지원을 보장하지 않습니다.
- 앱 패키지명 `net.manytool.app`은 로컬 기본값입니다. 실제 Play 등록/서명키/배포는 하지 않았습니다.
