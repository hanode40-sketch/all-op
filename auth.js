/******************************************************************
 *  حارس الدخول — Northwest Bus · أدوات التشغيل
 *  يوضع في مستودع all-op، ويُضاف في <head> كل برنامج:
 *
 *  <script src="https://hanode40-sketch.github.io/all-op/auth.js" data-tool="shift"></script>
 *
 *  data-tool = رمز البرنامج (accident, violation, shift, evaluation, trip, uniform, dashboard)
 *  في صفحة الهب الرئيسية اتركه بدون data-tool.
 ******************************************************************/
(function () {
  'use strict';

  var LOGIN_URL = 'https://hanode40-sketch.github.io/all-op/login.html';
  var HOME_URL  = 'https://hanode40-sketch.github.io/all-op/';
  var KEY = 'nw_auth_v1';

  var script = document.currentScript;
  var TOOL = (script && script.getAttribute('data-tool')) || '';
  var SHOW_BAR = !(script && script.getAttribute('data-bar') === 'off');

  /* ---------- الوضع الليلي: يتبع اختيار الصفحة الرئيسية ---------- */
  var THEME_KEY = 'nwTheme';
  var root = document.documentElement;
  var NATIVE_THEME = root.hasAttribute('data-theme');   // صفحات لها تصميم ليلي خاص (الهب، الأداء)
  function themeNow() {
    try {
      return localStorage.getItem(THEME_KEY) ||
        (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    } catch (e) { return 'light'; }
  }
  function applyTheme() {
    var t = themeNow();
    if (NATIVE_THEME) { root.setAttribute('data-theme', t); return; }
    if (t === 'dark') root.setAttribute('data-nw-dark', ''); else root.removeAttribute('data-nw-dark');
  }
  (function () {
    var st = document.createElement('style');
    var re = 'filter:invert(1) hue-rotate(180deg)';
    st.textContent =
      'html[data-nw-dark]{' + re + ';background:#fff}' +
      'html[data-nw-dark] img,html[data-nw-dark] video,html[data-nw-dark] canvas,html[data-nw-dark] iframe,' +
      'html[data-nw-dark] body::before,html[data-nw-dark] .nwa-bar,html[data-nw-dark] .nwa-ban,html[data-nw-dark] .nwa-deny{' + re + '}' +
      '@media print{html[data-nw-dark]{filter:none}html[data-nw-dark] img,html[data-nw-dark] canvas{filter:none}}';
    (document.head || root).appendChild(st);
    applyTheme();
    window.addEventListener('storage', function (ev) { if (ev.key === THEME_KEY) applyTheme(); });
    try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme); } catch (e) {}
  })();

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; }
  }
  function decode(token) {
    try {
      var b = String(token).split('.')[0].replace(/-/g, '+').replace(/_/g, '/');
      while (b.length % 4) b += '=';
      var bin = atob(b), bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return JSON.parse(new TextDecoder('utf-8').decode(bytes));
    } catch (e) { return null; }
  }
  function current() {
    var s = load();
    if (!s || !s.token) return null;
    var p = decode(s.token);
    if (!p || !p.exp || p.exp <= Date.now()) return null;
    return p;
  }
  function can(user, tool) {
    if (!tool) return true;
    var t = (user && user.t) || [];
    return t.indexOf('all') > -1 || t.indexOf(String(tool).toLowerCase()) > -1;
  }
  function toLogin() {
    location.replace(LOGIN_URL + '?next=' + encodeURIComponent(location.href));
  }
  function logout() {
    try { localStorage.removeItem(KEY); } catch (e) {}
    location.replace(LOGIN_URL);
  }

  var user = current();
  if (!user) {
    document.documentElement.style.visibility = 'hidden';
    toLogin();
    return;
  }

  var api = {
    user: user,
    name: user.n,
    username: user.u,
    role: user.r,
    token: function () { var s = load(); return (s && s.token) || ''; },
    /** يضيف التوكن واسم الموظف للبيانات قبل إرسالها لـ Apps Script */
    attach: function (obj) {
      obj = obj || {};
      obj.authToken = api.token();
      obj.authUser = user.n;
      return obj;
    },
    can: function (tool) { return can(user, tool); },
    isAuthError: function (res) { return !!res && res.error === 'AUTH'; },
    relogin: function () { showExpired(); },
    logout: logout
  };
  window.NWAuth = api;

  /* ---------- الواجهة ---------- */

  var css =
    '.nwa-bar{position:fixed;bottom:12px;inset-inline-start:12px;z-index:99999;display:flex;align-items:center;gap:8px;' +
    'background:rgba(11,61,92,.92);color:#fff;font:13px/1.2 Tajawal,system-ui,sans-serif;padding:6px 6px 6px 12px;' +
    'border-radius:999px;box-shadow:0 4px 14px rgba(0,0,0,.25);direction:rtl;margin-bottom:env(safe-area-inset-bottom)}' +
    '.nwa-bar button,.nwa-ban button{border:0;border-radius:999px;padding:6px 12px;font:inherit;cursor:pointer}' +
    '.nwa-bar button{background:#fff;color:#0b3d5c;font-weight:700}' +
    '.nwa-ban{position:fixed;top:0;left:0;right:0;z-index:100000;background:#b91c1c;color:#fff;direction:rtl;' +
    'font:14px/1.4 Tajawal,system-ui,sans-serif;padding:10px 14px;display:flex;gap:10px;align-items:center;justify-content:center;flex-wrap:wrap}' +
    '.nwa-ban button{background:#fff;color:#b91c1c;font-weight:700}' +
    '.nwa-deny{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;direction:rtl;' +
    'font-family:Tajawal,system-ui,sans-serif;background:#0b3d5c;color:#fff;text-align:center}' +
    '.nwa-deny a{display:inline-block;margin-top:16px;background:#fff;color:#0b3d5c;padding:10px 20px;border-radius:999px;text-decoration:none;font-weight:700}' +
    '@media print{.nwa-bar,.nwa-ban{display:none!important}}';

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var banner = null;
  function showExpired() {
    if (banner || !document.body) return;
    banner = el('div', 'nwa-ban',
      '<span>انتهت مدة الدخول — سجّل الدخول مرة ثانية ولن تفقد البيانات المكتوبة · Session expired</span>');
    var b = el('button', '', 'تسجيل الدخول');
    b.onclick = function () { window.open(LOGIN_URL + '?next=close', '_blank'); };
    banner.appendChild(b);
    document.body.appendChild(banner);
  }

  // عند تسجيل الدخول من تبويب آخر: إخفاء التنبيه وتحديث البيانات
  window.addEventListener('storage', function (ev) {
    if (ev.key !== KEY) return;
    var u = current();
    if (u) {
      user = u; api.user = u; api.name = u.n; api.username = u.u; api.role = u.r;
      if (banner) { banner.remove(); banner = null; }
      scheduleExpiry();
    } else {
      showExpired();
    }
  });

  var timer = null;
  function scheduleExpiry() {
    clearTimeout(timer);
    var ms = user.exp - Date.now();
    if (ms > 0 && ms < 2147483647) timer = setTimeout(showExpired, ms);
  }

  function init() {
    var style = el('style'); style.textContent = css;
    document.head.appendChild(style);

    if (TOOL && !can(user, TOOL)) {
      document.body.innerHTML =
        '<div class="nwa-deny"><div><div style="font-size:48px">🔒</div>' +
        '<h2 style="margin:8px 0">ليس لديك صلاحية لهذا البرنامج</h2>' +
        '<div style="opacity:.8">No permission for this tool · ' + esc(user.n) + '</div>' +
        '<a href="' + HOME_URL + '">الرجوع لأدوات التشغيل</a></div></div>';
      return;
    }

    // إخفاء بطاقات الأدوات غير المسموحة (في الهب): <a data-tool="shift">
    document.querySelectorAll('[data-tool]').forEach(function (n) {
      if (n !== script && !can(user, n.getAttribute('data-tool'))) n.style.display = 'none';
    });

    // تعبئة اسم الموظف تلقائيًا: <input data-auth="name"> أو <span data-auth="name">
    document.querySelectorAll('[data-auth]').forEach(function (n) {
      var key = n.getAttribute('data-auth');
      var val = key === 'name' ? user.n : key === 'username' ? user.u : key === 'role' ? user.r : '';
      if ('value' in n && n.tagName !== 'BUTTON') { n.value = val; n.readOnly = true; }
      else n.textContent = val;
    });

    if (SHOW_BAR) {
      var bar = el('div', 'nwa-bar', '<span>👤 ' + esc(user.n) + '</span>');
      var out = el('button', '', 'خروج');
      out.onclick = function () { if (confirm('تسجيل الخروج؟')) logout(); };
      bar.appendChild(out);
      document.body.appendChild(bar);
    }

    scheduleExpiry();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
