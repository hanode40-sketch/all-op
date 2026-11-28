/******************************************************************
 *  الترجمة الموحدة — Northwest Bus · أدوات التشغيل
 *  للبرامج اللي ما لها ترجمة داخلية: يترجم نصوص الصفحة للإنجليزي حسب اختيار اللغة (hubLang)
 *  ويرجعها للعربي — ويتابع أي محتوى يتغير في الصفحة.
 *
 *  <script src="https://hanode40-sketch.github.io/all-op/i18n.js"></script>
 *  <script>NWI18N.add({ 'نص عربي': 'English text', ... }, [[/^(\d+) غرفة$/, '$1 rooms']]);</script>
 *
 *  عنصر ما يتترجم: class="notranslate" أو data-noi18n
 ******************************************************************/
(function () {
  'use strict';
  if (window.NWI18N) return;
  var KEY = 'hubLang', DICT = {}, RX = [], WRX = null, WRXL = null, LANG = 'ar', BUSY = false;
  var TXT = new WeakMap(), ATT = new WeakMap(), ATTRS = ['placeholder', 'title', 'aria-label', 'data-tip'];
  var SCR = document.currentScript, NOBTN = !!(SCR && SCR.hasAttribute('data-nobtn'));   // البرامج اللي لها زر لغة خاص
  var root = document.documentElement, AR_DIR = root.getAttribute('dir') || 'rtl', AR_LANG = root.getAttribute('lang') || 'ar';

  function read() { try { return localStorage.getItem(KEY) === 'en' ? 'en' : 'ar'; } catch (e) { return 'ar'; } }
  var hasAr = function (s) { return /[؀-ۿ]/.test(s); };
  var esc = function (s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); };

  function build() {
    var keys = Object.keys(DICT).filter(function (k) { return k.length > 1; }).sort(function (a, b) { return b.length - a.length; });
    // الكلمة كاملة فقط (ما نبدّل جزء من كلمة)
    WRX = keys.length ? new RegExp('(^|[^\\u0621-\\u065F\\u0671-\\u06D3])(' + keys.map(esc).join('|') + ')(?=$|[^\\u0621-\\u065F\\u0671-\\u06D3])', 'g') : null;
    var lk = keys.filter(function (k) { return k.length >= 12; });   // العبارات الطويلة أول (قبل أنماط الأرقام)
    WRXL = lk.length ? new RegExp('(^|[^\\u0621-\\u065F\\u0671-\\u06D3])(' + lk.map(esc).join('|') + ')(?=$|[^\\u0621-\\u065F\\u0671-\\u06D3])', 'g') : null;
  }
  /** ترجمة نص: مطابقة كاملة ← أنماط ← استبدال العبارات المعروفة داخله */
  function tr(s) {
    if (s == null) return s;
    s = String(s);
    if (!hasAr(s)) return s;
    var t = s.trim();
    if (Object.prototype.hasOwnProperty.call(DICT, t)) return s.replace(t, DICT[t]);
    for (var i = 0; i < RX.length; i++) if (!RX[i][2]) { RX[i][0].lastIndex = 0; if (RX[i][0].test(t)) return s.replace(t, t.replace(RX[i][0], RX[i][1])); }   // نمط للنص كامل
    var out = WRXL ? s.replace(WRXL, function (m, pre, w) { return pre + DICT[w]; }) : s;
    for (var j = 0; j < RX.length; j++) if (RX[j][2]) out = out.replace(RX[j][0], RX[j][1]);   // أنماط داخل النص (قبل الكلمات)
    if (WRX) out = out.replace(WRX, function (m, pre, w) { return pre + DICT[w]; });
    out = out.replace(/،/g, ',').replace(/؟/g, '?').replace(/؛/g, ';');
    // كل شي أو لا شي: لو بقي عربي (بيانات مثل وصف المخالفة أو اسم مدينة) نخلي النص الأصلي كما هو بدل خلط اللغتين
    return /[\u0621-\u064A]/.test(out) ? s : out;
  }

  function skip(el) {
    for (var n = el; n && n.nodeType === 1; n = n.parentNode) {
      var tg = n.tagName;
      if (tg === 'SCRIPT' || tg === 'STYLE' || tg === 'TEXTAREA' || tg === 'NOSCRIPT' || tg === 'CODE') return true;
      if (n.isContentEditable || n.hasAttribute('data-noi18n') || (n.classList && n.classList.contains('notranslate'))) return true;
    }
    return false;
  }
  function doText(node) {
    var cur = node.nodeValue, o = TXT.get(node);
    if (o === undefined || (cur !== o.t && cur !== o.o)) { o = { o: cur, t: null }; TXT.set(node, o); }   // البرنامج غيّر النص: نعتبره الأصل الجديد
    if (LANG === 'en') { if (!hasAr(o.o)) return; o.t = tr(o.o); if (cur !== o.t) node.nodeValue = o.t; }
    else if (cur !== o.o) node.nodeValue = o.o;
  }
  function doAttrs(el) {
    var m = ATT.get(el) || {};
    ATTRS.forEach(function (a) {
      if (!el.hasAttribute(a)) return;
      var cur = el.getAttribute(a), o = m[a];
      if (!o || (cur !== o.t && cur !== o.o)) o = m[a] = { o: cur, t: null };
      if (LANG === 'en') { if (!hasAr(o.o)) return; o.t = tr(o.o); if (cur !== o.t) el.setAttribute(a, o.t); }
      else if (cur !== o.o) el.setAttribute(a, o.o);
    });
    if (el.tagName === 'INPUT' && /^(button|submit|reset)$/i.test(el.type)) {
      var cv = el.value, ov = m.__v;
      if (!ov || (cv !== ov.t && cv !== ov.o)) ov = m.__v = { o: cv, t: null };
      if (LANG === 'en') { if (hasAr(ov.o)) { ov.t = tr(ov.o); if (cv !== ov.t) el.value = ov.t; } }
      else if (cv !== ov.o) el.value = ov.o;
    }
    ATT.set(el, m);
  }
  function walk(n) {
    if (!n) return;
    if (n.nodeType === 3) { if (n.parentNode && !skip(n.parentNode)) doText(n); return; }
    if (n.nodeType !== 1 && n.nodeType !== 9 && n.nodeType !== 11) return;
    if (n.nodeType === 1) { if (skip(n)) return; doAttrs(n); }
    var w = document.createTreeWalker(n, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: function (x) { return x.nodeType === 1 && skip(x) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; }
    });
    var x; while ((x = w.nextNode())) { if (x.nodeType === 3) doText(x); else doAttrs(x); }
  }
  function apply() {
    BUSY = true;
    try {
      if (LANG === 'en') { root.setAttribute('dir', 'ltr'); root.setAttribute('lang', 'en'); }
      else { root.setAttribute('dir', AR_DIR); root.setAttribute('lang', AR_LANG); }
      if (document.title) { var t = document.title, o = TXT.get(document); if (!o || (t !== o.t && t !== o.o)) { o = { o: t, t: null }; TXT.set(document, o); } o.t = LANG === 'en' ? tr(o.o) : o.o; document.title = o.t; }
      if (document.body) walk(document.body);
      btn();
    } finally { BUSY = false; mo && mo.takeRecords(); }
  }
  var mo = null, pend = [], timer = 0;
  function flush() {
    timer = 0; var list = pend; pend = [];
    if (LANG !== 'en' && !list.some(function (n) { return TXT.has(n); })) return;
    BUSY = true;
    try { list.forEach(function (n) { if (n.isConnected !== false) walk(n); }); } finally { BUSY = false; mo.takeRecords(); }
  }
  function observe() {
    if (mo || !window.MutationObserver) return;
    mo = new MutationObserver(function (recs) {
      if (BUSY) return;
      recs.forEach(function (r) {
        if (r.type === 'characterData') pend.push(r.target);
        else if (r.type === 'attributes') pend.push(r.target);
        else r.addedNodes.forEach(function (n) { pend.push(n); });
      });
      if (pend.length && !timer) timer = (window.queueMicrotask ? (queueMicrotask(flush), 1) : setTimeout(flush, 0));
    });
    mo.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS.concat(['value']) });
  }

  /* زر اللغة للشاشات الصغيرة (على الكمبيوتر الزر في القائمة الجانبية) */
  function btn() {
    if (!document.body) return;
    return;   // الزر العائم مخفي (طلب الإدارة 11/2026) — تبديل اللغة من القائمة الجانبية أو زر اللغة داخل البرامج، والاختيار يتطبق على كل البرامج
    var b = document.getElementById('nwi18n-btn');
    if (!b) {
      if (document.getElementById('lang-btn')) return;
      b = document.createElement('button'); b.id = 'nwi18n-btn'; b.type = 'button'; b.setAttribute('data-noi18n', '');
      b.style.cssText = 'position:fixed;bottom:14px;inset-inline-start:14px;z-index:99990;font:700 13px/1 system-ui,Tahoma,sans-serif;padding:9px 12px;border-radius:999px;border:1px solid rgba(0,0,0,.15);background:#fff;color:#1f3f7a;box-shadow:0 4px 14px rgba(0,0,0,.2);cursor:pointer';
      b.onclick = function () { set(LANG === 'en' ? 'ar' : 'en'); };
      var st = document.createElement('style'); st.textContent = '@media screen and (min-width:1100px){html.nws-on #nwi18n-btn{display:none}}@media print{#nwi18n-btn{display:none}}';
      document.head.appendChild(st); document.body.appendChild(b);
    }
    b.textContent = LANG === 'en' ? '🌐 العربية' : '🌐 English';
  }
  function set(l) {
    LANG = l === 'en' ? 'en' : 'ar';
    try { localStorage.setItem(KEY, LANG); } catch (e) {}
    apply();
    try { window.dispatchEvent(new CustomEvent('nwlang', { detail: LANG })); } catch (e) {}
  }

  // رسائل التأكيد والتنبيه
  ['alert', 'confirm', 'prompt'].forEach(function (k) {
    var f = window[k]; if (!f) return;
    window[k] = function (m) { var a = [].slice.call(arguments); if (LANG === 'en') a[0] = tr(m); return f.apply(window, a); };
  });
  window.addEventListener('storage', function (e) { if (e.key === KEY) { var l = e.newValue === 'en' ? 'en' : 'ar'; if (l !== LANG) { LANG = l; apply(); } } });

  window.NWI18N = {
    add: function (dict, rx) { for (var k in dict) DICT[k.trim()] = dict[k]; (rx || []).forEach(function (r) { RX.push(r); }); build(); if (document.body && LANG === 'en') apply(); },
    t: function (s) { return LANG === 'en' ? tr(s) : s; },
    lang: function () { return LANG; },
    set: set, apply: apply
  };
  LANG = read();
  function start() { observe(); apply(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
