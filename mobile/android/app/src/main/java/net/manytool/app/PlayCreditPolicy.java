package net.manytool.app;

/** Pure validation shared by the controller and its offline tests. Never grants credit. */
public final class PlayCreditPolicy {
    private PlayCreditPolicy() {}
    public static boolean validBinding(String binding) {
        return binding != null && binding.matches("[a-f0-9]{64}");
    }
    public static boolean validProduct(String id) {
        return id != null && id.length() <= 100 && id.matches("[a-z0-9][a-z0-9_.]*");
    }
    public static boolean belongsToAccount(String expected, String actual) {
        return validBinding(expected) && expected.equals(actual);
    }
}
