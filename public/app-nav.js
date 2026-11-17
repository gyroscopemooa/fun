/* ManyTool Android app bottom menu bar. Only runs inside the app WebView (UA contains "ManytoolAndroid").
   Morph tooltip springs follow designbookmark tokens: settle 280/22 (position, width), pop 520/16 (scale), fade 420/32. */
(function () {
  if (!/ManytoolAndroid/i.test(navigator.userAgent) || window.__mtAppNav) return;
  window.__mtAppNav = true;

  function Spring(value, k, c, onUpdate) {
    this.v = value; this.t = value; this.vel = 0; this.k = k; this.c = c; this.cb = onUpdate; this.raf = 0; this.last = 0;
  }
  Spring.prototype.to = function (target) {
    this.t = target;
    if (this.raf) return;
    var self = this; this.last = performance.now();
    var step = function (now) {
      var dt = Math.min(0.032, (now - self.last) / 1000); self.last = now;
      var n = Math.max(1, Math.ceil(dt / 0.004)), h = dt / n;
      for (var i = 0; i < n; i++) { self.vel += (-self.k * (self.v - self.t) - self.c * self.vel) * h; self.v += self.vel * h; }
      self.cb(self.v);
      if (Math.abs(self.v - self.t) < 0.002 && Math.abs(self.vel) < 0.002) { self.v = self.t; self.cb(self.v); self.raf = 0; return; }
      self.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  };
  Spring.prototype.set = function (v) { this.v = v; this.t = v; this.vel = 0; this.cb(v); };

  var css = document.createElement('style');
  css.textContent =
    'body.mt-app{padding-bottom:calc(60px + env(safe-area-inset-bottom))!important}' +
    // Web-only NICE/single-purchase notices are never shown in the app (Google Play credits only).
    '[data-web-only]{display:none!important}' +
    '#mt-nav button.mt-pay{color:#0e7490;font-weight:800}' +
    '#mt-nav button.mt-charge{color:#b45309;font-weight:800}' +
    '#mt-nav button small{font-size:10px;font-weight:800;color:#0e7490;line-height:1;margin-top:-1px}' +
    '#mt-nav button span{white-space:nowrap}' +
    '#mt-nav button.mt-open{color:#0ea5e9}' +
    '#mt-ai-back{position:fixed;inset:0;z-index:2147482999;background:rgba(15,23,42,.35)}' +
    '#mt-ai{position:fixed;left:8px;right:8px;bottom:calc(64px + env(safe-area-inset-bottom));z-index:2147483000;max-height:60vh;overflow-y:auto;background:#fff;border-radius:18px;padding:12px;box-shadow:0 12px 40px rgba(15,23,42,.28);display:grid;grid-template-columns:1fr 1fr;gap:8px;overscroll-behavior:contain}' +
    '#mt-ai h2{grid-column:1/-1;margin:0 4px 2px;font-size:13px;font-weight:800;color:#64748b}' +
    '#mt-ai a{display:flex;align-items:center;min-height:44px;padding:8px 12px;border:1px solid #e2e8f0;border-radius:12px;color:#0f172a;font-size:13px;font-weight:700;text-decoration:none;background:#f8fafc}' +
    '#mt-ai a:active{background:#e0f2fe}' +
    '#mt-nav{position:fixed;left:0;right:0;bottom:0;z-index:2147483000;display:flex;height:calc(56px + env(safe-area-inset-bottom));' +
    'padding-bottom:env(safe-area-inset-bottom);background:rgba(255,255,255,.96);border-top:1px solid #e2e8f0;box-shadow:0 -4px 16px rgba(15,23,42,.08);' +
    '-webkit-tap-highlight-color:transparent;font-family:inherit}' +
    '#mt-nav button{flex:1;border:0;background:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;color:#334155;font-size:11px;font-weight:600;cursor:pointer;touch-action:manipulation}' +
    '#mt-nav button svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}' +
    '#mt-nav button:active{color:#0ea5e9}' +
    '#mt-tip{position:fixed;left:0;bottom:calc(66px + env(safe-area-inset-bottom));z-index:2147483001;height:28px;border-radius:14px;background:#1f2937;color:#fff;font-size:12px;font-weight:600;' +
    'display:flex;align-items:center;justify-content:center;white-space:nowrap;overflow:hidden;opacity:0;pointer-events:none;will-change:transform,width,opacity}';
  document.head.appendChild(css);

  var icons = {
    home: '<svg viewBox="0 0 24 24"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>',
    back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
    reload: '<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/></svg>',
    tools: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg>',
    pay: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/></svg>',
    charge: '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><path d="M12 13v4"/><path d="M10 15h4"/></svg>'
  };
  var items = [
    { key: 'home', label: '홈', run: function () { location.href = '/'; } },
    { key: 'back', label: '뒤로', run: function () { if (history.length > 1) history.back(); } },
    { key: 'reload', label: '새로고침', run: function () { location.reload(); } },
    { key: 'tools', label: '도구', run: function () { location.href = '/tools/'; } },
    // Credits only: 사용하기 shows this page's AI credit cost; 충전하기 opens the credit top-up dialog (never NicePay / single purchase).
    { key: 'pay', label: '사용하기', cls: 'mt-pay', run: function () { if (window.manytoolShowPaymentChoices) window.manytoolShowPaymentChoices({ mode: 'use' }); } },
    { key: 'charge', label: '충전하기', cls: 'mt-charge', run: function () { if (window.manytoolShowPaymentChoices) window.manytoolShowPaymentChoices({ mode: 'charge' }); } }
  ];

  var aiTools = [
    ['AI 이미지 생성', '/ai-image-generator/'], ['AI 증명사진', '/ai-id-photo/'], ['AI 여권사진', '/ai-passport-photo/'],
    ['AI 프로필 사진', '/ai-headshot/'], ['AI 코디', '/ai-stylist/'], ['AI 모델컷', '/ai-model-cut/'],
    ['AI 포토샵', '/ai-photoshop/'], ['AI 퍼스널컬러', '/ai-personal-color/'], ['AI 칼로리 분석', '/ai-calorie-calculator/'],
    ['AI 만세력', '/ai-manseryeok/'], ['AI 펫 번역기', '/ai-pet-translator/'], ['AI 이름 분석', '/name-premium/'],
    ['AI 상세페이지', '/tools/product-detail-studio/']
  ];
  function closeAi() {
    var a = document.getElementById('mt-ai'), b = document.getElementById('mt-ai-back');
    if (a) a.remove(); if (b) b.remove();
    var btn = document.querySelector('#mt-nav button[data-key="ai"]'); if (btn) btn.classList.remove('mt-open');
  }
  function toggleAi() {
    if (document.getElementById('mt-ai')) { closeAi(); return; }
    var back = document.createElement('div'); back.id = 'mt-ai-back'; back.addEventListener('click', closeAi);
    var sheet = document.createElement('nav'); sheet.id = 'mt-ai'; sheet.setAttribute('aria-label', 'AI 기능 바로가기');
    var h = document.createElement('h2'); h.textContent = 'AI 기능 바로가기'; sheet.appendChild(h);
    aiTools.forEach(function (t) { var a = document.createElement('a'); a.href = t[1]; a.textContent = t[0]; sheet.appendChild(a); });
    document.body.appendChild(back); document.body.appendChild(sheet);
    var btn = document.querySelector('#mt-nav button[data-key="ai"]'); if (btn) btn.classList.add('mt-open');
  }

  function mount() {
    document.body.classList.add('mt-app');
    var nav = document.createElement('nav'); nav.id = 'mt-nav'; nav.setAttribute('aria-label', '앱 메뉴');
    var tip = document.createElement('div'); tip.id = 'mt-tip'; tip.setAttribute('aria-hidden', 'true');
    var x = 0, w = 60, sc = 1, op = 0, hideTimer = 0, shown = false;
    var paint = function () { tip.style.width = w + 'px'; tip.style.opacity = op; tip.style.transform = 'translateX(' + x + 'px) scale(' + sc + ')'; };
    var sx = new Spring(0, 280, 22, function (v) { x = v; paint(); });
    var sw = new Spring(60, 280, 22, function (v) { w = v; paint(); });
    var ss = new Spring(1, 520, 16, function (v) { sc = v; paint(); });
    var so = new Spring(0, 420, 32, function (v) { op = Math.max(0, Math.min(1, v)); paint(); });

    items.forEach(function (it) {
      var b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-label', it.label); if (it.cls) b.className = it.cls; b.setAttribute('data-key', it.key);
      var cost = it.key === 'pay' && window.manytoolAiCredits ? window.manytoolAiCredits() : null;
      b.innerHTML = icons[it.key] + '<span>' + it.label + '</span>' + (cost ? '<small>' + (cost.from ? cost.credits + '크레딧~' : cost.credits + '크레딧') + '</small>' : '');
      b.addEventListener('pointerdown', function () {
        clearTimeout(hideTimer);
        tip.textContent = it.label;
        var tw = Math.ceil(tip.scrollWidth) + 0, tw2 = Math.max(44, tw + 24);
        var r = b.getBoundingClientRect(), cx = r.left + r.width / 2 - tw2 / 2;
        if (!shown) { sx.set(cx); sw.set(tw2); ss.set(0.6); }
        sx.to(cx); sw.to(tw2); ss.to(1); so.to(1); shown = true;
      });
      var release = function () { clearTimeout(hideTimer); hideTimer = setTimeout(function () { so.to(0); shown = false; }, 450); };
      b.addEventListener('pointerup', release); b.addEventListener('pointercancel', release);
      b.addEventListener('click', it.run);
      nav.appendChild(b);
    });
    document.body.appendChild(nav); document.body.appendChild(tip);
  }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
