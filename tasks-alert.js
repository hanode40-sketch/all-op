/******************************************************************
 *  تنبيه المهام في الصفحة الرئيسية — Northwest Bus · أدوات التشغيل
 *  يقرأ من Apps Script برنامج المهام ويعرض:
 *   - مهامك اللي ما انتهت (والمتأخرة منها)
 *   - قائمة الوردية اليومية إذا ما اكتملت
 *   - المهام اللي كلّفت بها غيرك وتأخرت (للمشرف والمدير)
 *  يتركّب تلقائياً في <div id="nw-task-alert"></div>
 ******************************************************************/
(function () {
  var TASKS_URL = 'https://script.google.com/macros/s/AKfycbzd8yDSxYL_Qt4JLaaTpqRG4IOAkhuGTx9mY98NevDqseiTyOmSWfZpIr9YOTxy51iVvQ/exec';
  var TASKS_PAGE = 'https://hanode40-sketch.github.io/tasks/';
  var REFRESH_MS = 5 * 60 * 1000;
  var VIOL_URL = 'https://script.google.com/macros/s/AKfycbynHzaInTH3aul1LCv2_w6FkEZ0_r-24P9Tw5P8WuhNqgHI-8H5yuU8tOl1Uko3OVl4Ag/exec';
  var VIOL_PAGE = 'https://hanode40-sketch.github.io/violation/';
  var VC = null;   // عدد المحاضر حسب الحالة

  var T = {
    ar: { mine: function (n) { return 'لديك مهام لم تقم بتأكيد إنجازها (' + n + ')'; },
          over: function (n) { return n + ' متأخرة'; }, high: function (n) { return n + ' عاجلة'; },
          list: function (a, b) { return 'قائمة الوردية اليومية: ' + a + ' من ' + b; },
          follow: function (n) { return 'لديك مهام كلّفت بها غيرك ولم يتم تأكيد إنجازها (' + n + ' متأخرة)'; },
          viol: function (a, b) { return 'محاضر مخالفات بانتظار إجراء: ' + a + ' معلّقة' + (b ? ' · ' + b + ' محوّلة للتحقيق' : ''); }, openV: 'فتح المحاضر ←',
          due: 'الموعد', open: 'فتح المهام ←', lateTag: 'متأخرة', newTag: 'جديدة', doingTag: 'قيد التنفيذ' },
    en: { mine: function (n) { return 'You have tasks you have not confirmed as done (' + n + ')'; },
          over: function (n) { return n + ' overdue'; }, high: function (n) { return n + ' urgent'; },
          list: function (a, b) { return 'Daily shift checklist: ' + a + ' of ' + b; },
          follow: function (n) { return 'Tasks you assigned have not been confirmed as done (' + n + ' overdue)'; },
          viol: function (a, b) { return 'Violation reports awaiting action: ' + a + ' pending' + (b ? ' · ' + b + ' under investigation' : ''); }, openV: 'Open reports →',
          due: 'Due', open: 'Open tasks →', lateTag: 'Overdue', newTag: 'New', doingTag: 'In progress' }
  };
  function lang() { try { return localStorage.getItem('hubLang') === 'en' ? 'en' : 'ar'; } catch (e) { return 'ar'; } }
  function t() { return T[lang()]; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function dueDate(s) { var m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/); return m ? new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5]) : null; }
  function isOpen(x) { return x.status === 'new' || x.status === 'doing'; }
  function isOver(x) { var d = dueDate(x.due); return isOpen(x) && d && d < new Date(); }
  function fmtDue(s) {
    var d = dueDate(s); if (!d) return '';
    try { return d.toLocaleString(lang() === 'en' ? 'en-GB' : 'ar-SA-u-ca-gregory-nu-latn', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return s; }
  }

  var css =
    '.nta{display:block;text-decoration:none!important;margin:0 0 12px;border-radius:14px;padding:14px 18px;color:var(--nw-ink,#0f172a);' +
      'background:var(--nw-card,#fff);border:1px solid var(--nw-line,#e2e8f0);border-inline-start:4px solid #d97706;box-shadow:var(--nw-shadow,0 1px 3px rgba(0,0,0,.06));cursor:pointer;transition:transform .15s,box-shadow .15s}' +
    '.nta:hover{transform:translateY(-1px)}' +
    '.nta.bad{border-inline-start-color:#dc2626}' +
    '.nta-h{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-weight:700;font-size:15px}' +
    '.nta-bell{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:10px;font-size:17px;background:#fef3c7;color:#b45309;flex-shrink:0}' +
    '.nta.bad .nta-bell{background:#fee2e2;color:#b91c1c}' +
    '.nta-chips{display:flex;gap:6px;flex-wrap:wrap}' +
    '.nta-chip{font-size:12px;font-weight:600;padding:3px 10px;border-radius:999px;background:var(--nw-soft,#f1f5f9);color:var(--nw-muted,#64748b);border:1px solid var(--nw-line,#e2e8f0)}' +
    '.nta-chip.r{background:#fee2e2;color:#b91c1c;border-color:#fecaca}.nta-chip.o{background:#ffedd5;color:#c2410c;border-color:#fed7aa}' +
    '.nta-go{margin-inline-start:auto;font-size:13px;font-weight:700;background:transparent;color:var(--nw-ink,#0f172a);border:1px solid var(--nw-line,#e2e8f0);padding:6px 14px;border-radius:10px;white-space:nowrap}' +
    '.nta:hover .nta-go{background:var(--nw-navy,#13274f);border-color:var(--nw-navy,#13274f);color:#fff}' +
    '.nta-l{margin:10px 0 0;padding:0;list-style:none;font-size:13.5px}' +
    '.nta-l li{display:flex;gap:8px;align-items:center;padding:7px 0;border-top:1px solid var(--nw-line,#eef2f7)}' +
    '.nta-l li b{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}' +
    '.nta-l li small{color:var(--nw-muted,#64748b);white-space:nowrap}' +
    '.nta-x{font-size:13px;margin-top:8px;font-weight:500;color:var(--nw-muted,#64748b)}' +
    'a.card[data-tool="tasks"]{position:relative}' +
    '.nta-badge{position:absolute;top:10px;inset-inline-end:10px;min-width:22px;height:22px;padding:0 7px;border-radius:999px;background:#dc2626;color:#fff;' +
      'font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center}' +
    'html[data-theme="dark"] .nta-bell{background:#3a2a12;color:#fbbf24}html[data-theme="dark"] .nta.bad .nta-bell{background:#3a1e22;color:#fca5a5}' +
    'html[data-theme="dark"] .nta-chip.r{background:#3a1e22;color:#fca5a5;border-color:#5b2329}html[data-theme="dark"] .nta-chip.o{background:#3a2412;color:#fdba74;border-color:#5b3a1c}' +
    '@media (max-width:600px){.nta-go{margin-inline-start:0}}';

  var root, D = null;
  function violHtml() {
    if (!VC) return '';
    var a = VC['معلّق'] || 0, b = 0;   // محوّل للتحقيق = انتهى الإجراء
    if (!a) return '';
    return '<a class="nta" href="' + VIOL_PAGE + '"><div class="nta-h"><span class="nta-bell">' + (window.NWIcon ? NWIcon('violation', 18) : '📝') + '</span><span>' + esc(t().viol(a, b)) +
      '</span><span class="nta-go">' + esc(t().openV) + '</span></div></a>';
  }
  function render() {
    if (!root) return;
    var badge = document.querySelector('a.card[data-tool="tasks"] .nta-badge');
    if (!D || !D.me) { root.innerHTML = violHtml(); if (badge) badge.remove(); return; }
    var me = D.me.u, L = t();
    var tasks = D.tasks || [];
    var mine = tasks.filter(function (x) { return x.to === me && isOpen(x); });
    var mineOver = mine.filter(isOver), mineHigh = mine.filter(function (x) { return x.prio === 'high'; });
    var follow = tasks.filter(function (x) { return x.by === me && x.to !== me && isOver(x); });
    var cl = D.checklist || [], clDone = cl.filter(function (c) { return c.done; }).length;
    var clOpen = cl.length && clDone < cl.length;

    // شارة العدد على بطاقة المهام
    var card = document.querySelector('a.card[data-tool="tasks"]');
    if (card) {
      if (mine.length) { if (!badge) { badge = document.createElement('span'); badge.className = 'nta-badge'; card.appendChild(badge); } badge.textContent = mine.length; }
      else if (badge) badge.remove();
    }

    if (!mine.length && !follow.length && !clOpen) { root.innerHTML = violHtml(); return; }
    var bad = mineOver.length || follow.length;
    var chips = '';
    if (mineOver.length) chips += '<span class="nta-chip r">🔴 ' + esc(L.over(mineOver.length)) + '</span>';
    if (mineHigh.length) chips += '<span class="nta-chip o">🟠 ' + esc(L.high(mineHigh.length)) + '</span>';
    var head = mine.length ? L.mine(mine.length) : (follow.length ? L.follow(follow.length) : L.list(clDone, cl.length));
    var list = mine.slice().sort(function (a, b) { return (isOver(b) - isOver(a)) || String(a.due).localeCompare(String(b.due)); }).slice(0, 4)
      .map(function (x) {
        var tag = isOver(x) ? '🔴' : x.prio === 'high' ? '🟠' : '🔵';
        return '<li><span>' + tag + '</span><b>' + esc(x.title) + '</b><small>' + esc(L.due) + ': ' + esc(fmtDue(x.due)) + '</small></li>';
      }).join('');
    var extra = '';
    if (mine.length && clOpen) extra += '<div class="nta-x">📋 ' + esc(L.list(clDone, cl.length)) + '</div>';
    if (mine.length && follow.length) extra += '<div class="nta-x">👀 ' + esc(L.follow(follow.length)) + '</div>';
    if (!mine.length && follow.length && clOpen) extra += '<div class="nta-x">📋 ' + esc(L.list(clDone, cl.length)) + '</div>';
    root.innerHTML = '<a class="nta' + (bad ? ' bad' : '') + '" href="' + TASKS_PAGE + '">' +
      '<div class="nta-h"><span class="nta-bell">' + (window.NWIcon ? NWIcon('bell', 18) : '🔔') + '</span><span>' + esc(head) + '</span><span class="nta-chips">' + chips + '</span><span class="nta-go">' + esc(L.open) + '</span></div>' +
      (list ? '<ul class="nta-l">' + list + '</ul>' : '') + extra + '</a>' + violHtml();
  }

  function loadViol() {
    if (!window.NWAuth || !(NWAuth.role === 'مدير' || NWAuth.role === 'مدير تنفيذي' || NWAuth.role === 'مشرف')) return;
    if (NWAuth.can && !NWAuth.can('violation')) return;
    fetch(VIOL_URL + '?action=summary&authToken=' + encodeURIComponent(NWAuth.token()))
      .then(function (r) { return r.json(); })
      .then(function (j) { if (j && j.ok && j.counts) { VC = j.counts; render(); } })
      .catch(function () {});
  }
  function load() {
    loadViol();
    if (!window.NWAuth) return;
    if (NWAuth.can && !NWAuth.can('tasks')) return;
    fetch(TASKS_URL + '?action=boot&month=&authToken=' + encodeURIComponent(NWAuth.token()))
      .then(function (r) { return r.json(); })
      .then(function (j) { if (j && j.ok !== false && j.me) { D = j; render(); } })
      .catch(function () {});
  }

  function mount() {
    root = document.getElementById('nw-task-alert');
    if (!root || !window.NWAuth) return;
    var s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
    load();
    setInterval(load, REFRESH_MS);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) load(); });
    window.addEventListener('storage', function (e) { if (e.key === 'hubLang') setTimeout(render, 30); });
    new MutationObserver(function () { setTimeout(render, 30); }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
