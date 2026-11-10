package net.manytool.app;

import android.app.Activity;
import com.android.billingclient.api.*;
import java.util.*;
import java.util.concurrent.*;

/** Native consumable purchase controller. All grants and consumption belong to the server.
 * Not wired to the shell until authenticated account handoff and production config are verified.
 * No purchase token, receipt or user account is written to storage or logs. */
public final class PlayCreditBilling implements PurchasesUpdatedListener, AutoCloseable {
    public interface Backend {
        // Must use authenticated HTTPS API session, never caller-supplied email/credit amount.
        Catalog catalog() throws Exception;
        Receipt verify(String productId, String token) throws Exception;
    }
    public interface Listener {
        void status(String message);
        void products(List<Offer> products);
        void verified(Receipt receipt);
    }
    public static final class Catalog {
        public final boolean enabled, recoveryAvailable;
        public final String accountBinding;
        public final Map<String,Integer> credits;
        public Catalog(boolean enabled, boolean recoveryAvailable, String binding, Map<String,Integer> credits) {
            this.enabled=enabled; this.recoveryAvailable=recoveryAvailable; this.accountBinding=binding;
            this.credits=Collections.unmodifiableMap(new HashMap<>(credits));
        }
    }
    public static final class Receipt {
        public final long balance;
        public final boolean consumptionPending;
        public Receipt(long balance, boolean consumptionPending) {
            this.balance=balance; this.consumptionPending=consumptionPending;
        }
    }
    public static final class Offer {
        public final String productId, formattedPrice;
        public final int credits;
        private final ProductDetails details;
        private final String offerToken;
        private Offer(ProductDetails details, String price, String token, int credits) {
            this.details=details; this.productId=details.getProductId();
            this.formattedPrice=price; this.offerToken=token; this.credits=credits;
        }
    }
    private final Activity activity;
    private final Backend backend;
    private final Listener listener;
    private final BillingClient billing;
    private final ExecutorService io=Executors.newSingleThreadExecutor();
    private final Map<String,Offer> offers=new HashMap<>();
    private final Set<String> verifying=new HashSet<>();
    private Catalog catalog;
    private boolean closed, loading, purchaseInFlight;
    private long generation;

