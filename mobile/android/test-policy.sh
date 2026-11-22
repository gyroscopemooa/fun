#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
out="$(mktemp -d)"
trap 'rm -rf "$out"' EXIT
javac --release 17 -encoding UTF-8 -d "$out" app/src/main/java/net/manytool/app/NavigationPolicy.java app/src/release/java/net/manytool/app/DevServer.java app/src/main/java/net/manytool/app/CreditReadiness.java app/src/main/java/net/manytool/app/FileSelectionPolicy.java tests/PolicyTest.java
java -cp "$out" net.manytool.app.PolicyTest
