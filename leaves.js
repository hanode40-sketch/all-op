/* ====================================================================
   الإجازات والاستعداد — إدارة السائقين (Northwest Bus)
   - الأساس التاريخي: leave_baseline.json (مستخرج من ملف الروستر الأصلي حتى تاريخ القطع)
   - بعد تاريخ القطع: يتحدث تلقائياً من البرنامج نفسه:
       • الإجازات: من حالة السائق الحالية (من/إلى) + سجل التغييرات (driverHistory)
       • الاستعداد: من الروستر المرفوع في البرنامج (rosterRange) + التبديلات + الراحة اليدوية
   يعتمد على متغيرات ودوال drivers.html (D, C, ST, NWAuth, $, esc, addD, today, ...)
   ==================================================================== */
(function () {
  'use strict';
  const EN = () => LANG === 'en';
  const tr = (ar, en) => EN() ? en : ar;
  const TY = {
    A: ['إجازة سنوية', 'Annual Leave', 's-annual'],
    E: ['إجازة اضطرارية', 'Emergency Leave', 's-emergency'],
    S: ['إجازة مرضية', 'Sick Leave', 's-sick'],
    N: ['لم يعد من الإجازة', 'Not Returned', 's-out']
  };
  const ST2TY = { 'Annual Leave': 'A', 'Emergency Leave': 'E', 'Sick Leave': 'S', 'Not Returned': 'N' };
  const tyName = t => TY[t] ? (EN() ? TY[t][1] : TY[t][0]) : t;
  const dmy = k => k ? k.slice(8, 10) + '/' + k.slice(5, 7) + '/' + k.slice(0, 4) : '';
  const days = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5);
  const SS = (k, v) => { try { if (v === undefined) return JSON.parse(sessionStorage.getItem(k) || 'null'); sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } };

  let BASE = null, BASEP = null;
  let HIST = SS('nwLvHist1') || {};         // iqama -> فترات من سجل التغييرات
  let LSB = null, LSBP = null, LSB_AT = ''; // iqama -> { last, n } استعداد من روستر البرنامج بعد تاريخ القطع
  let SYNC = null;                          // مزامنة سجل التغييرات (جارية)
  let TAB = 'per';

  function loadBase() {
    if (BASE) return Promise.resolve(BASE);
    if (!BASEP) BASEP = fetch('leave_baseline.json?v=' + Date.now(), { cache: 'no-cache' }).then(r => r.json())
      .then(j => (BASE = j)).catch(() => (BASE = { cutoff: '0000-00-00', d: {} }));
    return BASEP;
  }
  const cut = () => (BASE && BASE.cutoff) || '0000-00-00';

  /* ---------- سجل التغييرات → فترات إجازة (نفس منطق تقرير عمل السائقين) ---------- */
  const stKey = v => { v = String(v || '').trim(); if (ST[v]) return v; return STATUSES.find(k => ST[k].ar === v || ST[k].en === v) || ''; };
  const hDates = v => { const out = []; String(v || '').replace(/(\d{4})-(\d{1,2})-(\d{1,2})|(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/g, (m, y, mo, d, d2, mo2, y2) => { out.push(y ? y + '-' + mo.padStart(2, '0') + '-' + d.padStart(2, '0') : y2 + '-' + mo2.padStart(2, '0') + '-' + d2.padStart(2, '0')); }); return out; };
  const hDate = v => hDates(v)[0] || '';
  const isLv = s => !!ST2TY[s];
  function histIntervals(h, r) {
    const ev = (h || []).map(x => ({ ts: String(x[0] || ''), d: hDate(x[0]), f: String(x[3] || ''), o: x[4], n: x[5] })).filter(x => x.d).sort((a, z) => a.ts < z.ts ? -1 : a.ts > z.ts ? 1 : 0);
    const isSt = x => (/status|الحالة|حالة/i.test(x.f) && (stKey(x.n) || stKey(x.o))) || (stKey(x.n) && stKey(x.o));
    const stEv = ev.filter(isSt);
    const dEv = ev.filter(x => !isSt(x) && /تاريخ|date|from|to|من|إلى|عودة|بداية/i.test(x.f)).map(x => { const d = hDates(x.n); return d.length >= 2 ? { ts: x.ts, rg: [d[0] < d[1] ? d[0] : d[1], d[0] < d[1] ? d[1] : d[0]] } : null; }).filter(Boolean);
    const f0 = hDate(r[C.FROM]), t0 = hDate(r[C.TO]), cur0 = f0 && t0 ? [f0 < t0 ? f0 : t0, f0 < t0 ? t0 : f0] : null;
    const rangeAt = ts => { const L = dEv.filter(x => !ts || x.ts <= ts).pop(); return L ? L.rg : cur0; };
    const out = []; let cur = null;
    if (stEv.length) { const o = stKey(stEv[0].o); if (isLv(o)) cur = { s: '0000-00-00', st: o, d: stEv[0].d }; }
    const close = (e, ts) => {
      const rg = rangeAt(ts);
      if (rg) { const s2 = rg[0] > cur.s ? rg[0] : cur.s, e2 = rg[1] < e ? rg[1] : e; if (s2 <= e2) out.push([ST2TY[cur.st], s2, e2]); }
      else if (cur.d && cur.d <= e) out.push([ST2TY[cur.st], cur.d, e]);          // بدون تواريخ مسجلة: من تاريخ تغيير الحالة
      cur = null;
    };
    stEv.forEach(x => { const n = stKey(x.n); if (cur) close(addD(x.d, -1), x.ts); if (isLv(n)) cur = { s: '0000-00-00', st: n, d: x.d }; });
    if (cur) cur = null;   // الإجازة الحالية تنحسب من حالة السائق مباشرة
    return out;
  }

  async function pool(items, n, fn, prog) {
    let i = 0, done = 0; const tmo = p => Promise.race([p, new Promise(r => setTimeout(r, 20000))]);
    await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const it = items[i++]; try { await tmo(fn(it)); } catch (e) {} done++; if (prog) prog(done, items.length); } }));
  }
  function syncHist(force) {
    if (SYNC) return SYNC;
    const need = D.filter(r => force || !(String(r[C.IQ]) in HIST));
    if (!need.length) return Promise.resolve();
    SYNC = pool(need, 12, r => NWAuth.call('driverHistory', { iqama: r[C.IQ] }).then(j => { if (j && j.ok !== false) HIST[String(r[C.IQ])] = histIntervals((j && j.history) || [], r); }),
      (i, n) => { const el = $('lvSync'); if (el) el.textContent = tr(`⏳ مزامنة سجل التغييرات من البرنامج (${i}/${n})...`, `⏳ Syncing change history (${i}/${n})...`); })
      .then(() => { SS('nwLvHist1', HIST); SYNC = null; RES = null; if ($('lvOv').classList.contains('on')) draw(); });
    return SYNC;
  }

  /* ---------- الاستعداد من روستر البرنامج بعد تاريخ القطع ---------- */
  function liveSB() {
    const from = addD(cut(), 1), to = today();
    if (LSB && LSB_AT === to) return Promise.resolve(LSB);
    if (LSBP) return LSBP;
    LSBP = (async () => {
      const dd = {}, subs = [], marks = [];
      if (from <= to) {
        let a = addD(from, -7);                                  // أيام قبلها عشان نعرف بداية فترة الغياب
        while (a <= to) {
          let b = addD(a, 30); if (b > to) b = to;
          try { const j = await NWAuth.call('rosterRange', { from: a, to: b }); if (j && j.ok) { Object.assign(dd, j.days || {}); (j.subs || []).forEach(x => subs.push(x)); (j.marks || []).forEach(x => marks.push(x)); } } catch (e) {}
          a = addD(b, 1);
        }
      }
      const SET = {}, SWO = {}, SWI = {}, MK = {};
      Object.keys(dd).forEach(k => { const rows = dd[k] || []; if (!rows.length) return; const s = {}; rows.forEach(r => [r[1], r[2]].forEach(x => { if (x) s[String(x).trim()] = 1; })); SET[k] = s; });
      subs.forEach(x => { (SWO[x.date] = SWO[x.date] || {})[String(x.orig)] = 1; (SWI[x.date] = SWI[x.date] || {})[String(x.rep)] = 1; });
      marks.forEach(x => { if (x.mark === 'rest') (MK[x.date] = MK[x.date] || {})[String(x.iqama)] = 1; });
      const sched = (iq, k) => { if (!SET[k]) return null; if (SWI[k] && SWI[k][iq]) return true; if (SWO[k] && SWO[k][iq]) return false; return !!SET[k][iq]; };
      const out = {};
      D.forEach(r => {
        const iq = String(r[C.IQ]), P = periods(r);
        const onLv = k => P.some(p => k >= p.s && k <= p.e2);
        let last = '', n = 0;
        for (let k = from; k <= to; k = addD(k, 1)) {
          if (!SET[k] || onLv(k)) continue;
          if (SWO[k] && SWO[k][iq] && !(SWI[k] && SWI[k][iq])) { last = k; n++; continue; }
          if (sched(iq, k) !== false || (MK[k] && MK[k][iq])) continue;
          let run = 1;
          for (let d = 1; d <= 30; d++) { if (sched(iq, addD(k, -d)) !== false) break; run++; }
          for (let d = 1; d <= 30; d++) { if (sched(iq, addD(k, d)) !== false) break; run++; }
          if (run > 2) { last = k; n++; }
        }
        if (last) out[iq] = { last, n };
      });
      LSB = out; LSB_AT = to; LSBP = null; return out;
    })();
    return LSBP;
  }

  /* ---------- دمج الأساس + البرنامج لكل سائق ---------- */
  function periods(r) {
    const iq = String(r[C.IQ]), b = (BASE && BASE.d[iq]) || {}, C0 = cut(), T = today();
    const curTy = ST2TY[r[C.ST]], cf = hDate(r[C.FROM]), ct = hDate(r[C.TO]);
    let P = [];
    (b.l || []).forEach(x => P.push({ t: x[0], s: x[1], e: x[2], open: !!x[3], src: 'R' }));
    (HIST[iq] || []).forEach(x => P.push({ t: x[0], s: x[1], e: x[2], src: 'P' }));
    if (curTy) {   // الإجازة الحالية حسب البرنامج
      let s = cf || '';
      if (!s) { const o = P.filter(p => p.t === curTy && p.open).pop(); s = o ? o.s : ''; }
      if (s) P.push({ t: curTy, s, e: ct && ct > s ? ct : '', cur: true, src: 'P' });
    }
    // فترة مفتوحة من الروستر والسائق رجع (حسب البرنامج): تنتهي عند تاريخ القطع
    P.forEach(p => { if (p.open && !(curTy === p.t)) p.e = C0; });
    P = P.filter(p => p.s).sort((a, z) => a.s < z.s ? -1 : a.s > z.s ? 1 : 0);
    const M = [];
    P.forEach(p => {
      const L = M.filter(m => m.t === p.t).pop();
      const le = L ? (L.cur && !L.e ? T : L.e) : '';
      if (L && le && days(le, p.s) <= 5) {   // متداخلة أو متقاربة = نفس الإجازة
        if (p.cur) { L.cur = true; L.e = p.e; } else if (!L.cur && p.e > L.e) L.e = p.e;
        if (p.src === 'P') L.src = L.src === 'R' ? 'RP' : L.src;
      } else M.push(Object.assign({}, p));
    });
    M.forEach(p => {
      const endKnown = p.e || '';
      p.e2 = p.cur ? (endKnown && endKnown < T ? T : (endKnown || T)) : endKnown;   // للحساب
      if (p.cur) { p.stt = 'cur'; p.d = days(p.s, T < p.s ? p.s : T) + 1; }
      else if (p.s > T) { p.stt = 'next'; p.d = days(p.s, p.e) + 1; }
      else { p.stt = 'done'; p.d = days(p.s, p.e) + 1; }
      if (r[C.ST] === 'Not Returned' && p.t === 'N' && p.cur) p.stt = 'cur';
    });
    return M;
  }
  function lastSB(r) {
    const iq = String(r[C.IQ]), b = (BASE && BASE.d[iq] && BASE.d[iq].s) || null, lv = LSB && LSB[iq];
    let last = b ? b[0] : '', loc = b ? b[1] : '', n = b ? b[3] : 0, ps = b ? b[2] : '';
    if (lv) { n += lv.n; if (lv.last > last) { last = lv.last; loc = depName(dep(r)); ps = ''; } }
    if ($('fDate') && $('fDate').value === today() && typeof isStandby === 'function' && isStandby(r)) { if (today() > last) n++; last = today(); loc = depName(sbDep(r)); }
    else if (loc && DEP[loc]) loc = depName(loc);
    return { last, loc, n, ps, since: last ? days(last, today()) : null };
  }
  let RES = null;
  function compute() {
    if (RES) return RES;
    RES = D.map(r => {
      const P = periods(r), A = P.filter(p => p.t === 'A'), la = A[A.length - 1];
      const b = (BASE && BASE.d[String(r[C.IQ])]) || {};
      return { r, P, A, la, sb: lastSB(r), first: b.f || '',
        aDays: A.reduce((s, p) => s + p.d, 0), sDays: P.filter(p => p.t === 'S').reduce((s, p) => s + p.d, 0), eDays: P.filter(p => p.t === 'E').reduce((s, p) => s + p.d, 0),
        sinceRet: la && la.stt === 'done' ? days(la.e, today()) : null };
    });
    return RES;
  }
  const sttName = s => ({ cur: tr('جارية حالياً', 'Ongoing'), done: tr('منتهية', 'Ended'), next: tr('قادمة', 'Upcoming') })[s] || '';
  const srcName = s => ({ R: tr('الروستر', 'Roster file'), P: tr('البرنامج', 'App'), RP: tr('الروستر + البرنامج', 'Roster + App') })[s] || '';

  /* ---------- الواجهة ---------- */
  function ui() {
    const rpt = $('bRpt'); if (!rpt || $('bLv')) return;
    rpt.insertAdjacentHTML('afterend', `<button class="btn light" id="bLv">🌴 ${tr('الإجازات والاستعداد', 'Leaves & Standby')}</button>`);
    const sync = () => { $('bLv').style.display = rpt.style.display; };
    sync(); new MutationObserver(sync).observe(rpt, { attributes: true, attributeFilter: ['style'] });
    document.body.insertAdjacentHTML('beforeend', `
<style>
  .lv-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0}
  .lv-tabs button{border:1px solid var(--nw-line,#e2e8f0);background:var(--nw-soft,#f8fafc);color:var(--nw-ink,#13274f);border-radius:999px;padding:7px 14px;font-weight:700;cursor:pointer;font-family:inherit}
  .lv-tabs button.on{background:var(--nw-navy,#13274f);color:#fff;border-color:transparent}
  .lv-box{margin-top:12px;border:1px solid var(--nw-line,#e5e7eb);border-radius:12px;padding:10px 12px;font-size:13px}
  .lv-box b{font-weight:800} .lv-box .ln{margin:3px 0} .lv-box details{margin-top:6px} .lv-box summary{cursor:pointer;color:var(--muted)}
  .lv-warn{color:#b45309;font-weight:700}
</style>
<div class="ov" id="lvOv"><div class="md" style="max-width:1150px">
  <div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><h3 style="margin:0">🌴 ${tr('الإجازات والاستعداد', 'Leaves & Standby')}</h3><button class="btn light" id="lvX">✕</button></div>
  <div class="sub" id="lvSub"></div>
  <div class="lv-tabs" id="lvTabs">
    <button data-t="per">📅 ${tr('فترات الإجازات', 'Leave periods')}</button>
    <button data-t="sum">👤 ${tr('ملخص لكل سائق', 'Per driver')}</button>
    <button data-t="no">🚫 ${tr('بدون إجازة سنوية', 'No annual leave')}</button>
    <button data-t="sb">🟣 ${tr('آخر استعداد', 'Last standby')}</button>
  </div>
  <div class="bar" style="align-items:flex-end;padding:0;box-shadow:none;border:0;background:none">
    <div style="flex:2"><input id="lvQ" type="search" autocomplete="off" placeholder="${tr('ابحث بالاسم أو رقم الإقامة', 'Search by name or Iqama')}"></div>
    <div id="lvTyW"><select id="lvTy"><option value="">${tr('كل الأنواع', 'All types')}</option>${Object.keys(TY).map(k => `<option value="${k}">${tyName(k)}</option>`).join('')}</select></div>
    <div id="lvStW"><select id="lvSt"><option value="">${tr('كل الحالات', 'All')}</option><option value="cur">${sttName('cur')}</option><option value="done">${sttName('done')}</option><option value="next">${sttName('next')}</option></select></div>
    <div id="lvYW"><select id="lvY"></select></div>
    <div style="flex:0 0 auto;display:flex;gap:6px"><button class="btn light" id="lvRe">🔄 ${tr('تحديث', 'Refresh')}</button><button class="btn light" id="lvXls">⬇️ Excel</button></div>
  </div>
  <div class="sub2" id="lvSync" style="margin:6px 0"></div>
  <div id="lvOut"></div>
</div></div>`);
    $('bLv').onclick = openLv;
    $('lvX').onclick = () => $('lvOv').classList.remove('on');
    $('lvOv').addEventListener('click', e => { if (e.target.id === 'lvOv') $('lvOv').classList.remove('on'); });
    $('lvTabs').onclick = e => { const b = e.target.closest('button'); if (!b) return; TAB = b.dataset.t; draw(); };
    ['lvQ', 'lvTy', 'lvSt', 'lvY'].forEach(id => $(id).addEventListener('input', draw));
    $('lvRe').onclick = async () => { HIST = {}; SS('nwLvHist1', HIST); LSB = null; LSB_AT = ''; RES = null; await openLv(); syncHist(true); };
    $('lvXls').onclick = xls;
    $('fDepot') && $('fDepot').addEventListener('change', () => { if ($('lvOv').classList.contains('on')) draw(); });
  }

  async function openLv() {
    $('lvOv').classList.add('on'); $('lvOut').innerHTML = `<div class="msg">⏳ ${tr('جاري التحميل...', 'Loading...')}</div>`;
    if (typeof LOADP !== 'undefined' && LOADP) { try { await LOADP; } catch (e) {} }
    await loadBase(); RES = null; draw();
    liveSB().then(() => { RES = null; draw(); });
    syncHist(false);
  }
  const rowsInScope = () => { const dv = $('fDepot') ? $('fDepot').value : ''; return compute().filter(x => inDep(dep(x.r), dv)); };
  const matchQ = x => { const q = ($('lvQ').value || '').trim().toLowerCase(); return !q || (String(x.r[C.NAME]) + ' ' + x.r[C.IQ] + ' ' + (x.r[C.EMP] || '')).toLowerCase().includes(q); };
  const chip = t => `<span class="chip ${TY[t] ? TY[t][2] : ''}">${esc(tyName(t))}</span>`;
  const endTxt = p => p.cur ? (p.e ? `${dmy(p.e)} <span class="sub2" style="display:inline">${tr('(متوقع)', '(expected)')}</span>` : tr('مفتوحة', 'Open')) : dmy(p.e);

  function draw() {
    if (!BASE) return;
    document.querySelectorAll('#lvTabs button').forEach(b => b.classList.toggle('on', b.dataset.t === TAB));
    $('lvTyW').style.display = $('lvStW').style.display = $('lvYW').style.display = TAB === 'per' ? '' : 'none';
    const list = rowsInScope().filter(matchQ);
    const yrs = [...new Set(compute().flatMap(x => x.P.map(p => p.s.slice(0, 4))))].sort().reverse();
    const yv = $('lvY').value; $('lvY').innerHTML = `<option value="">${tr('كل السنوات', 'All years')}</option>` + yrs.map(y => `<option${y === yv ? ' selected' : ''}>${y}</option>`).join('');
    const live = LSB ? '' : tr(' · ⏳ جاري حساب الاستعداد من روستر البرنامج', ' · ⏳ computing standby from app roster');
    $('lvSub').innerHTML = tr(`البيانات حتى ${dmy(cut())} من ملف الروستر الأصلي (من ${dmy(BASE.from || '')})، وبعدها تتحدث تلقائياً من البرنامج: حالة السائق وتواريخ الإجازة وسجل التغييرات والروستر المرفوع.`,
      `Data up to ${dmy(cut())} comes from the original roster file (since ${dmy(BASE.from || '')}); after that it updates automatically from the app: driver status, leave dates, change history and the uploaded roster.`) + live;
    if (!SYNC) $('lvSync').textContent = '';
    const out = $('lvOut');
    if (TAB === 'per') {
      const ty = $('lvTy').value, st = $('lvSt').value, y = $('lvY').value;
      const P = []; list.forEach(x => x.P.forEach(p => { if ((!ty || p.t === ty) && (!st || p.stt === st) && (!y || p.s.slice(0, 4) === y || (p.e2 || '').slice(0, 4) === y)) P.push({ x, p }); }));
      P.sort((a, z) => (z.p.stt === 'cur') - (a.p.stt === 'cur') || (z.p.s > a.p.s ? 1 : z.p.s < a.p.s ? -1 : 0));
      const drv = new Set(P.map(v => v.x.r[C.IQ])).size, tot = P.reduce((s, v) => s + v.p.d, 0), cur = P.filter(v => v.p.stt === 'cur').length;
      out.innerHTML = `<div class="rp-k"><div><b>${P.length}</b><span>${tr('فترة إجازة', 'Leave periods')}</span></div><div><b>${drv}</b><span>${tr('سائق', 'Drivers')}</span></div><div><b>${tot.toLocaleString('en-US')}</b><span>${tr('مجموع الأيام', 'Total days')}</span></div><div><b>${cur}</b><span>${sttName('cur')}</span></div></div>
      <div class="rp-w"><table class="rp-t"><thead><tr><th>#</th><th>${tr('السائق', 'Driver')}</th><th>${tr('رقم الإقامة', 'Iqama')}</th><th>${tr('الكراج', 'Depot')}</th><th>${tr('النوع', 'Type')}</th><th>${tr('من', 'From')}</th><th>${tr('إلى', 'To')}</th><th>${tr('الأيام', 'Days')}</th><th>${tr('الحالة', 'Status')}</th><th>${tr('المصدر', 'Source')}</th></tr></thead><tbody>
      ${P.slice(0, 1500).map((v, i) => `<tr class="cl" data-iq="${esc(v.x.r[C.IQ])}"><td>${i + 1}</td><td><b>${esc(v.x.r[C.NAME])}</b></td><td>${esc(v.x.r[C.IQ])}</td><td>${esc(depName(dep(v.x.r)))}</td><td>${chip(v.p.t)}</td><td>${dmy(v.p.s)}</td><td>${endTxt(v.p)}</td><td><b>${v.p.d}</b></td><td>${v.p.stt === 'cur' ? `<span class="chip s-annual">${sttName('cur')}</span>` : sttName(v.p.stt)}</td><td>${srcName(v.p.src)}</td></tr>`).join('') || `<tr><td colspan="10" class="msg">${tr('لا توجد نتائج', 'No results')}</td></tr>`}
      </tbody></table></div>`;
    } else if (TAB === 'sum') {
      const L = list.slice().sort((a, z) => z.aDays - a.aDays || String(a.r[C.NAME]).localeCompare(z.r[C.NAME]));
      out.innerHTML = `<div class="rp-w"><table class="rp-t"><thead><tr><th>#</th><th>${tr('السائق', 'Driver')}</th><th>${tr('رقم الإقامة', 'Iqama')}</th><th>${tr('الحالة الحالية', 'Current status')}</th><th>${tr('عدد السنوية', 'Annual count')}</th><th>${tr('أيام السنوية', 'Annual days')}</th><th>${tr('آخر سنوية من', 'Last annual from')}</th><th>${tr('إلى', 'To')}</th><th>${tr('من رجوعه (يوم)', 'Days since return')}</th><th>${tr('أيام مرضية', 'Sick days')}</th><th>${tr('أيام اضطرارية', 'Emergency days')}</th><th>${tr('آخر استعداد', 'Last standby')}</th></tr></thead><tbody>
      ${L.map((x, i) => `<tr class="cl" data-iq="${esc(x.r[C.IQ])}"><td>${i + 1}</td><td><b>${esc(x.r[C.NAME])}</b></td><td>${esc(x.r[C.IQ])}</td><td>${esc(stName(x.r[C.ST]))}</td><td>${x.A.length}</td><td><b>${x.aDays}</b></td><td>${x.la ? dmy(x.la.s) : '—'}</td><td>${x.la ? endTxt(x.la) : '—'}</td><td>${x.sinceRet ?? (x.la && x.la.stt === 'cur' ? sttName('cur') : '—')}</td><td>${x.sDays || ''}</td><td>${x.eDays || ''}</td><td>${x.sb.last ? dmy(x.sb.last) : '—'}</td></tr>`).join('')}
      </tbody></table></div>`;
    } else if (TAB === 'no') {
      const L = list.filter(x => !x.A.length).map(x => Object.assign(x, { svc: x.first ? days(x.first, today()) + 1 : null }))
        .sort((a, z) => (z.r[C.ST] === 'operation') - (a.r[C.ST] === 'operation') || (z.svc || 0) - (a.svc || 0));
      const op = L.filter(x => x.r[C.ST] === 'operation'), yr = op.filter(x => (x.svc || 0) >= 365).length;
      out.innerHTML = `<div class="rp-k"><div><b>${L.length}</b><span>${tr('بدون إجازة سنوية', 'No annual leave')}</span></div><div><b>${op.length}</b><span>${tr('منهم على رأس العمل', 'Of them in operation')}</span></div><div><b>${yr}</b><span>${tr('على رأس العمل ولهم سنة أو أكثر', 'In operation for a year or more')}</span></div></div>
      <div class="rp-w"><table class="rp-t"><thead><tr><th>#</th><th>${tr('السائق', 'Driver')}</th><th>${tr('رقم الإقامة', 'Iqama')}</th><th>${tr('الكراج', 'Depot')}</th><th>${tr('الحالة الحالية', 'Current status')}</th><th>${tr('أول يوم بالروستر', 'First roster day')}</th><th>${tr('المدة (يوم)', 'Days')}</th><th>${tr('أيام مرضية/اضطرارية', 'Sick/emergency days')}</th><th>${tr('آخر استعداد', 'Last standby')}</th></tr></thead><tbody>
      ${L.map((x, i) => `<tr class="cl" data-iq="${esc(x.r[C.IQ])}"><td>${i + 1}</td><td><b>${esc(x.r[C.NAME])}</b></td><td>${esc(x.r[C.IQ])}</td><td>${esc(depName(dep(x.r)))}</td><td>${esc(stName(x.r[C.ST]))}</td><td>${x.first ? dmy(x.first) : '—'}</td><td>${x.svc != null ? `<b${x.svc >= 365 && x.r[C.ST] === 'operation' ? ' class="lv-warn"' : ''}>${x.svc}</b>` : '—'}</td><td>${(x.sDays + x.eDays) || ''}</td><td>${x.sb.last ? dmy(x.sb.last) : '—'}</td></tr>`).join('') || `<tr><td colspan="9" class="msg">${tr('لا توجد نتائج', 'No results')}</td></tr>`}
      </tbody></table></div><div class="sub2">${tr('«أول يوم بالروستر» = أول يوم ظهر فيه السائق في ملف الروستر الأصلي، مو بالضرورة تاريخ مباشرته.', '"First roster day" is the first day the driver appears in the original roster file, not necessarily the joining date.')}</div>`;
    } else {
      const L = list.filter(x => x.r[C.ST] === 'operation' || x.sb.last).sort((a, z) => (a.sb.since ?? 1e9) - (z.sb.since ?? 1e9));
      const now = L.filter(x => x.sb.since === 0).length, old = L.filter(x => x.r[C.ST] === 'operation' && x.sb.since != null && x.sb.since > 180).length, never = L.filter(x => !x.sb.last).length;
      out.innerHTML = `<div class="rp-k"><div><b>${now}</b><span>${tr('على استعداد اليوم', 'On standby today')}</span></div><div><b>${old}</b><span>${tr('أكثر من 6 شهور بدون استعداد', 'Over 6 months without standby')}</span></div><div><b>${never}</b><span>${tr('ما نزلوا استعداد', 'Never on standby')}</span></div></div>
      <div class="rp-w"><table class="rp-t"><thead><tr><th>#</th><th>${tr('السائق', 'Driver')}</th><th>${tr('رقم الإقامة', 'Iqama')}</th><th>${tr('الكراج', 'Depot')}</th><th>${tr('الحالة الحالية', 'Current status')}</th><th>${tr('آخر يوم استعداد', 'Last standby day')}</th><th>${tr('المكان', 'Location')}</th><th>${tr('كم يوم مر', 'Days ago')}</th><th>${tr('مجموع أيام الاستعداد', 'Total standby days')}</th></tr></thead><tbody>
      ${L.map((x, i) => `<tr class="cl" data-iq="${esc(x.r[C.IQ])}"><td>${i + 1}</td><td><b>${esc(x.r[C.NAME])}</b></td><td>${esc(x.r[C.IQ])}</td><td>${esc(depName(dep(x.r)))}</td><td>${esc(stName(x.r[C.ST]))}</td><td>${x.sb.last ? (x.sb.since === 0 ? `<span class="chip s-sb">${tr('اليوم', 'Today')}</span>` : dmy(x.sb.last)) : tr('لم ينزل استعداد', 'Never')}</td><td>${esc(x.sb.loc || '')}</td><td>${x.sb.since ?? '—'}</td><td>${x.sb.n || ''}</td></tr>`).join('')}
      </tbody></table></div>`;
    }
    out.querySelectorAll('tr[data-iq]').forEach(t => t.onclick = () => { $('lvOv').classList.remove('on'); openEdit(t.dataset.iq); });
  }

  /* ---------- ملخص السائق داخل نافذة التعديل ---------- */
  async function drvBox(iq) {
    let box = $('lvBox');
    if (!box) { $('hist').insertAdjacentHTML('beforebegin', '<div class="lv-box" id="lvBox"></div>'); box = $('lvBox'); }
    if (!iq) { box.style.display = 'none'; return; }
    box.style.display = ''; box.innerHTML = `<span class="sub2">⏳ ${tr('سجل الإجازات...', 'Leave history...')}</span>`;
    await loadBase();
    const r = D.find(x => x[C.IQ] === iq); if (!r || EDIT !== iq) return;
    if (!(String(iq) in HIST)) { try { const j = await NWAuth.call('driverHistory', { iqama: iq }); HIST[String(iq)] = histIntervals((j && j.history) || [], r); SS('nwLvHist1', HIST); } catch (e) {} }
    if (EDIT !== iq) return;
    const P = periods(r), A = P.filter(p => p.t === 'A'), la = A[A.length - 1], sb = lastSB(r), b = (BASE.d[String(iq)] || {});
    const ret = la && la.stt === 'done' ? days(la.e, today()) : null;
    box.innerHTML = `<div class="ln">🌴 <b>${tr('آخر إجازة سنوية', 'Last annual leave')}:</b> ${la ? `${dmy(la.s)} ${EN() ? '→' : '←'} ${endTxt(la)} (${la.d} ${tr('يوم', 'days')}) · ${sttName(la.stt)}${ret != null ? ` · ${tr('رجع من', 'back for')} ${ret} ${tr('يوم', 'days')}` : ''}` : `<span class="lv-warn">${tr('لا توجد إجازة سنوية مسجلة', 'No annual leave recorded')}${b.f ? ` — ${tr('بالروستر من', 'in roster since')} ${dmy(b.f)}` : ''}</span>`}</div>
      <div class="ln">📊 ${tr('عدد الإجازات السنوية', 'Annual leaves')}: <b>${A.length}</b> · ${tr('مجموع أيامها', 'total days')}: <b>${A.reduce((s, p) => s + p.d, 0)}</b></div>
      <div class="ln">🟣 <b>${tr('آخر استعداد', 'Last standby')}:</b> ${sb.last ? `${sb.since === 0 ? tr('اليوم', 'Today') : dmy(sb.last)}${sb.loc ? ' · ' + esc(sb.loc) : ''}${sb.since ? ` · ${tr('قبل', '')} ${sb.since} ${tr('يوم', 'days ago')}` : ''}` : tr('لم ينزل استعداد', 'Never')}</div>
      ${P.length ? `<details><summary>${tr('كل الإجازات', 'All leaves')} (${P.length})</summary>${P.slice().reverse().map(p => `<div class="ln">${chip(p.t)} ${dmy(p.s)} ${EN() ? '→' : '←'} ${endTxt(p)} · <b>${p.d}</b> ${tr('يوم', 'days')} · ${sttName(p.stt)} <span class="sub2" style="display:inline">(${srcName(p.src)})</span></div>`).join('')}</details>` : ''}`;
  }

  /* ---------- Excel ---------- */
  async function xls() {
    const b = $('lvXls'); b.disabled = true;
    try {
      await loadXlsx(); const wb = XLSX.utils.book_new(), L = rowsInScope();
      const add = (name, aoa, w) => { const ws = XLSX.utils.aoa_to_sheet(aoa); ws['!cols'] = w.map(x => ({ wch: x })); XLSX.utils.book_append_sheet(wb, ws, name); };
      const per = [['اسم السائق', 'رقم الإقامة', 'الرقم الوظيفي', 'الكراج', 'نوع الإجازة', 'من', 'إلى', 'عدد الأيام', 'الحالة', 'المصدر']];
      L.forEach(x => x.P.forEach(p => per.push([x.r[C.NAME], x.r[C.IQ], x.r[C.EMP] || '', depName(dep(x.r)), TY[p.t][0], dmy(p.s), p.cur ? (p.e ? dmy(p.e) + ' (متوقع)' : 'مفتوحة') : dmy(p.e), p.d, ({ cur: 'جارية حالياً', done: 'منتهية', next: 'قادمة' })[p.stt], ({ R: 'الروستر', P: 'البرنامج', RP: 'الروستر + البرنامج' })[p.src]])));
      add('فترات الإجازات', per, [30, 13, 11, 11, 15, 11, 18, 9, 12, 16]);
      add('ملخص لكل سائق', [['اسم السائق', 'رقم الإقامة', 'الحالة الحالية', 'عدد السنوية', 'أيام السنوية', 'آخر سنوية من', 'إلى', 'من رجوعه (يوم)', 'أيام مرضية', 'أيام اضطرارية', 'آخر استعداد']]
        .concat(L.map(x => [x.r[C.NAME], x.r[C.IQ], ST[x.r[C.ST]] ? ST[x.r[C.ST]].ar : x.r[C.ST], x.A.length, x.aDays, x.la ? dmy(x.la.s) : '', x.la ? (x.la.cur ? (x.la.e ? dmy(x.la.e) : 'مفتوحة') : dmy(x.la.e)) : '', x.sinceRet ?? '', x.sDays, x.eDays, x.sb.last ? dmy(x.sb.last) : ''])), [30, 13, 14, 10, 10, 12, 12, 12, 10, 10, 12]);
      add('بدون إجازة سنوية', [['اسم السائق', 'رقم الإقامة', 'الكراج', 'الحالة الحالية', 'أول يوم بالروستر', 'المدة (يوم)', 'آخر استعداد']]
        .concat(L.filter(x => !x.A.length).map(x => [x.r[C.NAME], x.r[C.IQ], depName(dep(x.r)), ST[x.r[C.ST]] ? ST[x.r[C.ST]].ar : x.r[C.ST], x.first ? dmy(x.first) : '', x.first ? days(x.first, today()) + 1 : '', x.sb.last ? dmy(x.sb.last) : ''])), [30, 13, 11, 14, 14, 10, 12]);
      add('آخر استعداد', [['اسم السائق', 'رقم الإقامة', 'الكراج', 'الحالة الحالية', 'آخر يوم استعداد', 'المكان', 'كم يوم مر', 'مجموع أيام الاستعداد']]
        .concat(L.map(x => [x.r[C.NAME], x.r[C.IQ], depName(dep(x.r)), ST[x.r[C.ST]] ? ST[x.r[C.ST]].ar : x.r[C.ST], x.sb.last ? dmy(x.sb.last) : 'لم ينزل استعداد', x.sb.loc || '', x.sb.since ?? '', x.sb.n || 0])), [30, 13, 11, 14, 14, 12, 10, 12]);
      XLSX.writeFile(wb, `Leaves_Standby_${today()}.xlsx`);
    } catch (e) { alert(e.message || 'Error'); }
    finally { b.disabled = false; }
  }

  /* ---------- الربط مع البرنامج ---------- */
  function hook() {
    ui();
    if (typeof openEdit === 'function' && !openEdit.__lv) {
      const o = openEdit;
      openEdit = function (iq) { const r = o.apply(this, arguments); try { drvBox(iq || ''); } catch (e) {} return r; };
      openEdit.__lv = true;
    }
    const oc = window.__clearHist;   // بعد حفظ تعديل سائق: نعيد قراءة سجله ونحدّث الحسابات
    window.__clearHist = iq => { if (oc) oc(iq); if (iq) delete HIST[String(iq)]; else HIST = {}; SS('nwLvHist1', HIST); RES = null; LSB = null; LSB_AT = ''; };
    if ($('fDate')) $('fDate').addEventListener('change', () => { RES = null; });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hook); else hook();
})();
