package net.manytool.app;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.CancellationSignal;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import androidx.credentials.*;
import androidx.credentials.exceptions.GetCredentialException;
import com.google.android.libraries.identity.googleid.GetGoogleIdOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;
import org.json.JSONObject;
import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.KeyStore;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** Native Google sign-in for the credit wallet. The session token is Keystore-encrypted,
 * never logged and never exposed to WebView JavaScript. */
public final class AppAccount implements PlayCreditHttpBackend.SessionProvider {
    public interface Callback { void done(boolean ok, String message); }
    public static final String API = CreditServer.ORIGIN;
    private static final String PREFS="native_account", SESSION="credit_session", KEY="manytool_credit_session_key";
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private final SharedPreferences prefs;
    private volatile String session;
    private boolean busy;

    public AppAccount(Context context) {
        prefs=context.getSharedPreferences(PREFS,Context.MODE_PRIVATE);
        session=restoreSession();
    }

    @Override public String currentSessionToken() { return session; }
    public boolean signedIn() { return session != null; }

    private SecretKey key() throws Exception {
        KeyStore store=KeyStore.getInstance("AndroidKeyStore"); store.load(null);
        if(store.containsAlias(KEY)) return ((KeyStore.SecretKeyEntry)store.getEntry(KEY,null)).getSecretKey();
        KeyGenerator generator=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(KEY,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
        return generator.generateKey();
    }
    private String restoreSession() {
        String saved=prefs.getString(SESSION,null); if(saved==null) return null;
        try { String[] parts=saved.split(":",2); if(parts.length!=2) throw new Exception("format");
            Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding"); byte[] iv=Base64.decode(parts[0],Base64.NO_WRAP);
            cipher.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,iv));
            String value=new String(cipher.doFinal(Base64.decode(parts[1],Base64.NO_WRAP)),StandardCharsets.UTF_8);
            if(!value.matches("[a-f0-9]{32,256}")) throw new Exception("token"); return value;
        } catch(Exception ignored) { prefs.edit().remove(SESSION).apply(); return null; }
    }
    private void saveSession(String value) {
        try { byte[] iv=new byte[12]; new java.security.SecureRandom().nextBytes(iv); Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE,key(),new GCMParameterSpec(128,iv));
            prefs.edit().putString(SESSION,Base64.encodeToString(iv,Base64.NO_WRAP)+":"+Base64.encodeToString(cipher.doFinal(value.getBytes(StandardCharsets.UTF_8)),Base64.NO_WRAP)).apply();
        } catch(Exception ignored) { /* A session can still be used until this process closes. */ }
    }

    private static String cookie(HttpURLConnection c, String name) {
        Pattern p = Pattern.compile("(?:^|;\\s*)" + name + "=([a-f0-9]{32,256})");
        for (java.util.Map.Entry<String, List<String>> entry : c.getHeaderFields().entrySet()) {
            if (entry.getKey() == null || !"Set-Cookie".equalsIgnoreCase(entry.getKey()) || entry.getValue() == null) continue;
            for (String h : entry.getValue()) { Matcher m = p.matcher(h); if (m.find()) return m.group(1); }
        }
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
                        session = out[0]; saveSession(session);
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
        String old = session; session = null; prefs.edit().remove(SESSION).apply();
        if (old == null) return;
        io.execute(() -> { try { post("/credits/logout", new JSONObject(), "manytool_credit_session=" + old, null, null); } catch (Exception ignored) { /* best effort */ } });
    }
    public void close() { io.shutdown(); }
}
