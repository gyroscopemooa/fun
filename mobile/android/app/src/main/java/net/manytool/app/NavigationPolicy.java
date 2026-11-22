package net.manytool.app;

import java.net.URI;
import java.util.Locale;
import java.util.Arrays;

/** Pure policy: no cookies, tokens, credentials or dynamic purchase configuration. */
public final class NavigationPolicy {
    public static final String ORIGIN = "https://manytool.net";
    /** Page origin the app loads: production, or the dev server in debug builds. */
    public static String base() { return DevServer.ORIGIN != null ? DevServer.ORIGIN : ORIGIN; }
    public static boolean isTrusted(String value) {
        if (DevServer.isDevUrl(value)) return true;
        try {
            URI u = URI.create(value);
            return "https".equalsIgnoreCase(u.getScheme()) && "manytool.net".equalsIgnoreCase(u.getHost())
                && u.getRawUserInfo() == null && (u.getPort() == -1 || u.getPort() == 443);
        } catch (RuntimeException e) { return false; }
    }
    public static boolean isAllowedPage(String value) {
        if (!isTrusted(value) || isPaymentRequest(value)) return false;
        try {
            String path = URI.create(value).getPath().replaceAll("/+$", "");
            return !path.contains("\\") && !Arrays.asList(path.split("/")).contains("..") && !Arrays.asList(path.split("/")).contains(".");
        } catch (RuntimeException e) { return false; }
    }
    public static boolean isPaymentRequest(String value) {
        try {
            URI u = URI.create(value);
            String host = String.valueOf(u.getHost()).toLowerCase(Locale.ROOT);
            String path = String.valueOf(u.getPath()).toLowerCase(Locale.ROOT);
            return host.equals("polar.sh") || host.endsWith(".polar.sh") || host.equals("buy.stripe.com")
                || path.contains("checkout") || path.contains("/payment") || path.contains("/credits")
                || path.contains("/billing") || host.equals("nicepay.co.kr") || host.endsWith(".nicepay.co.kr")
                || path.contains("/nicepay") || path.contains("/credit-review");
        } catch (RuntimeException e) { return true; }
    }
    public static boolean isExternalPage(String value) {
        try {
            URI u = URI.create(value);
            return "https".equalsIgnoreCase(u.getScheme()) && u.getHost()!=null && u.getUserInfo()==null
                && (u.getPort()==-1 || u.getPort()==443) && !isTrusted(value) && !isPaymentRequest(value);
        } catch (RuntimeException e) { return false; }
    }
    public static boolean isPublicDownload(String value) {
        if (isPaymentRequest(value)) return false;
        if (isTrusted(value)) return true;
        try {
            URI u=URI.create(value);
            String path=u.getPath();
            return "https".equalsIgnoreCase(u.getScheme()) && "api.manytool.net".equalsIgnoreCase(u.getHost())
                && u.getRawUserInfo()==null && (u.getPort()==-1 || u.getPort()==443)
                && path.startsWith("/files/") && !path.contains("\\") && !Arrays.asList(path.split("/")).contains("..");
        } catch(RuntimeException e){return false;}
    }
    public static String safeFilename(String input) {
        String result = input == null ? "manytool-file" : input.replaceAll("[^\\p{L}\\p{N}._ -]", "_");
        result = result.replaceAll("^\\.+", "");
        return result.trim().isEmpty() ? "manytool-file" : result.substring(0, Math.min(result.length(), 100));
    }
    private NavigationPolicy() {}
}
