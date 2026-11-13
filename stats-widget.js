/******************************************************************
 *  إحصائيات العمل — ملف مشترك (الصفحة الرئيسية + stats.html)
 *  يقرأ من «سجل النشاط» (نفس مصدر صفحة أداء الموظفين)
 *  - NWStats.mountHub(el): ملخص المؤشرات في الصفحة الرئيسية
 *  - NWStats.details({...}): نافذة تفاصيل أي مؤشر
 ******************************************************************/
(function () {
  var AUTH_URL = 'https://script.google.com/macros/s/AKfycbweMNQs14aIiDJ-yH9yu3KXubnfsrtFnuC58eIryvWUwLe6kB_-cA_p6a6TRazK--Ft/exec';
  var LOGIN_TOOL = 'الدخول';
  var HOME = 'https://hanode40-sketch.github.io/all-op/';

  var TOOLS = {
    'تسليم الوردية':  { c:'#f59e0b', en:'Shift Handover' },
    'المهام':         { c:'#16a34a', en:'Tasks' },
    'مسار الرحلة':    { c:'#0d9488', en:'Trip Route' },
    'محضر المخالفة':  { c:'#dc2626', en:'Violation Report' },
    'تقرير الحوادث':  { c:'#ea580c', en:'Accident Report' },
    'تقييم السائقين': { c:'#2563eb', en:'Driver Evaluation' },
    'استلام الزي':    { c:'#7c3aed', en:'Uniform Receipt' },
    'لوحة السائقين':  { c:'#0891b2', en:'Drivers Dashboard' }
  };
  var EXTRA = ['#64748b','#db2777','#65a30d','#9333ea','#0284c7'], extraMap = {}, extraI = 0;
  var OP_EN = { 'تسليم وردية':'Shift handover', 'تعديل تسليم':'Edit handover', 'استلام وردية':'Shift received', 'حذف تسليم':'Delete handover',
    'تقرير حادث':'Accident report', 'تقييم سائق':'Driver evaluation', 'حذف تقييم':'Delete evaluation', 'تكليف مهمة':'Assign task', 'بدء مهمة':'Start task',
    'إنجاز مهمة':'Complete task', 'إلغاء مهمة':'Cancel task', 'بند القائمة اليومية':'Checklist item', 'إرسال مسار رحلة':'Send trip route',
    'إرسال بطاقة جدول رحلة':'Send duty card', 'محضر مخالفة':'Violation report' };

  var T = {
    ar: { secTitle:'إحصائيات العمل', allStats:'كل الإحصائيات ←', today:'اليوم', thisMonth:'هذا الشهر', lastMonth:'الشهر السابق',
      kTotal:'إجمالي العمليات', kUsers:'موظف نشط', kAvg:'متوسط يومي', kPeak:'أكثر يوم عمل',
      oAcc:'الحوادث', oViol:'المخالفات', oEval:'تقييمات السائقين', oTrip:'رسائل الرحلات', oTasks:'إنجاز المهام', oShift:'تأكيد استلام الورديات',
      vsPrev:'عن نفس الفترة من الشهر السابق', vsYest:'عن أمس', noPrev:'', perDay:'عملية / يوم', ofUsers:'من أصل', ops:'عملية',
      done:'منجزة', of:'من', received:'مستلمة', none:'لا يوجد', tapHint:'اضغط على أي مؤشر لعرض التفاصيل', loading:'جاري التحميل...',
      eNet:'تعذّر تحميل الإحصائيات — تأكد من الإنترنت', eAuth:'انتهت مدة الدخول — سجّل دخول من جديد', retry:'إعادة المحاولة',
      close:'إغلاق', search:'بحث بالاسم أو المرجع أو التفاصيل...', export:'تصدير Excel', records:'سجل', more:'عرض المزيد',
      byUser:'حسب الموظف', byGarage:'حسب الكراج', byTool:'حسب البرنامج', byAct:'حسب العملية', list:'السجلات', noRec:'لا توجد سجلات',
      hTime:'الوقت', hEmp:'الموظف', hTool:'البرنامج', hOp:'العملية', hRef:'المرجع', hDetails:'تفاصيل', unassigned:'غير محدد',
      pending:'بانتظار', pendShift:'ورديات مسلّمة لم يتأكد استلامها', pendTask:'مهام مكلّفة لم تُنجز', inactive:'موظفين بدون أي عملية',
      days:['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'] },
    en: { secTitle:'Work statistics', allStats:'All statistics →', today:'Today', thisMonth:'This month', lastMonth:'Last month',
      kTotal:'Total operations', kUsers:'Active employees', kAvg:'Daily average', kPeak:'Busiest day',
      oAcc:'Accidents', oViol:'Violations', oEval:'Driver evaluations', oTrip:'Trip messages', oTasks:'Task completion', oShift:'Shift receipt confirmed',
      vsPrev:'vs same period last month', vsYest:'vs yesterday', noPrev:'', perDay:'ops / day', ofUsers:'of', ops:'ops',
      done:'done', of:'of', received:'received', none:'None', tapHint:'Tap any indicator to see the details', loading:'Loading...',
      eNet:'Could not load statistics — check your internet', eAuth:'Session expired — sign in again', retry:'Retry',
      close:'Close', search:'Search name, reference or details...', export:'Export Excel', records:'records', more:'Show more',
      byUser:'By employee', byGarage:'By garage', byTool:'By tool', byAct:'By operation', list:'Records', noRec:'No records',
      hTime:'Time', hEmp:'Employee', hTool:'Tool', hOp:'Operation', hRef:'Reference', hDetails:'Details', unassigned:'Unassigned',
      pending:'Pending', pendShift:'Handed-over shifts not yet confirmed', pendTask:'Assigned tasks not completed', inactive:'Employees with no operations',
      days:['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'] }
  };

  /* ---------- أدوات عامة ---------- */
  function lang() { try { return localStorage.getItem('hubLang') === 'en' ? 'en' : 'ar'; } catch (e) { return 'ar'; } }
  function t(k) { var L = T[lang()]; return L[k] != null ? L[k] : (T.ar[k] != null ? T.ar[k] : k); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function nf(n) { return Number(n).toLocaleString('en-US'); }
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function thisMonth() { return dkey(new Date()).slice(0, 7); }
  function prevMonth(m) { var a = m.split('-').map(Number), y = a[0], mm = a[1] - 1; if (!mm) { mm = 12; y--; } return y + '-' + pad(mm); }
  function toolName(x) { return lang() === 'en' ? ((TOOLS[x] || {}).en || x) : x; }
  function opName(x) { return lang() === 'en' ? (OP_EN[String(x).trim()] || x) : x; }
  function toolColor(x) { if (TOOLS[x]) return TOOLS[x].c; if (!extraMap[x]) extraMap[x] = EXTRA[extraI++ % EXTRA.length]; return extraMap[x]; }
  function fmt(iso) { try { return new Date(iso).toLocaleString(lang() === 'en' ? 'en-GB' : 'ar-SA-u-ca-gregory-nu-latn', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }); } catch (e) { return iso; } }
  function act(r) { return String(r[4] == null ? '' : r[4]).trim(); }
  function isDel(r) { return /حذف|delete/i.test(act(r)); }

  /* ---------- البيانات ---------- */
  var cache = {};
  function fetchMonth(month, force) {
    if (!force && cache[month] && Date.now() - cache[month].at < 60000) return cache[month].p;
    var p = fetch(AUTH_URL, { method:'POST', body: JSON.stringify({ action:'activity', token: window.NWAuth ? NWAuth.token() : '', month: month }) })
      .then(function (r) { return r.json(); });
    cache[month] = { at: Date.now(), p: p };
    p.catch(function () { delete cache[month]; });
    return p;
  }
  var USERS = [];
  function setUsers(u) { if (u && u.length) USERS = u; }
  function userGarages(u) {
    var x = USERS.find(function (v) { return v.u === u; }), g = x && (x.g || x.garages);
    return Array.isArray(g) ? g : (g ? String(g).split(/[,،]/).map(function (s) { return s.trim(); }).filter(Boolean) : []);
  }
  function allGarages() { var s = {}; USERS.forEach(function (x) { userGarages(x.u).forEach(function (g) { s[g] = 1; }); }); return Object.keys(s).sort(); }
  function opsRows(data, f) {
    f = f || {};
    return ((data && data.rows) || []).filter(function (r) {
      return r[3] && r[3] !== LOGIN_TOOL && (!f.tool || r[3] === f.tool) && (!f.garage || userGarages(r[1]).indexOf(f.garage) > -1);
    });
  }

  /* ---------- تعريف المؤشرات (مكان واحد لكل الصفحات) ---------- */
  function byAct(rows, a) { return rows.filter(function (r) { return act(r) === a; }); }
  function byToolNoDel(rows, tl) { return rows.filter(function (r) { return r[3] === tl && !isDel(r); }); }
  /** يقارن عمليتين بالمرجع (مثلاً: تسليم ↔ استلام) ويرجع غير المكتملة */
  function pairPending(aRows, bRows) {
    var refs = {}; bRows.forEach(function (r) { if (r[5]) refs[String(r[5]).trim()] = 1; });
    var withRef = aRows.filter(function (r) { return r[5]; });
    if (!withRef.length || !Object.keys(refs).length) return null;            // لا يوجد مرجع للمطابقة
    return aRows.filter(function (r) { return r[5] && !refs[String(r[5]).trim()]; });
  }
  function kpis(rows, prev, opt) {
    opt = opt || {};
    var days = opt.days || 1, totalUsers = opt.totalUsers || 0, vs = opt.vs || t('vsPrev');
    var dayCount = {}; rows.forEach(function (r) { var k = dkey(new Date(r[0])); dayCount[k] = (dayCount[k] || 0) + 1; });
    var peak = Object.keys(dayCount).sort(function (a, b) { return dayCount[b] - dayCount[a]; })[0];
    var activeSet = {}; rows.forEach(function (r) { activeSet[r[1]] = 1; });
    function P(fn) { return prev ? fn(prev) : null; }
    var acc = byAct(rows, 'تقرير حادث'), viol = byToolNoDel(rows, 'محضر المخالفة'), ev = byAct(rows, 'تقييم سائق'), trip = byToolNoDel(rows, 'مسار الرحلة');
    var tA = byAct(rows, 'تكليف مهمة'), tD = byAct(rows, 'إنجاز مهمة'), sH = byAct(rows, 'تسليم وردية'), sR = byAct(rows, 'استلام وردية');
    var tP = tA.length ? Math.round(Math.min(tD.length, tA.length) / tA.length * 100) : null;
    var sP = sH.length ? Math.round(Math.min(sR.length, sH.length) / sH.length * 100) : null;
    var peakLbl = peak ? new Date(peak + 'T12:00').toLocaleDateString(lang() === 'en' ? 'en-GB' : 'ar-SA-u-ca-gregory-nu-latn', { weekday:'long', day:'numeric', month:'short' }) : '—';
    var tasksRows = tA.concat(tD), shiftRows = sH.concat(sR);
    return [
      { id:'total', grp:'sum', ic:'📊', c:'#1f3f7a', lb:t('kTotal'), v:nf(rows.length), d:[rows.length, P(function (p) { return p.length; })], rows:rows },
      { id:'avg',   grp:'sum', ic:'📅', c:'#0d9488', lb:t('kAvg'), v:(rows.length / days).toFixed(1), sub:t('perDay'), rows:rows },
      { id:'users', grp:'sum', ic:'👥', c:'#7c3aed', lb:t('kUsers'), v:nf(Object.keys(activeSet).length), sub: totalUsers ? t('ofUsers') + ' ' + totalUsers : '', rows:rows, mode:'users' },
      { id:'peak',  grp:'sum', ic:'🔥', c:'#f59e0b', lb:t('kPeak'), v:peakLbl, small:true, sub: peak ? nf(dayCount[peak]) + ' ' + t('ops') : '', rows: rows.filter(function (r) { return dkey(new Date(r[0])) === peak; }) },
      { id:'acc',   grp:'ops', ic:'🚨', c:'#ea580c', lb:t('oAcc'), v:nf(acc.length), d:[acc.length, P(function (p) { return byAct(p, 'تقرير حادث').length; })], neg:true, rows:acc },
      { id:'viol',  grp:'ops', ic:'📝', c:'#dc2626', lb:t('oViol'), v:nf(viol.length), d:[viol.length, P(function (p) { return byToolNoDel(p, 'محضر المخالفة').length; })], neg:true, rows:viol },
      { id:'eval',  grp:'ops', ic:'⭐', c:'#2563eb', lb:t('oEval'), v:nf(ev.length), d:[ev.length, P(function (p) { return byAct(p, 'تقييم سائق').length; })], rows:ev },
      { id:'trip',  grp:'ops', ic:'🚌', c:'#0d9488', lb:t('oTrip'), v:nf(trip.length), d:[trip.length, P(function (p) { return byToolNoDel(p, 'مسار الرحلة').length; })], rows:trip },
      { id:'tasks', grp:'ops', ic:'✅', c:'#16a34a', lb:t('oTasks'), ring:tP, sub: tA.length ? nf(tD.length) + ' ' + t('done') + ' ' + t('of') + ' ' + nf(tA.length) : t('none'),
        rows:tasksRows, pending: pairPending(tA, tD), pendLbl:t('pendTask') },
      { id:'shift', grp:'ops', ic:'🔄', c:'#f59e0b', lb:t('oShift'), ring:sP, sub: sH.length ? nf(sR.length) + ' ' + t('received') + ' ' + t('of') + ' ' + nf(sH.length) : t('none'),
        rows:shiftRows, pending: pairPending(sH, sR), pendLbl:t('pendShift') }
    ].map(function (k) { k.vs = vs; return k; });
  }

  /* ---------- رسم البطاقات ---------- */
  function deltaHtml(k) {
    if (!k.d || k.d[1] == null) return '';
    var a = k.d[0], b = k.d[1];
    if (!b) return a ? '<span class="nst-dl up' + (k.neg ? ' neg' : '') + '">▲ ' + esc(k.vs) + '</span>' : '';
    var p = Math.round((a - b) / b * 100);
    if (!p) return '<span class="nst-dl">0% ' + esc(k.vs) + '</span>';
    return '<span class="nst-dl ' + (p > 0 ? 'up' : 'down') + (k.neg ? ' neg' : '') + '">' + (p > 0 ? '▲' : '▼') + ' ' + Math.abs(p) + '% ' + esc(k.vs) + '</span>';
  }
  function ring(p, color) {
    var r = 20, c = 2 * Math.PI * r, v = Math.max(0, Math.min(100, p));
    return '<svg width="52" height="52" viewBox="0 0 52 52"><circle cx="26" cy="26" r="' + r + '" fill="none" stroke="currentColor" stroke-opacity=".12" stroke-width="6"/>' +
      '<circle cx="26" cy="26" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="6" stroke-linecap="round" stroke-dasharray="' + (c * v / 100) + ' ' + c + '" transform="rotate(-90 26 26)"/>' +
      '<text x="26" y="30" text-anchor="middle" font-size="11" font-weight="700" fill="currentColor">' + v + '%</text></svg>';
  }
  var REG = {}, regI = 0;
  function reg(spec) { var id = 'k' + (++regI); REG[id] = spec; return id; }
  function tileHtml(k, extra) {
    var id = reg(k), body;
    if (k.ring !== undefined) {
      var col = k.ring == null ? '' : (k.ring >= (k.id === 'shift' ? 80 : 70) ? '#16a34a' : '#f59e0b');
      body = '<div class="nst-ring">' + (k.ring == null ? '<b class="nst-v">—</b>' : ring(k.ring, col)) + '<div class="nst-sub">' + esc(k.sub) + '</div></div>';
    } else {
      body = '<b class="nst-v' + (k.small ? ' sm' : '') + '">' + esc(k.v) + '</b><div class="nst-sub">' + (k.sub ? esc(k.sub) : '') + deltaHtml(k) + '</div>';
    }
    return '<button type="button" class="nst-tile ' + (extra || '') + '" style="--acc:' + k.c + '" data-nst="' + id + '"><span class="nst-lb">' + k.ic + ' ' + esc(k.lb) +
      '<i class="nst-go">' + (lang() === 'en' ? '›' : '‹') + '</i></span>' + body + '</button>';
  }

  /* ---------- نافذة التفاصيل ---------- */
  var css =
    '.nst-tile{all:unset;box-sizing:border-box;cursor:pointer;display:block;position:relative;overflow:hidden;background:#fff;border:1px solid rgba(15,23,42,.06);border-radius:16px;padding:14px 16px;' +
      'box-shadow:0 1px 2px rgba(15,23,42,.06),0 8px 24px rgba(10,25,55,.16);color:#0f172a;font-family:inherit;transition:transform .15s,box-shadow .15s;text-align:start}' +
    '.nst-tile:hover{transform:translateY(-3px);box-shadow:0 2px 4px rgba(15,23,42,.08),0 16px 32px rgba(10,25,55,.26)}' +
    '.nst-tile:focus-visible{outline:3px solid #f28c28;outline-offset:2px}' +
    '.nst-tile::before{content:"";position:absolute;inset-inline:0;top:0;height:4px;background:var(--acc)}' +
    '.nst-lb{display:flex;align-items:center;gap:6px;font-size:13px;color:#64748b;font-weight:600}' +
    '.nst-go{margin-inline-start:auto;font-style:normal;font-size:18px;color:#cbd5e1;line-height:1}' +
    '.nst-tile:hover .nst-go{color:var(--acc)}' +
    '.nst-v{display:block;font-size:28px;line-height:1.15;margin:6px 0 4px;font-weight:800}.nst-v.sm{font-size:18px;margin:10px 0 6px}' +
    '.nst-sub{font-size:12px;color:#64748b;display:flex;flex-wrap:wrap;gap:6px;align-items:center}' +
    '.nst-ring{display:flex;align-items:center;gap:12px;margin-top:6px}' +
    '.nst-dl{display:inline-block;font-size:11.5px;font-weight:700;padding:2px 8px;border-radius:999px;background:#eef2f7;color:#64748b}' +
    '.nst-dl.up{background:#e7f5ed;color:#15803d}.nst-dl.down{background:#fdecea;color:#b91c1c}.nst-dl.up.neg{background:#fdecea;color:#b91c1c}.nst-dl.down.neg{background:#e7f5ed;color:#15803d}' +
    /* قسم الصفحة الرئيسية */
    '.nst-hub{margin:0 0 30px}.nst-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px}' +
    '.nst-head h2{margin:0;color:#fff;font-size:18px;text-shadow:0 2px 8px rgba(0,0,0,.4);display:flex;align-items:center;gap:8px}' +
    '.nst-seg{display:inline-flex;background:rgba(255,255,255,.16);border-radius:999px;padding:3px;margin-inline-start:auto}' +
    '.nst-seg button{all:unset;cursor:pointer;color:#fff;font-size:13px;font-weight:700;padding:6px 12px;border-radius:999px}' +
    '.nst-seg button.on{background:#fff;color:#1f3f7a}' +
    '.nst-all{color:#fff;text-decoration:none;font-size:13px;font-weight:700;background:rgba(255,255,255,.16);padding:7px 12px;border-radius:999px;white-space:nowrap}' +
    '.nst-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.nst-grid+.nst-grid{margin-top:12px}' +
    '.nst-hint{color:rgba(255,255,255,.8);font-size:12px;margin-top:8px;text-shadow:0 1px 4px rgba(0,0,0,.4)}' +
    '.nst-msg{background:rgba(255,255,255,.92);border-radius:14px;padding:16px;text-align:center;color:#64748b;font-size:14px}' +
    '.nst-msg button{all:unset;cursor:pointer;color:#1f3f7a;font-weight:700;margin-inline-start:8px;text-decoration:underline}' +
    '.nst-skel{height:104px;border-radius:16px;background:linear-gradient(90deg,rgba(255,255,255,.55),rgba(255,255,255,.8),rgba(255,255,255,.55));background-size:200% 100%;animation:nstsk 1.2s infinite}' +
    '@keyframes nstsk{0%{background-position:200% 0}100%{background-position:-200% 0}}' +
    '@media (max-width:820px){.nst-grid{grid-template-columns:1fr 1fr}.nst-v{font-size:24px}.nst-seg{margin-inline-start:0}.nst-head h2{width:100%}}' +
    /* النافذة */
    '.nst-ov{position:fixed;inset:0;z-index:100000;background:rgba(8,15,30,.55);display:flex;align-items:flex-start;justify-content:center;padding:4vh 12px;overflow-y:auto;animation:nstf .15s}' +
    '@keyframes nstf{from{opacity:0}to{opacity:1}}@keyframes nstu{from{transform:translateY(14px);opacity:.6}to{transform:none;opacity:1}}' +
    '.nst-md{background:#fff;color:#0f172a;width:100%;max-width:920px;border-radius:18px;box-shadow:0 30px 80px rgba(0,0,0,.35);overflow:hidden;animation:nstu .18s;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Tahoma,Arial,sans-serif}' +
    '.nst-mh{display:flex;align-items:center;gap:12px;padding:18px 20px;border-bottom:1px solid #e5e7eb;border-top:5px solid var(--acc)}' +
    '.nst-mh .ic{width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;background:#f1f5f9;flex-shrink:0}' +
    '.nst-mh h3{margin:0;font-size:18px}.nst-mh small{color:#64748b;font-size:13px}' +
    '.nst-x{all:unset;cursor:pointer;margin-inline-start:auto;width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;color:#64748b;background:#f1f5f9}' +
    '.nst-x:hover{background:#e2e8f0;color:#0f172a}' +
    '.nst-mb{padding:16px 20px 20px}' +
    '.nst-cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;margin-bottom:16px}' +
    '.nst-box{background:#f8fafc;border:1px solid #eef2f7;border-radius:12px;padding:12px 14px}.nst-box h4{margin:0 0 8px;font-size:13px;color:#64748b}' +
    '.nst-box.warn{background:#fff7ed;border-color:#fed7aa}.nst-box.warn h4{color:#c2410c}' +
    '.nst-hb{display:grid;grid-template-columns:minmax(70px,120px) 1fr 34px;gap:8px;align-items:center;font-size:13px;margin:6px 0}' +
    '.nst-hb span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.nst-hb .tr{height:9px;background:#e2e8f0;border-radius:5px;overflow:hidden}.nst-hb .tr i{display:block;height:100%;border-radius:5px}.nst-hb b{text-align:end}' +
    '.nst-bar{display:flex;gap:8px;align-items:center;margin:4px 0 10px;flex-wrap:wrap}.nst-bar h4{margin:0;font-size:14px}' +
    '.nst-q{flex:1;min-width:180px;font:inherit;font-size:14px;padding:9px 12px;border:1px solid #e5e7eb;border-radius:10px;background:#f8fafc;color:inherit}' +
    '.nst-btn{all:unset;cursor:pointer;font-size:13px;font-weight:700;padding:9px 14px;border-radius:10px;background:#1f3f7a;color:#fff;white-space:nowrap}' +
    '.nst-tw{overflow-x:auto;border:1px solid #eef2f7;border-radius:12px}' +
    '.nst-t{width:100%;border-collapse:collapse;font-size:13.5px}.nst-t th,.nst-t td{padding:9px 10px;border-bottom:1px solid #eef2f7;text-align:start;white-space:nowrap}' +
    '.nst-t th{font-size:12px;color:#64748b;background:#f8fafc;position:sticky;top:0}.nst-t td.w{white-space:normal;min-width:180px;color:#64748b}' +
    '.nst-t tr.pend td{background:#fff7ed}' +
    '.nst-tag{font-size:12px;padding:2px 8px;border-radius:999px;font-weight:600;background:#eef2f7}' +
    '.nst-empty{text-align:center;color:#64748b;padding:24px}.nst-more{display:block;margin:12px auto 0;background:#eef2f7;color:#1f3f7a}' +
    'html[data-theme="dark"] .nst-tile{background:#141b2a;border-color:rgba(255,255,255,.07);color:#e5e7eb;box-shadow:0 10px 28px rgba(0,0,0,.45)}' +
    'html[data-theme="dark"] .nst-lb,html[data-theme="dark"] .nst-sub{color:#94a3b8}html[data-theme="dark"] .nst-go{color:#3b4558}' +
    'html[data-theme="dark"] .nst-dl{background:#1e2a44;color:#c7d7f5}html[data-theme="dark"] .nst-dl.up,html[data-theme="dark"] .nst-dl.down.neg{background:#12301f;color:#4ade80}' +
    'html[data-theme="dark"] .nst-dl.down,html[data-theme="dark"] .nst-dl.up.neg{background:#3a1e22;color:#f87171}' +
    'html[data-theme="dark"] .nst-msg{background:rgba(22,28,40,.92);color:#9aa6b8}html[data-theme="dark"] .nst-skel{background:linear-gradient(90deg,#141b2a,#1c2538,#141b2a);background-size:200% 100%}' +
    'html[data-theme="dark"] .nst-seg button.on{background:#e5e7eb;color:#0f172a}' +
    'html[data-theme="dark"] .nst-md{background:#151c2b;color:#e5e7eb}html[data-theme="dark"] .nst-mh{border-bottom-color:#263042}' +
    'html[data-theme="dark"] .nst-mh .ic,html[data-theme="dark"] .nst-x{background:#1e2a44;color:#c7d7f5}' +
    'html[data-theme="dark"] .nst-box{background:#0f1624;border-color:#263042}html[data-theme="dark"] .nst-box.warn{background:#2e2112;border-color:#5a3b17}' +
    'html[data-theme="dark"] .nst-hb .tr{background:#1e2a44}html[data-theme="dark"] .nst-q{background:#0f1624;border-color:#263042}' +
    'html[data-theme="dark"] .nst-tw{border-color:#263042}html[data-theme="dark"] .nst-t th{background:#111827;color:#9aa6b8}html[data-theme="dark"] .nst-t th,html[data-theme="dark"] .nst-t td{border-color:#263042}' +
    'html[data-theme="dark"] .nst-t tr.pend td{background:#2e2112}html[data-theme="dark"] .nst-tag,html[data-theme="dark"] .nst-more{background:#1e2a44;color:#c7d7f5}' +
    '@media (max-width:600px){.nst-ov{padding:10px 8px}.nst-mh,.nst-mb{padding-inline:14px}.nst-tw{border:0}.nst-t thead{display:none}.nst-t,.nst-t tbody{display:block}' +
    '.nst-t tr{display:flex;flex-wrap:wrap;gap:4px 10px;align-items:center;padding:10px 12px;border:1px solid #eef2f7;border-radius:12px;margin-bottom:8px}' +
    '.nst-t td{display:block;border:0!important;padding:0;white-space:normal}.nst-t td:first-child{width:100%;font-size:12px;color:#64748b}.nst-t td.w{min-width:0;width:100%;font-size:12.5px}' +
    'html[data-theme="dark"] .nst-t tr{border-color:#263042}}' +
    '@media print{.nst-ov{display:none!important}}';
  var cssDone = false;
  function ensureCss() { if (cssDone) return; cssDone = true; var s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); }

  function hbars(map, colorFn, limit) {
    var list = Object.keys(map).map(function (k) { return [k, map[k]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, limit || 6);
    var max = list.length ? list[0][1] : 1;
    return list.map(function (x) {
      return '<div class="nst-hb"><span title="' + esc(x[0]) + '">' + esc(x[0]) + '</span><span class="tr"><i style="width:' + Math.max(4, x[1] / max * 100) + '%;background:' + colorFn(x[0]) + '"></i></span><b>' + nf(x[1]) + '</b></div>';
    }).join('');
  }
  function countBy(rows, fn) { var m = {}; rows.forEach(function (r) { [].concat(fn(r)).forEach(function (k) { if (k !== '' && k != null) m[k] = (m[k] || 0) + 1; }); }); return m; }

  /** spec: { lb, ic, c, rows, mode, pending, pendLbl, sub } */
  function details(spec) {
    ensureCss();
    var rows = (spec.rows || []).slice().sort(function (a, b) { return String(b[0]).localeCompare(String(a[0])); });
    var pendSet = new Set(spec.pending || []);
    var ov = document.createElement('div'); ov.className = 'nst-ov';
    ov.setAttribute('dir', lang() === 'en' ? 'ltr' : 'rtl'); ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    var tools = countBy(rows, function (r) { return r[3]; });
    var boxes = '';
    if (spec.pending && spec.pending.length) {
      boxes += '<div class="nst-box warn"><h4>⚠️ ' + esc(spec.pendLbl) + ' (' + spec.pending.length + ')</h4>' +
        spec.pending.slice(0, 6).map(function (r) { return '<div style="font-size:13px;margin:4px 0"><b>' + esc(r[5]) + '</b> · ' + esc(r[2] || r[1]) + ' · <span style="opacity:.7">' + esc(fmt(r[0])) + '</span></div>'; }).join('') + '</div>';
    }
    if (spec.mode === 'users') {
      var actU = {}; rows.forEach(function (r) { actU[r[1]] = 1; });
      var idle = USERS.filter(function (u) { return u.active !== false && !actU[u.u]; });
      if (idle.length) boxes += '<div class="nst-box warn"><h4>' + esc(t('inactive')) + ' (' + idle.length + ')</h4><div style="font-size:13px;line-height:1.9">' + idle.map(function (u) { return esc(u.n || u.u); }).join('، ') + '</div></div>';
    }
    if (rows.length) {
      boxes += '<div class="nst-box"><h4>' + esc(t('byUser')) + '</h4>' + hbars(countBy(rows, function (r) { return r[2] || r[1]; }), function () { return spec.c; }, spec.mode === 'users' ? 12 : 6) + '</div>';
      if (Object.keys(tools).length > 1) {
        var tl = {}; Object.keys(tools).forEach(function (k) { tl[toolName(k)] = tools[k]; });
        boxes += '<div class="nst-box"><h4>' + esc(t('byTool')) + '</h4>' + hbars(tl, function (n) { var k = Object.keys(tools).find(function (x) { return toolName(x) === n; }); return toolColor(k); }) + '</div>';
      } else {
        var acts = countBy(rows, function (r) { return opName(act(r)); });
        if (Object.keys(acts).length > 1) boxes += '<div class="nst-box"><h4>' + esc(t('byAct')) + '</h4>' + hbars(acts, function () { return spec.c; }) + '</div>';
      }
      if (allGarages().length) boxes += '<div class="nst-box"><h4>' + esc(t('byGarage')) + '</h4>' + hbars(countBy(rows, function (r) { var g = userGarages(r[1]); return g.length ? g : t('unassigned'); }), function () { return '#64748b'; }) + '</div>';
    }
    ov.innerHTML =
      '<div class="nst-md" style="--acc:' + spec.c + '">' +
        '<div class="nst-mh"><div class="ic">' + (spec.ic || '📊') + '</div><div><h3>' + esc(spec.lb) + '</h3><small>' + nf(rows.length) + ' ' + esc(t('records')) + (spec.sub ? ' · ' + esc(spec.sub) : '') + '</small></div>' +
          '<button class="nst-x" type="button" aria-label="' + esc(t('close')) + '">×</button></div>' +
        '<div class="nst-mb">' + (boxes ? '<div class="nst-cols">' + boxes + '</div>' : '') +
          '<div class="nst-bar"><h4>' + esc(t('list')) + '</h4><input class="nst-q" type="search" placeholder="' + esc(t('search')) + '"><button class="nst-btn" type="button" data-x="csv">' + esc(t('export')) + '</button></div>' +
          '<div class="nst-list"></div></div></div>';
    document.body.appendChild(ov);
    var prevOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    var shown = 100, q = '';
    function filtered() {
      if (!q) return rows;
      var s = q.toLowerCase();
      return rows.filter(function (r) { return [r[1], r[2], toolName(r[3]), opName(act(r)), r[5], r[6]].join(' ').toLowerCase().indexOf(s) > -1; });
    }
    function draw() {
      var list = filtered(), part = list.slice(0, shown);
      ov.querySelector('.nst-list').innerHTML = !list.length ? '<div class="nst-empty">' + esc(t('noRec')) + '</div>' :
        '<div class="nst-tw"><table class="nst-t"><thead><tr><th>' + esc(t('hTime')) + '</th><th>' + esc(t('hEmp')) + '</th><th>' + esc(t('hTool')) + '</th><th>' + esc(t('hOp')) + '</th><th>' + esc(t('hRef')) + '</th><th>' + esc(t('hDetails')) + '</th></tr></thead><tbody>' +
        part.map(function (r) {
          return '<tr class="' + (pendSet.has(r) ? 'pend' : '') + '"><td>' + esc(fmt(r[0])) + '</td><td><b>' + esc(r[2] || r[1]) + '</b></td><td><span style="color:' + toolColor(r[3]) + '">●</span> ' + esc(toolName(r[3])) + '</td>' +
            '<td><span class="nst-tag">' + esc(opName(act(r))) + (pendSet.has(r) ? ' · ' + esc(t('pending')) : '') + '</span></td><td dir="ltr">' + esc(r[5]) + '</td><td class="w">' + esc(r[6]) + '</td></tr>';
        }).join('') + '</tbody></table></div>' +
        (list.length > shown ? '<button class="nst-btn nst-more" type="button" data-x="more">' + esc(t('more')) + ' (' + nf(list.length - shown) + ')</button>' : '');
    }
    function close() { document.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow; ov.remove(); }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    ov.addEventListener('click', function (e) {
      if (e.target === ov || e.target.closest('.nst-x')) return close();
      var x = e.target.closest('[data-x]'); if (!x) return;
      if (x.dataset.x === 'more') { shown += 200; draw(); }
      if (x.dataset.x === 'csv') exportCsv(filtered(), spec.lb);
    });
    ov.querySelector('.nst-q').addEventListener('input', function (e) { q = e.target.value.trim(); shown = 100; draw(); });
    draw();
    ov.querySelector('.nst-x').focus();
  }

  function exportCsv(rows, name) {
    var head = lang() === 'en' ? ['Date','Time','Employee','Tool','Operation','Reference','Details'] : ['التاريخ','الوقت','الموظف','البرنامج','العملية','المرجع','تفاصيل'];
    var out = rows.map(function (r) { var d = new Date(r[0]); return [dkey(d), pad(d.getHours()) + ':' + pad(d.getMinutes()), r[2] || r[1], toolName(r[3]), opName(act(r)), r[5], r[6]]; });
    var csv = '﻿' + [head].concat(out).map(function (r) { return r.map(function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }).join(','); }).join('\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type:'text/csv;charset=utf-8' }));
    a.download = String(name || 'stats').replace(/[\\/:*?"<>|\s]+/g, '_') + '_' + dkey(new Date()) + '.csv'; a.click();
  }

  /* أي عنصر فيه data-nst يفتح تفاصيله */
  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('[data-nst]');
    if (el && REG[el.getAttribute('data-nst')]) { e.preventDefault(); details(REG[el.getAttribute('data-nst')]); }
  });

  /* ---------- قسم الصفحة الرئيسية ---------- */
  function mountHub(root) {
    if (!root) return;
    ensureCss();
    var period = 'today', CUR = null, PREV = null;
    try { period = localStorage.getItem('nwStatsPeriod') || 'today'; } catch (e) {}
    function shell(inner) {
      root.innerHTML =
        '<div class="nst-head"><h2>📈 ' + esc(t('secTitle')) + '</h2>' +
        '<div class="nst-seg">' + ['today', 'month', 'last'].map(function (p) { return '<button type="button" data-p="' + p + '" class="' + (p === period ? 'on' : '') + '">' + esc(t(p === 'today' ? 'today' : p === 'month' ? 'thisMonth' : 'lastMonth')) + '</button>'; }).join('') + '</div>' +
        '<a class="nst-all" href="' + HOME + 'stats.html">' + esc(t('allStats')) + '</a></div>' + inner;
    }
    function skeleton() { var s = ''; for (var i = 0; i < 8; i++) s += '<div class="nst-skel"></div>'; shell('<div class="nst-grid">' + s + '</div>'); }
    function fail(msg) { shell('<div class="nst-msg">' + esc(msg) + '<button type="button" data-retry>' + esc(t('retry')) + '</button></div>'); }
    function render() {
      if (!CUR) return;
      var cm = opsRows(CUR), pm = opsRows(PREV), now = new Date(), today = dkey(now);
      var y = new Date(now); y.setDate(now.getDate() - 1); var yest = dkey(y);
      var both = cm.concat(pm), rows, prev, days, vs;
      if (period === 'today') { rows = both.filter(function (r) { return dkey(new Date(r[0])) === today; }); prev = both.filter(function (r) { return dkey(new Date(r[0])) === yest; }); days = 1; vs = t('vsYest'); }
      else if (period === 'month') { rows = cm; prev = PREV ? pm.filter(function (r) { return new Date(r[0]).getDate() <= now.getDate(); }) : null; days = now.getDate(); vs = t('vsPrev'); }
      else { rows = pm; prev = null; var pmm = prevMonth(thisMonth()).split('-').map(Number); days = new Date(pmm[0], pmm[1], 0).getDate(); vs = ''; }
      var totalUsers = USERS.filter(function (u) { return u.active !== false; }).length;
      var list = kpis(rows, prev, { days: days, totalUsers: totalUsers, vs: vs });
      var pick = ['total', 'users', 'acc', 'viol', 'eval', 'trip', 'tasks', 'shift'];
      var tiles = pick.map(function (id) { return list.find(function (k) { return k.id === id; }); });
      shell('<div class="nst-grid">' + tiles.map(function (k) { return tileHtml(k); }).join('') + '</div><div class="nst-hint">👆 ' + esc(t('tapHint')) + '</div>');
    }
    function load(force) {
      skeleton();
      var m = thisMonth();
      Promise.all([fetchMonth(m, force), fetchMonth(prevMonth(m), force).catch(function () { return null; })]).then(function (res) {
        var a = res[0], b = res[1];
        if (a.error === 'FORBIDDEN') { root.style.display = 'none'; return; }          // غير مدير: نخفي القسم
        if (a.error === 'AUTH') { if (window.NWAuth) NWAuth.relogin(); return fail(t('eAuth')); }
        if (!a.ok) return fail(t('eNet'));
        CUR = a; PREV = b && b.ok ? b : null; setUsers(a.users); render();
      }).catch(function () { fail(t('eNet')); });
    }
    root.addEventListener('click', function (e) {
      var p = e.target.closest('[data-p]');
      if (p) { period = p.dataset.p; try { localStorage.setItem('nwStatsPeriod', period); } catch (x) {} render(); return; }
      if (e.target.closest('[data-retry]')) load(true);
    });
    window.addEventListener('storage', function (e) { if (e.key === 'hubLang') setTimeout(render, 30); });
    new MutationObserver(function () { setTimeout(render, 30); }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    load();
  }

  window.NWStats = {
    AUTH_URL: AUTH_URL, TOOLS: TOOLS, fetchMonth: fetchMonth, setUsers: setUsers, userGarages: userGarages, allGarages: allGarages,
    opsRows: opsRows, kpis: kpis, tileHtml: tileHtml, reg: reg, details: details, exportCsv: exportCsv,
    toolName: toolName, opName: opName, toolColor: toolColor, t: t, thisMonth: thisMonth, prevMonth: prevMonth, mountHub: mountHub
  };

  /* تركيب تلقائي: <section id="nw-stats"> في الصفحة الرئيسية */
  function auto() {
    var el = document.getElementById('nw-stats');
    if (!el || !window.NWAuth) return;
    if (NWAuth.can && !NWAuth.can('stats')) { el.style.display = 'none'; return; }   // بدون صلاحية: لا يظهر
    mountHub(el);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', auto); else auto();
})();
