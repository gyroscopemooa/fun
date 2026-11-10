import net.manytool.app.PlayCreditPolicy;
public class PlayPolicyTest {
    private static int count;
    private static void ok(boolean value) {count++; if(!value) throw new AssertionError("check "+count);}
    public static void main(String[] args) {
        String binding="a".repeat(64);
        ok(PlayCreditPolicy.validBinding(binding)); ok(!PlayCreditPolicy.validBinding(null));
        ok(!PlayCreditPolicy.validBinding("user@example.com")); ok(!PlayCreditPolicy.validBinding("A".repeat(64)));
        ok(PlayCreditPolicy.validProduct("credit_10")); ok(PlayCreditPolicy.validProduct("manytool.credit.10"));
        ok(!PlayCreditPolicy.validProduct("https://example.com")); ok(!PlayCreditPolicy.validProduct("../evil"));
        ok(!PlayCreditPolicy.validProduct("UPPER")); ok(!PlayCreditPolicy.validProduct(null));
        ok(PlayCreditPolicy.belongsToAccount(binding,binding)); ok(!PlayCreditPolicy.belongsToAccount(binding,"b".repeat(64)));
        ok(!PlayCreditPolicy.belongsToAccount(null,null)); ok(!PlayCreditPolicy.belongsToAccount(binding,null));
        System.out.println("Play policy: "+count+" checks passed");
    }
}
