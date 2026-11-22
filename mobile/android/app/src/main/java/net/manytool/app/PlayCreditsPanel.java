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
    private final TextView balance, payButton, status, summaryCredits, summaryPrice;
    private final LinearLayout packs;
    private final PlayCreditBilling controller;
    private final boolean english;
    private PlayCreditBilling.Offer selected;
    private int previewCredits;
    private int selectedQuantity=1, previewQuantity=1;
    private final List<PlayCreditBilling.Offer> availableOffers=new ArrayList<>();
    private final Map<String,TextView> offerQuantityLabels=new HashMap<>();
    private final Map<Integer,TextView> previewQuantityLabels=new HashMap<>();
    private static final int[] PREVIEW_CREDITS={1,5,10,100};

    public PlayCreditsPanel(Activity activity, PlayCreditBilling.Backend backend, Runnable close, boolean english) {
        super(activity); setOrientation(VERTICAL); setBackgroundColor(CANVAS); setPadding(dp(24),dp(32),dp(24),dp(26));
        this.english=english;
        LinearLayout header=new LinearLayout(activity); header.setGravity(Gravity.CENTER_VERTICAL);
        TextView title=text(t("크레딧 충전","Credit top up"),26,INK,true); title.setGravity(Gravity.CENTER_VERTICAL); header.addView(title,new LinearLayout.LayoutParams(0,dp(64),1));
        TextView closeButton=text("×",28,MUTED,false); closeButton.setGravity(Gravity.CENTER); closeButton.setBackground(round(Color.rgb(236,240,244),22)); closeButton.setOnClickListener(v->close.run()); header.addView(closeButton,square(44));
        addView(header,lp(-1,64,0,0,0,20));

        LinearLayout wallet=card(); wallet.addView(text(t("보유 크레딧","Your credits"),13,MUTED,false));
        balance=text(t("잔액을 확인하고 있어요","Checking your balance"),20,INK,true); wallet.addView(balance,lp(-1,-2,8,0,0,0)); addView(wallet,lp(-1,-2,0,0,0,24));
        addView(text(t("충전 상품","Top-up products"),19,INK,true),lp(-1,-2,0,0,0,12));
        packs=new LinearLayout(activity); packs.setOrientation(VERTICAL); addView(packs);
        loadingRow();
        LinearLayout summary=card();
        summary.addView(text(t("결제 예정","Order summary"),13,MUTED,false));
        LinearLayout summaryLine=new LinearLayout(activity); summaryLine.setGravity(Gravity.CENTER_VERTICAL);
        summaryCredits=text(t("상품을 선택해 주세요","Select a package"),18,INK,true); summaryLine.addView(summaryCredits,new LinearLayout.LayoutParams(0,-2,1));
        summaryPrice=text(t("Google Play 가격","Google Play price"),16,INK,true); summaryLine.addView(summaryPrice); summary.addView(summaryLine,lp(-1,-2,8,0,0,0));
        addView(summary,lp(-1,-2,18,0,0,0));
        controller=new PlayCreditBilling(activity,backend,this);

        Space spacer=new Space(activity); addView(spacer,new LinearLayout.LayoutParams(-1,0,1));
        status=text(t("Google Play 가격을 불러오는 중","Loading Google Play prices"),13,MUTED,false); status.setGravity(Gravity.CENTER); addView(status,lp(-1,-2,0,0,0,14));
        payButton=text(t("상품을 선택해 주세요","Select a package"),17,Color.WHITE,true); payButton.setGravity(Gravity.CENTER); payButton.setEnabled(false); payButton.setAlpha(.45f); payButton.setBackground(round(PRIMARY,12)); payButton.setOnClickListener(v->{if(selected!=null)controller.buy(selected.productId);}); addView(payButton,lp(-1,60,0,0,0,0));
        controller.connect();
    }

    private void loadingRow() { packs.removeAllViews(); TextView loading=text(t("Google Play 상품을 불러오는 중","Loading Google Play products"),15,MUTED,false); loading.setGravity(Gravity.CENTER_VERTICAL); loading.setPadding(dp(20),0,dp(20),0); loading.setBackground(round(SURFACE,18)); packs.addView(loading,lp(-1,64,0,0,0,0)); }
    private LinearLayout pack(PlayCreditBilling.Offer offer) {
        LinearLayout row=new LinearLayout(getContext()); row.setGravity(Gravity.CENTER_VERTICAL); row.setPadding(dp(20),0,dp(16),0); row.setTag(offer); row.setClickable(true);
        row.addView(text(offer.credits+t(" 크레딧"," credits"),16,INK,true),new LinearLayout.LayoutParams(0,-2,1));
        LinearLayout counter=new LinearLayout(getContext()); counter.setGravity(Gravity.CENTER_VERTICAL);
        TextView minus=text("−",19,INK,true); minus.setGravity(Gravity.CENTER); minus.setBackground(round(Color.rgb(240,244,247),10)); counter.addView(minus,square(34));
        TextView quantity=text("1",15,INK,true); quantity.setGravity(Gravity.CENTER); counter.addView(quantity,new LinearLayout.LayoutParams(dp(34),dp(34))); offerQuantityLabels.put(offer.productId,quantity);
        TextView plus=text("+",18,INK,true); plus.setGravity(Gravity.CENTER); plus.setBackground(round(SELECTED,10)); counter.addView(plus,square(34)); row.addView(counter);
        row.addView(text(offer.formattedPrice,15,INK,true),lp(-2,-2,0,12,0,0));
        View.OnClickListener choose=v->{selected=offer;selectedQuantity=1;refreshSelection();}; row.setOnClickListener(choose);
        minus.setOnClickListener(v->{if(selected==offer)selectedQuantity=Math.max(1,selectedQuantity-1);else {selected=offer;selectedQuantity=1;}refreshSelection();});
        plus.setOnClickListener(v->{if(selected==offer)selectedQuantity++;else {selected=offer;selectedQuantity=1;}refreshSelection();}); return row;
    }
    private void refreshSelection() {
        for(int i=0;i<packs.getChildCount();i++) { LinearLayout row=(LinearLayout)packs.getChildAt(i); boolean active=row.getTag()==selected; row.setBackground(stroke(active?SELECTED:SURFACE,active?PRIMARY:Color.rgb(229,233,238),12,active?2:1)); }
        payButton.setEnabled(selected!=null); payButton.setAlpha(selected==null ? .45f : 1f);
        for(Map.Entry<String,TextView> entry:offerQuantityLabels.entrySet()) entry.getValue().setText(selected!=null&&entry.getKey().equals(selected.productId)?String.valueOf(selectedQuantity):"0");
        if(selected!=null) { summaryCredits.setText((selected.credits*selectedQuantity)+t(" 크레딧"," credits")); summaryPrice.setText(selected.formattedPrice+" × "+selectedQuantity); payButton.setText(t("선택한 상품 결제","Pay selected product")); }
    }
    private void previewRows() {
        packs.removeAllViews(); selected=null;
        TextView notice=text(t("상품 등록 전 미리보기 · 실제 가격은 Google Play에서 표시됩니다","Preview only · Google Play shows the local price"),13,MUTED,false); notice.setPadding(dp(2),0,0,dp(10)); packs.addView(notice);
        for(int credits:PREVIEW_CREDITS) packs.addView(previewPack(credits),lp(-1,60,0,0,0,10));
        previewCredits=1; previewQuantity=1; refreshPreview(); payButton.setEnabled(false); payButton.setAlpha(.45f); payButton.setText(t("Google Play 상품 등록 후 결제","Register Play products to pay"));
    }
    private LinearLayout previewPack(int credits) {
        LinearLayout row=new LinearLayout(getContext()); row.setGravity(Gravity.CENTER_VERTICAL); row.setPadding(dp(20),0,dp(16),0); row.setTag(credits); row.setClickable(true);
        row.addView(text(credits+t(" 크레딧"," credits"),16,INK,true),new LinearLayout.LayoutParams(0,-2,1));
        LinearLayout counter=new LinearLayout(getContext()); counter.setGravity(Gravity.CENTER_VERTICAL);
        TextView minus=text("−",19,INK,true); minus.setGravity(Gravity.CENTER); minus.setBackground(round(Color.rgb(240,244,247),10)); counter.addView(minus,square(34));
        TextView quantity=text("1",15,INK,true); quantity.setGravity(Gravity.CENTER); counter.addView(quantity,new LinearLayout.LayoutParams(dp(34),dp(34))); previewQuantityLabels.put(credits,quantity);
        TextView plus=text("+",18,INK,true); plus.setGravity(Gravity.CENTER); plus.setBackground(round(SELECTED,10)); counter.addView(plus,square(34)); row.addView(counter);
        row.addView(text(t("Google Play 가격","Google Play price"),14,MUTED,true));
        row.setOnClickListener(v->{previewCredits=credits;previewQuantity=1;refreshPreview();});
        minus.setOnClickListener(v->{if(previewCredits==credits)previewQuantity=Math.max(1,previewQuantity-1);else {previewCredits=credits;previewQuantity=1;}refreshPreview();});
        plus.setOnClickListener(v->{if(previewCredits==credits)previewQuantity++;else {previewCredits=credits;previewQuantity=1;}refreshPreview();}); return row;
    }
    private void refreshPreview() {
        summaryCredits.setText((previewCredits*previewQuantity)+t(" 크레딧"," credits")); summaryPrice.setText(t("Google Play 가격","Google Play price")+" × "+previewQuantity);
        for(Map.Entry<Integer,TextView> entry:previewQuantityLabels.entrySet()) entry.getValue().setText(entry.getKey()==previewCredits?String.valueOf(previewQuantity):"0");
        for(int i=0;i<packs.getChildCount();i++) { View row=packs.getChildAt(i); Object tag=row.getTag(); if(tag instanceof Integer) row.setBackground(stroke(((Integer)tag)==previewCredits?SELECTED:SURFACE,((Integer)tag)==previewCredits?PRIMARY:Color.rgb(229,233,238),12,((Integer)tag)==previewCredits?2:1)); }
    }
    private LinearLayout card() { LinearLayout view=new LinearLayout(getContext()); view.setOrientation(VERTICAL); view.setPadding(dp(20),dp(19),dp(20),dp(19)); view.setBackground(round(SURFACE,20)); return view; }
    private String t(String ko,String en) { return english ? en : ko; }
    private TextView text(String value,int size,int color,boolean bold) { TextView view=new TextView(getContext()); view.setText(value); view.setTextSize(size); view.setTextColor(color); if(bold)view.setTypeface(Typeface.DEFAULT,Typeface.BOLD); return view; }
    private int dp(int value) { return (int)(value*getResources().getDisplayMetrics().density+.5f); }
    private LinearLayout.LayoutParams lp(int width,int height,int top,int left,int right,int bottom) { LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(width,height>0?dp(height):height); p.setMargins(dp(left),dp(top),dp(right),dp(bottom)); return p; }
    private LinearLayout.LayoutParams square(int size) { return new LinearLayout.LayoutParams(dp(size),dp(size)); }
    private GradientDrawable round(int color,int radius) { GradientDrawable shape=new GradientDrawable(); shape.setColor(color); shape.setCornerRadius(dp(radius)); return shape; }
    private GradientDrawable stroke(int color,int line,int radius,int width) { GradientDrawable shape=round(color,radius); shape.setStroke(dp(width),line); return shape; }
    @Override public void status(String message){status.setText(message);}
    @Override public void products(List<PlayCreditBilling.Offer> offers) {
        packs.removeAllViews(); selected=null;
        List<PlayCreditBilling.Offer> ordered=new ArrayList<>(offers); ordered.sort(Comparator.comparingInt(o->o.credits)); availableOffers.clear(); availableOffers.addAll(ordered);
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
