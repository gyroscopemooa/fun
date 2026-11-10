import net.manytool.app.HybridBridgePolicy;
public class HybridBridgeTest {
    private static int count;
    static void ok(boolean v){count++;if(!v)throw new AssertionError("check "+count);}
    public static void main(String[] args){
        ok(HybridBridgePolicy.trustedOrigin("https://manytool.net",true));
        ok(HybridBridgePolicy.trustedOrigin("https://manytool.net:443",true));
        ok(!HybridBridgePolicy.trustedOrigin("https://manytool.net",false));
        ok(!HybridBridgePolicy.trustedOrigin("https://manytool.net.evil.example",true));
        ok(!HybridBridgePolicy.trustedOrigin("https://evil@manytool.net",true));
        ok(!HybridBridgePolicy.trustedOrigin("http://manytool.net",true));
        ok(!HybridBridgePolicy.trustedOrigin("https://manytool.net:444",true));
        ok(!HybridBridgePolicy.trustedOrigin("https://manytool.net/x",true));
        ok(HybridBridgePolicy.allowedCommand("saveText")); ok(HybridBridgePolicy.allowedCommand("shareText"));
        ok(HybridBridgePolicy.allowedCommand("capabilities")); ok(!HybridBridgePolicy.allowedCommand("getCookies"));
        ok(!HybridBridgePolicy.allowedCommand("openUrl")); ok(!HybridBridgePolicy.allowedCommand("buy"));
        ok(HybridBridgePolicy.validId("request_123")); ok(!HybridBridgePolicy.validId("<script>"));
        ok(!HybridBridgePolicy.validText("")); ok(!HybridBridgePolicy.validText("a".repeat(64001)));
        ok(HybridBridgePolicy.validText("사용자가 선택한 텍스트"));
        System.out.println("Hybrid bridge: "+count+" checks passed");
    }
}
