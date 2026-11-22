package net.manytool.app;

/** Lets the debug shell exercise the native credit-login entry point without enabling purchases. */
public final class AppFeatures {
    public static final boolean PLAY_CREDITS_ENTRY_ENABLED = true;
    public static final boolean ALLOW_LOCAL_CREDIT_API = true;
    /** UI-only package picker used before Play Console products exist. No purchase is possible. */
    public static final boolean SHOW_CREDIT_PREVIEW = true;
    private AppFeatures() {}
}
