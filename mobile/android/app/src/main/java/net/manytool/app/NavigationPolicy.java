package net.manytool.app;

import java.net.URI;
import java.util.Locale;
import java.util.Set;
import java.util.HashSet;
import java.util.Arrays;

/** Pure policy: no cookies, tokens, credentials or dynamic purchase configuration. */
public final class NavigationPolicy {
    public static final String ORIGIN = "https://manytool.net";
    private static final Set<String> PAGES = new HashSet<>(Arrays.asList(
        "/platform-tools", "/selection-workbench", "/text-compare", "/subtitle-editor", "/image-batch", "/image-tools", "/image-compressor", "/image-converter", "/image-cropper",
        "/image-merger", "/image-resizer", "/image-blur", "/json-formatter",
        "/date-calculator", "/photo-to-document", "/privacy", "/terms", "/contact"
    ));
    public static boolean isTrusted(String value) {
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
            return PAGES.contains(path);
        } catch (RuntimeException e) { return false; }
    }
    public static boolean isPaymentRequest(String value) {
        try {
            URI u = URI.create(value);
            String host = String.valueOf(u.getHost()).toLowerCase(Locale.ROOT);
            String path = String.valueOf(u.getPath()).toLowerCase(Locale.ROOT);
            return host.equals("polar.sh") || host.endsWith(".polar.sh") || host.equals("buy.stripe.com")
                || path.contains("checkout") || path.contains("/payment") || path.contains("/credits")
                || path.contains("/billing");
        } catch (RuntimeException e) { return true; }
    }
    public static boolean isPublicDownload(String value) {
        return isTrusted(value) && !isPaymentRequest(value);
    }
    public static String safeFilename(String input) {
        String result = input == null ? "manytool-file" : input.replaceAll("[^\\p{L}\\p{N}._ -]", "_");
        result = result.replaceAll("^\\.+", "");
        return result.trim().isEmpty() ? "manytool-file" : result.substring(0, Math.min(result.length(), 100));
    }
    private NavigationPolicy() {}
}
