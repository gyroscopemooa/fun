package net.manytool.app;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.view.Gravity;
import android.view.View;
import android.widget.*;
import java.util.*;

/** Native credit checkout. Prices are always read from Google Play, never hard-coded locally. */
public final class PlayCreditsPanel extends LinearLayout implements PlayCreditBilling.Listener, AutoCloseable {
    private static final int INK=Color.rgb(25,31,43), MUTED=Color.rgb(108,119,137), SURFACE=Color.WHITE,
        CANVAS=Color.rgb(247,248,250), PRIMARY=Color.rgb(18,137,160), SELECTED=Color.rgb(230,247,249);
    private final TextView balance, payButton, status;
    private final LinearLayout packs;
    private final PlayCreditBilling controller;
    private PlayCreditBilling.Offer selected;
    private int previewCredits;

    public PlayCreditsPanel(Activity activity, PlayCreditBilling.Backend backend, Runnable close) {
        super(activity); setOrientation(VERTICAL); setBackgroundColor(CANVAS); setPadding(dp(24),dp(32),dp(24),dp(26));
        LinearLayout header=new LinearLayout(activity); header.setGravity(Gravity.CENTER_VERTICAL);
        TextView title=text("크레딧 충전",26,INK,true); title.setGravity(Gravity.CENTER_VERTICAL); header.addView(title,new LinearLayout.LayoutParams(0,dp(64),1));
        TextView closeButton=text("×",28,MUTED,false); closeButton.setGravity(Gravity.CENTER); closeButton.setBackground(round(Color.rgb(236,240,244),22)); closeButton.setOnClickListener(v->close.run()); header.addView(closeButton,square(44));
        addView(header,lp(-1,64,0,0,0,20));

        LinearLayout wallet=card(); wallet.addView(text("보유 크레딧",13,MUTED,false));
        balance=text("잔액을 확인하고 있어요",20,INK,true); wallet.addView(balance,lp(-1,-2,8,0,0,0)); addView(wallet,lp(-1,-2,0,0,0,24));
        addView(text("충전할 크레딧",19,INK,true),lp(-1,-2,0,0,0,12));
        packs=new LinearLayout(activity); packs.setOrientation(VERTICAL); addView(packs);
        loadingRow();
        controller=new PlayCreditBilling(activity,backend,this);

        Space spacer=new Space(activity); addView(spacer,new LinearLayout.LayoutParams(-1,0,1));
        status=text("Google Play 가격을 불러오는 중",13,MUTED,false); status.setGravity(Gravity.CENTER); addView(status,lp(-1,-2,0,0,0,14));
        payButton=text("상품을 선택해 주세요",17,Color.WHITE,true); payButton.setGravity(Gravity.CENTER); payButton.setEnabled(false); payButton.setAlpha(.45f); payButton.setBackground(round(PRIMARY,12)); payButton.setOnClickListener(v->{if(selected!=null)controller.buy(selected.productId);}); addView(payButton,lp(-1,60,0,0,0,0));
        controller.connect();
    }

