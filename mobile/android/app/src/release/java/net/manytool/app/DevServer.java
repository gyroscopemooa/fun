package net.manytool.app;

/** Release build: no development server. The app only ever loads the production origin. */
public final class DevServer {
    public static final String ORIGIN = null;
    public static boolean isDevUrl(String value) { return false; }
    public static boolean isDevOrigin(String value) { return false; }
    private DevServer() {}
}
