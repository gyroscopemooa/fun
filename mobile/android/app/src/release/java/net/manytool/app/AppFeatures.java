package net.manytool.app;

/** Production keeps purchase entry points closed until Play billing is ready. */
public final class AppFeatures {
    public static final boolean PLAY_CREDITS_ENTRY_ENABLED = false;
    public static final boolean ALLOW_LOCAL_CREDIT_API = false;
    private AppFeatures() {}
}
