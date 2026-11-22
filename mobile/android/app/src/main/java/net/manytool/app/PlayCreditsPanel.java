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

    public PlayCreditsPanel(Activity activity, PlayCreditBilling.Backend backend, Runnable close) {
        super(activity); setOrientation(VERTICAL); setBackgroundColor(CANVAS); setPadding(dp(20),dp(18),dp(20),dp(18));
        LinearLayout header=new LinearLayout(activity); header.setGravity(Gravity.CENTER_VERTICAL);
        header.addView(text("크레딧 충전",25,INK,true),new LinearLayout.LayoutParams(0,dp(48),1));
        TextView closeButton=text("×",27,MUTED,false); closeButton.setGravity(Gravity.CENTER); closeButton.setBackground(round(Color.rgb(236,240,244),20)); closeButton.setOnClickListener(v->close.run()); header.addView(closeButton,square(40));
        addView(header,lp(-1,48,0,0,0,16));

        LinearLayout wallet=card(); wallet.addView(text("보유 크레딧",13,MUTED,false));
        balance=text("잔액을 확인하고 있어요",19,INK,true); wallet.addView(balance,lp(-1,-2,6,0,0,0)); addView(wallet,lp(-1,-2,0,0,0,20));
        addView(text("충전 상품",18,INK,true),lp(-1,-2,0,0,0,10));
        packs=new LinearLayout(activity); packs.setOrientation(VERTICAL); addView(packs);
        loadingRow();
        controller=new PlayCreditBilling(activity,backend,this);

        Space spacer=new Space(activity); addView(spacer,new LinearLayout.LayoutParams(-1,0,1));
        status=text("Google Play 가격을 불러오는 중",12,MUTED,false); status.setGravity(Gravity.CENTER); addView(status,lp(-1,-2,0,0,0,10));
        payButton=text("상품을 선택해 주세요",17,Color.WHITE,true); payButton.setGravity(Gravity.CENTER); payButton.setEnabled(false); payButton.setAlpha(.45f); payButton.setBackground(round(PRIMARY,18)); payButton.setOnClickListener(v->{if(selected!=null)controller.buy(selected.productId);}); addView(payButton,lp(-1,56,0,0,0,0));
        controller.connect();
    }

    private void loadingRow() { packs.removeAllViews(); TextView loading=text("Google Play 상품을 불러오는 중",14,MUTED,false); loading.setGravity(Gravity.CENTER_VERTICAL); loading.setPadding(dp(18),0,dp(18),0); loading.setBackground(round(SURFACE,16)); packs.addView(loading,lp(-1,62,0,0,0,0)); }
    private LinearLayout pack(PlayCreditBilling.Offer offer) {
        LinearLayout row=new LinearLayout(getContext()); row.setGravity(Gravity.CENTER_VERTICAL); row.setPadding(dp(18),0,dp(18),0); row.setTag(offer); row.setClickable(true);
        row.addView(text(offer.credits+" 크레딧",16,INK,true),new LinearLayout.LayoutParams(0,-2,1));
        row.addView(text(offer.formattedPrice,16,INK,true)); row.setOnClickListener(v->{selected=(PlayCreditBilling.Offer)v.getTag();refreshSelection();}); return row;
    }
    private void refreshSelection() {
        for(int i=0;i<packs.getChildCount();i++) { LinearLayout row=(LinearLayout)packs.getChildAt(i); boolean active=row.getTag()==selected; row.setBackground(stroke(active?SELECTED:SURFACE,active?PRIMARY:Color.rgb(229,233,238),16,active?2:1)); }
        payButton.setEnabled(selected!=null); payButton.setAlpha(selected==null ? .45f : 1f); if(selected!=null) payButton.setText(selected.formattedPrice+" 결제하기");
    }
    private LinearLayout card() { LinearLayout view=new LinearLayout(getContext()); view.setOrientation(VERTICAL); view.setPadding(dp(18),dp(16),dp(18),dp(16)); view.setBackground(round(SURFACE,18)); return view; }
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
        if(ordered.isEmpty()) { loadingRow(); payButton.setText("구매 가능한 상품이 없습니다"); return; }
        for(PlayCreditBilling.Offer offer:ordered) packs.addView(pack(offer),lp(-1,62,0,0,0,9));
        selected=ordered.get(0); status.setVisibility(GONE); refreshSelection();
    }
    @Override public void verified(PlayCreditBilling.Receipt receipt){balance.setText("보유 크레딧 "+receipt.balance+"개");}
    public void resume(){controller.restore();}
    @Override public void close(){controller.close();}
}
