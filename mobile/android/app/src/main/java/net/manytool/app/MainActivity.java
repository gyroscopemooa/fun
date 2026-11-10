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
    private boolean downloadBusy = false, homeVisible = true;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        root = new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL);
        // Target 35: avoid drawing controls beneath status/navigation bars.
        if (android.os.Build.VERSION.SDK_INT >= 30) root.setOnApplyWindowInsetsListener((v, insets) -> {
            android.graphics.Insets bars = insets.getInsets(android.view.WindowInsets.Type.systemBars());
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom); return insets;
        });
        if (android.os.Build.VERSION.SDK_INT < 30) root.setOnApplyWindowInsetsListener((v, insets) -> {
            v.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom()); return insets;
        });
        setContentView(root); root.requestApplyInsets(); showHome();
    }
    private Button button(String text, Runnable action) {
        Button b = new Button(this); b.setText(text); b.setOnClickListener(v -> action.run()); return b;
    }
    private void showHome() {
        disposeWeb(); root.removeAllViews(); homeVisible = true;
        ScrollView scroll = new ScrollView(this); LinearLayout list = new LinearLayout(this);
        list.setOrientation(LinearLayout.VERTICAL); list.setPadding(24,24,24,24); scroll.addView(list); root.addView(scroll);
        TextView title = new TextView(this); title.setText("매니툴 · Android 개발판"); title.setTextSize(24); list.addView(title);
        TextView info = new TextView(this);
        info.setText("웹 도구를 재사용하는 앱 기본 틀입니다. 현재 검증할 무료 도구만 열립니다. 유료 기능·SNS 로그인 다운로드는 준비 중이며 활성화하지 않았습니다."); list.addView(info);
        String[][] tools = {{"이미지 도구", "/image-tools/"}, {"이미지 압축", "/image-compressor/"},
            {"이미지 변환", "/image-converter/"}, {"이미지 자르기", "/image-cropper/"},
            {"이미지 크기 변경", "/image-resizer/"}, {"사진 글자 추출·문서", "/photo-to-document/"},
            {"선택 글 도구", "/selection-workbench/"}, {"문서 비교", "/text-compare/"}, {"자막 편집", "/subtitle-editor/"}, {"이미지 제출·가리기", "/image-batch/"}, {"JSON 정리", "/json-formatter/"}, {"날짜 계산", "/date-calculator/"}};
        for (String[] tool : tools) list.addView(button(tool[0], () -> openTool(tool[1])));
        list.addView(button("크레딧 · 준비 상태", () -> message("크레딧", CreditReadiness.STATUS +
            "\n기존 웹 결제창은 이 앱에서 차단합니다. 실제 충전·차감은 하지 않습니다.")));
        list.addView(button("영상·SNS 로그인 · 준비 중", () -> message("아직 사용할 수 없습니다",
            "로그인 세션·다운로드는 별도 검증이 필요합니다. 다른 앱의 로그인은 자동 공유되지 않습니다. 실제 계정 정보를 입력하거나 쿠키를 업로드하지 마세요.")));
        list.addView(button("앱의 웹 데이터 지우기", () -> new AlertDialog.Builder(this).setTitle("웹 데이터 삭제")
            .setMessage("이 앱에서 웹 도구가 보관한 데이터와 로그인 쿠키를 지웁니다. 저장한 파일은 지우지 않습니다.")
            .setNegativeButton("취소", null).setPositiveButton("삭제", (d,w) -> {
                WebStorage.getInstance().deleteAllData(); CookieManager.getInstance().removeAllCookies(done -> CookieManager.getInstance().flush());
                Toast.makeText(this,"앱의 웹 데이터 삭제를 요청했습니다.",Toast.LENGTH_SHORT).show();
            }).show()));
        list.addView(button("개인정보처리방침", () -> openTool("/privacy/")));
    }
    private void openTool(String path) {
        disposeWeb(); root.removeAllViews(); homeVisible = false;
        LinearLayout bar = new LinearLayout(this);
        bar.addView(button("홈", this::showHome)); bar.addView(button("뒤로", this::goBack));
        bar.addView(button("새로고침", () -> { if(web != null) web.reload(); })); root.addView(bar);
        status = new TextView(this); status.setPadding(16,8,16,8); root.addView(status);
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
                message("새 창 차단", "이 개발판은 외부 로그인·결제 창을 열지 않습니다."); return false;
            }
            @Override public void onPermissionRequest(PermissionRequest request) { request.deny(); }
            @Override public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                callback.invoke(origin,false,false);
            }
            @Override public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (!NavigationPolicy.isAllowedPage(v.getUrl())) { callback.onReceiveValue(null); return true; }
                if (upload != null) upload.onReceiveValue(null); upload = callback; uploadNavigation = navigation;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*");
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
                if (NavigationPolicy.isAllowedPage(url)) return false;
                message("준비 중인 연결", "이 개발판에서 아직 검증하지 않은 페이지 또는 외부 연결입니다. 앱에서 열지 않았습니다."); return true;
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
                String url=r.getUrl().toString();
                if (NavigationPolicy.isPaymentRequest(url) || (r.isForMainFrame() && !NavigationPolicy.isAllowedPage(url)))
                    return new WebResourceResponse("text/plain", "UTF-8", 403, "Blocked in development shell", java.util.Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
                return null;
            }
            @Override public void onPageStarted(WebView v,String url,Bitmap icon) { navigation++; status.setText("불러오는 중…"); }
            @Override public void onPageFinished(WebView v,String url) { status.setText("무료 도구 개발판 · 외부 결제/로그인 차단"); }
            @Override public void onReceivedError(WebView v,WebResourceRequest r,WebResourceError error) {
                if(r.isForMainFrame()) status.setText("페이지를 불러오지 못했습니다. 연결 상태를 확인하고 새로고침해 주세요.");
            }
            @Override public void onReceivedSslError(WebView v,SslErrorHandler handler,SslError error) {
                handler.cancel(); status.setText("안전한 연결을 확인할 수 없어 중단했습니다.");
            }
            @Override public boolean onRenderProcessGone(WebView v,RenderProcessGoneDetail detail) {
                showHome(); message("페이지 종료", "웹 화면이 종료되어 홈으로 돌아왔습니다."); return true;
            }
        });
        installHybridBridge(web);
        web.setDownloadListener((url,ua,disposition,mime,length) -> requestDownload(url,mime));
        web.loadUrl(NavigationPolicy.ORIGIN + path);
    }
    private void bridgeReply(JavaScriptReplyProxy reply,String id,boolean ok,String message) {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return;
        try {reply.postMessage(new JSONObject().put("id",id).put("ok",ok).put("message",message).toString());}
        catch(Exception ignored) { /* Page may have navigated; never log payloads. */ }
    }
    private void installHybridBridge(WebView target) {
        if(!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return;
        WebViewCompat.addWebMessageListener(target,"ManytoolNative",java.util.Collections.singleton(NavigationPolicy.ORIGIN),
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
                            .put("version",1).put("saveText",true).put("shareText",true).put("playCredits",false)
                            .put("notifications",false).put("authenticatedVideo",false)).toString()); return;
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
    private void requestDownload(String url,String mime) {
        if (web == null || !NavigationPolicy.isAllowedPage(web.getUrl()) || downloadBusy || pendingSave != null) return;
        int generation = navigation;
        if (url.startsWith("blob:" + NavigationPolicy.ORIGIN + "/")) {
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
                downloadBusy=false; if(isFinishing() || generation!=navigation || web==null) return;
                if(result==null) message("저장 실패", "파일을 받지 못했습니다. 로그인 파일·리디렉션·8MB 초과 파일은 아직 지원하지 않습니다.");
                else saveFile(result,mime);
            });
        });
    }
    private void pollBlob(String key,int generation,int attempt,String mime) {
        if (web==null || generation!=navigation || isFinishing()) { downloadBusy=false; return; }
        web.evaluateJavascript("window["+JSONObject.quote(key)+"]", encoded -> {
            if (web==null || generation!=navigation) { downloadBusy=false; return; }
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
            if(selected!=null) for(Uri uri:selected) if(!isSelectedDocumentSafe(uri)) { selected=null; break; }
            upload.onReceiveValue(selected); upload=null; uploadNavigation=-1;
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
            return file!=null && file.getStatSize()>=0 && file.getStatSize()<=32L*1024*1024;
        } catch(Exception ignored) { return false; }
    }
    private void message(String title,String body) { if(!isFinishing()) new AlertDialog.Builder(this).setTitle(title).setMessage(body).setPositiveButton("확인",null).show(); }
    private void goBack() { if(web!=null && web.canGoBack()) web.goBack(); else showHome(); }
    @Override public void onBackPressed() { if(homeVisible) super.onBackPressed(); else goBack(); }
    private void disposeWeb() { navigation++; if(bridgeDialog!=null){bridgeDialog.dismiss();bridgeDialog=null;} downloadBusy=false; if(upload!=null){upload.onReceiveValue(null);upload=null;} if(web!=null){web.stopLoading();web.destroy();web=null;} }
    @Override protected void onDestroy() { disposeWeb(); pendingSave=null; io.shutdown(); super.onDestroy(); }
}
