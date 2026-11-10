package net.manytool.app;

import org.json.*;
import java.net.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** HTTPS transport for the existing authenticated wallet API. It does not implement login.
 * SessionProvider must come from a verified first-party app authentication flow, not a
 * WebView JS message, external URL, email field, or untrusted origin. Never persists tokens. */
public final class PlayCreditHttpBackend implements PlayCreditBilling.Backend {
    public interface SessionProvider { String currentSessionToken(); }
    private final URI base;
    private final String webOrigin;
    private final SessionProvider sessions;
    public PlayCreditHttpBackend(String apiBase, String webOrigin, SessionProvider sessions) {
        this.base=validatedOrigin(apiBase); this.webOrigin=validatedOrigin(webOrigin).toString(); this.sessions=sessions;
    }
    private static URI validatedOrigin(String raw) {
        URI uri=URI.create(raw);
        if(!"https".equals(uri.getScheme()) || uri.getHost()==null || uri.getRawUserInfo()!=null ||
            uri.getRawQuery()!=null || uri.getRawFragment()!=null || (uri.getPort()!=-1 && uri.getPort()!=443) ||
            !(uri.getRawPath().isEmpty() || uri.getRawPath().equals("/"))) throw new IllegalArgumentException("HTTPS origin required");
        return URI.create("https://"+uri.getHost());
    }
    private JSONObject request(String path, JSONObject body) throws Exception {
        String session=sessions.currentSessionToken();
        if(session==null || !session.matches("[a-f0-9]{32,256}")) throw new IOException("Authenticated session required");
        HttpURLConnection c=(HttpURLConnection)base.resolve(path).toURL().openConnection();
        c.setInstanceFollowRedirects(false); c.setConnectTimeout(15000); c.setReadTimeout(25000);
        c.setRequestProperty("Cookie","manytool_credit_session="+session);
        c.setRequestProperty("Origin",webOrigin); c.setRequestProperty("Accept","application/json");
        c.setRequestProperty("Cache-Control","no-store");
        try {
            if(body!=null) { c.setRequestMethod("POST"); c.setDoOutput(true); c.setRequestProperty("Content-Type","application/json");
                byte[] bytes=body.toString().getBytes(StandardCharsets.UTF_8); c.setFixedLengthStreamingMode(bytes.length);
                try(OutputStream out=c.getOutputStream()){out.write(bytes);}
            }
            int status=c.getResponseCode();
            if(status<200 || status>=300) throw new IOException("Wallet request failed: "+status);
            // Ignore response bodies for errors; no server message can expose purchase credentials.
            try(InputStream in=c.getInputStream(); ByteArrayOutputStream out=new ByteArrayOutputStream()) {
                byte[] bytes=new byte[4096]; int n;
                while((n=in.read(bytes))!=-1) {if(out.size()+n>1024*1024) throw new IOException("Response too large"); out.write(bytes,0,n);}
                if(!session.equals(sessions.currentSessionToken())) throw new IOException("Account session changed");
                return new JSONObject(out.toString("UTF-8"));
            }
        } finally { c.disconnect(); }
    }
    @Override public PlayCreditBilling.Catalog catalog() throws Exception {
        JSONObject result=request("/credits/play/catalog",null);
        Map<String,Integer> products=new HashMap<>();
        JSONArray list=result.optJSONArray("products");
        if(list!=null) for(int i=0;i<list.length();i++) {
            JSONObject p=list.getJSONObject(i); String id=p.getString("productId");
            if(products.put(id,p.getInt("credits"))!=null) throw new IOException("Duplicate product");
        }
        return new PlayCreditBilling.Catalog(result.optBoolean("enabled",false), result.optBoolean("recoveryAvailable",false), result.optString("accountBinding",""), products);
    }
    @Override public PlayCreditBilling.Receipt verify(String productId,String token) throws Exception {
        JSONObject result=request("/credits/play/verify",new JSONObject().put("productId",productId).put("purchaseToken",token));
        long balance=result.getLong("balance");
        if(balance<0 || !result.has("consumptionPending")) throw new IOException("Invalid receipt");
        return new PlayCreditBilling.Receipt(balance,result.getBoolean("consumptionPending"));
    }
}
