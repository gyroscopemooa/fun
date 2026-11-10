package net.manytool.app;

/** Deliberately fails closed until authenticated app account handoff and real Play tests pass. */
public final class CreditReadiness {
    public static final boolean PURCHASES_ENABLED = false;
    public static final String STATUS = "준비 중: Play 결제·서버 검증 개발 중. 앱 계정 연결·상품·환불 동기화·실구매 검증 전입니다.";
    public static boolean canLaunchPurchase() { return PURCHASES_ENABLED; }
    private CreditReadiness() {}
}