    private void loadingRow() { packs.removeAllViews(); TextView loading=text("Google Play 상품을 불러오는 중",15,MUTED,false); loading.setGravity(Gravity.CENTER_VERTICAL); loading.setPadding(dp(20),0,dp(20),0); loading.setBackground(round(SURFACE,18)); packs.addView(loading,lp(-1,64,0,0,0,0)); }
    private LinearLayout pack(PlayCreditBilling.Offer offer) {
        LinearLayout row=new LinearLayout(getContext()); row.setGravity(Gravity.CENTER_VERTICAL); row.setPadding(dp(20),0,dp(20),0); row.setTag(offer); row.setClickable(true);
        row.addView(text(offer.credits+" 크레딧",16,INK,true),new LinearLayout.LayoutParams(0,-2,1));
        row.addView(text(offer.formattedPrice,16,INK,true)); row.setOnClickListener(v->{selected=(PlayCreditBilling.Offer)v.getTag();refreshSelection();}); return row;
    }
    private LinearLayout previewPack(int credits, String price) {
        LinearLayout row=new LinearLayout(getContext()); row.setGravity(Gravity.CENTER_VERTICAL); row.setPadding(dp(20),0,dp(20),0); row.setTag(credits); row.setClickable(true);
        row.addView(text(credits+" 크레딧",16,INK,true),new LinearLayout.LayoutParams(0,-2,1));
        row.addView(text(price+" · 예시",15,MUTED,true));
        row.setOnClickListener(v->{previewCredits=(int)v.getTag();refreshPreview();}); return row;
    }
    private void refreshSelection() {
        for(int i=0;i<packs.getChildCount();i++) { LinearLayout row=(LinearLayout)packs.getChildAt(i); boolean active=row.getTag()==selected; row.setBackground(stroke(active?SELECTED:SURFACE,active?PRIMARY:Color.rgb(229,233,238),12,active?2:1)); }
        payButton.setEnabled(selected!=null); payButton.setAlpha(selected==null ? .45f : 1f); if(selected!=null) payButton.setText(selected.formattedPrice+" 결제하기");
    }
    private void previewRows() {
        packs.removeAllViews(); selected=null;
        TextView notice=text("상품 등록 전 미리보기 · 실제 가격은 Google Play에서 표시됩니다",13,MUTED,false); notice.setPadding(dp(2),0,0,dp(10)); packs.addView(notice);
        int[] credits={1,5,10,100}; String[] prices={"₩1,000","₩5,000","₩10,000","₩100,000"};
        for(int i=0;i<credits.length;i++) packs.addView(previewPack(credits[i],prices[i]),lp(-1,64,0,0,0,10));
        previewCredits=1; refreshPreview(); payButton.setEnabled(false); payButton.setAlpha(.45f); payButton.setText("상품 등록 후 결제할 수 있어요");
    }
    private void refreshPreview() {
        for(int i=1;i<packs.getChildCount();i++) { LinearLayout row=(LinearLayout)packs.getChildAt(i); boolean active=(int)row.getTag()==previewCredits; row.setBackground(stroke(active?SELECTED:SURFACE,active?PRIMARY:Color.rgb(229,233,238),12,active?2:1)); }
    }
    private LinearLayout card() { LinearLayout view=new LinearLayout(getContext()); view.setOrientation(VERTICAL); view.setPadding(dp(20),dp(19),dp(20),dp(19)); view.setBackground(round(SURFACE,20)); return view; }
    private TextView text(String value,int size,int color,boolean bold) { TextView view=new TextView(getContext()); view.setText(value); view.setTextSize(size); view.setTextColor(color); if(bold)view.setTypeface(Typeface.DEFAULT,Typeface.BOLD); return view; }
    private int dp(int value) { return (int)(value*getResources().getDisplayMetrics().density+.5f); }
    private LinearLayout.LayoutParams lp(int width,int height,int top,int left,int right,int bottom) { LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(width,height); p.setMargins(dp(left),dp(top),dp(right),dp(bottom)); return p; }
    private LinearLayout.LayoutParams square(int size) { return new LinearLayout.LayoutParams(dp(size),dp(size)); }
    private GradientDrawable round(int color,int radius) { GradientDrawable shape=new GradientDrawable(); shape.setColor(color); shape.setCornerRadius(dp(radius)); return shape; }
    private GradientDrawable stroke(int color,int line,int radius,int width) { GradientDrawable shape=round(color,radius); shape.setStroke(dp(width),line); return shape; }
    @Override public void status(String message){status.setText(message);}
    @Override public void products(List<PlayCreditBilling.Offer> offers) {
        packs.removeAllViews(); selected=null;
        List<PlayCreditBilling.Offer> ordered=new ArrayList<>(offers); ordered.sort(Comparator.comparingInt(o->o.credits));
        if(ordered.isEmpty()) {
            if(AppFeatures.SHOW_CREDIT_PREVIEW) { previewRows(); status.setText("상품 등록 전 미리보기입니다. 구매는 시작되지 않습니다."); }
            else { loadingRow(); payButton.setText("구매 가능한 상품이 없습니다"); }
            return;
        }
        for(PlayCreditBilling.Offer offer:ordered) packs.addView(pack(offer),lp(-1,64,0,0,0,10));
        selected=ordered.get(0); status.setVisibility(GONE); refreshSelection();
    }
    @Override public void verified(PlayCreditBilling.Receipt receipt){balance.setText("보유 크레딧 "+receipt.balance+"개");}
    public void resume(){controller.restore();}
    @Override public void close(){controller.close();}
}
