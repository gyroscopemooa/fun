package net.manytool.app;

/** Lets the debug shell exercise the native credit-login entry point without enabling purchases. */
public final class AppFeatures {
    public static final boolean PLAY_CREDITS_ENTRY_ENABLED = true;
    public static final boolean ALLOW_LOCAL_CREDIT_API = true;
    private AppFeatures() {}
}
