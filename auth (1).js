/******************************************************************
 *  حارس الدخول — Northwest Bus · أدوات التشغيل
 *  يوضع في مستودع all-op، ويُضاف في <head> كل برنامج:
 *
 *  <script src="https://hanode40-sketch.github.io/all-op/auth.js" data-tool="shift"></script>
 *
 *  data-tool = رمز البرنامج (accident, violation, shift, evaluation, trip, uniform, dashboard, stats, kpi)
 *  في صفحة الهب الرئيسية اتركه بدون data-tool.
 ******************************************************************/
(function () {
  'use strict';

  var LOGIN_URL = 'https://hanode40-sketch.github.io/all-op/login.html';
  var HOME_URL  = 'https://hanode40-sketch.github.io/all-op/';
  var KEY = 'nw_auth_v1';
  var IDLE_KEY = 'nw_last_active';
  var AUTH_VERSION = '2026-11-13.4';   // غيّره عند كل تعديل على هذا الملف (يجبر الأجهزة على التحديث)
  var IDLE_MS = 2 * 60 * 60 * 1000;   // يقفل بعد ساعتين بدون أي نشاط (غيّر الرقم 2 لتغيير المدة)

  var script = document.currentScript;
  var TOOL = (script && script.getAttribute('data-tool')) || '';
  // شريط اسم الموظف وزر الخروج: يظهر في الصفحة الرئيسية فقط (البرامج بدون شريط)
  var BAR_ATTR = script && script.getAttribute('data-bar');
  var SHOW_BAR = BAR_ATTR === 'on' || (!TOOL && BAR_ATTR !== 'off');

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
      'html[data-nw-dark]{' + re + '}' +
      'html[data-nw-dark] img,html[data-nw-dark] video,html[data-nw-dark] canvas,html[data-nw-dark] iframe,' +
      'html[data-nw-dark] body::before,html[data-nw-dark] .nws,html[data-nw-dark] .nwh,html[data-nw-dark] .nwa-bar,html[data-nw-dark] .nwa-ban,html[data-nw-dark] .nwa-deny{' + re + '}' +
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
  function lastActive() {
    var s = load(), a = 0;
    try { a = Number(localStorage.getItem(IDLE_KEY) || 0); } catch (e) {}
    return Math.max(a, (s && s.at) || 0);   // وقت الدخول يُحسب كنشاط
  }
  function idleExpired() { return Date.now() - lastActive() > IDLE_MS; }
  function current() {
    var s = load();
    if (!s || !s.token) return null;
    var p = decode(s.token);
    if (!p || !p.exp || p.exp <= Date.now()) return null;
    if (idleExpired()) {                      // خمول أكثر من المدة المحددة: خروج
      try { localStorage.removeItem(KEY); } catch (e) {}
      return null;
    }
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

  // رابط نظام الدخول يُقرأ من login.html (مكان واحد للرابط)
  var authUrlP = null;
  function getAuthUrl() {
    if (!authUrlP) authUrlP = fetch(LOGIN_URL).then(function (r) { return r.text(); })
      .then(function (t) { var m = t.match(/AUTH_URL\s*=\s*'([^']+)'/); return m ? m[1] : ''; })
      .catch(function () { return ''; });
    return authUrlP;
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
    garages: user.g || [],                 // كراجات الموظف (فاضي = الكل)
    token: function () { var s = load(); return (s && s.token) || ''; },
    /** يضيف التوكن واسم الموظف للبيانات قبل إرسالها لـ Apps Script */
    attach: function (obj) {
      obj = obj || {};
      obj.authToken = api.token();
      obj.authUser = user.n;
      return obj;
    },
    can: function (tool) { return can(user, tool); },
    /** تسجيل عملية في «سجل النشاط» (لصفحة أداء الموظفين) — للبرامج اللي ما لها Apps Script */
    log: function (act, ref, details, tool) {
      return getAuthUrl().then(function (u) {
        if (!u) return;
        return fetch(u, { method: 'POST', keepalive: true, body: JSON.stringify({
          action: 'log', token: api.token(), tool: tool || TOOL, act: act || '', ref: ref || '', details: details || '' }) })
          .catch(function () {});
      });
    },
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
    '.nwa-inline{display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,.94);color:#1a1a1a;border:1px solid rgba(255,255,255,.6);' +
    'border-radius:999px;padding:4px 4px 4px 12px;font:600 13px/1.2 inherit;box-shadow:0 4px 12px rgba(10,25,55,.15);min-width:0;flex:0 1 auto;overflow:hidden}' +
    '.nwa-inline span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}' +
    '.nwa-inline button{border:0;border-radius:999px;padding:5px 12px;font:inherit;cursor:pointer;background:#fdecea;color:#b3261e;font-weight:700}' +
    'html[data-theme="dark"] .nwa-inline{background:rgba(22,28,40,.92);color:#e5e7eb;border-color:rgba(255,255,255,.12)}' +
    'html[data-theme="dark"] .nwa-inline button{background:#3a1e22;color:#f87171}' +
    '@media print{.nwa-bar,.nwa-ban,.nwa-inline{display:none!important}}';

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
      user = u; api.user = u; api.name = u.n; api.username = u.u; api.role = u.r; api.garages = u.g || [];
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

  /* ---------- القفل بعد الخمول ---------- */
  var lastWrite = 0;
  function markActive() {
    if (banner) return;                        // بعد انتهاء الجلسة لا نجدد النشاط
    var now = Date.now();
    if (now - lastWrite < 30000) return;       // تسجيل مرة كل 30 ثانية كحد أقصى
    lastWrite = now;
    try { localStorage.setItem(IDLE_KEY, String(now)); } catch (e) {}
  }
  function checkIdle() {
    if (banner || !load()) return;
    if (idleExpired()) {
      try { localStorage.removeItem(KEY); } catch (e) {}
      showExpired();                           // البيانات المكتوبة تبقى في الصفحة
    }
  }
  function startIdleWatch() {
    ['click', 'keydown', 'touchstart', 'scroll', 'input'].forEach(function (ev) {
      window.addEventListener(ev, markActive, { passive: true, capture: true });
    });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') checkIdle();   // عند الرجوع للتبويب
    });
    setInterval(checkIdle, 60000);
    markActive();
  }


  /* ================= القائمة الجانبية (الكمبيوتر فقط ≥ 1100px) ================= */
  var SIDE_KEY = 'nwSideMini';
  var SIDE_ITEMS = [
    { g: 0, t: '',            ic: '🏠', ar: 'الرئيسية',            en: 'Home',              url: HOME_URL },
    { g: 1, t: 'shift',       ic: '🔄', ar: 'تسليم الوردية',       en: 'Shift Handover',    url: 'https://hanode40-sketch.github.io/shift_handover/' },
    { g: 1, t: 'tasks',       ic: '✅', ar: 'المهام',              en: 'Tasks',             url: 'https://hanode40-sketch.github.io/tasks/' },
    { g: 1, t: 'trip',        ic: '🚌', ar: 'مسار الرحلة',         en: 'Trip Route',        url: 'https://hanode40-sketch.github.io/trip/' },
    { g: 2, t: 'violation',   ic: '📝', ar: 'محضر مخالفة',         en: 'Violation Report',  url: 'https://hanode40-sketch.github.io/violation/' },
    { g: 2, t: 'accident',    ic: '🚨', ar: 'تقرير حادث',          en: 'Accident Report',   url: 'https://hanode40-sketch.github.io/accident_report/' },
    { g: 2, t: 'evaluation',  ic: '⭐', ar: 'تقييم السائقين',      en: 'Driver Evaluation', url: 'https://hanode40-sketch.github.io/OP/' },
    { g: 3, t: 'performance', ic: '📊', ar: 'أداء الموظفين',       en: 'Staff Performance', url: HOME_URL + 'performance.html' },
    { g: 3, t: 'stats',       ic: '📈', ar: 'إحصائيات العمل',      en: 'Work Statistics',   url: HOME_URL + 'stats.html' },
    { g: 3, t: 'kpi',         ic: '🎯', ar: 'المؤشرات التشغيلية',  en: 'Operational KPIs',  url: HOME_URL + 'kpi.html' }
  ];
  var SIDE_GROUPS = [null, ['التشغيل اليومي', 'Daily operations'], ['التقارير والسلامة', 'Reports & safety'], ['الإدارة', 'Management']];
  var ROLE_EN = { 'مدير': 'Manager', 'مشرف': 'Supervisor', 'مرحّل': 'Dispatcher', 'مرحل': 'Dispatcher', 'موظف': 'Employee' };
  var sideCss =
    '.nws{display:none}' +
    '@media screen and (min-width:1100px){' +
      'html.nws-on .nws{display:flex}' +
      'html.nws-on .nwa-bar,html.nws-on #nw-user-slot,html.nws-on .lang-bar{display:none!important}' +
      'html.nws-on.nws-r body{margin-right:248px!important}html.nws-on.nws-l body{margin-left:248px!important}' +
      'html.nws-on.nws-mini.nws-r body{margin-right:76px!important}html.nws-on.nws-mini.nws-l body{margin-left:76px!important}' +
    '}' +
    '.nws{position:fixed;top:0;bottom:0;width:248px;z-index:99990;flex-direction:column;background:linear-gradient(180deg,#0f1d38 0%,#0b1529 100%);' +
      'color:#cbd5e1;font:14px/1.35 -apple-system,BlinkMacSystemFont,"Segoe UI",Tahoma,Arial,sans-serif;box-shadow:0 0 0 1px rgba(255,255,255,.04),0 10px 30px rgba(0,0,0,.25);transition:width .2s}' +
    'html.nws-r .nws{right:0}html.nws-l .nws{left:0}html.nws-mini .nws{width:76px}' +
    '.nws *{box-sizing:border-box}' +
    '.nws-top{display:flex;gap:8px;padding:14px 16px 0}' +
    '.nws-btn{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.08);color:#dbe4f0;' +
      'border-radius:9px;padding:7px 8px;cursor:pointer;font:inherit;font-size:12.5px;font-weight:700;transition:background .15s}' +
    '.nws-btn:hover{background:rgba(255,255,255,.14);color:#fff}' +
    'html.nws-mini .nws-top{flex-direction:column;padding:12px 10px 0}html.nws-mini .nws-btn .bt{display:none}' +
    '.nws-head{display:flex;align-items:center;gap:10px;padding:18px 16px 16px;border-bottom:1px solid rgba(255,255,255,.07)}' +
    '.nws-logo{width:42px;height:42px;flex-shrink:0;border-radius:12px;background:linear-gradient(135deg,#f28c28,#e8611a);color:#fff;font-weight:900;font-size:16px;display:flex;align-items:center;justify-content:center;letter-spacing:.5px}' +
    '.nws-brand{flex:1;min-width:0}.nws-brand b{display:block;color:#fff;font-size:15px}.nws-brand small{color:#7f8ea8;font-size:12px}' +
    '.nws-tog{background:rgba(255,255,255,.06);border:0;color:#9fb0c9;width:30px;height:30px;border-radius:8px;cursor:pointer;font-size:14px;flex-shrink:0}' +
    '.nws-tog:hover{background:rgba(255,255,255,.12);color:#fff}' +
    '.nws-nav{flex:1;overflow-y:auto;padding:10px 10px}' +
    '.nws-g{font-size:11px;font-weight:700;color:#5f6f8a;text-transform:uppercase;letter-spacing:.5px;padding:16px 10px 6px}' +
    '.nws-i{display:flex;align-items:center;gap:12px;padding:10px 12px;margin:2px 0;border-radius:10px;color:#cbd5e1;text-decoration:none;font-weight:600;position:relative;transition:background .15s,color .15s}' +
    '.nws-i:hover{background:rgba(255,255,255,.06);color:#fff}' +
    '.nws-i .ic{width:30px;height:30px;flex-shrink:0;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:16px;background:rgba(255,255,255,.05)}' +
    '.nws-i.on{background:rgba(242,140,40,.14);color:#fff}.nws-i.on .ic{background:#f28c28}' +
    '.nws-i.on::before{content:"";position:absolute;top:8px;bottom:8px;width:3px;border-radius:3px;background:#f28c28}' +
    'html.nws-r .nws-i.on::before{right:-10px}html.nws-l .nws-i.on::before{left:-10px}' +
    '.nws-foot{display:flex;align-items:center;gap:10px;padding:14px 14px 16px;border-top:1px solid rgba(255,255,255,.07)}' +
    '.nws-av{width:38px;height:38px;flex-shrink:0;border-radius:50%;background:#1f3f7a;color:#fff;font-weight:800;display:flex;align-items:center;justify-content:center}' +
    '.nws-u{flex:1;min-width:0}.nws-u b{display:block;color:#fff;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.nws-u small{color:#7f8ea8;font-size:12px}' +
    '.nws-out{background:rgba(239,68,68,.12);color:#fca5a5;border:0;border-radius:8px;padding:7px 10px;cursor:pointer;font:inherit;font-size:12px;font-weight:700;flex-shrink:0}' +
    '.nws-out:hover{background:rgba(239,68,68,.25);color:#fff}' +
    'html.nws-mini .nws .tx,html.nws-mini .nws-brand,html.nws-mini .nws-u,html.nws-mini .nws-out{display:none}' +
    'html.nws-mini .nws-head{flex-direction:column;padding:16px 8px}html.nws-mini .nws-g{font-size:0;padding:8px 0;margin:6px 10px;border-top:1px solid rgba(255,255,255,.08)}' +
    'html.nws-mini .nws-i{justify-content:center;padding:8px 0}html.nws-mini .nws-foot{justify-content:center}' +
    '@media print{.nws{display:none!important}html.nws-on body{margin:0!important}}';

  function buildSide(user) {
    var st = el('style'); st.textContent = sideCss; document.head.appendChild(st);
    var nav = el('nav', 'nws'); nav.setAttribute('aria-label', 'menu');
    document.body.appendChild(nav);
    var here = location.href.split('#')[0].split('?')[0];
    function isOn(it) {
      if (TOOL) return it.t === TOOL;
      if (!it.t) return /\/all-op\/(index\.html)?$/.test(here);
      return false;
    }
    function render() {
      var en = false; try { en = localStorage.getItem('hubLang') === 'en'; } catch (e) {}
      var dirR = (document.documentElement.getAttribute('dir') || document.dir || 'rtl') !== 'ltr';
      root.classList.toggle('nws-r', dirR); root.classList.toggle('nws-l', !dirR);
      nav.setAttribute('dir', en ? 'ltr' : 'rtl');
      var dark = themeNow() === 'dark';
      var h = '<div class="nws-top"><button class="nws-btn nws-theme" type="button" title="' + (dark ? (en ? 'Light mode' : 'الوضع النهاري') : (en ? 'Dark mode' : 'الوضع الليلي')) + '">' +
        (dark ? '☀️' : '🌙') + '<span class="bt">' + (dark ? (en ? 'Light' : 'نهاري') : (en ? 'Dark' : 'ليلي')) + '</span></button>' +
        '<button class="nws-btn nws-lang" type="button" title="' + (en ? 'العربية' : 'English') + '">🌐<span class="bt">' + (en ? 'العربية' : 'English') + '</span></button></div>' +
        '<div class="nws-head"><div class="nws-logo">NW</div><div class="nws-brand"><b>' + (en ? 'Operations Tools' : 'أدوات التشغيل') +
        '</b><small>Northwest Bus</small></div><button class="nws-tog" type="button" title="' + (en ? 'Collapse' : 'تصغير') + '">☰</button></div><div class="nws-nav">';
      var lastG = -1;
      SIDE_ITEMS.forEach(function (it) {
        if (it.t && !can(user, it.t)) return;
        if (it.g !== lastG && SIDE_GROUPS[it.g]) h += '<div class="nws-g">' + SIDE_GROUPS[it.g][en ? 1 : 0] + '</div>';
        lastG = it.g;
        var name = en ? it.en : it.ar;
        h += '<a class="nws-i' + (isOn(it) ? ' on' : '') + '" href="' + it.url + '" title="' + esc(name) + '"><span class="ic">' + it.ic + '</span><span class="tx">' + esc(name) + '</span></a>';
      });
      var nm = String(user.n || ''), role = user.r || '';
      h += '</div><div class="nws-foot"><div class="nws-av">' + esc(nm.trim().charAt(0).toUpperCase() || '؟') + '</div><div class="nws-u"><b dir="auto" title="' + esc(nm) + '">' + esc(nm) +
        '</b><small>' + esc(en ? (ROLE_EN[role] || role) : role) + '</small></div><button class="nws-out" type="button">' + (en ? 'Sign out' : 'خروج') + '</button></div>';
      nav.innerHTML = h;
      nav.querySelector('.nws-out').onclick = function () { if (confirm(en ? 'Sign out?' : 'تسجيل الخروج؟')) logout(); };
      nav.querySelector('.nws-theme').onclick = function () {
        var pb = document.getElementById('theme-btn');           // الصفحة الرئيسية لها زرها الخاص
        if (pb) pb.click();
        else { var t = themeNow() === 'dark' ? 'light' : 'dark'; try { localStorage.setItem(THEME_KEY, t); } catch (e) {} applyTheme(); }
        setTimeout(render, 30);
      };
      nav.querySelector('.nws-lang').onclick = function () {
        var pb = document.getElementById('lang-btn');
        if (pb) { pb.click(); }
        else {
          var v = en ? 'ar' : 'en'; try { localStorage.setItem('hubLang', v); } catch (e) {}
          // نفس التبويب ما يوصله حدث storage تلقائياً — نرسله للبرنامج عشان يغيّر لغته
          try { window.dispatchEvent(new StorageEvent('storage', { key: 'hubLang', newValue: v })); } catch (e) {}
        }
        setTimeout(render, 60);
      };
      nav.querySelector('.nws-tog').onclick = function () {
        var mini = !root.classList.contains('nws-mini'); root.classList.toggle('nws-mini', mini);
        try { localStorage.setItem(SIDE_KEY, mini ? '1' : '0'); } catch (e) {}
      };
    }
    try { if (localStorage.getItem(SIDE_KEY) === '1') root.classList.add('nws-mini'); } catch (e) {}
    root.classList.add('nws-on');
    render();
    window.addEventListener('storage', function (ev) { if (ev.key === 'hubLang') setTimeout(render, 50); });
    new MutationObserver(function () { render(); }).observe(root, { attributes: true, attributeFilter: ['dir', 'lang'] });
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

    // القائمة الجانبية على الكمبيوتر (مكان واحد لكل البرامج) — تُلغى بـ data-side="off"
    if (!(script && script.getAttribute('data-side') === 'off')) { try { buildSide(user); } catch (e) { console.error(e); } }

    // شريط العنوان الثابت (لكل البرامج) — يُلغى بـ data-head="off"
    try { buildHead(); } catch (e) { console.error(e); }

    // تعبئة اسم الموظف تلقائيًا: <input data-auth="name"> أو <span data-auth="name">
    document.querySelectorAll('[data-auth]').forEach(function (n) {
      var key = n.getAttribute('data-auth');
      var val = key === 'name' ? user.n : key === 'username' ? user.u : key === 'role' ? user.r : '';
      if ('value' in n && n.tagName !== 'BUTTON') { n.value = val; n.readOnly = true; }
      else n.textContent = val;
    });

    var slot = document.getElementById('nw-user-slot');   // مكان مخصص في الصفحة (مثل الصفحة الرئيسية)
    if (slot && SHOW_BAR) {
      slot.classList.add('nwa-inline');
      slot.innerHTML = '👤<span dir="auto">' + esc(user.n) + '</span>';
      var out2 = el('button', '', 'خروج');
      out2.type = 'button';
      out2.onclick = function () { if (confirm('تسجيل الخروج؟')) logout(); };
      slot.appendChild(out2);
    } else if (SHOW_BAR) {
      var bar = el('div', 'nwa-bar', '<span>👤 ' + esc(user.n) + '</span>');
      var out = el('button', '', 'خروج');
      out.onclick = function () { if (confirm('تسجيل الخروج؟')) logout(); };
      bar.appendChild(out);
      document.body.appendChild(bar);
    }

    scheduleExpiry();
    startIdleWatch();
    setTimeout(freshCheck, 1500);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) freshCheck(); });
  }

  /* ---------- تحديث تلقائي: يمنع المتصفح من عرض نسخة قديمة محفوظة ----------
     يجيب أحدث نسخة من الصفحة وملفاتها من GitHub، ولو فيه تحديث يعيد تحميل الصفحة مرة وحدة */
  function freshCheck() {
    if (location.protocol === 'file:' || !window.fetch) return;
    var path = location.pathname;
    try {
      var k = 'nwFresh_' + path, last = Number(sessionStorage.getItem(k) || 0);
      if (Date.now() - last < 60000) return;                 // مرة كل دقيقة كحد أقصى
      sessionStorage.setItem(k, String(Date.now()));
    } catch (e) {}
    function reloadOnce() {
      try {
        var rk = 'nwReloaded_' + path, r = Number(sessionStorage.getItem(rk) || 0);
        if (Date.now() - r < 120000) return;                 // ما يعيد التحميل أكثر من مرة
        sessionStorage.setItem(rk, String(Date.now()));
      } catch (e) { return; }
      location.reload();
    }
    var docLM = Date.parse(document.lastModified);
    fetch(location.href.split('#')[0], { cache: 'reload', credentials: 'same-origin' }).then(function (r) {
      var lm = Date.parse(r.headers.get('last-modified') || '');
      if (lm && docLM && lm > docLM + 1000) reloadOnce();
    }).catch(function () {});
    var me = script && script.src;
    if (me) fetch(me, { cache: 'reload' }).then(function (r) { return r.text(); }).then(function (txt) {
      var m = txt.match(/AUTH_VERSION\s*=\s*'([^']+)'/);
      if (m && m[1] !== AUTH_VERSION) reloadOnce();
    }).catch(function () {});
    // باقي ملفات الصفحة (مثل stats-widget.js): تتحدث بهدوء للمرة الجاية
    document.querySelectorAll('script[src],link[rel="stylesheet"]').forEach(function (n) {
      var u = n.src || n.href;
      if (u && u !== me && u.indexOf(location.origin) === 0) fetch(u, { cache: 'reload' }).catch(function () {});
    });
  }

  /* ---------- شريط عنوان ثابت موحّد لكل البرامج (نفس شكل صفحة المؤشرات) ---------- */
  var OWN_HEAD = { stats: 1, kpi: 1, performance: 1 };        // صفحات لها شريطها الخاص
  // عنوان البرنامج القديم (الشعار + الاسم) يتخفى لأن الشريط الجديد يعرضه
  var HIDE_OLD = {
    accident:   '.e-logo,.e-title,.e-sub',
    violation:  '.wrap>div:first-child:has(>img[alt="Northwest Bus"]),.wrap>h2:first-of-type,.wrap>h2:first-of-type+p',
    shift:      '.wrap>.top',
    evaluation: '.wrap>.top>img,.wrap>.top>h1',
    tasks:      '.wrap>.top',
    trip:       '.wrap>div:first-child:has(>img[alt="Northwest Bus"]),#page-title'
  };
  var headCss =
    'html,body{overflow-x:clip!important}' +          /* overflow-x:hidden يعطّل التثبيت — clip يمنع التمرير الجانبي بدون ما يعطّله */
    '.nwh{position:sticky;top:0;z-index:900;display:flex;align-items:center;justify-content:space-between;gap:10px;' +
      'margin:0 0 16px;padding:12px 16px;border-radius:0 0 16px 16px;color:#fff;direction:rtl;' +
      'background:rgba(31,63,122,.9);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);box-shadow:0 6px 20px rgba(0,0,0,.18);' +
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Tahoma,Arial,sans-serif;box-sizing:border-box}' +
    '.nwh[dir="ltr"]{direction:ltr}' +
    '.nwh-t{display:flex;align-items:center;gap:10px;min-width:0}' +
    '.nwh-ic{font-size:22px;line-height:1}' +
    '.nwh h1{margin:0;font-size:20px;line-height:1.25;font-weight:800;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,.35);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.nwh small{display:block;font-size:12px;opacity:.8;font-weight:500}' +
    '.nwh-back{color:#fff!important;text-decoration:none!important;font-size:14px;font-weight:600;background:rgba(255,255,255,.16);padding:8px 14px;border-radius:999px;white-space:nowrap;flex-shrink:0}' +
    '.nwh-back:hover{background:rgba(255,255,255,.26)}' +
    'html[data-nw-dark] .nwh,html[data-theme="dark"] .nwh{background:rgba(11,18,32,.88);border-bottom:1px solid #263042}' +
    '@media (max-width:600px){.nwh{padding:10px 12px}.nwh h1{font-size:17px}.nwh-back{font-size:13px;padding:7px 11px}}' +
    '@media print{.nwh{display:none!important}}';
  function buildHead() {
    if (!TOOL || OWN_HEAD[TOOL] || (script && script.getAttribute('data-head') === 'off')) return;
    var it = null;
    SIDE_ITEMS.forEach(function (x) { if (x.t === TOOL) it = x; });
    if (!it) return;
    var st = el('style'); st.textContent = headCss + (HIDE_OLD[TOOL] ? HIDE_OLD[TOOL] + '{display:none!important}' : '');
    document.head.appendChild(st);
    var h = el('header', 'nwh');
    function render() {
      var en = false; try { en = localStorage.getItem('hubLang') === 'en'; } catch (e) {}
      h.setAttribute('dir', en ? 'ltr' : 'rtl');
      h.innerHTML = '<div class="nwh-t"><span class="nwh-ic">' + it.ic + '</span><div style="min-width:0"><h1>' + esc(en ? it.en : it.ar) +
        '</h1><small>' + esc(en ? it.ar : it.en) + '</small></div></div>' +
        '<a class="nwh-back" href="' + HOME_URL + '">' + (en ? '← Operations Tools' : '← أدوات التشغيل') + '</a>';
    }
    render();
    document.body.insertBefore(h, document.body.firstChild);
    window.addEventListener('storage', function (ev) { if (ev.key === 'hubLang') render(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
