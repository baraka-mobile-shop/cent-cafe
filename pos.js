/* Cent POS — cashier system SPA (lock, cashier, barista, menu admin, reports) */
(function () {
  const C = window.Cent;
  C.seedLive();
  const params = new URLSearchParams(location.search);
  const PREVIEW = params.has('preview');

  const PINS = { '1111': { role: 'cashier', name: 'كاشير' }, '9999': { role: 'manager', name: 'مدير' } };
  let session = null;
  try { session = JSON.parse(sessionStorage.getItem('cent_session') || 'null'); } catch (e) {}
  if (PREVIEW && !session) session = { role: 'manager', name: 'مدير' };

  let view = session ? (location.hash.replace('#', '') || 'cashier') : 'lock';
  let cart = [];
  let orderType = 'dinein';
  let tableNo = '4';
  let custName = '';
  let discount = 0;
  let activeCat = 'all';
  let searchQ = '';

  const root = document.getElementById('root');
  const overlayRoot = document.getElementById('overlay-root');

  const TYPE_NAMES = { dinein: 'صالة', pickup: 'تيك أواي', delivery: 'دليفري' };
  const STATUS_FLOW = { new: 'prep', prep: 'ready', ready: 'done' };
  const STATUS_ACT = { new: 'ابدأ التحضير', prep: 'تم التجهيز', ready: 'تم التسليم' };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function money(n) { return C.fmt(n) + ' ج'; }
  function toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast'; t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2200);
  }

  /* ---------- header ---------- */
  function header(active) {
    const shift = C.getShift();
    const nav = session ? `
      <a class="navtab ${active === 'cashier' ? 'active' : ''}" href="#cashier" data-v="cashier">الكاشير</a>
      <a class="navtab ${active === 'barista' ? 'active' : ''}" href="#barista" data-v="barista">التحضير</a>
      ${session.role === 'manager' ? `
      <a class="navtab ${active === 'menu' ? 'active' : ''}" href="#menu" data-v="menu">المنيو</a>
      <a class="navtab ${active === 'qr' ? 'active' : ''}" href="#qr" data-v="qr">QR الطاولات</a>
      <a class="navtab ${active === 'reports' ? 'active' : ''}" href="#reports" data-v="reports">التقارير</a>` : ''}` : '';
    return `<header>
      <a class="brand" href="#cashier" data-v="cashier">
        <div class="mark"><svg viewBox="0 0 24 24" fill="none" stroke="#E8C78F" stroke-width="1.8" stroke-linecap="round"><path d="M4 9h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9z"/><path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17"/><path d="M8 5.5c0-1 .8-1.2.8-2M11.5 5.5c0-1 .8-1.2.8-2"/></svg></div>
        <h1><span class="wordmark">Cent</span><small>نظام الكاشير</small></h1>
      </a>
      ${nav}
      <div class="header-spacer"></div>
      ${session ? `<span class="pill ${shift && !shift.closed ? 'green' : 'red'} hide-m">${shift && !shift.closed ? 'الوردية مفتوحة' : 'الوردية مقفولة'}</span>
      <span class="pill gray hide-m">${esc(session.name)}</span>
      <button class="icon-btn" id="btn-install" title="تثبيت التطبيق" style="display:none"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12m0 0 4-4m-4 4-4-4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg></button>
      <button class="icon-btn" id="btn-lock" title="قفل"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg></button>` : ''}
    </header>`;
  }

  /* ---------- lock ---------- */
  let pinBuf = '';
  function renderLock() {
    root.innerHTML = `<div class="lock-wrap">
      <a class="brand" style="pointer-events:none">
        <div class="mark" style="width:56px;height:56px;border-radius:16px"><svg viewBox="0 0 24 24" fill="none" stroke="#E8C78F" stroke-width="1.8" stroke-linecap="round" style="width:30px;height:30px"><path d="M4 9h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9z"/><path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17"/><path d="M8 5.5c0-1 .8-1.2.8-2M11.5 5.5c0-1 .8-1.2.8-2"/></svg></div>
        <h1 style="font-size:38px"><span class="wordmark">Cent</span></h1>
      </a>
      <div class="lock-card">
        <b style="font-size:15px">أدخل الرقم السري</b>
        <div class="lock-dots">${[0, 1, 2, 3].map(i => `<i class="${pinBuf.length > i ? 'on' : ''}"></i>`).join('')}</div>
        <div class="lock-err" id="lock-err"></div>
        <div class="pad">
          ${['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✓'].map(k => `<button data-k="${k}">${k}</button>`).join('')}
        </div>
        <div style="margin-top:14px;font-size:11.5px;color:var(--muted)">للتجربة — كاشير: ١١١١ · مدير: ٩٩٩٩</div>
      </div>
    </div>`;
    root.querySelectorAll('.pad button').forEach(b => b.onclick = () => {
      const k = b.dataset.k;
      if (k === '⌫') pinBuf = pinBuf.slice(0, -1);
      else if (k === '✓') return tryPin();
      else if (pinBuf.length < 4) { pinBuf += k; if (pinBuf.length === 4) return tryPin(); }
      renderLock();
    });
  }
  function tryPin() {
    const norm = pinBuf.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
    const p = PINS[norm];
    if (p) {
      session = p;
      try { sessionStorage.setItem('cent_session', JSON.stringify(p)); } catch (e) {}
      pinBuf = ''; view = 'cashier'; location.hash = '#cashier'; render();
    } else {
      pinBuf = ''; renderLock();
      document.getElementById('lock-err').textContent = 'رقم غير صحيح، حاول تاني';
    }
  }

  /* ---------- cashier ---------- */
  function menuItems() {
    const m = C.getMenu();
    return m.items.filter(i => (activeCat === 'all' || i.cat === activeCat) && (!searchQ || i.name.includes(searchQ)));
  }
  function catOf(id) { return C.CATS.find(c => c.id === id) || C.CATS[0]; }
  function itemBasePrice(it) { return it.sizes ? Math.min(...Object.values(it.sizes)) : it.price; }

  function renderCashier() {
    const m = C.getMenu();
    const items = menuItems();
    const cartQty = id => cart.filter(c => c.itemId === id).reduce((s, c) => s + c.qty, 0);
    root.innerHTML = header('cashier') + `
    <div class="pos-wrap">
      <div class="menu-area">
        <div style="display:flex;gap:10px;align-items:center;padding-bottom:12px">
          <div class="search" style="flex:1;max-width:320px">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
            <input id="q" placeholder="ابحث عن صنف…  ( / )" value="${esc(searchQ)}">
          </div>
        </div>
        <div class="cats">
          <span class="cat ${activeCat === 'all' ? 'active' : ''}" data-cat="all">الكل</span>
          ${m.cats.map(c => `<span class="cat ${activeCat === c.id ? 'active' : ''}" data-cat="${c.id}">${esc(c.name)}</span>`).join('')}
        </div>
        <div class="grid">
          ${items.map(it => {
            const q = cartQty(it.id);
            return `<button class="product ${q ? 'sel' : ''} ${it.available ? '' : 'off'}" data-item="${it.id}">
              ${q ? `<span class="qty-badge">${C.fmt(q)}</span>` : ''}
              <div class="picon ${catOf(it.cat).cls}">${esc(it.letter)}</div>
              <h3>${esc(it.name)}</h3>
              <div class="price">${it.sizes ? 'من ' + money(itemBasePrice(it)) : money(it.price)}</div>
            </button>`;
          }).join('') || '<div style="color:var(--faint);padding:30px">لا توجد أصناف مطابقة</div>'}
        </div>
      </div>
      ${orderPanelHtml(false)}
    </div>
    ${cart.length ? `<button class="mobile-order-bar" id="mob-open">
      <span class="c">${C.fmt(cart.reduce((s, c) => s + c.qty, 0))}</span>
      <b>${money(totals().total)}</b>
      <span style="font-size:12px;opacity:.75">${TYPE_NAMES[orderType]}${orderType === 'dinein' ? ' · طاولة ' + esc(tableNo) : ''}</span>
      <span class="go">عرض الطلب</span>
    </button>` : ''}`;
    bindCashier();
  }

  function orderPanelHtml(sheet) {
    const t = totals();
    return `<div class="order-panel ${sheet ? 'sheet' : ''}" id="order-panel">
      <div class="op-head">
        <div class="seg">
          ${Object.entries(TYPE_NAMES).map(([k, v]) => `<button class="${orderType === k ? 'on' : ''}" data-ot="${k}">${v}</button>`).join('')}
        </div>
        <div class="op-table">
          طلب جديد · الكاشير: <b>${esc(session.name)}</b>
          ${orderType === 'dinein' ? `· طاولة <select id="f-table">${['1','2','3','4','5','6','7','8','9','10'].map(n => `<option ${n === tableNo ? 'selected' : ''}>${n}</option>`).join('')}</select>` : ''}
          ${orderType !== 'dinein' ? `· <input id="f-name" placeholder="اسم العميل (اختياري)" value="${esc(custName)}" style="width:150px">` : ''}
        </div>
      </div>
      ${cart.length ? `<div class="op-items">
        ${cart.map((c, i) => `<div class="oi">
          <div class="info"><b>${esc(c.name)}</b>
            <div class="meta">${esc(c.size || '')}${c.addons.length ? ' · <em>+ ' + c.addons.map(a => esc(a)).join('، ') + '</em>' : ''}${c.notes ? ' · ' + esc(c.notes) : ''}</div>
          </div>
          <div class="stepper"><button data-dec="${i}">−</button><span>${C.fmt(c.qty)}</span><button data-inc="${i}">+</button></div>
          <div class="amt">${money(c.qty * c.unit)}</div>
          <button class="del" data-del="${i}">×</button>
        </div>`).join('')}
      </div>` : `<div class="op-empty">
        <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M4 9h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9z"/><path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17"/></svg>
        اختر الأصناف من المنيو
      </div>`}
      <div class="op-totals">
        <div class="trow"><span>المجموع</span><span>${money(t.subtotal)}</span></div>
        <div class="trow"><span>خصم</span><span><input id="f-disc" type="number" min="0" value="${discount}" style="width:70px"> ج</span></div>
        <div class="trow total"><span>الإجمالي</span><span>${money(t.total)}</span></div>
      </div>
      <div class="op-pay">
        <button class="btn primary" id="pay-cash" ${cart.length ? '' : 'disabled'}>دفع كاش</button>
        <button class="btn dark" id="pay-visa" ${cart.length ? '' : 'disabled'}>فيزا</button>
        <button class="btn ghost" style="flex:.7" id="pay-clear">مسح</button>
      </div>
    </div>`;
  }

  function totals() {
    const subtotal = cart.reduce((s, c) => s + c.qty * c.unit, 0);
    const tax = 0;
    const total = Math.max(0, Math.round((subtotal - (discount || 0)) * 10) / 10);
    return { subtotal, tax, total };
  }

  function bindCashier() {
    const q = document.getElementById('q');
    if (q) { q.oninput = () => { searchQ = q.value; renderCashier(); const nq = document.getElementById('q'); nq.focus(); nq.setSelectionRange(nq.value.length, nq.value.length); }; }
    root.querySelectorAll('.cat').forEach(c => c.onclick = () => { activeCat = c.dataset.cat; renderCashier(); });
    root.querySelectorAll('.product').forEach(p => p.onclick = () => openItemModal(p.dataset.item));
    bindOrderPanel(root);
    const mob = document.getElementById('mob-open');
    if (mob) mob.onclick = () => openSheet();
  }

  function bindOrderPanel(scope) {
    scope.querySelectorAll('[data-ot]').forEach(b => b.onclick = () => { orderType = b.dataset.ot; rerenderPanel(); });
    scope.querySelectorAll('[data-inc]').forEach(b => b.onclick = () => { cart[+b.dataset.inc].qty++; rerenderPanel(); });
    scope.querySelectorAll('[data-dec]').forEach(b => b.onclick = () => { const c = cart[+b.dataset.dec]; c.qty--; if (c.qty <= 0) cart.splice(+b.dataset.dec, 1); rerenderPanel(); });
    scope.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { cart.splice(+b.dataset.del, 1); rerenderPanel(); });
    const tb = scope.querySelector('#f-table'); if (tb) tb.onchange = () => { tableNo = tb.value; };
    const nm = scope.querySelector('#f-name'); if (nm) nm.onchange = () => { custName = nm.value; };
    const dc = scope.querySelector('#f-disc'); if (dc) dc.onchange = () => { discount = Math.max(0, +dc.value || 0); rerenderPanel(); };
    const pc = scope.querySelector('#pay-cash'); if (pc) pc.onclick = () => openCashModal();
    const pv = scope.querySelector('#pay-visa'); if (pv) pv.onclick = () => finishOrder('visa');
    const px = scope.querySelector('#pay-clear'); if (px) px.onclick = () => { cart = []; discount = 0; rerenderPanel(); };
  }

  function rerenderPanel() {
    if (document.getElementById('sheet-overlay')) { openSheet(); return; }
    renderCashier();
  }

  function openSheet() {
    overlayRoot.innerHTML = `<div class="overlay" id="sheet-overlay" style="align-items:flex-end;padding:0">
      <div style="width:100%">${orderPanelHtml(true)}</div>
    </div>`;
    const ov = document.getElementById('sheet-overlay');
    ov.onclick = e => { if (e.target === ov) overlayRoot.innerHTML = ''; };
    bindOrderPanel(overlayRoot);
  }

  /* item modal */
  function openItemModal(itemId) {
    const it = C.getMenu().items.find(i => i.id === itemId);
    if (!it || !it.available) return;
    const sizes = it.sizes ? Object.entries(it.sizes) : null;
    let selSize = sizes ? sizes[0][0] : null;
    let selAddons = [];
    let qty = 1, notes = '';
    const render = () => {
      const unit = (sizes ? it.sizes[selSize] : it.price) + selAddons.reduce((s, a) => s + C.ADDONS.find(x => x.id === a).price, 0);
      overlayRoot.innerHTML = `<div class="overlay" id="im">
        <div class="modal">
          <div class="m-head">
            <div class="picon ${catOf(it.cat).cls}" style="width:40px;height:40px;border-radius:11px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800">${esc(it.letter)}</div>
            <h3>${esc(it.name)}</h3>
            <button class="m-close" id="im-x">×</button>
          </div>
          <div class="m-body">
            ${sizes ? `<div class="m-label">الحجم</div><div class="chips" id="im-sizes">
              ${sizes.map(([n, p]) => `<button class="chip ${n === selSize ? 'on' : ''}" data-s="${esc(n)}">${esc(n)} <span class="p">${money(p)}</span></button>`).join('')}
            </div>` : ''}
            ${it.addons ? `<div class="m-label">إضافات</div><div class="chips" id="im-addons">
              ${C.ADDONS.map(a => `<button class="chip ${selAddons.includes(a.id) ? 'on' : ''}" data-a="${a.id}">${esc(a.name)} <span class="p">+${money(a.price)}</span></button>`).join('')}
            </div>` : ''}
            <div class="m-label">ملاحظات</div>
            <textarea class="m-note" id="im-notes" rows="2" placeholder="مثال: سكر قليل، من غير بصل…">${esc(notes)}</textarea>
            <div class="m-foot">
              <div class="stepper"><button id="im-dec">−</button><span>${C.fmt(qty)}</span><button id="im-inc">+</button></div>
              <button class="btn primary" id="im-add">إضافة · ${money(unit * qty)}</button>
            </div>
          </div>
        </div>
      </div>`;
      const ov = document.getElementById('im');
      ov.onclick = e => { if (e.target === ov) overlayRoot.innerHTML = ''; };
      document.getElementById('im-x').onclick = () => overlayRoot.innerHTML = '';
      overlayRoot.querySelectorAll('#im-sizes .chip').forEach(ch => ch.onclick = () => { selSize = ch.dataset.s; render(); });
      overlayRoot.querySelectorAll('#im-addons .chip').forEach(ch => ch.onclick = () => {
        const a = ch.dataset.a;
        selAddons = selAddons.includes(a) ? selAddons.filter(x => x !== a) : [...selAddons, a];
        render();
      });
      document.getElementById('im-notes').oninput = e => notes = e.target.value;
      document.getElementById('im-inc').onclick = () => { qty++; render(); document.getElementById('im-notes').value = notes; };
      document.getElementById('im-dec').onclick = () => { if (qty > 1) qty--; render(); document.getElementById('im-notes').value = notes; };
      document.getElementById('im-add').onclick = () => {
        cart.push({ itemId: it.id, name: it.name, size: selSize || '', addons: selAddons.map(a => C.ADDONS.find(x => x.id === a).name), notes, qty, unit });
        overlayRoot.innerHTML = '';
        rerenderPanel();
        toast('اتضافت للطلب');
      };
    };
    render();
  }

  /* cash modal */
  function openCashModal() {
    const t = totals();
    let paid = String(Math.ceil(t.total));
    const render = () => {
      const change = Math.max(0, Math.round(((+paid || 0) - t.total) * 10) / 10);
      overlayRoot.innerHTML = `<div class="overlay" id="cm">
        <div class="modal" style="width:380px">
          <div class="m-head"><h3>دفع كاش</h3><button class="m-close" id="cm-x">×</button></div>
          <div class="m-body">
            <div class="trow total" style="margin-bottom:12px"><span>الإجمالي</span><span>${money(t.total)}</span></div>
            <div class="field"><label>المبلغ المدفوع</label><input id="cm-paid" type="number" inputmode="numeric" value="${esc(paid)}"></div>
            <div class="chips" style="margin-bottom:12px">
              ${[50, 100, 200].map(v => `<button class="chip" data-p="${v}">${money(v)}</button>`).join('')}
              <button class="chip" data-p="exact">بالظبط</button>
            </div>
            <div class="trow" style="font-size:15px"><span>الباقي للعميل</span><b style="color:var(--green)">${money(change)}</b></div>
            <div class="m-foot"><button class="btn primary" id="cm-ok" ${(+paid || 0) >= t.total ? '' : 'disabled'}>تأكيد الدفع وطباعة</button></div>
          </div>
        </div>
      </div>`;
      const ov = document.getElementById('cm');
      ov.onclick = e => { if (e.target === ov) overlayRoot.innerHTML = ''; };
      document.getElementById('cm-x').onclick = () => overlayRoot.innerHTML = '';
      const inp = document.getElementById('cm-paid');
      inp.focus(); inp.select();
      inp.oninput = () => { paid = inp.value; const ok = document.getElementById('cm-ok'); const chg = Math.max(0, Math.round(((+paid || 0) - t.total) * 10) / 10); ok.disabled = (+paid || 0) < t.total; ok.textContent = 'تأكيد الدفع وطباعة'; ov.querySelector('.trow b').textContent = money(chg); };
      inp.onkeydown = e => { if (e.key === 'Enter' && (+paid || 0) >= t.total) { finishOrder('cash', +paid); } };
      overlayRoot.querySelectorAll('[data-p]').forEach(ch => ch.onclick = () => { paid = ch.dataset.p === 'exact' ? String(t.total) : ch.dataset.p; render(); });
      document.getElementById('cm-ok').onclick = () => finishOrder('cash', +paid);
    };
    render();
  }

  function finishOrder(pay, paidAmt) {
    const t = totals();
    const o = C.addOrder({
      type: orderType, table: orderType === 'dinein' ? tableNo : '', name: custName,
      items: cart.map(c => ({ ...c })), subtotal: t.subtotal, tax: t.tax, discount: discount || 0,
      total: t.total, pay, paid: paidAmt || t.total, source: 'pos'
    });
    overlayRoot.innerHTML = '';
    printReceipt(o);
    cart = []; discount = 0; custName = '';
    renderCashier();
    toast('تم تسجيل الطلب #' + C.fmt(o.seq) + ' وانبعت للتحضير');
  }

  function printReceipt(o) {
    const r = document.getElementById('receipt');
    r.innerHTML = `
      <h2>Cent</h2>
      <div class="r-sub">طلب #${C.fmt(o.seq)} · ${TYPE_NAMES[o.type]}${o.table ? ' · طاولة ' + esc(o.table) : ''}<br>${new Date(o.ts).toLocaleString('ar-EG')}</div>
      <div class="r-dash"></div>
      ${o.items.map(i => `<div class="r-line"><span>${C.fmt(i.qty)} × ${esc(i.name)} ${esc(i.size || '')}</span><span>${money(i.qty * i.unit)}</span></div>
        ${i.addons.length || i.notes ? `<div class="r-line" style="font-size:10px;color:#555"><span>${i.addons.map(a => '+ ' + esc(a)).join('، ')} ${esc(i.notes || '')}</span><span></span></div>` : ''}`).join('')}
      <div class="r-dash"></div>
      <div class="r-line"><span>المجموع</span><span>${money(o.subtotal)}</span></div>
      ${o.discount ? `<div class="r-line"><span>خصم</span><span>- ${money(o.discount)}</span></div>` : ''}
      <div class="r-line r-total"><span>الإجمالي</span><span>${money(o.total)}</span></div>
      <div class="r-line"><span>الدفع</span><span>${o.pay === 'cash' ? 'كاش' : 'فيزا'}</span></div>
      <div class="r-dash"></div>
      <div class="r-sub">شكرًا لزيارتكم Cent</div>`;
    setTimeout(() => window.print(), 150);
  }

  /* ---------- barista ---------- */
  function renderBarista() {
    const list = C.orders().filter(o => ['new', 'prep', 'ready'].includes(o.status));
    const cols = { new: [], prep: [], ready: [] };
    list.forEach(o => cols[o.status] && cols[o.status].push(o));
    const ticket = o => `
      <div class="ticket">
        <div class="t-head">
          <span class="t-num">#${C.fmt(o.seq)}</span>
          <span class="t-type">${TYPE_NAMES[o.type]}${o.table ? ' · طاولة ' + esc(o.table) : ''}${o.name ? ' · ' + esc(o.name) : ''}</span>
          ${o.source === 'site' ? '<span class="t-src">أونلاين · كاش عند الاستلام</span>' : ''}
          <span class="t-time ${C.minsAgo(o.ts) >= 10 ? 'late' : C.minsAgo(o.ts) >= 6 ? 'warn' : 'ok'}">من ${C.fmt(C.minsAgo(o.ts))} دقيقة</span>
        </div>
        <ul>${o.items.map(i => `<li><span class="q">${C.fmt(i.qty)}×</span><span>${esc(i.name)} ${esc(i.size || '')}${i.addons.length ? `<span class="note">+ ${i.addons.map(esc).join('، ')}</span>` : ''}${i.notes ? `<span class="note">${esc(i.notes)}</span>` : ''}</span></li>`).join('')}</ul>
        <button class="t-act ${o.status !== 'new' ? 'go' : ''}" data-adv="${o.id}">${STATUS_ACT[o.status]}</button>
      </div>`;
    root.innerHTML = header('barista') + `
    <div class="page">
      <div class="toolbar"><h2>طلبات التحضير</h2><span class="pill">${C.fmt(list.length)} طلبات نشطة</span></div>
      <div class="kds">
        <div class="kds-col new"><h3>جديد <span>${C.fmt(cols.new.length)}</span></h3>${cols.new.map(ticket).join('') || '<div style="color:var(--faint);font-size:12.5px;padding:8px">لا توجد طلبات</div>'}</div>
        <div class="kds-col prep"><h3>بيتحضّر <span>${C.fmt(cols.prep.length)}</span></h3>${cols.prep.map(ticket).join('') || '<div style="color:var(--faint);font-size:12.5px;padding:8px">لا توجد طلبات</div>'}</div>
        <div class="kds-col ready"><h3>جاهز للتسليم <span>${C.fmt(cols.ready.length)}</span></h3>${cols.ready.map(ticket).join('') || '<div style="color:var(--faint);font-size:12.5px;padding:8px">لا توجد طلبات</div>'}</div>
      </div>
    </div>`;
    bindHeader();
    root.querySelectorAll('[data-adv]').forEach(b => b.onclick = () => {
      const o = C.orders().find(x => x.id === b.dataset.adv);
      C.updateOrder(b.dataset.adv, { status: STATUS_FLOW[o.status] });
      renderBarista();
    });
  }

  /* ---------- menu admin ---------- */
  function renderMenu() {
    const m = C.getMenu();
    const avail = m.items.filter(i => i.available).length;
    root.innerHTML = header('menu') + `
    <div class="page">
      <div class="toolbar">
        <h2>المنيو</h2>
        <span class="pill">${C.fmt(m.items.length)} صنف</span>
        <span class="pill gray">${C.fmt(m.cats.length)} فئات</span>
        <span class="pill red">${C.fmt(m.items.length - avail)} نافد</span>
        <div class="header-spacer"></div>
        <button class="btn primary sm" id="mi-add">+ إضافة صنف</button>
      </div>
      <div class="menu-list">
        ${m.items.map(it => `<div class="mi ${it.available ? '' : 'out'}">
          <div class="picon ${catOf(it.cat).cls}">${esc(it.letter)}</div>
          <div class="mi-info"><b>${esc(it.name)}</b><small>${esc(catOf(it.cat).name)}${it.addons ? ' · إضافات متاحة' : ''}</small></div>
          <div class="sizes">
            ${it.sizes ? Object.entries(it.sizes).map(([n, p]) => `<div class="size-chip"><small>${esc(n)}</small><b>${money(p)}</b></div>`).join('') : `<div class="size-chip"><small>سعر</small><b>${money(it.price)}</b></div>`}
          </div>
          <button class="toggle ${it.available ? '' : 'off'}" data-tgl="${it.id}" title="متاح / نافد"></button>
          ${it.available ? '' : '<span class="pill red">نافد</span>'}
          <button class="icon-btn" data-edit="${it.id}"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
        </div>`).join('')}
      </div>
    </div>`;
    bindHeader();
    root.querySelectorAll('[data-tgl]').forEach(b => b.onclick = () => {
      const mm = C.getMenu();
      const it = mm.items.find(i => i.id === b.dataset.tgl);
      it.available = !it.available;
      C.saveMenu(mm); renderMenu();
    });
    root.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => openEditModal(b.dataset.edit));
    document.getElementById('mi-add').onclick = () => openEditModal(null);
  }

  function openEditModal(itemId) {
    const mm = C.getMenu();
    const it = itemId ? mm.items.find(i => i.id === itemId) : { id: 'i' + Date.now().toString(36), name: '', cat: 'hot', letter: '', price: 50, sizes: null, addons: false, available: true };
    let sizesText = it.sizes ? Object.entries(it.sizes).map(([n, p]) => n + '=' + p).join('، ') : '';
    overlayRoot.innerHTML = `<div class="overlay" id="em">
      <div class="modal">
        <div class="m-head"><h3>${itemId ? 'تعديل صنف' : 'إضافة صنف'}</h3><button class="m-close" id="em-x">×</button></div>
        <div class="m-body">
          <div class="field"><label>اسم الصنف</label><input id="em-name" value="${esc(it.name)}"></div>
          <div class="field"><label>الفئة</label><select id="em-cat">${C.CATS.map(c => `<option value="${c.id}" ${it.cat === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
          <div class="field"><label>أحجام وأسعار (اختياري) — بالشكل: صغير=٥٥، كبير=٧٥</label><input id="em-sizes" value="${esc(sizesText)}" placeholder="فارغ = سعر واحد"></div>
          <div class="field"><label>السعر الواحد (لو مفيش أحجام)</label><input id="em-price" type="number" value="${it.price || ''}"></div>
          <div class="field"><label><input type="checkbox" id="em-addons" ${it.addons ? 'checked' : ''} style="width:auto;margin-inline-end:6px">يقبل إضافات (شوت، لبن شوفان…)</label></div>
          <div class="m-foot">
            <button class="btn primary" id="em-save">حفظ</button>
            ${itemId ? `<button class="btn ghost" id="em-del" style="color:var(--red);flex:.6">حذف</button>` : ''}
          </div>
        </div>
      </div>
    </div>`;
    const close = () => overlayRoot.innerHTML = '';
    document.getElementById('em-x').onclick = close;
    document.getElementById('em').onclick = e => { if (e.target.id === 'em') close(); };
    document.getElementById('em-save').onclick = () => {
      const name = document.getElementById('em-name').value.trim();
      if (!name) return;
      it.name = name;
      it.letter = name.trim().charAt(0);
      it.cat = document.getElementById('em-cat').value;
      it.addons = document.getElementById('em-addons').checked;
      const st = document.getElementById('em-sizes').value.trim();
      if (st) {
        const norm = st.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/،/g, ',');
        const entries = norm.split(',').map(s => s.trim()).filter(Boolean).map(s => { const [n, p] = s.split('='); return [n.trim(), +p || 0]; }).filter(e => e[0] && e[1]);
        it.sizes = entries.length ? Object.fromEntries(entries) : null;
        it.price = entries.length ? entries[0][1] : it.price;
      } else { it.sizes = null; it.price = +document.getElementById('em-price').value || it.price; }
      const mm2 = C.getMenu();
      const ix = mm2.items.findIndex(i => i.id === it.id);
      if (ix >= 0) mm2.items[ix] = it; else mm2.items.push(it);
      C.saveMenu(mm2); close(); renderMenu(); toast('اتحفظ');
    };
    const del = document.getElementById('em-del');
    if (del) del.onclick = () => {
      const mm2 = C.getMenu();
      mm2.items = mm2.items.filter(i => i.id !== it.id);
      C.saveMenu(mm2); close(); renderMenu(); toast('اتحذف');
    };
  }

  /* ---------- reports ---------- */
  function renderReports() {
    const today = C.todayOrders().filter(o => o.status !== 'canceled');
    const totalSales = today.reduce((s, o) => s + o.total, 0);
    const cash = today.filter(o => o.pay === 'cash').reduce((s, o) => s + o.total, 0);
    const visa = today.filter(o => o.pay === 'visa').reduce((s, o) => s + o.total, 0);
    const cod = today.filter(o => o.pay === 'cod').reduce((s, o) => s + o.total, 0);
    const avg = today.length ? totalSales / today.length : 0;
    const week = C.weekSeries();
    const maxW = Math.max(...week.map(w => w.total), 1);
    const top = C.topItemsToday();
    const maxTop = top.length ? top[0][1] : 1;
    const shift = C.getShift();
    const shiftOrders = shift ? today.filter(o => o.ts >= shift.openedAt) : [];
    const shiftCash = shiftOrders.filter(o => o.pay === 'cash').reduce((s, o) => s + o.total, 0);
    const expected = shift ? (shift.float + shiftCash) : 0;
    root.innerHTML = header('reports') + `
    <div class="page">
      <div class="toolbar">
        <h2>تقرير اليوم</h2>
        <span class="pill">${new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
        <div class="header-spacer"></div>
        <button class="btn ghost sm" id="exp-csv">تصدير Excel (CSV)</button>
      </div>
      <div class="kpis">
        <div class="kpi"><small>إجمالي المبيعات</small><b>${money(totalSales)}</b></div>
        <div class="kpi"><small>عدد الطلبات</small><b>${C.fmt(today.length)} طلب</b></div>
        <div class="kpi"><small>متوسط الفاتورة</small><b>${money(Math.round(avg))}</b></div>
        <div class="kpi"><small>أونلاين (الموقع)</small><b>${money(today.filter(o => o.source === 'site').reduce((s, o) => s + o.total, 0))}</b></div>
      </div>
      <div class="rep-grid">
        <div>
          <div class="card">
            <h3>مبيعات آخر ٧ أيام <small>بالجنيه المصري</small></h3>
            <div class="chart">
              ${week.map(w => `<div class="bar ${w.today ? 'today' : ''}"><span class="val">${C.fmt(Math.round(w.total / 100) / 10)}k</span><div class="col" style="height:${Math.max(4, Math.round(w.total / maxW * 100))}%"></div><span class="day">${w.day}</span></div>`).join('')}
            </div>
          </div>
          <div class="card">
            <h3>طرق الدفع اليوم</h3>
            <div class="trow"><span>كاش</span><b>${money(cash)}</b></div>
            <div class="trow"><span>فيزا</span><b>${money(visa)}</b></div>
            <div class="trow"><span>كاش عند الاستلام (أونلاين)</span><b>${money(cod)}</b></div>
          </div>
        </div>
        <div>
          <div class="card">
            <h3>أكثر الأصناف مبيعًا اليوم</h3>
            ${top.map(([name, q], i) => `<div class="top-item"><span class="rank">${C.fmt(i + 1)}</span><div class="ti-info"><b>${esc(name)}</b><div class="bar-line"><i style="width:${Math.round(q / maxTop * 100)}%"></i></div></div><span class="ti-amt">${C.fmt(q)} طلب</span></div>`).join('') || '<div style="color:var(--faint);font-size:13px">لا توجد مبيعات بعد</div>'}
          </div>
          <div class="card shift-card">
            <h3>${shift && !shift.closed ? 'الوردية الحالية' : 'فتح وردية'}</h3>
            ${shift && !shift.closed ? `
              <div class="srow"><span>رصيد فتح الدرج</span><b>${money(shift.float)}</b></div>
              <div class="srow"><span>مبيعات كاش (الوردية)</span><b>${money(shiftCash)}</b></div>
              <div class="srow"><span>طلبات الوردية</span><b>${C.fmt(shiftOrders.length)}</b></div>
              <div class="srow hl"><span>المتوقع في الدرج</span><b class="ok">${money(Math.round(expected * 10) / 10)}</b></div>
              <button class="btn primary" style="width:100%;margin-top:10px" id="shift-close">قفل الوردية وطباعة التقرير</button>
            ` : `
              <div class="field"><label>رصيد فتح الدرج</label><input id="shift-float" type="number" value="500"></div>
              <button class="btn primary" style="width:100%" id="shift-open">فتح وردية جديدة</button>
            `}
          </div>
        </div>
      </div>
    </div>`;
    bindHeader();
    const so = document.getElementById('shift-open');
    if (so) so.onclick = () => { C.openShift(+document.getElementById('shift-float').value || 0, session.name); renderReports(); toast('اتفتحت الوردية'); };
    const sc = document.getElementById('shift-close');
    if (sc) sc.onclick = () => { C.closeShift(); renderReports(); toast('اتقفلت الوردية'); setTimeout(() => window.print(), 200); };
    document.getElementById('exp-csv').onclick = () => {
      const rows = [['seq', 'time', 'type', 'table', 'items', 'total', 'pay', 'source', 'status']];
      today.forEach(o => rows.push([o.seq, new Date(o.ts).toLocaleTimeString('ar-EG'), TYPE_NAMES[o.type], o.table || '', o.items.map(i => i.qty + 'x ' + i.name).join(' | '), o.total, o.pay, o.source, o.status]));
      const csv = '﻿' + rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      a.download = 'cent-orders-' + C.dayKey() + '.csv';
      a.click();
    };
  }

  /* ---------- QR tables ---------- */
  function siteBase() { return location.href.slice(0, location.href.lastIndexOf('/') + 1) + 'site.html'; }
  let qrCount = parseInt(localStorage.getItem('cent_qr_count') || '12', 10) || 12;
  function renderQr() {
    root.innerHTML = header('qr') + `<div class="page">
      <div class="card qr-controls">
        <h3>QR الطاولات</h3>
        <p class="qr-hint">اطبع والصق كل QR على ترابيزته. العميل يمسحه ويطلب من موبايله، والطلب يوصل لشاشة التحضير برقم الطاولة.</p>
        <div class="qr-ctrl-row">
          <label>عدد الطاولات</label>
          <input id="qr-count" type="number" min="1" max="60" value="${qrCount}" style="width:80px">
          <button class="btn primary" id="qr-gen">حدّث الرموز</button>
          <button class="btn dark" id="qr-print">🖨 طباعة الكل</button>
        </div>
      </div>
      <div class="qr-grid" id="qr-grid"></div>
    </div>`;
    bindHeader();
    const draw = () => {
      const grid = document.getElementById('qr-grid');
      grid.innerHTML = '';
      for (let n = 1; n <= qrCount; n++) {
        const url = siteBase() + '?table=' + n;
        const card = document.createElement('div');
        card.className = 'qr-card';
        card.innerHTML = `<div class="qr-brand"><span class="wordmark">Cent</span></div><div class="qr-box"></div><b>طاولة ${C.fmt(n)}</b><small>امسح واطلب</small>`;
        grid.appendChild(card);
        try {
          new QRCode(card.querySelector('.qr-box'), { text: url, width: 148, height: 148, correctLevel: QRCode.CorrectLevel.M });
        } catch (e) { card.querySelector('.qr-box').textContent = 'QR error'; }
      }
    };
    document.getElementById('qr-gen').onclick = () => {
      qrCount = Math.max(1, Math.min(60, parseInt(document.getElementById('qr-count').value, 10) || 12));
      try { localStorage.setItem('cent_qr_count', String(qrCount)); } catch (e) {}
      draw();
    };
    document.getElementById('qr-print').onclick = () => {
      document.body.classList.add('print-qr');
      window.print();
      setTimeout(() => document.body.classList.remove('print-qr'), 400);
    };
    draw();
  }

  /* ---------- chrome ---------- */
  function bindHeader() {
    const lock = document.getElementById('btn-lock');
    if (lock) lock.onclick = () => { try { sessionStorage.removeItem('cent_session'); } catch (e) {} session = null; view = 'lock'; render(); };
    const inst = document.getElementById('btn-install');
    if (inst && deferredInstall) { inst.style.display = 'flex'; inst.onclick = () => { deferredInstall.prompt(); deferredInstall = null; }; }
    root.querySelectorAll('[data-v]').forEach(a => a.onclick = e => { e.preventDefault(); view = a.dataset.v; location.hash = '#' + view; render(); });
  }

  function render() {
    overlayRoot.innerHTML = '';
    if (!session) return renderLock();
    if (view === 'cashier') renderCashier(), bindHeader();
    else if (view === 'barista') renderBarista();
    else if (view === 'menu' && session.role === 'manager') renderMenu();
    else if (view === 'reports' && session.role === 'manager') renderReports();
    else if (view === 'qr' && session.role === 'manager') renderQr();
    else { view = 'cashier'; renderCashier(); bindHeader(); }
    if (PREVIEW && params.get('modal')) openItemModal(params.get('modal'));
  }

  let deferredInstall = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; const b = document.getElementById('btn-install'); if (b) b.style.display = 'flex'; });
  window.addEventListener('hashchange', () => { const v = location.hash.replace('#', ''); if (v && v !== view) { view = v; render(); } });
  window.addEventListener('keydown', e => {
    if (!session || view !== 'cashier') return;
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT') { e.preventDefault(); const q = document.getElementById('q'); if (q) q.focus(); }
    if (e.key === 'Escape') overlayRoot.innerHTML = '';
  });
  C.subscribe(() => { if (session && view === 'barista') renderBarista(); });
  setInterval(() => { if (session && view === 'barista') renderBarista(); }, 30000);

  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
  render();
})();
