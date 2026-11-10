#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
out="$(mktemp -d)"
trap 'rm -rf "$out"' EXIT
javac --release 17 -d "$out" app/src/main/java/net/manytool/app/NavigationPolicy.java app/src/main/java/net/manytool/app/CreditReadiness.java tests/PolicyTest.java
java -cp "$out" net.manytool.app.PolicyTest
