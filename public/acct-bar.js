/* Header account widget (login / credit balance / top-up) + per-page AI credit cost helper.
   Runs on web and in the Android app WebView. Never starts a payment; balance is shown only when the
   account API provides it (the web login is not linked to the credit wallet yet). */
(function () {
  if (window.__mtAcct) return; window.__mtAcct = true;
  var inApp = /ManytoolAndroid/i.test(navigator.userAgent);
  var lang = (document.documentElement.lang || 'ko').slice(0, 2);
  var L = ({
    ko: { login: '로그인', account: '내 계정', charge: '충전', credit: '크레딧', chargeTitle: '크레딧 충전' },
    ja: { login: 'ログイン', account: 'マイページ', charge: 'チャージ', credit: 'クレジット', chargeTitle: 'クレジット' },
    en: { login: 'Sign in', account: 'Account', charge: 'Top up', credit: 'Credits', chargeTitle: 'Top up credits' }
  })[lang] || { login: 'Sign in', account: 'Account', charge: 'Top up', credit: 'Credits', chargeTitle: 'Top up credits' };

  /* Credits needed for the AI tool on this page: 1 credit = 1,000 KRW (rounded up), from the public catalog. */
  window.manytoolAiCredits = function () {
    var cat = Object.keys(window.manytoolAiCatalog || {}).map(function (k) { return window.manytoolAiCatalog[k]; });
    var path = location.pathname.replace(/^\/(?!ai(?:-|\/))[a-z]{2,3}(?:-[A-Za-z]{2,4})?(?=\/)/, '').replace(/\/$/, '');
    var found = null, from = false;
    if (path === '/ai-stylist') { found = cat.filter(function (p) { return p.id === 'stylist_1'; })[0]; from = true; }
    else {
      var probe = path;
      while (!found && probe) {
        found = cat.filter(function (p) { return p.paths && p.paths.indexOf(probe) >= 0; })[0];
        if (!found) probe = probe.slice(0, Math.max(0, probe.lastIndexOf('/')));
      }
      if (!found && /product-detail-studio$/.test(path)) {
        var n = Number((document.querySelector('[data-ai-page-count]') || {}).value || 7);
        found = cat.filter(function (p) { return p.pageCount === n; })[0] || cat.filter(function (p) { return p.pageCount === 7; })[0];
      }
    }
    return found ? { name: found.name, unit: found.unit || '', credits: Math.ceil(found.amount / 1000), from: from } : null;
  };
  window.manytoolCreditState = { signedIn: false, balance: null };

  var css = document.createElement('style');
  css.textContent =
    '#mt-acct{display:inline-flex;align-items:center;gap:4px;flex-shrink:0}' +
    '#mt-acct a,#mt-acct button{display:inline-flex;align-items:center;gap:3px;white-space:nowrap;border-radius:8px;font:inherit;font-size:11px;font-weight:700;line-height:1;padding:7px 8px;text-decoration:none;cursor:pointer}' +
    '#mt-acct .mt-login{border:1px solid #cbd5e1;background:#fff;color:#0f172a}' +
    '#mt-acct .mt-credit{border:1px solid #fde68a;background:#fffbeb;color:#92400e}' +
    '#mt-acct .mt-charge{border:0;background:#0e7490;color:#fff}' +
    '#mt-acct [hidden]{display:none!important}' +
    '@media(min-width:640px){#mt-acct a,#mt-acct button{font-size:12px;padding:8px 11px}}';
  document.head.appendChild(css);

  function openCharge(event) {
    if (inApp && typeof window.manytoolShowPaymentChoices === 'function') { event.preventDefault(); window.manytoolShowPaymentChoices({ mode: 'charge' }); }
  }

  /* In the Android app the web login is not linked to the app; use the native Google sign-in bridge.
     The bridge is trusted on the home page only, so other pages keep the normal link. */
  function nativeSignIn(event, login, credit) {
    var native = window.ManytoolNative;
    if (!inApp || !native || !native.postMessage || location.pathname.replace(/^\/[a-z]{2}(?:-[A-Za-z]{2,4})?(?=\/)/, '') !== '/') return;
    event.preventDefault();
    if (login.dataset.busy) return; login.dataset.busy = '1';
    var id = 'si' + Math.random().toString(36).slice(2, 12);
    var timer;
    var done = function () { delete login.dataset.busy; native.removeEventListener('message', on); clearTimeout(timer); };
    var on = function (e) {
      try {
        var data = JSON.parse(e.data); if (data.id !== id) return; done();
        if (data.ok) {
          login.textContent = L.account; credit.hidden = false; credit.textContent = '★ ' + L.credit;
          window.manytoolCreditState = { signedIn: true, balance: null };
          document.dispatchEvent(new CustomEvent('manytool:credit-state'));
        }
      } catch (err) { /* ignore unrelated messages */ }
    };
    timer = setTimeout(done, 180000);
    native.addEventListener('message', on);
    native.postMessage(JSON.stringify({ id: id, command: 'signIn' }));
  }

  function mount() {
    var anchor = document.querySelector('header details');
    if (!anchor || document.getElementById('mt-acct')) return;
    var box = document.createElement('div'); box.id = 'mt-acct';
    var login = document.createElement('a'); login.className = 'mt-login'; login.href = '/account/'; login.textContent = L.login;
    var credit = document.createElement('a'); credit.className = 'mt-credit'; credit.href = inApp ? '#' : '/credits/'; credit.hidden = true;
    credit.addEventListener('click', openCharge);
    login.addEventListener('click', function (event) { nativeSignIn(event, login, credit); });
    var charge = document.createElement('a'); charge.className = 'mt-charge'; charge.href = inApp ? '#' : '/credits/'; charge.textContent = '+ ' + L.charge; charge.title = L.chargeTitle;
    charge.addEventListener('click', openCharge);
    box.append(login, credit, charge);
    anchor.parentNode.insertBefore(box, anchor);
    // Header.astro already has its own plain login link; the widget replaces it.
    var legacy = document.querySelector('header a[href="/account/"]:not(.mt-login)'); if (legacy) legacy.hidden = true;
    refresh(login, credit);
  }

  function refresh(login, credit) {
    fetch('/api/auth/me', { credentials: 'same-origin', signal: AbortSignal.timeout(8000) })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (me) {
        if (!me || !me.email) return;
        var balance = typeof me.credits === 'number' ? me.credits : null;
        window.manytoolCreditState = { signedIn: true, balance: balance, email: me.email };
        login.textContent = L.account;
        credit.hidden = false;
        credit.textContent = '★ ' + (balance === null ? L.credit : balance + ' ' + L.credit);
        document.dispatchEvent(new CustomEvent('manytool:credit-state'));
      }).catch(function () { /* stays signed out */ });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
