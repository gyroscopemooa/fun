package net.manytool.app;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.view.Gravity;
import android.view.View;
import android.widget.*;
import java.util.List;

/** Compact, app-native credit checkout. The actual charge is verified by PlayCreditBilling. */
public final class PlayCreditsPanel extends LinearLayout implements PlayCreditBilling.Listener, AutoCloseable {
    private static final int INK=Color.rgb(25,31,43), MUTED=Color.rgb(110,121,139), SURFACE=Color.WHITE,
        CANVAS=Color.rgb(247,248,250), PRIMARY=Color.rgb(18,137,160), PALE=Color.rgb(232,247,249);
    private final TextView balance, count, payButton, status;
    private final LinearLayout presets;
    private final PlayCreditBilling controller;
    private int requestedCredits=1;

    public PlayCreditsPanel(Activity activity, PlayCreditBilling.Backend backend, Runnable close) {
        super(activity); setOrientation(VERTICAL); setBackgroundColor(CANVAS); setPadding(dp(20),dp(18),dp(20),dp(24));
        LinearLayout header=new LinearLayout(activity); header.setGravity(Gravity.CENTER_VERTICAL); header.setOrientation(HORIZONTAL);
        TextView title=text("크레딧 충전",25,INK); title.setTypeface(Typeface.DEFAULT,Typeface.BOLD); header.addView(title,new LinearLayout.LayoutParams(0,dp(48),1));
        TextView closeButton=text("×",28,MUTED); closeButton.setGravity(Gravity.CENTER); closeButton.setBackground(round(Color.rgb(239,242,245),20)); closeButton.setOnClickListener(v->close.run()); header.addView(closeButton,square(40));
        addView(header,lp(-1,48,0,0,0,14));

        LinearLayout wallet=card(); wallet.setOrientation(HORIZONTAL); wallet.setGravity(Gravity.CENTER_VERTICAL);
        LinearLayout walletCopy=new LinearLayout(activity); walletCopy.setOrientation(VERTICAL);
        walletCopy.addView(text("보유 크레딧",13,MUTED)); balance=text("로그인된 계정",18,INK); balance.setTypeface(Typeface.DEFAULT,Typeface.BOLD); walletCopy.addView(balance,lp(-1,-2,4,0,0,0));
        wallet.addView(walletCopy,new LinearLayout.LayoutParams(0,-2,1));
        TextView arrow=text("›",30,Color.rgb(165,174,186)); arrow.setGravity(Gravity.CENTER); wallet.addView(arrow,square(32)); addView(wallet,lp(-1,78,0,0,0,14));

        LinearLayout quantity=card();
        TextView quantityTitle=text("얼마를 충전할까요?",18,INK); quantityTitle.setTypeface(Typeface.DEFAULT,Typeface.BOLD); quantity.addView(quantityTitle);
        LinearLayout stepper=new LinearLayout(activity); stepper.setGravity(Gravity.CENTER_VERTICAL); stepper.setOrientation(HORIZONTAL);
        TextView minus=roundControl("−"); stepper.addView(minus,square(44));
        count=text("1",28,INK); count.setTypeface(Typeface.DEFAULT,Typeface.BOLD); count.setGravity(Gravity.CENTER); stepper.addView(count,new LinearLayout.LayoutParams(0,dp(52),1));
        TextView plus=roundControl("+"); stepper.addView(plus,square(44)); quantity.addView(stepper,lp(-1,52,12,0,0,10));
        presets=new LinearLayout(activity); presets.setGravity(Gravity.CENTER); presets.setOrientation(HORIZONTAL); quantity.addView(presets,lp(-1,40,0,0,0,0));
        for(int value:new int[]{1,5,10,100}) { TextView pill=pill(value); presets.addView(pill,lp(0,40,0,0,7,0,1)); }
        addView(quantity,lp(-1,-2,0,0,0,18));
        minus.setOnClickListener(v->{requestedCredits=Math.max(1,requestedCredits-1);refresh();});
        plus.setOnClickListener(v->{requestedCredits=Math.min(1000,requestedCredits+1);refresh();});

        status=text("",12,MUTED); status.setGravity(Gravity.CENTER);
        payButton=text("₩1,000 충전하기",17,Color.WHITE); payButton.setTypeface(Typeface.DEFAULT,Typeface.BOLD); payButton.setGravity(Gravity.CENTER); payButton.setBackground(round(PRIMARY,28)); payButton.setOnClickListener(v->status.setText("Google Play 상품 연결 후 결제를 시작합니다.")); addView(payButton,lp(-1,56,0,0,0,8));
        addView(status,lp(-1,-2,0,0,0,0));
        controller=new PlayCreditBilling(activity,backend,this); refresh();
    }

    private void refresh() {
        count.setText(String.valueOf(requestedCredits)); payButton.setText("₩"+String.format(java.util.Locale.KOREA,"%,d",requestedCredits*1000)+" 충전하기");
        for(int i=0;i<presets.getChildCount();i++) { TextView pill=(TextView)presets.getChildAt(i); boolean active=(int)pill.getTag()==requestedCredits; pill.setTextColor(active?Color.WHITE:INK); pill.setBackground(round(active?PRIMARY:Color.rgb(239,242,245),20)); }
    }
    private TextView pill(int value) { TextView view=text(value+"개",14,INK); view.setTag(value); view.setGravity(Gravity.CENTER); view.setTypeface(Typeface.DEFAULT,Typeface.BOLD); view.setOnClickListener(v->{requestedCredits=(int)v.getTag();refresh();}); return view; }
    private TextView roundControl(String value) { TextView view=text(value,25,INK); view.setGravity(Gravity.CENTER); view.setTypeface(Typeface.DEFAULT,Typeface.BOLD); view.setBackground(round(PALE,16)); return view; }
    private LinearLayout card() { LinearLayout card=new LinearLayout(getContext()); card.setOrientation(VERTICAL); card.setPadding(dp(18),dp(16),dp(18),dp(16)); card.setBackground(round(SURFACE,20)); return card; }
    private TextView text(String value,int size,int color) { TextView view=new TextView(getContext()); view.setText(value); view.setTextSize(size); view.setTextColor(color); return view; }
    private int dp(int value) { return (int)(value*getResources().getDisplayMetrics().density+.5f); }
    private LinearLayout.LayoutParams lp(int width,int height,int top,int left,int right,int bottom) { LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(width,height); p.setMargins(dp(left),dp(top),dp(right),dp(bottom)); return p; }
    private LinearLayout.LayoutParams lp(int width,int height,int top,int left,int right,int bottom,float weight) { LinearLayout.LayoutParams p=lp(width,height,top,left,right,bottom); p.weight=weight; return p; }
    private LinearLayout.LayoutParams square(int size) { return new LinearLayout.LayoutParams(dp(size),dp(size)); }
    private GradientDrawable round(int color,int radius) { GradientDrawable shape=new GradientDrawable(); shape.setColor(color); shape.setCornerRadius(dp(radius)); return shape; }
    @Override public void status(String message){status.setText(message);}
    @Override public void products(List<PlayCreditBilling.Offer> offers) { /* Store catalog will replace the static packs when enabled. */ }
    @Override public void verified(PlayCreditBilling.Receipt receipt){balance.setText("보유 크레딧 "+receipt.balance+"개");}
    public void resume(){ }
    @Override public void close(){controller.close();}
}
