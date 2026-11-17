package net.manytool.app;

public final class PolicyTest {
    private static int assertions;
    private static void check(boolean value,String label) { assertions++; if(!value) throw new AssertionError(label); }
    public static void main(String[] args) {
        check(NavigationPolicy.isAllowedPage("https://manytool.net/image-cropper/"),"image tool");
        check(NavigationPolicy.isAllowedPage("https://manytool.net/photo-to-document/?source=app"),"OCR");
        check(!NavigationPolicy.isAllowedPage("https://manytool.net/credits/"),"credit UI off");
        check(NavigationPolicy.isAllowedPage("https://manytool.net/ai-id-photo/"),"AI screen available, checkout separately blocked");
        check(NavigationPolicy.isAllowedPage("https://manytool.net/instagram-video-downloader/"),"all web tool screens");
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
        check(NavigationPolicy.isAllowedPage("https://manytool.net/"),"web home");
        check(NavigationPolicy.isAllowedPage("https://manytool.net/ja/image-cropper/"),"translated page");
        check(NavigationPolicy.isAllowedPage("https://manytool.net/account/"),"account page");
        check(NavigationPolicy.isExternalPage("https://mooaresume.com/"),"partner browser link");
        check(!NavigationPolicy.isExternalPage("https://pg-web.nicepay.co.kr/v3/"),"no PG external bypass");
        check(!NavigationPolicy.isExternalPage("intent://evil"),"external intent rejected");
        check(java.util.Arrays.equals(FileSelectionPolicy.mimeTypes(new String[]{".jpg,image/png", "image/png"}), new String[]{"image/jpeg","image/png"}),"accept types normalized");
        check(java.util.Arrays.equals(FileSelectionPolicy.mimeTypes(new String[]{"", "nonsense"}),new String[]{"*/*"}),"empty accept fallback");
        check(NavigationPolicy.isPublicDownload("https://api.manytool.net/files/output.jpg"),"owned public image API file");
        check(!NavigationPolicy.isPublicDownload("https://api.manytool.net/private/output.jpg"),"no arbitrary API downloads");
        check(!NavigationPolicy.isPublicDownload("https://api.manytool.net/files/../private/x"),"download traversal");
        check(NavigationPolicy.isPaymentRequest("https://manytool.net/api/nicepay-review/window"),"review PG path blocked");
        check(java.util.Arrays.equals(FileSelectionPolicy.mimeTypes(new String[]{"image/*"}),new String[]{"image/*"}),"image wildcard preserved");
        check(!CreditReadiness.canLaunchPurchase(),"billing fail closed");
        check(NavigationPolicy.safeFilename("../../x.txt").equals("_.._x.txt"),"filename sanitized");
        System.out.println("PASS " + assertions + " Android navigation/billing policy checks");
    }
}
