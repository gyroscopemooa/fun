package net.manytool.app;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.view.Gravity;
import android.view.View;
import android.widget.*;
import java.util.List;

/** Compact native checkout; the actual purchase stays behind PlayCreditBilling verification. */
public final class PlayCreditsPanel extends LinearLayout implements PlayCreditBilling.Listener, AutoCloseable {
    private static final int INK=Color.rgb(25,31,43), MUTED=Color.rgb(108,119,137), SURFACE=Color.WHITE,
        CANVAS=Color.rgb(247,248,250), PRIMARY=Color.rgb(18,137,160), SELECTED=Color.rgb(230,247,249);
    private final TextView balance, payButton, status;
    private final LinearLayout packs;
    private final PlayCreditBilling controller;
    private int requestedCredits=1;

    public PlayCreditsPanel(Activity activity, PlayCreditBilling.Backend backend, Runnable close) {
        super(activity); setOrientation(VERTICAL); setBackgroundColor(CANVAS); setPadding(dp(20),dp(18),dp(20),dp(24));
        LinearLayout header=new LinearLayout(activity); header.setGravity(Gravity.CENTER_VERTICAL);
        TextView title=text("크레딧 충전",25,INK,true); header.addView(title,new LinearLayout.LayoutParams(0,dp(48),1));
        TextView closeButton=text("×",27,MUTED,false); closeButton.setGravity(Gravity.CENTER); closeButton.setBackground(round(Color.rgb(236,240,244),20)); closeButton.setOnClickListener(v->close.run()); header.addView(closeButton,square(40));
        addView(header,lp(-1,48,0,0,0,14));

        LinearLayout wallet=card();
        wallet.addView(text("보유 크레딧",13,MUTED,false));
        balance=text("로그인된 계정",19,INK,true); wallet.addView(balance,lp(-1,-2,6,0,0,0));
        addView(wallet,lp(-1,-2,0,0,0,18));

        TextView section=text("충전할 크레딧",18,INK,true); addView(section,lp(-1,-2,0,0,0,10));
        packs=new LinearLayout(activity); packs.setOrientation(VERTICAL); addView(packs);
        for(int credits:new int[]{1,5,10,100}) packs.addView(pack(credits),lp(-1,62,0,0,0,9));

        status=text("",12,MUTED,false); status.setGravity(Gravity.CENTER);
        payButton=text("₩1,000 충전하기",17,Color.WHITE,true); payButton.setGravity(Gravity.CENTER); payButton.setBackground(round(PRIMARY,18)); payButton.setOnClickListener(v->status.setText("Google Play 상품 연결 후 결제를 시작합니다.")); addView(payButton,lp(-1,56,10,0,0,8));
        addView(status,lp(-1,-2,0,0,0,0));
        controller=new PlayCreditBilling(activity,backend,this); refresh();
    }

    private LinearLayout pack(int credits) {
        LinearLayout row=new LinearLayout(getContext()); row.setGravity(Gravity.CENTER_VERTICAL); row.setPadding(dp(18),0,dp(18),0); row.setTag(credits); row.setClickable(true);
        TextView left=text(credits+" 크레딧",16,INK,true); row.addView(left,new LinearLayout.LayoutParams(0,-2,1));
        TextView right=text("₩"+String.format(java.util.Locale.KOREA,"%,d",credits*1000),15,INK,true); row.addView(right);
        row.setOnClickListener(v->{requestedCredits=(int)v.getTag();refresh();}); return row;
    }
    private void refresh() {
        payButton.setText("₩"+String.format(java.util.Locale.KOREA,"%,d",requestedCredits*1000)+" 충전하기");
        for(int i=0;i<packs.getChildCount();i++) { LinearLayout row=(LinearLayout)packs.getChildAt(i); boolean active=(int)row.getTag()==requestedCredits; row.setBackground(stroke(active?SELECTED:SURFACE,active?PRIMARY:Color.rgb(229,233,238),16,active?2:1)); }
    }
    private LinearLayout card() { LinearLayout view=new LinearLayout(getContext()); view.setOrientation(VERTICAL); view.setPadding(dp(18),dp(16),dp(18),dp(16)); view.setBackground(round(SURFACE,18)); return view; }
    private TextView text(String value,int size,int color,boolean bold) { TextView view=new TextView(getContext()); view.setText(value); view.setTextSize(size); view.setTextColor(color); if(bold)view.setTypeface(Typeface.DEFAULT,Typeface.BOLD); return view; }
    private int dp(int value) { return (int)(value*getResources().getDisplayMetrics().density+.5f); }
    private LinearLayout.LayoutParams lp(int width,int height,int top,int left,int right,int bottom) { LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(width,height); p.setMargins(dp(left),dp(top),dp(right),dp(bottom)); return p; }
    private LinearLayout.LayoutParams square(int size) { return new LinearLayout.LayoutParams(dp(size),dp(size)); }
    private GradientDrawable round(int color,int radius) { GradientDrawable shape=new GradientDrawable(); shape.setColor(color); shape.setCornerRadius(dp(radius)); return shape; }
    private GradientDrawable stroke(int color,int line,int radius,int width) { GradientDrawable shape=round(color,radius); shape.setStroke(dp(width),line); return shape; }
    @Override public void status(String message){status.setText(message);}
    @Override public void products(List<PlayCreditBilling.Offer> offers) { }
    @Override public void verified(PlayCreditBilling.Receipt receipt){balance.setText("보유 크레딧 "+receipt.balance+"개");}
    public void resume(){ }
    @Override public void close(){controller.close();}
}
