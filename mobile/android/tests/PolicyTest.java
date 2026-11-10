package net.manytool.app;

public final class PolicyTest {
    private static int assertions;
    private static void check(boolean value,String label) { assertions++; if(!value) throw new AssertionError(label); }
    public static void main(String[] args) {
        check(NavigationPolicy.isAllowedPage("https://manytool.net/image-cropper/"),"image tool");
        check(NavigationPolicy.isAllowedPage("https://manytool.net/photo-to-document/?source=app"),"OCR");
        check(!NavigationPolicy.isAllowedPage("https://manytool.net/credits/"),"credit UI off");
        check(!NavigationPolicy.isAllowedPage("https://manytool.net/ai-id-photo/"),"paid tool off");
        check(!NavigationPolicy.isAllowedPage("https://manytool.net/instagram-video-downloader/"),"video not verified");
        check(!NavigationPolicy.isTrusted("https://manytool.net.evil.test/image-cropper/"),"host suffix");
        check(!NavigationPolicy.isTrusted("https://manytool.net@evil.test/image-cropper/"),"userinfo spoof");
        check(!NavigationPolicy.isTrusted("https://u:pass@manytool.net/image-cropper/"),"no credentials");
        check(!NavigationPolicy.isTrusted("http://manytool.net/image-cropper/"),"HTTP blocked");
        check(!NavigationPolicy.isTrusted("https://manytool.net:8443/image-cropper/"),"nonstandard port");
        check(!NavigationPolicy.isTrusted("file:///etc/passwd"),"local file blocked");
        check(!NavigationPolicy.isAllowedPage("javascript:alert(1)"),"javascript navigation");
        check(!NavigationPolicy.isAllowedPage("intent://manytool.net"),"intent scheme");
        check(!NavigationPolicy.isAllowedPage("https://manytool.net/image-cropper/../credits"),"traversal");
        check(NavigationPolicy.isPaymentRequest("https://api.manytool.net/payment/checkout"),"checkout API blocked");
        check(NavigationPolicy.isPaymentRequest("https://api.manytool.net/%63redits/buy"),"encoded credit path");
        check(NavigationPolicy.isPaymentRequest("https://checkout.polar.sh/x"),"Polar blocked");
        check(NavigationPolicy.isPaymentRequest("https://buy.stripe.com/x"),"Stripe blocked");
        check(!NavigationPolicy.isPublicDownload("https://external.test/file.png"),"external download blocked");
        check(NavigationPolicy.isPublicDownload("https://manytool.net/files/output.png"),"same-origin public file");
        check(!CreditReadiness.canLaunchPurchase(),"billing fail closed");
        check(NavigationPolicy.safeFilename("../../x.txt").equals("_.._x.txt"),"filename sanitized");
        System.out.println("PASS " + assertions + " Android navigation/billing policy checks");
    }
}
