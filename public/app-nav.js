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
    reload: '<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/></svg>'
  };
  var items = [
    { key: 'home', label: '홈', run: function () { location.href = '/'; } },
    { key: 'back', label: '뒤로', run: function () { if (history.length > 1) history.back(); } },
    { key: 'reload', label: '새로고침', run: function () { location.reload(); } }
  ];

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
      var b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-label', it.label);
      b.innerHTML = icons[it.key] + '<span>' + it.label + '</span>';
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
