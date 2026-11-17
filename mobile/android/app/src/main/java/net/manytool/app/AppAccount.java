package net.manytool.app;

import android.app.Activity;
import android.os.CancellationSignal;
import androidx.credentials.*;
import androidx.credentials.exceptions.GetCredentialException;
import com.google.android.libraries.identity.googleid.GetGoogleIdOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;
import org.json.JSONObject;
import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Native Google sign-in for the credit wallet. The session token lives only in memory:
 * never written to storage/logs and never exposed to WebView JavaScript. */
public final class AppAccount implements PlayCreditHttpBackend.SessionProvider {
    public interface Callback { void done(boolean ok, String message); }
    public static final String API = "https://api.manytool.net";
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private volatile String session;
    private boolean busy;

    @Override public String currentSessionToken() { return session; }
    public boolean signedIn() { return session != null; }

    private static String cookie(HttpURLConnection c, String name) {
        List<String> headers = c.getHeaderFields().get("Set-Cookie");
        if (headers == null) return null;
        Pattern p = Pattern.compile("(?:^|;\\s*)" + name + "=([a-f0-9]{32,256})");
        for (String h : headers) { Matcher m = p.matcher(h); if (m.find()) return m.group(1); }
        return null;
    }
    private JSONObject post(String path, JSONObject body, String cookieHeader, String[] cookieOut, String cookieName) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(API + path).openConnection();
        c.setInstanceFollowRedirects(false); c.setConnectTimeout(15000); c.setReadTimeout(20000);
        c.setRequestMethod("POST"); c.setDoOutput(true);
        c.setRequestProperty("Origin", NavigationPolicy.ORIGIN); c.setRequestProperty("Content-Type", "application/json");
        c.setRequestProperty("Accept", "application/json");
        if (cookieHeader != null) c.setRequestProperty("Cookie", cookieHeader);
        try {
            byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8); c.setFixedLengthStreamingMode(bytes.length);
            try (OutputStream out = c.getOutputStream()) { out.write(bytes); }
            if (c.getResponseCode() != 200) throw new IOException("status");
            if (cookieOut != null) cookieOut[0] = cookie(c, cookieName);
            try (InputStream in = c.getInputStream(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                byte[] buf = new byte[4096]; int n;
                while ((n = in.read(buf)) != -1) { if (out.size() + n > 65536) throw new IOException("size"); out.write(buf, 0, n); }
                return new JSONObject(out.toString("UTF-8"));
            }
        } finally { c.disconnect(); }
    }

    /** Blocking GET of the signed-in wallet balance; call off the main thread. Returns -1 when unavailable. */
    public long fetchBalance() {
        String token = session;
        if (token == null) return -1;
        try {
            HttpURLConnection c = (HttpURLConnection) new URL(API + "/credits/me").openConnection();
            c.setInstanceFollowRedirects(false); c.setConnectTimeout(15000); c.setReadTimeout(20000);
            c.setRequestProperty("Cookie", "manytool_credit_session=" + token); c.setRequestProperty("Origin", NavigationPolicy.ORIGIN);
            c.setRequestProperty("Accept", "application/json");
            try {
                if (c.getResponseCode() != 200) { if (c.getResponseCode() == 401 && token.equals(session)) session = null; return -1; }
                try (InputStream in = c.getInputStream(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                    byte[] buf = new byte[4096]; int n;
                    while ((n = in.read(buf)) != -1) { if (out.size() + n > 1048576) return -1; out.write(buf, 0, n); }
                    long balance = new JSONObject(out.toString("UTF-8")).getLong("balance");
                    return balance < 0 ? -1 : balance;
                }
            } finally { c.disconnect(); }
        } catch (Exception e) { return -1; }
    }
    public void runIo(Runnable task) { io.execute(task); }

    /** Must be called from the main thread. */
    public void signIn(Activity activity, Callback callback) {
        if (busy) return; busy = true;
        io.execute(() -> {
            try {
                JSONObject challenge = post("/credits/google/challenge", new JSONObject(), null, null, null);
                String nonce = challenge.getString("nonce"), clientId = challenge.getString("clientId");
                if (!nonce.matches("[a-f0-9]{64}") || clientId.isEmpty()) throw new IOException("challenge");
                activity.runOnUiThread(() -> requestToken(activity, nonce, clientId, callback));
            } catch (Exception e) { finish(activity, callback, false, "서버에 연결하지 못했습니다. 로그인하지 않았습니다."); }
        });
    }
    private void requestToken(Activity activity, String nonce, String clientId, Callback callback) {
        GetGoogleIdOption option = new GetGoogleIdOption.Builder().setFilterByAuthorizedAccounts(false)
            .setServerClientId(clientId).setNonce(nonce).build();
        GetCredentialRequest request = new GetCredentialRequest.Builder().addCredentialOption(option).build();
        CredentialManager.create(activity).getCredentialAsync(activity, request, new CancellationSignal(), io,
            new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                @Override public void onResult(GetCredentialResponse result) {
                    try {
                        Credential credential = result.getCredential();
                        if (!(credential instanceof CustomCredential) || !GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(credential.getType()))
                            throw new IOException("type");
                        String token = GoogleIdTokenCredential.createFrom(((CustomCredential) credential).getData()).getIdToken();
                        String[] out = new String[1];
                        post("/credits/google/session", new JSONObject().put("credential", token), "manytool_google_nonce=" + nonce, out, "manytool_credit_session");
                        if (out[0] == null) throw new IOException("session");
                        session = out[0];
                        finish(activity, callback, true, "로그인했습니다.");
                    } catch (Exception e) { finish(activity, callback, false, "로그인을 확인하지 못했습니다. 다시 시도해 주세요."); }
                }
                @Override public void onError(GetCredentialException e) { finish(activity, callback, false, "Google 로그인을 취소했거나 사용할 수 없습니다."); }
            });
    }
    private void finish(Activity activity, Callback callback, boolean ok, String message) {
        activity.runOnUiThread(() -> { busy = false; if (!activity.isFinishing()) callback.done(ok, message); });
    }
    public void signOut() {
        String old = session; session = null;
        if (old == null) return;
        io.execute(() -> { try { post("/credits/logout", new JSONObject(), "manytool_credit_session=" + old, null, null); } catch (Exception ignored) { /* best effort */ } });
    }
    public void close() { signOut(); io.shutdown(); }
}
