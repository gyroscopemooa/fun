package net.manytool.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Bundle;
import android.util.Base64;
import android.webkit.*;
import android.widget.*;
import org.json.JSONObject;
import androidx.webkit.JavaScriptReplyProxy;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import java.nio.charset.StandardCharsets;
import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Hybrid development shell. Origin-scoped message bridge; no account-cookie export. */
public class MainActivity extends Activity {
    private static final int CHOOSE_FILE = 10, SAVE_FILE = 11, LIMIT = 8 * 1024 * 1024;
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private WebView web;
    private LinearLayout root;
    private TextView status;
    private ValueCallback<Uri[]> upload;
    private byte[] pendingSave;
    private int navigation = 0, uploadNavigation = -1;
    private AlertDialog bridgeDialog;
    private long lastBridgeRequest;
    private boolean downloadBusy = false, loadFailed = false;
    private AppAccount account;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        account = new AppAccount(this);
        if (android.os.Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::goBack);
        }
        root = new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(0xFFF1F5F9); // match the web page background behind the status bar inset
        // Target 35: avoid drawing controls beneath status/navigation bars.
        if (android.os.Build.VERSION.SDK_INT >= 30) root.setOnApplyWindowInsetsListener((v, insets) -> {
            android.graphics.Insets bars = insets.getInsets(android.view.WindowInsets.Type.systemBars());
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom); return insets;
        });
        if (android.os.Build.VERSION.SDK_INT < 30) root.setOnApplyWindowInsetsListener((v, insets) -> {
            v.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom()); return insets;
        });
        frame = new FrameLayout(this); frame.addView(root, new FrameLayout.LayoutParams(-1,-1));
        setContentView(frame); root.requestApplyInsets(); showSplash(); showHome();
    }
    // In-app splash: "Weight wave" lettering rendered from bundled assets only (no network, no bridge).
    private static final long SPLASH_MIN_MS = 1800, SPLASH_MAX_MS = 4500;
    private FrameLayout frame;
    private WebView splash;
    private long splashShownAt;
    private boolean splashClosing;
    private void showSplash() {
        splash = new WebView(this); splashShownAt = android.os.SystemClock.elapsedRealtime();
        splash.setBackgroundColor(0xFFF5F5F8); splash.setClickable(true);
        WebSettings s = splash.getSettings(); s.setJavaScriptEnabled(true);
        s.setAllowFileAccess(false); s.setAllowContentAccess(false); s.setDomStorageEnabled(false);
        final androidx.webkit.WebViewAssetLoader loader = new androidx.webkit.WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", new androidx.webkit.WebViewAssetLoader.AssetsPathHandler(this)).build();
        splash.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
                WebResourceResponse res = loader.shouldInterceptRequest(r.getUrl());
                return res != null ? res : new WebResourceResponse("text/plain", "UTF-8", 403, "Blocked", java.util.Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
            }
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) { return true; }
        });
        frame.addView(splash, new FrameLayout.LayoutParams(-1,-1));
        splash.loadUrl("https://appassets.androidplatform.net/assets/splash/splash.html");
        splash.postDelayed(this::hideSplash, SPLASH_MAX_MS);
    }
    private void hideSplash() {
        if (splash == null || splashClosing) return; splashClosing = true;
        final WebView target = splash;
        long wait = Math.max(0, SPLASH_MIN_MS - (android.os.SystemClock.elapsedRealtime() - splashShownAt));
        target.postDelayed(() -> target.animate().alpha(0f).setDuration(350).withEndAction(() -> {
            frame.removeView(target); target.destroy(); if (splash == target) splash = null;
        }).start(), wait);
    }
    private Button button(String text, Runnable action) {
        Button b = new Button(this); b.setText(text); b.setOnClickListener(v -> action.run()); return b;
    }
    private void showHome() {
        if (web != null) { web.loadUrl(NavigationPolicy.base() + "/"); return; }
        openTool("/");
    }
    private void openTool(String path) {
        disposeWeb(); root.removeAllViews();
        status = new TextView(this); status.setPadding(16,8,16,8); status.setVisibility(android.view.View.GONE); root.addView(status);
        web = new WebView(this); root.addView(web, new LinearLayout.LayoutParams(-1,0,1));
        WebView.setWebContentsDebuggingEnabled(false);
        WebSettings s = web.getSettings(); s.setJavaScriptEnabled(true); s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false); s.setAllowContentAccess(false); s.setAllowFileAccessFromFileURLs(false);
        s.setAllowUniversalAccessFromFileURLs(false); s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setSafeBrowsingEnabled(true); s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setSupportMultipleWindows(true); s.setGeolocationEnabled(false); s.setMediaPlaybackRequiresUserGesture(true);
        s.setUserAgentString(s.getUserAgentString() + " ManytoolAndroidDev/0.1");
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onCreateWindow(WebView v, boolean dialog, boolean gesture, android.os.Message result) {
                if (!gesture) return false;
                WebView popup = new WebView(MainActivity.this);
                popup.setWebViewClient(new WebViewClient() {
                    @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                        String url = r.getUrl().toString();
                        if (NavigationPolicy.isAllowedPage(url) && web != null) web.loadUrl(url);
                        else openExternal(url);
                        v.destroy(); return true;
                    }
                });
                ((WebView.WebViewTransport)result.obj).setWebView(popup); result.sendToTarget(); return true;
            }
            @Override public void onPermissionRequest(PermissionRequest request) { request.deny(); }
            @Override public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                callback.invoke(origin,false,false);
            }
            @Override public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (!NavigationPolicy.isAllowedPage(v.getUrl())) { callback.onReceiveValue(null); return true; }
                if (upload != null) { callback.onReceiveValue(null); return true; }
                upload = callback; uploadNavigation = navigation;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*");
                String[] accepted = FileSelectionPolicy.mimeTypes(params.getAcceptTypes());
                intent.setType(accepted.length == 1 ? accepted[0] : "*/*");
                if (accepted.length > 1) intent.putExtra(Intent.EXTRA_MIME_TYPES, accepted);
                intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE);
                try { startActivityForResult(intent, CHOOSE_FILE); }
                catch (RuntimeException e) { upload.onReceiveValue(null); upload=null; message("파일 선택", "파일 선택 앱을 열지 못했습니다."); }
                return true;
            }
        });
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                if (!r.isForMainFrame()) return !NavigationPolicy.isTrusted(r.getUrl().toString());
                String url = r.getUrl().toString();
                if (r.hasGesture() && (url.startsWith("blob:"+NavigationPolicy.base()+"/") || url.startsWith("data:"))) {
                    requestDownload(url,null); return true;
                }
                if (NavigationPolicy.isAllowedPage(url)) return false;
                if (r.hasGesture() && NavigationPolicy.isExternalPage(url)) openExternal(url);
                else message("연결 안내", NavigationPolicy.isPaymentRequest(url) ? "앱 결제는 준비 중입니다." : "이 연결은 앱에서 열 수 없습니다.");
                return true;
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
                String url=r.getUrl().toString();
                if (NavigationPolicy.isPaymentRequest(url) || (r.isForMainFrame() && !NavigationPolicy.isAllowedPage(url)))
                    return new WebResourceResponse("text/plain", "UTF-8", 403, "Blocked in development shell", java.util.Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
                return null;
            }
            @Override public void onPageStarted(WebView v,String url,Bitmap icon) { navigation++; downloadBusy=false; loadFailed=false; status.setVisibility(android.view.View.GONE); }
            @Override public void onPageFinished(WebView v,String url) {
                if(!loadFailed)status.setVisibility(android.view.View.GONE);
                // The app is Korean-first. Prevent WebView device language from sending the
                // Korean app shell to the incomplete English home-page copy.
                if(url.startsWith(NavigationPolicy.base()+"/en")) {
                    v.evaluateJavascript("localStorage.setItem('manytool-locale','ko');location.replace('/');",null);
                    return;
                }
                installNativeAccountEntryPoints(v);
                syncNativeAccountState(v);
                CookieManager.getInstance().flush(); hideSplash();
            }
            @Override public void onReceivedError(WebView v,WebResourceRequest r,WebResourceError error) {
                if(r.isForMainFrame()) { loadFailed=true; hideSplash(); status.setVisibility(android.view.View.VISIBLE); status.setText("페이지를 불러오지 못했습니다. 연결 상태를 확인하고 새로고침해 주세요."); }
            }
            @Override public void onReceivedSslError(WebView v,SslErrorHandler handler,SslError error) {
                handler.cancel(); loadFailed=true; status.setVisibility(android.view.View.VISIBLE); status.setText("안전한 연결을 확인할 수 없어 중단했습니다.");
            }
            @Override public boolean onRenderProcessGone(WebView v,RenderProcessGoneDetail detail) {
                disposeWeb(); showHome(); message("페이지 종료", "웹 화면이 종료되어 홈으로 돌아왔습니다."); return true;
            }
        });
        installHybridBridge(web);
        web.setDownloadListener((url,ua,disposition,mime,length) -> requestDownload(url,mime));
        web.loadUrl(NavigationPolicy.base() + path);
    }

    private void bridgeReply(JavaScriptReplyProxy reply,String id,boolean ok,String message) {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return;
        try {reply.postMessage(new JSONObject().put("id",id).put("ok",ok).put("message",message).toString());}
        catch(Exception ignored) { /* Page may have navigated; never log payloads. */ }
    }
    private void installHybridBridge(WebView target) {
        if(!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return;
        WebViewCompat.addWebMessageListener(target,"ManytoolNative",java.util.Collections.singleton(NavigationPolicy.base()),
            (view,request,origin,mainFrame,reply) -> {
                if(web!=view || !HybridBridgePolicy.trustedOrigin(origin.toString(),mainFrame) || !NavigationPolicy.isAllowedPage(view.getUrl())) return;
                if(request.getType()!=androidx.webkit.WebMessageCompat.TYPE_STRING) return;
                String raw=request.getData();
                if(raw==null || raw.length()>HybridBridgePolicy.MAX_MESSAGE) return;
                String id="";
                try {
                    JSONObject data=new JSONObject(raw); id=data.optString("id","");
                    String command=data.optString("command","");
                    if(!HybridBridgePolicy.validId(id) || !HybridBridgePolicy.allowedCommand(command)) {bridgeReply(reply,id,false,"unsupported");return;}
                    if("capabilities".equals(command)) {
                        reply.postMessage(new JSONObject().put("id",id).put("ok",true).put("capabilities",new JSONObject()
                            .put("version",1).put("saveText",true).put("shareText",true).put("creditLogin",true).put("playCredits",AppFeatures.PLAY_CREDITS_ENTRY_ENABLED).put("signedIn",account.signedIn())
                            .put("notifications",false).put("authenticatedVideo",false)).toString()); return;
                    }
                    if("balance".equals(command) || "signIn".equals(command)) {
                        // Account state only: signedIn + numeric balance. The session token never crosses the bridge.
                        final String replyId=id; final int generation=navigation;
                        Runnable respond=() -> account.runIo(() -> {
                            long balance=account.fetchBalance();
                            try {reply.postMessage(new JSONObject().put("id",replyId).put("ok",true).put("signedIn",account.signedIn()).put("balance",balance).toString());}
                            catch(Exception ignored) { /* page changed */ }
                        });
                        if("balance".equals(command)) { respond.run(); return; }
                        runOnUiThread(() -> {
                            if(web!=view || navigation!=generation || isFinishing()) return;
                            if(account.signedIn()) { syncNativeAccountState(web); respond.run(); return; }
                            account.signIn(this,(ok,text)->{ if(ok) { syncNativeAccountState(web); respond.run(); } else bridgeReply(reply,replyId,false,text); });
                        });
                        return;
                    }
                    if("signOut".equals(command)) {
                        final String requestId=id;
                        runOnUiThread(() -> { account.signOut(); syncNativeAccountState(web); bridgeReply(reply,requestId,true,"signed_out"); });
                        return;
                    }
                    if("openCredits".equals(command)) {
                        // Opens the native screen only; no account, token or purchase data crosses the bridge.
                        final int generation=navigation;
                        runOnUiThread(() -> { if(web==view && navigation==generation) openCredits(); });
                        reply.postMessage(new JSONObject().put("id",id).put("ok",CreditReadiness.canLaunchPurchase()).put("message","opened").toString()); return;
                    }
                    long now=android.os.SystemClock.elapsedRealtime();
                    if(bridgeDialog!=null || pendingSave!=null || now-lastBridgeRequest<1000) {bridgeReply(reply,id,false,"busy");return;}
                    String text=data.optString("text","");
                    if(!HybridBridgePolicy.validText(text)){bridgeReply(reply,id,false,"invalid_text");return;}
                    lastBridgeRequest=now;
                    final String requestId=id; final int generation=navigation;
                    bridgeDialog=new AlertDialog.Builder(this).setTitle("saveText".equals(command)?"텍스트 파일 저장":"텍스트 공유")
                        .setMessage("현재 매니툴 도구가 선택한 텍스트를 "+("saveText".equals(command)?"저장":"공유")+"하려고 합니다.\n\n"+
                            text.substring(0,Math.min(240,text.length()))+(text.length()>240?"…":""))
                        .setNegativeButton("취소",(d,w)->bridgeReply(reply,requestId,false,"cancelled"))
                        .setPositiveButton("계속",(d,w)->{
                            if(web!=view || navigation!=generation){bridgeReply(reply,requestId,false,"page_changed");return;}
                            if("saveText".equals(command)) { if(!saveFile(text.getBytes(StandardCharsets.UTF_8),"text/plain")){bridgeReply(reply,requestId,false,"unavailable");return;} }
                            else try {startActivity(Intent.createChooser(new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT,text),"공유할 앱 선택"));}
                            catch(RuntimeException e){bridgeReply(reply,requestId,false,"unavailable");return;}
                            // Launched does not mean file saved or a message sent.
                            bridgeReply(reply,requestId,true,"launched");
                        }).create();
                    bridgeDialog.setOnCancelListener(d->bridgeReply(reply,requestId,false,"cancelled"));
                    bridgeDialog.setOnDismissListener(d->bridgeDialog=null); bridgeDialog.show();
                } catch(Exception ignored){bridgeReply(reply,id,false,"invalid_request");}
            });
    }
    /**
     * The public site still has web-only account and credit controls.  Embedded OAuth
     * is deliberately unsupported in this WebView, so route those two entry points to
     * the app-owned Google sign-in flow before page handlers can open a dead-end modal.
     */
    private void installNativeAccountEntryPoints(WebView target) {
        if(target != web) return;
        String script = "(function(){if(window.__manytoolNativeAccountEntrypoints)return;"
            + "window.__manytoolNativeAccountEntrypoints=true;"
            + "var appStyle=document.createElement('style');appStyle.id='manytool-native-shell-style';"
            + "appStyle.textContent=\"nav[aria-label=\\\"Breadcrumb\\\"],.site-footer,#tool-search{display:none!important}\";document.head.appendChild(appStyle);"
            + "var search=document.getElementById('tool-search');if(search&&search.parentElement)search.parentElement.remove();"
            + "var addAiMenu=function(){if(document.querySelector('#mt-nav button[data-key=ai]'))return;var tools=document.querySelector('#mt-nav button[data-key=tools]');if(!tools)return setTimeout(addAiMenu,120);var label=tools.querySelector('span');if(label)label.textContent='AI 도구';tools.setAttribute('aria-label','AI 도구 모음');"
            + "tools.addEventListener('click',function(e){e.preventDefault();e.stopImmediatePropagation();var old=document.getElementById('manytool-native-ai');if(old){old.remove();return;}var sheet=document.createElement('nav');sheet.id='manytool-native-ai';sheet.setAttribute('aria-label','AI 도구 모음');sheet.style.cssText='position:fixed;left:12px;right:12px;bottom:72px;z-index:2147483646;max-height:60vh;overflow:auto;border-radius:20px;padding:12px;background:#fff;box-shadow:0 16px 42px rgba(15,23,42,.25);display:grid;grid-template-columns:1fr 1fr;gap:8px';var title=document.createElement('strong');title.textContent='AI 도구 모음';title.style.cssText='grid-column:1/-1;padding:6px 8px;color:#0f172a;font-size:16px';sheet.appendChild(title);[['AI 이미지 생성','/ai-image-generator/'],['AI 증명사진','/ai-id-photo/'],['AI 여권사진','/ai-passport-photo/'],['AI 프로필 사진','/ai-headshot/'],['AI 포토샵','/ai-photoshop/'],['AI 모델컷','/ai-model-cut/'],['AI 퍼스널컬러','/ai-personal-color/'],['AI 칼로리 분석','/ai-calorie-calculator/'],['AI 만세력','/ai-manseryeok/'],['AI 펫 번역기','/ai-pet-translator/']].forEach(function(item){var a=document.createElement('a');a.href=item[1];a.textContent=item[0];a.style.cssText='padding:13px 10px;border:1px solid #e2e8f0;border-radius:13px;background:#f8fafc;color:#0f172a;font-size:13px;font-weight:700;text-decoration:none';sheet.appendChild(a);});document.body.appendChild(sheet);},true);};addAiMenu();"
            + "var openNativeCredits=function(){if(window.ManytoolNative&&window.ManytoolNative.postMessage)window.ManytoolNative.postMessage(JSON.stringify({id:'native_credit_entry',command:'openCredits'}));};"
            + "window.manytoolShowPaymentChoices=openNativeCredits;"
            + "document.addEventListener('click',function(event){"
            + "var node=event.target instanceof Element?event.target.closest('a,button'):null;if(!node)return;"
            + "var label=(node.textContent||'').replace(/\\s+/g,' ').trim();var compact=label.replace(/\\s/g,'');"
            + "var href=node.tagName==='A'?(node.getAttribute('href')||''):'';"
            + "var logout=label==='로그아웃'||label==='Sign out'||node.dataset.manytoolNativeSignedIn==='true';"
            + "var login=label==='로그인'||label==='Sign in'||label==='ログイン'||/^\\/account\\/?(?:[?#].*)?$/.test(href);"
            + "var credits=compact==='충전'||compact==='+충전'||compact==='크레딧충전';"
            + "if(!login&&!credits&&!logout)return;event.preventDefault();event.stopImmediatePropagation();"
            + "if(logout&&window.ManytoolNative&&window.ManytoolNative.postMessage)window.ManytoolNative.postMessage(JSON.stringify({id:'native_sign_out',command:'signOut'}));else openNativeCredits();"
            + "},true);})();";
        target.evaluateJavascript(script, null);
    }
    /** Reflect the native-only session in the embedded site's header without exposing account data to JavaScript. */
    private void syncNativeAccountState(WebView target) {
        if(target == null || target != web) return;
        String signed=account.signedIn()?"true":"false";
        String script = "(function(){var link=document.querySelector(\"header a[href='/account/'],header a[data-manytool-native-signed-in]\");"
            + "if(!link)return;var signed="+signed+";link.textContent=signed?'로그아웃':'로그인';link.setAttribute('aria-label',signed?'Google 계정 로그아웃':'Google 계정 로그인');"
            + "link.dataset.manytoolNativeSignedIn=signed?'true':'';link.href=signed?'#native-logout':'/account/';})();";
        target.evaluateJavascript(script, null);
    }
    private void requestDownload(String url,String mime) {
        if (web == null || !NavigationPolicy.isAllowedPage(web.getUrl()) || downloadBusy || pendingSave != null) return;
        int generation = navigation;
        if (url.startsWith("data:")) {
            try {
                int split=url.indexOf(";base64,");
                if(split<0 || url.length()>LIMIT*1.4) throw new IOException();
                byte[] bytes=Base64.decode(url.substring(split+8),Base64.DEFAULT);
                if(bytes.length>LIMIT)throw new IOException();
                saveFile(bytes,url.substring(5,split));
            } catch(Exception e) { message("저장 실패", "지원하지 않거나 너무 큰 파일입니다."); }
            return;
        }
        if (url.startsWith("blob:" + NavigationPolicy.base() + "/")) {
            downloadBusy = true;
            String script = "(async()=>{try{const b=await(await fetch("+JSONObject.quote(url)+")).blob();if(b.size>"+LIMIT+")return '';return await new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result);f.onerror=()=>r('');f.readAsDataURL(b)})}catch(e){return ''}})()";
            // evaluateJavascript does not await a Promise: poll a single bounded in-page result.
            String key = "__manytoolSave" + System.nanoTime();
            web.evaluateJavascript("window["+JSONObject.quote(key)+"]=null;"+script+".then(x=>window["+JSONObject.quote(key)+"]=x);", null);
            pollBlob(key,generation,0,mime); return;
        }
        if (!NavigationPolicy.isPublicDownload(url)) { message("파일 저장 준비 중", "이 개발판은 매니툴의 공개 HTTPS 파일과 화면에서 생성한 작은 파일만 저장합니다."); return; }
        downloadBusy=true;
        io.execute(() -> {
            byte[] bytes=null;
            try {
                HttpURLConnection c=(HttpURLConnection)new URL(url).openConnection();
                c.setInstanceFollowRedirects(false); c.setConnectTimeout(10000); c.setReadTimeout(15000);
                try {
                    if(c.getResponseCode()!=200 || c.getContentLengthLong()>LIMIT) throw new IOException();
                    try(InputStream in=c.getInputStream(); ByteArrayOutputStream out=new ByteArrayOutputStream()) {
                        byte[] buf=new byte[8192]; int n; while((n=in.read(buf))!=-1) { if(out.size()+n>LIMIT) throw new IOException(); out.write(buf,0,n); } bytes=out.toByteArray();
                    }
                } finally { c.disconnect(); }
            } catch(Exception ignored) { /* Never log request URLs or credentials. */ }
            byte[] result=bytes; runOnUiThread(() -> {
                if(isFinishing() || generation!=navigation || web==null) return; downloadBusy=false;
                if(result==null) message("저장 실패", "파일을 받지 못했습니다. 로그인 파일·리디렉션·8MB 초과 파일은 아직 지원하지 않습니다.");
                else saveFile(result,mime);
            });
        });
    }
    private void pollBlob(String key,int generation,int attempt,String mime) {
        if (web==null || generation!=navigation || isFinishing()) return;
        web.evaluateJavascript("window["+JSONObject.quote(key)+"]", encoded -> {
            if (web==null || generation!=navigation) return;
            if ("null".equals(encoded) && attempt<100) { web.postDelayed(() -> pollBlob(key,generation,attempt+1,mime),100); return; }
            web.evaluateJavascript("delete window["+JSONObject.quote(key)+"]",null); downloadBusy=false;
            try {
                Object decoded=new org.json.JSONTokener(encoded).nextValue(); String data=decoded instanceof String ? (String)decoded : "";
                int split=data.indexOf(";base64,"); if(!data.startsWith("data:") || split<0 || data.length()>LIMIT*1.4) throw new IOException();
                byte[] bytes=Base64.decode(data.substring(split+8),Base64.DEFAULT); if(bytes.length>LIMIT) throw new IOException();
                saveFile(bytes,data.substring(5,split));
            } catch(Exception e) { message("저장 준비 실패", "파일 생성에 실패했거나 8MB 제한을 초과했습니다."); }
        });
    }
    private boolean saveFile(byte[] bytes,String mime) {
        if(pendingSave!=null) return false;
        pendingSave=bytes;
        String safeMime=mime!=null && mime.matches("[a-zA-Z0-9.+-]+/[a-zA-Z0-9.+-]+") ? mime : "application/octet-stream";
        String extension=safeMime.equals("image/png") ? ".png" : safeMime.equals("image/jpeg") ? ".jpg" : safeMime.equals("application/pdf") ? ".pdf" : safeMime.equals("text/plain") ? ".txt"
            : safeMime.equals("image/webp") ? ".webp" : safeMime.equals("application/vnd.openxmlformats-officedocument.wordprocessingml.document") ? ".docx" : ".bin";
        Intent save=new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(safeMime)
            .putExtra(Intent.EXTRA_TITLE,"manytool-"+System.currentTimeMillis()+extension);
        try { startActivityForResult(save,SAVE_FILE); return true; }
        catch(RuntimeException e) { pendingSave=null; message("저장 실패", "파일 저장 화면을 열지 못했습니다."); return false; }
    }
    @Override protected void onActivityResult(int request,int result,Intent data) {
        super.onActivityResult(request,result,data);
        if(request==CHOOSE_FILE && upload!=null) {
            Uri[] selected=null;
            if(result==RESULT_OK && data!=null && uploadNavigation==navigation && web!=null && NavigationPolicy.isAllowedPage(web.getUrl())) {
                if(data.getClipData()!=null) {
                    int count=data.getClipData().getItemCount();
                    if(count<=20) { selected=new Uri[count]; for(int i=0;i<count;i++) selected[i]=data.getClipData().getItemAt(i).getUri(); }
                } else if(data.getData()!=null) selected=new Uri[]{data.getData()};
            }
            final Uri[] candidates=selected;
            final ValueCallback<Uri[]> callback=upload;
            final int generation=uploadNavigation;
            upload=null; uploadNavigation=-1;
            io.execute(() -> {
                boolean valid=candidates!=null;
                if(valid) for(Uri uri:candidates) if(!isSelectedDocumentSafe(uri)){valid=false;break;}
                final boolean accepted=valid;
                runOnUiThread(() -> {
                    boolean current=!isFinishing() && web!=null && generation==navigation;
                    callback.onReceiveValue(accepted && current ? candidates : null);
                    if(current && candidates!=null && !accepted)message("파일 선택", "파일을 읽을 수 없거나 한 파일이 32MB를 초과했습니다. 기기에 내려받은 파일로 다시 선택해주세요.");
                });
            });
        }
        if(request==SAVE_FILE) {
            byte[] bytes=pendingSave; pendingSave=null;
            if(result!=RESULT_OK || data==null || data.getData()==null) return;
            if(bytes==null) { message("저장 중단", "앱 화면이 다시 시작되어 저장할 내용을 복구하지 못했습니다. 선택한 파일은 비어 있을 수 있습니다. 도구에서 다시 저장해 주세요."); return; }
            Uri target=data.getData(); io.execute(() -> {
                boolean ok=false; try(OutputStream out=getContentResolver().openOutputStream(target,"w")) { if(out!=null){out.write(bytes);ok=true;} } catch(IOException ignored){}
                boolean saved=ok; runOnUiThread(() -> {if(!isFinishing()) message(saved?"저장 완료":"저장 실패",saved?"선택한 위치에 파일을 저장했습니다.":"다른 저장 위치를 선택해 다시 시도해 주세요.");});
            });
        }
    }
    private boolean isSelectedDocumentSafe(Uri uri) {
        if(uri==null || !"content".equals(uri.getScheme()) || uri.getAuthority()==null
            || uri.getAuthority().equals(getPackageName()) || uri.getAuthority().startsWith(getPackageName()+".")) return false;
        try(android.os.ParcelFileDescriptor file=getContentResolver().openFileDescriptor(uri,"r")) {
            if (file == null) return false;
            long size = file.getStatSize();
            if (size >= 0) return size <= 32L*1024*1024;
            // Cloud providers may not expose a descriptor size. Bound reads off the UI thread.
            try(InputStream in=getContentResolver().openInputStream(uri)) {
                if(in==null)return false;
                byte[] buffer=new byte[8192];long total=0;int n;
                while((n=in.read(buffer))!=-1){total+=n;if(total>32L*1024*1024)return false;}
                return true;
            }
        } catch(Exception ignored) { return false; }
    }
    private void openExternal(String url) {
        if(!NavigationPolicy.isExternalPage(url)) { message("연결 안내", "앱에서 지원하지 않는 연결입니다."); return; }
        try {startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(url)).addCategory(Intent.CATEGORY_BROWSABLE));}
        catch(RuntimeException e){message("브라우저", "링크를 열 브라우저를 찾지 못했습니다.");}
    }
    private void message(String title,String body) { if(!isFinishing()) new AlertDialog.Builder(this).setTitle(title).setMessage(body).setPositiveButton("확인",null).show(); }
    private PlayCreditsPanel creditsPanel;
    private android.view.View creditsView;
    private void openCredits() {
        if(isFinishing() || creditsView!=null) return;
        if(!account.signedIn()) {
            showCreditLogin();
            return;
        }
        if(AppFeatures.PLAY_CREDITS_ENTRY_ENABLED) { showCredits(); return; }
        message("크레딧 충전", CreditReadiness.STATUS);
    }
    private void showCreditLogin() {
        if(creditsView!=null || web==null) return;
        LinearLayout page=new LinearLayout(this); page.setOrientation(LinearLayout.VERTICAL); page.setGravity(android.view.Gravity.CENTER_HORIZONTAL);
        page.setPadding(dp(24),dp(28),dp(24),dp(28)); page.setBackgroundColor(0xFFF7F8FA);
        LinearLayout header=new LinearLayout(this); header.setGravity(android.view.Gravity.CENTER_VERTICAL);
        TextView title=nativeText("크레딧 충전",26,0xFF191F2B,true); title.setGravity(android.view.Gravity.CENTER_VERTICAL); header.addView(title,new LinearLayout.LayoutParams(0,dp(56),1));
        TextView close=nativeText("×",28,0xFF6C7789,false); close.setGravity(android.view.Gravity.CENTER); close.setBackground(roundNative(0xFFECF0F4,22)); close.setOnClickListener(v->closeCredits()); header.addView(close,new LinearLayout.LayoutParams(dp(44),dp(44)));
        page.addView(header,new LinearLayout.LayoutParams(-1,dp(56)));
        Space top=new Space(this); page.addView(top,new LinearLayout.LayoutParams(-1,0,1));
        LinearLayout card=new LinearLayout(this); card.setOrientation(LinearLayout.VERTICAL); card.setPadding(dp(24),dp(26),dp(24),dp(24)); card.setBackground(roundNative(0xFFFFFFFF,20));
        card.addView(nativeText("크레딧 충전을 위해",15,0xFF6C7789,false));
        card.addView(nativeText("로그인해 주세요",24,0xFF191F2B,true),nativeLp(-1,-2,8,0,0,0));
        TextView help=nativeText("Google 계정으로 로그인하면 충전 내역과 잔액을 안전하게 관리할 수 있어요.",14,0xFF6C7789,false); help.setLineSpacing(dp(4),1f); card.addView(help,nativeLp(-1,-2,16,0,0,0));
        TextView continueButton=nativeText("Google로 계속하기",17,0xFFFFFFFF,true); continueButton.setGravity(android.view.Gravity.CENTER); continueButton.setBackground(roundNative(0xFF1289A0,12));
        continueButton.setOnClickListener(v->{
            continueButton.setEnabled(false); continueButton.setAlpha(.65f); continueButton.setText("Google 로그인 준비 중…");
            account.signIn(this,(ok,text)->{
                if(!ok) { continueButton.setEnabled(true); continueButton.setAlpha(1f); continueButton.setText("Google로 계속하기"); message("로그인",text); return; }
                syncNativeAccountState(web); closeCredits();
                if(AppFeatures.PLAY_CREDITS_ENTRY_ENABLED) showCredits(); else message("로그인 완료", "Google 계정으로 로그인했습니다. " + CreditReadiness.STATUS);
            });
        });
        card.addView(continueButton,nativeLp(-1,60,24,0,0,0)); page.addView(card,new LinearLayout.LayoutParams(-1,-2));
        Space bottom=new Space(this); page.addView(bottom,new LinearLayout.LayoutParams(-1,0,1));
        creditsView=page; web.setVisibility(android.view.View.GONE); root.addView(page,new LinearLayout.LayoutParams(-1,0,1));
    }
    private void showCredits() {
        if(creditsView!=null || web==null) return;
        creditsPanel=new PlayCreditsPanel(this,new PlayCreditHttpBackend(AppAccount.API,NavigationPolicy.ORIGIN,account),this::closeCredits);
        ScrollView scroll=new ScrollView(this); scroll.setFillViewport(true); scroll.addView(creditsPanel,new ScrollView.LayoutParams(-1,-1));
        creditsView=scroll; web.setVisibility(android.view.View.GONE);
        root.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));
    }
    private void closeCredits() {
        if(creditsPanel!=null){creditsPanel.close();creditsPanel=null;}
        if(creditsView!=null){root.removeView(creditsView);creditsView=null;}
        if(web!=null) web.setVisibility(android.view.View.VISIBLE);
    }
    private TextView nativeText(String value,int size,int color,boolean bold) { TextView view=new TextView(this); view.setText(value); view.setTextSize(size); view.setTextColor(color); if(bold)view.setTypeface(android.graphics.Typeface.DEFAULT,android.graphics.Typeface.BOLD); return view; }
    private LinearLayout.LayoutParams nativeLp(int width,int height,int top,int left,int right,int bottom) { LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(width,height); p.setMargins(dp(left),dp(top),dp(right),dp(bottom)); return p; }
    private android.graphics.drawable.GradientDrawable roundNative(int color,int radius) { android.graphics.drawable.GradientDrawable shape=new android.graphics.drawable.GradientDrawable(); shape.setColor(color); shape.setCornerRadius(dp(radius)); return shape; }
    private int dp(int value) { return (int)(value*getResources().getDisplayMetrics().density+.5f); }
    @Override protected void onResume() { super.onResume(); if(creditsPanel!=null) creditsPanel.resume(); }
    private void goBack() { if(creditsView!=null){closeCredits();return;} if(web!=null && web.canGoBack()) web.goBack(); else new AlertDialog.Builder(this).setMessage("ManyTool을 종료할까요?").setNegativeButton("취소",null).setPositiveButton("종료",(d,w)->finish()).show(); }
    // API 33+ uses the OnBackInvokedDispatcher registered in onCreate.
    // This legacy override serves API 26-32; API 36 uses the registered callback.
    @android.annotation.SuppressLint("GestureBackNavigation")
    @Override public void onBackPressed() { goBack(); }
    private void disposeWeb() { navigation++; closeCredits(); if(bridgeDialog!=null){bridgeDialog.dismiss();bridgeDialog=null;} downloadBusy=false; if(upload!=null){upload.onReceiveValue(null);upload=null;} if(web!=null){web.stopLoading();web.destroy();web=null;} }
    @Override protected void onDestroy() { disposeWeb(); if(splash!=null){splash.destroy();splash=null;} account.close(); pendingSave=null; io.shutdown(); super.onDestroy(); }
}
