# 내부 테스트 업로드 서명

패키지: net.manytool.app
업로드 키: .signing/manytool-upload.jks (alias manytool-upload)
로컬 설정: signing.properties

두 파일은 Git에서 제외하고 현재 Windows 계정과 SYSTEM에만 파일 권한을 부여했다. 키와 설정은 함께 안전한 개인 백업에 보관한다. 암호를 채팅이나 저장소에 올리지 않는다. 이후 동일 앱 업데이트는 같은 업로드 키를 사용한다. Google Play App Signing의 앱 서명키는 이 업로드 키와 구분된다.

빌드: gradlew.bat :app:bundleRelease :app:lintRelease --console=plain
Gradle Wrapper 8.13, AGP 8.12.0, JDK 17, compile/target SDK 36.

signing.properties 또는 키가 없는 다른 PC에서는 해당 개인 백업을 복원해야 release 서명을 할 수 있다. local.properties에는 해당 PC의 Android SDK 경로를 설정한다.