    public PlayCreditBilling(Activity activity, Backend backend, Listener listener) {
        this.activity=activity; this.backend=backend; this.listener=listener;
        billing=BillingClient.newBuilder(activity.getApplicationContext()).setListener(this)
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .enableAutoServiceReconnection().build();
    }
    private void ui(Runnable r) { activity.runOnUiThread(() -> { if(!closed && !activity.isFinishing()) r.run(); }); }
    /** Call from the main thread. Destroy this controller on account switch/sign-out. */
    public void connect() {
        if(closed || loading) return;
        loading=true; final long requestGeneration=++generation;
        catalog=null; offers.clear(); listener.products(Collections.emptyList());
        listener.status("구매 준비 상태 확인 중…");
        io.execute(() -> {
            try { Catalog value=backend.catalog(); ui(() -> {
                if(generation!=requestGeneration) return;
                loading=false;
                if(!usable(value)) { listener.status("로그인 또는 결제 준비가 필요합니다. 구매는 시작되지 않았습니다."); return; }
                catalog=value;
                if(billing.isReady()) { refreshOffers(); restore(); return; }
                billing.startConnection(new BillingClientStateListener() {
                    @Override public void onBillingSetupFinished(BillingResult result) { ui(() -> {
                        if(generation!=requestGeneration) return;
                        if(result.getResponseCode()!=BillingClient.BillingResponseCode.OK) {
                            listener.status("Google Play 연결 실패. 다시 시도해 주세요."); return;
                        }
                        refreshOffers(); restore();
                    }); }
                    @Override public void onBillingServiceDisconnected() { ui(() -> listener.status("Google Play 연결이 끊겼습니다. 다시 시도해 주세요.")); }
                });
            }); } catch(Exception ignored) { ui(() -> { if(generation!=requestGeneration) return; loading=false; listener.status("서버 확인 실패. 결제하지 않았습니다."); }); }
        });
    }
    private boolean usable(Catalog c) {
        if(c==null || (!c.enabled && !c.recoveryAvailable) || !PlayCreditPolicy.validBinding(c.accountBinding) || c.credits.size()>20) return false;
        if(c.enabled && c.credits.isEmpty()) return false;
        for(Map.Entry<String,Integer> p:c.credits.entrySet())
            if(!PlayCreditPolicy.validProduct(p.getKey()) || p.getValue()==null || p.getValue()<=0) return false;
        return true;
    }
    public void refreshOffers() {
        if(closed || loading || catalog==null || !catalog.enabled || !billing.isReady()) return;
        final long requestGeneration=generation;
        offers.clear(); listener.products(Collections.emptyList());
        List<QueryProductDetailsParams.Product> ids=new ArrayList<>();
        for(String id:catalog.credits.keySet()) ids.add(QueryProductDetailsParams.Product.newBuilder()
            .setProductId(id).setProductType(BillingClient.ProductType.INAPP).build());
        billing.queryProductDetailsAsync(QueryProductDetailsParams.newBuilder().setProductList(ids).build(), (result, response) -> ui(() -> {
            if(generation!=requestGeneration || catalog==null) return;
            if(result.getResponseCode()!=BillingClient.BillingResponseCode.OK) { listener.status("상품 가격 조회 실패"); return; }
            for(ProductDetails detail:response.getProductDetailsList()) {
                Integer count=catalog.credits.get(detail.getProductId());
                List<ProductDetails.OneTimePurchaseOfferDetails> options=detail.getOneTimePurchaseOfferDetailsList();
                // Do not silently choose between rental/discount/multiple offers. Configure one consumable offer.
                if(count==null || options==null || options.size()!=1) continue;
                ProductDetails.OneTimePurchaseOfferDetails option=options.get(0);
                if(option.getRentalDetails()!=null) continue;
                offers.put(detail.getProductId(),new Offer(detail,option.getFormattedPrice(),option.getOfferToken(),count));
            }
            listener.products(Collections.unmodifiableList(new ArrayList<>(offers.values())));
            listener.status(offers.isEmpty()?"구매 가능한 상품이 없습니다. Play 상품 설정을 확인해야 합니다.":"Google Play 표시 가격을 확인한 뒤 구매해 주세요.");
        }));
    }
    /** Explicit purchase button only; never invoked by page load or WebView JavaScript. */
    public void buy(String productId) {
        if(closed || loading || purchaseInFlight || catalog==null || !catalog.enabled || !billing.isReady()) return;
        Offer offer=offers.get(productId); if(offer==null) return;
        BillingFlowParams.ProductDetailsParams.Builder item=BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(offer.details);
        if(offer.offerToken!=null && !offer.offerToken.isEmpty()) item.setOfferToken(offer.offerToken);
        purchaseInFlight=true;
        BillingResult result=billing.launchBillingFlow(activity,BillingFlowParams.newBuilder()
            .setProductDetailsParamsList(Collections.singletonList(item.build()))
            .setObfuscatedAccountId(catalog.accountBinding).build());
        if(result.getResponseCode()!=BillingClient.BillingResponseCode.OK) {
            purchaseInFlight=false; listener.status("구매창을 열지 못했습니다. 상품을 새로고침해 주세요.");
        }
    }
    @Override public void onPurchasesUpdated(BillingResult result,List<Purchase> purchases) {
        ui(() -> {
            purchaseInFlight=false;
            if(result.getResponseCode()==BillingClient.BillingResponseCode.USER_CANCELED) { listener.status("구매를 취소했습니다."); return; }
            if(result.getResponseCode()!=BillingClient.BillingResponseCode.OK) {
                listener.status("결과 확인이 필요합니다. 구매 복원을 눌러 확인해 주세요."); return;
            }
            if(purchases!=null) for(Purchase purchase:purchases) process(purchase);
        });
    }
    /** Call on resume and on explicit retry, including after network loss/process recreation. */
    public void restore() {
        if(closed || loading || catalog==null || !billing.isReady()) return;
        final long requestGeneration=generation;
        billing.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build(), (result,purchases) -> ui(() -> {
            if(generation!=requestGeneration || catalog==null) return;
            if(result.getResponseCode()!=BillingClient.BillingResponseCode.OK) { listener.status("구매 복원 조회 실패. 다시 시도해 주세요."); return; }
            for(Purchase p:purchases) process(p);
        }));
    }
    private void process(Purchase p) {
        if(catalog==null) return;
        if(p.getPurchaseState()==Purchase.PurchaseState.PENDING) { listener.status("결제 승인 대기 중입니다. 크레딧은 아직 적립되지 않았습니다."); return; }
        if(p.getPurchaseState()!=Purchase.PurchaseState.PURCHASED || p.getProducts().size()!=1) return;
        AccountIdentifiers account=p.getAccountIdentifiers();
        if(account==null || !PlayCreditPolicy.belongsToAccount(catalog.accountBinding,account.getObfuscatedAccountId())) {
            listener.status("이 구매를 시작한 매니툴 계정으로 로그인해 주세요."); return;
        }
        String product=p.getProducts().get(0), token=p.getPurchaseToken();
        if(!PlayCreditPolicy.validProduct(product) || token==null || token.isEmpty() || !verifying.add(token)) return;
        // Server may settle a previously recorded purchase for a retired product, never trusts client credits.
        listener.status("구매를 서버에서 검증 중입니다…");
        io.execute(() -> {
            try { Receipt receipt=backend.verify(product,token); ui(() -> {
                verifying.remove(token); listener.verified(receipt);
                listener.status(receipt.consumptionPending?"적립은 확인됐으며 구매 마무리를 재시도해야 합니다.":"서버에서 구매와 잔액을 확인했습니다.");
            }); } catch(Exception ignored) { ui(() -> {
                verifying.remove(token); listener.status("구매 검증을 완료하지 못했습니다. 다시 구매하지 말고 구매 복원을 눌러 주세요.");
            }); }
        });
    }
    @Override public void close() { closed=true; generation++; offers.clear(); verifying.clear(); catalog=null; billing.endConnection(); io.shutdown(); }
}
