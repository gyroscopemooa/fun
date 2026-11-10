package net.manytool.app;

import java.net.URI;

/** Bridge capability allowlist. No arbitrary reflection, navigation or credential access. */
public final class HybridBridgePolicy {
    public static final int MAX_MESSAGE=72000, MAX_TEXT=64000;
    private HybridBridgePolicy() {}
    public static boolean trustedOrigin(String origin, boolean mainFrame) {
        if(!mainFrame || origin==null) return false;
        try {
            URI u=URI.create(origin);
            return "https".equals(u.getScheme()) && "manytool.net".equals(u.getHost()) &&
                (u.getPort()==-1 || u.getPort()==443) && u.getUserInfo()==null &&
                (u.getPath().isEmpty() || u.getPath().equals("/")) && u.getQuery()==null && u.getFragment()==null;
        } catch(IllegalArgumentException e){return false;}
    }
    public static boolean validId(String id){return id!=null && id.matches("[a-zA-Z0-9_-]{1,64}");}
    public static boolean allowedCommand(String command){return "capabilities".equals(command) || "saveText".equals(command) || "shareText".equals(command);}
    public static boolean validText(String text){return text!=null && !text.isEmpty() && text.length()<=MAX_TEXT;}
}
