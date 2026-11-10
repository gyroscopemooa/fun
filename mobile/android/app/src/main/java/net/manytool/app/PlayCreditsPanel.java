package net.manytool.app;

import android.app.Activity;
import android.widget.*;
import java.util.List;

/** Native price/confirmation UI, deliberately not mounted in the development shell yet.
 * The host must supply authenticated backend, close on logout/account switch and call resume(). */
public final class PlayCreditsPanel extends LinearLayout implements PlayCreditBilling.Listener, AutoCloseable {
    private final TextView status, balance;
    private final LinearLayout products;
    private final PlayCreditBilling controller;
    private boolean connected;
    public PlayCreditsPanel(Activity activity, PlayCreditBilling.Backend backend) {
        super(activity); setOrientation(VERTICAL); setPadding(24,24,24,24);
        TextView title=new TextView(activity); title.setText("Google Play 크레딧 충전"); title.setTextSize(22); addView(title);
        balance=new TextView(activity); balance.setText("잔액은 서버 구매 검증 후 표시됩니다."); addView(balance);
        status=new TextView(activity); addView(status);
        products=new LinearLayout(activity); products.setOrientation(VERTICAL); addView(products);
        controller=new PlayCreditBilling(activity,backend,this);
        Button connect=new Button(activity); connect.setText("상품 조회 / 다시 연결");
        connect.setOnClickListener(v -> {connected=true; controller.connect();}); addView(connect);
        Button restore=new Button(activity); restore.setText("미완료 구매 확인"); restore.setOnClickListener(v -> controller.restore()); addView(restore);
        TextView note=new TextView(activity); note.setText("승인 대기 중인 구매는 적립되지 않습니다. 결제 후 오류가 나면 재구매하지 말고 미완료 구매 확인을 눌러 주세요. Play 구매 취소·환불은 Google Play 절차를 따릅니다."); addView(note);
    }
    @Override public void status(String message){status.setText(message);}
    @Override public void products(List<PlayCreditBilling.Offer> offers) {
        products.removeAllViews();
        for(PlayCreditBilling.Offer offer:offers) {
            Button buy=new Button(getContext()); buy.setText(offer.credits+" 크레딧 · "+offer.formattedPrice);
            buy.setOnClickListener(v -> controller.buy(offer.productId)); products.addView(buy);
        }
    }
    @Override public void verified(PlayCreditBilling.Receipt receipt){balance.setText("확인된 잔액: "+receipt.balance+" 크레딧");}
    public void resume(){if(connected) controller.restore();}
    @Override public void close(){controller.close();}
}
