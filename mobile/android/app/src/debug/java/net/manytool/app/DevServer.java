package net.manytool.app;

import java.net.URI;

/**
 * Debug builds can use the production web shell while the credit API stays local.
 * Set ORIGIN back to the host dev server when testing unpublished web changes.
 */
public final class DevServer {
    public static final String ORIGIN = null;
    public static boolean isDevUrl(String value) {
        try {
            URI u = URI.create(value);
            return "http".equalsIgnoreCase(u.getScheme()) && "10.0.2.2".equals(u.getHost()) && u.getPort() == 4310 && u.getRawUserInfo() == null;
        } catch (RuntimeException e) { return false; }
    }
    public static boolean isDevOrigin(String value) { return isDevUrl(value); }
    private DevServer() {}
}
