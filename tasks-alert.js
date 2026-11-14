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

  var T = {
    ar: { mine: function (n) { return 'لديك مهام لم تقم بتأكيد إنجازها (' + n + ')'; },
          over: function (n) { return n + ' متأخرة'; }, high: function (n) { return n + ' عاجلة'; },
          list: function (a, b) { return 'قائمة الوردية اليومية: ' + a + ' من ' + b; },
          follow: function (n) { return 'لديك مهام كلّفت بها غيرك ولم يتم تأكيد إنجازها (' + n + ' متأخرة)'; },
          due: 'الموعد', open: 'فتح المهام ←', lateTag: 'متأخرة', newTag: 'جديدة', doingTag: 'قيد التنفيذ' },
    en: { mine: function (n) { return 'You have tasks you have not confirmed as done (' + n + ')'; },
          over: function (n) { return n + ' overdue'; }, high: function (n) { return n + ' urgent'; },
          list: function (a, b) { return 'Daily shift checklist: ' + a + ' of ' + b; },
          follow: function (n) { return 'Tasks you assigned have not been confirmed as done (' + n + ' overdue)'; },
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
    '.nta{display:block;text-decoration:none!important;margin:0 0 22px;border-radius:16px;padding:14px 16px;color:#7c2d12;' +
      'background:linear-gradient(135deg,#fff7ed,#ffedd5);border:1px solid #fdba74;box-shadow:0 8px 24px rgba(10,25,55,.16);cursor:pointer;transition:transform .15s}' +
    '.nta:hover{transform:translateY(-2px)}' +
    '.nta.bad{color:#7f1d1d;background:linear-gradient(135deg,#fef2f2,#fee2e2);border-color:#fca5a5}' +
    '.nta-h{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-weight:800;font-size:16px}' +
    '.nta-bell{font-size:22px;animation:ntaR 2.4s ease-in-out infinite;transform-origin:50% 0}' +
    '@keyframes ntaR{0%,80%,100%{transform:rotate(0)}85%{transform:rotate(14deg)}90%{transform:rotate(-12deg)}95%{transform:rotate(8deg)}}' +
    '.nta-chips{display:flex;gap:6px;flex-wrap:wrap}' +
    '.nta-chip{font-size:12px;font-weight:700;padding:3px 10px;border-radius:999px;background:rgba(255,255,255,.75)}' +
    '.nta-chip.r{background:#dc2626;color:#fff}.nta-chip.o{background:#ea580c;color:#fff}' +
    '.nta-go{margin-inline-start:auto;font-size:13px;font-weight:700;background:#ea580c;color:#fff;padding:6px 12px;border-radius:999px;white-space:nowrap}' +
    '.nta.bad .nta-go{background:#dc2626}' +
    '.nta-l{margin:10px 0 0;padding:0;list-style:none;font-size:13.5px}' +
    '.nta-l li{display:flex;gap:8px;align-items:center;padding:6px 0;border-top:1px dashed rgba(124,45,18,.2)}' +
    '.nta-l li b{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.nta-l li small{opacity:.8;white-space:nowrap}' +
    '.nta-x{font-size:13px;margin-top:8px;font-weight:600}' +
    'a.card[data-tool="tasks"]{position:relative}' +
    '.nta-badge{position:absolute;top:10px;inset-inline-end:10px;min-width:24px;height:24px;padding:0 7px;border-radius:999px;background:#dc2626;color:#fff;' +
      'font-size:13px;font-weight:800;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(220,38,38,.45)}' +
    'html[data-theme="dark"] .nta{color:#fed7aa;background:linear-gradient(135deg,#2a1a0e,#3a2210);border-color:#9a3412}' +
    'html[data-theme="dark"] .nta.bad{color:#fecaca;background:linear-gradient(135deg,#2a1215,#3a1519);border-color:#991b1b}' +
    'html[data-theme="dark"] .nta-chip{background:rgba(255,255,255,.1)}html[data-theme="dark"] .nta-l li{border-color:rgba(255,255,255,.12)}' +
    '@media (max-width:600px){.nta-go{margin-inline-start:0}}';

  var root, D = null;
  function render() {
    if (!root) return;
    var badge = document.querySelector('a.card[data-tool="tasks"] .nta-badge');
    if (!D || !D.me) { root.innerHTML = ''; if (badge) badge.remove(); return; }
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

    if (!mine.length && !follow.length && !clOpen) { root.innerHTML = ''; return; }
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
      '<div class="nta-h"><span class="nta-bell">🔔</span><span>' + esc(head) + '</span><span class="nta-chips">' + chips + '</span><span class="nta-go">' + esc(L.open) + '</span></div>' +
      (list ? '<ul class="nta-l">' + list + '</ul>' : '') + extra + '</a>';
  }

  function load() {
    if (!window.NWAuth) return;
    fetch(TASKS_URL + '?action=boot&month=&authToken=' + encodeURIComponent(NWAuth.token()))
      .then(function (r) { return r.json(); })
      .then(function (j) { if (j && j.ok !== false && j.me) { D = j; render(); } })
      .catch(function () {});
  }

  function mount() {
    root = document.getElementById('nw-task-alert');
    if (!root || !window.NWAuth) return;
    if (NWAuth.can && !NWAuth.can('tasks')) { root.style.display = 'none'; return; }
    var s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
    load();
    setInterval(load, REFRESH_MS);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) load(); });
    window.addEventListener('storage', function (e) { if (e.key === 'hubLang') setTimeout(render, 30); });
    new MutationObserver(function () { setTimeout(render, 30); }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
