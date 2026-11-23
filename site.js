/* Cent — customer site (mobile-first). Same-device demo sync with the POS via store.js. */
(function () {
  const C = window.Cent;
  C.seedLive();

  const params = new URLSearchParams(location.search);
  const QR_TABLE = params.get('table') || '';
  const CART_KEY = 'cent_site_cart_v1';
  const MY_KEY = 'cent_site_myorders_v1';

  let cart = read(CART_KEY, []);
  let orderType = QR_TABLE ? 'dinein' : (read('cent_site_ot', null) || 'pickup');
  let cat = 'all';
  let view = 'home';           // home | item | cart | confirm | orders
  let curItem = null, curSize = null, curAddons = [], curQty = 1, curNotes = '';
  let lastOrderId = null;

  function read(k, f) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : f; } catch (e) { return f; } }
  function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function money(n) { return C.fmt(n) + ' ج'; }
  function saveCart() { write(CART_KEY, cart); }
  function cartCount() { return cart.reduce((s, c) => s + c.qty, 0); }
  function cartTotal() { return cart.reduce((s, c) => s + c.qty * c.unit, 0); }
  function myIds() { return read(MY_KEY, []); }
  function menu() { return C.getMenu(); }
  function itemById(id) { return menu().items.find(i => i.id === id); }
  function minPrice(it) { return it.price || Math.min(...Object.values(it.sizes || { '': 0 })); }
  function firstSize(it) { return it.sizes ? Object.keys(it.sizes)[0] : ''; }
  const OT = { dinein: { n: 'من الطاولة', ic: '🪑', h: QR_TABLE ? 'طاولة ' + esc(QR_TABLE) : 'امسح الـQR' }, pickup: { n: 'استلام', ic: '🛍️', h: 'من الفرع' }, delivery: { n: 'دليفري', ic: '🛵', h: 'لحد البيت' } };
  const STATUS_NAMES = { new: 'اتأكّد', prep: 'بيتحضّر', ready: 'جاهز', done: 'اتسلّم', canceled: 'اتلغى' };

  /* demo hook for screenshots: site.html?demo=cart|confirm|orders */
  const demo = params.get('demo');
  if (demo && !cart.length && (demo === 'cart')) {
    cart = [
      { itemId: 'latte', name: 'لاتيه', size: 'وسط', addons: ['شوت اكسترا'], notes: 'سكر أقل', qty: 2, unit: 75 },
      { itemId: 'cheesecake', name: 'تشيز كيك', size: '', addons: [], notes: 'فراولة', qty: 1, unit: 85 },
    ]; saveCart();
  }

  function header(sub) {
    return `<header class="s-nav">
      <a href="site.html" style="text-decoration:none;color:inherit"><div class="s-brand">
        <div class="s-mark"><svg viewBox="0 0 24 24" fill="none"><path d="M4 9h12v6.5A4.5 4.5 0 0 1 11.5 20h-3A4.5 4.5 0 0 1 4 15.5V9z" stroke="#E8CBA8" stroke-width="1.6"/><path d="M16 10.2h1.4a2.7 2.7 0 0 1 0 5.4H16" stroke="#E8CBA8" stroke-width="1.6"/><path d="M7.5 6c0-1 .9-1 .9-2M11.5 6c0-1 .9-1 .9-2" stroke="#E8CBA8" stroke-width="1.6" stroke-linecap="round"/></svg></div>
        <div><b class="wordmark">Cent</b><small>${sub || 'كافيه — اطلب أونلاين'}</small></div>
      </div></a>
      <div class="spacer"></div>
      <button class="cart-btn" id="nav-cart">🧺${cartCount() ? `<span class="n">${C.fmt(cartCount())}</span>` : ''}</button>
    </header>`;
  }
  function bottomNav(active) {
    return `<nav class="s-bottom">
      <a href="#" data-nav="home" class="${active === 'home' ? 'on' : ''}">🏠 الرئيسية</a>
      <a href="#" data-nav="home" class="">📋 المنيو</a>
      <a href="#" data-nav="orders" class="${active === 'orders' ? 'on' : ''}">🧾 طلباتي</a>
      <a href="#" data-nav="cart" class="${active === 'cart' ? 'on' : ''}">🧺 السلة</a>
    </nav>`;
  }

  /* ---------- views ---------- */
  function vHome() {
    const m = menu();
    const cats = [{ id: 'all', name: 'الكل' }].concat(m.cats);
    const items = m.items.filter(i => i.available !== false && (cat === 'all' || i.cat === cat));
    const pop = m.items.filter(i => i.available !== false).slice(0, 4);
    return `${header()}
    <div class="s-page">
      <div class="hero">
        <div class="h-pill">متاح دلوقتي · تحضير ~١٠ دقايق</div>
        <h1>Cent</h1>
        <p>قهوتك وأكلنا الطازج بيوصلوك لحد طاولتك أو باب بيتك.<br>اطلب في ثواني، وادفع كاش عند الاستلام.</p>
        <a class="cta" href="#" id="cta-order">اطلب دلوقتي ↓</a>
        <div class="steam"><svg viewBox="0 0 24 24" fill="none"><path d="M4 9h12v6.5A4.5 4.5 0 0 1 11.5 20h-3A4.5 4.5 0 0 1 4 15.5V9z" stroke="#F6E9D2" stroke-width="1.4"/><path d="M16 10.2h1.4a2.7 2.7 0 0 1 0 5.4H16" stroke="#F6E9D2" stroke-width="1.4"/><path d="M7.5 6c0-1 .9-1 .9-2M11.5 6c0-1 .9-1 .9-2" stroke="#F6E9D2" stroke-width="1.4" stroke-linecap="round"/></svg></div>
      </div>
      <div class="ot-row">
        ${['dinein', 'pickup', 'delivery'].map(t => `<div class="ot-card ${orderType === t ? 'on' : ''}" data-ot="${t}"><div class="ic">${OT[t].ic}</div><b>${OT[t].n}</b><small>${OT[t].h}</small></div>`).join('')}
      </div>
      <div class="sec-t"><h2>الأكثر طلبًا</h2></div>
      <div class="pop-row">
        ${pop.map(i => `<div class="pop-card" data-item="${i.id}"><div class="picon ${m.cats.find(c => c.id === i.cat)?.cls || 'g-hot'}">${esc(i.letter)}</div><b>${esc(i.name)}</b><div class="pr">${money(minPrice(i))}</div></div>`).join('')}
      </div>
      <div class="sec-t" id="menu-top"><h2>المنيو</h2></div>
      <div class="s-cats">${cats.map(c => `<button class="s-cat ${cat === c.id ? 'on' : ''}" data-cat="${c.id}">${esc(c.name)}</button>`).join('')}</div>
      <div class="menu-2col"><div>
      ${items.map(i => `<div class="s-item" data-item="${i.id}">
        <div class="picon ${m.cats.find(c => c.id === i.cat)?.cls || 'g-hot'}">${esc(i.letter)}</div>
        <div class="inf"><b>${esc(i.name)}</b><small>${i.sizes ? Object.keys(i.sizes).join(' / ') : ''}</small></div>
        <div class="pr">${i.price ? money(i.price) : 'من ' + money(minPrice(i))}</div>
        <button class="add-btn" data-add="${i.id}">+</button>
      </div>`).join('')}
      </div></div>
      <div style="height:86px"></div>
    </div>
    ${bottomNav('home')}`;
  }

  function vItem() {
    const it = curItem;
    const m = menu();
    const cls = m.cats.find(c => c.id === it.cat)?.cls || 'g-hot';
    const sizes = it.sizes ? Object.entries(it.sizes) : null;
    const unit = (sizes ? (it.sizes[curSize] || 0) : it.price) + curAddons.reduce((s, a) => s + (C.ADDONS.find(x => x.name === a)?.price || 0), 0);
    return `
    <div class="sheet-hero ${cls}" style="background:linear-gradient(150deg,var(--accent),#7C4517)">
      <button class="back" id="item-back">→</button>
      <div class="picon">${esc(it.letter)}</div>
      <h1>${esc(it.name)}</h1>
      <p>${it.addons ? 'ظبطها على مزاجك: حجم وإضافات وملاحظات للمحضّر.' : 'ملاحظاتك للمحضّر؟ اكتبها تحت.'}</p>
    </div>
    <div class="s-page" style="padding-bottom:110px">
      ${sizes ? `<div class="m-label">الحجم</div><div class="chips">
        ${sizes.map(([s, p]) => `<button class="chip ${curSize === s ? 'on' : ''}" data-size="${esc(s)}">${esc(s)} <span class="p">${money(p)}</span></button>`).join('')}
      </div>` : ''}
      ${it.addons ? `<div class="m-label">إضافات</div><div class="chips">
        ${C.ADDONS.map(a => `<button class="chip ${curAddons.includes(a.name) ? 'on' : ''}" data-addon="${esc(a.name)}">${esc(a.name)} <span class="p">+${money(a.price)}</span></button>`).join('')}
      </div>` : ''}
      <div class="m-label">ملاحظات للمحضّر</div>
      <textarea class="note" id="item-notes" rows="2" placeholder="مثال: من غير سكر خالص، حار زيادة…">${esc(curNotes)}</textarea>
    </div>
    <div class="add-bar">
      <div class="stepper"><i id="q-minus">−</i><span>${C.fmt(curQty)}</span><i id="q-plus">+</i></div>
      <button class="big-btn" id="item-add">أضف للسلة · ${money(unit * curQty)}</button>
    </div>`;
  }

  function vCart() {
    const lines = cart.map((c, i) => `<div class="c-item">
      <div class="inf"><b>${C.fmt(c.qty)} × ${esc(c.name)}${c.size ? ' ' + esc(c.size) : ''}</b>
        <small>${c.addons.map(a => '+ ' + esc(a)).join('، ')}${c.addons.length && c.notes ? ' · ' : ''}${esc(c.notes || '')}</small>
        <div class="qty-mini"><i data-dec="${i}">−</i><span>${C.fmt(c.qty)}</span><i data-inc="${i}">+</i></div>
        <button class="rm" data-rm="${i}">حذف</button>
      </div>
      <div class="amt">${money(c.qty * c.unit)}</div>
    </div>`).join('');
    return `${header('مراجعة الطلب')}
    <div class="s-page" style="padding-bottom:110px">
      ${cart.length ? lines : `<div class="empty-box">🧺<b>السلة فاضية</b>ضيف حاجة من المنيو الأول</div>`}
      ${cart.length ? `
      <div class="m-label" style="margin-top:18px">طريقة الاستلام</div>
      <div class="ot-row" style="margin:0 0 4px">
        ${['dinein', 'pickup', 'delivery'].map(t => `<div class="ot-card ${orderType === t ? 'on' : ''}" data-ot="${t}"><div class="ic">${OT[t].ic}</div><b>${OT[t].n}</b><small>${OT[t].h}</small></div>`).join('')}
      </div>
      <div class="field"><label>اسمك</label><input id="f-name" value="${esc(read('cent_site_name', ''))}" placeholder="عشان نناديك"></div>
      ${orderType === 'dinein' && !QR_TABLE ? `<div class="field"><label>رقم الطاولة</label><input id="f-table" inputmode="numeric" placeholder="مثال: ٥"></div>` : ''}
      ${orderType === 'delivery' ? `<div class="field"><label>العنوان بالتفصيل</label><input id="f-addr" placeholder="الشارع، العمارة، الدور، علامة مميزة"></div>` : ''}
      <div class="field"><label>ملاحظات على الطلب كله <span class="hint">(اختياري)</span></label><input id="f-notes" placeholder="مثال: كل المشروبات سخنة"></div>
      <div class="cash-note">💵 الدفع كاش عند الاستلام أو التسليم — مفيش دفع أونلاين دلوقتي</div>
      <div class="trow total"><span>الإجمالي</span><span>${money(cartTotal())}</span></div>` : ''}
    </div>
    ${cart.length ? `<div class="add-bar"><button class="big-btn dark" id="confirm-order">تأكيد الطلب · ${money(cartTotal())}</button></div>` : bottomNav('cart')}`;
  }

  function vConfirm() {
    const o = C.orders().find(x => x.id === lastOrderId);
    if (!o) return vOrders();
    const steps = ['new', 'prep', 'ready', 'done'];
    const idx = Math.max(0, steps.indexOf(o.status));
    return `<div class="s-page" style="text-align:center;max-width:520px;margin:0 auto">
      <div class="ok-ring"><i><svg viewBox="0 0 24 24" fill="none"><path d="M4.5 12.5l5 5L19.5 7" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></i></div>
      <h2 style="font-size:20px;font-weight:800">طلبك وصلنا${o.name ? ' يا ' + esc(o.name) : ''} 👋</h2>
      <p style="font-size:13px;color:var(--muted);margin-top:4px">الدفع كاش عند الاستلام — هنقولك أول ما يجهز</p>
      <div class="ord-box">
        <div class="num">#${C.fmt(o.seq)}</div>
        <small>${OT[o.type]?.n || ''}${o.table ? ' · طاولة ' + esc(o.table) : ''} · ${money(o.total)}</small>
        <div class="eta">⏱ ${o.status === 'ready' ? 'جاهز دلوقتي!' : o.status === 'done' ? 'اتسلّم — بالهنا ☕' : 'جاهز خلال حوالي ١٢ دقيقة'}</div>
      </div>
      <div class="tl" style="text-align:right">
        ${steps.map((s, i) => `<div class="tl-step ${i < idx ? 'done' : i === idx ? (o.status === 'done' ? 'done' : 'now') : ''}">
          <div class="tl-dot">${i < idx || o.status === 'done' ? '✓' : i === idx ? '●' : ''}</div>
          <div><b>${STATUS_NAMES[s]}</b><small>${['وصلنا وأكّدناه', 'الباراستا شغال عليه', 'هننده عليك باسمك', 'اتفضل ☕'][i]}</small></div>
        </div>`).join('')}
      </div>
      <button class="ghost-btn" id="go-orders">📋 طلباتي</button>
      <button class="ghost-btn" id="go-home">اطلب حاجة تانية</button>
      <div style="height:24px"></div>
    </div>`;
  }

  function vOrders() {
    const mine = C.orders().filter(o => myIds().includes(o.id));
    return `${header('طلباتي')}
    <div class="s-page">
      ${mine.length ? mine.map(o => `<a class="ord-row" href="#" data-track="${o.id}">
        <div><b>#${C.fmt(o.seq)}</b> <small style="color:var(--muted)">${OT[o.type]?.n || ''}${o.table ? ' · طاولة ' + esc(o.table) : ''}</small><br>
        <small style="color:var(--muted)">${o.items.map(i => C.fmt(i.qty) + '× ' + esc(i.name)).join('، ')}</small></div>
        <span class="st st-${o.status}">${STATUS_NAMES[o.status] || o.status}</span>
      </a>`).join('') : `<div class="empty-box">🧾<b>مفيش طلبات لسه</b>أول طلب ليك هيظهر هنا</div>`}
      <div style="height:86px"></div>
    </div>
    ${bottomNav('orders')}`;
  }

  /* ---------- render + bind ---------- */
  const app = document.getElementById('app');
  function render() {
    app.innerHTML = view === 'home' ? vHome() : view === 'item' ? vItem() : view === 'cart' ? vCart() : view === 'confirm' ? vConfirm() : vOrders();
    bind();
    window.scrollTo(0, 0);
  }
  function go(v) { view = v; render(); }

  function openItem(id) {
    const it = itemById(id);
    if (!it) return;
    curItem = it; curSize = firstSize(it); curAddons = []; curQty = 1; curNotes = '';
    go('item');
  }
  function setOT(t) { orderType = t; write('cent_site_ot', t); render(); }

  function bind() {
    document.querySelectorAll('[data-nav]').forEach(b => b.onclick = e => { e.preventDefault(); go(b.dataset.nav); });
    const nc = document.getElementById('nav-cart'); if (nc) nc.onclick = () => go('cart');
    document.querySelectorAll('[data-ot]').forEach(b => b.onclick = () => setOT(b.dataset.ot));
    document.querySelectorAll('[data-cat]').forEach(b => b.onclick = () => { cat = b.dataset.cat; render(); const el = document.getElementById('menu-top'); if (el) el.scrollIntoView(); });
    document.querySelectorAll('[data-item]').forEach(b => b.onclick = () => openItem(b.dataset.item));
    document.querySelectorAll('[data-add]').forEach(b => b.onclick = e => { e.stopPropagation(); openItem(b.dataset.add); });
    const cta = document.getElementById('cta-order'); if (cta) cta.onclick = e => { e.preventDefault(); document.getElementById('menu-top').scrollIntoView({ behavior: 'smooth' }); };

    if (view === 'item') {
      document.getElementById('item-back').onclick = () => go('home');
      document.getElementById('item-notes').oninput = e => { curNotes = e.target.value; };
      document.querySelectorAll('[data-size]').forEach(b => b.onclick = () => { curSize = b.dataset.size; render(); });
      document.querySelectorAll('[data-addon]').forEach(b => b.onclick = () => {
        const a = b.dataset.addon;
        curAddons = curAddons.includes(a) ? curAddons.filter(x => x !== a) : curAddons.concat(a); render();
      });
      document.getElementById('q-minus').onclick = () => { curQty = Math.max(1, curQty - 1); render(); };
      document.getElementById('q-plus').onclick = () => { curQty = Math.min(20, curQty + 1); render(); };
      document.getElementById('item-add').onclick = () => {
        const it = curItem;
        const base = it.sizes ? it.sizes[curSize] : it.price;
        const unit = base + curAddons.reduce((s, a) => s + (C.ADDONS.find(x => x.name === a)?.price || 0), 0);
        cart.push({ itemId: it.id, name: it.name, size: it.sizes ? curSize : '', addons: curAddons.slice(), notes: curNotes.trim(), qty: curQty, unit });
        saveCart(); go('cart');
      };
    }

    if (view === 'cart') {
      document.querySelectorAll('[data-inc]').forEach(b => b.onclick = () => { cart[+b.dataset.inc].qty = Math.min(20, cart[+b.dataset.inc].qty + 1); saveCart(); render(); });
      document.querySelectorAll('[data-dec]').forEach(b => b.onclick = () => { const i = +b.dataset.dec; cart[i].qty = Math.max(1, cart[i].qty - 1); saveCart(); render(); });
      document.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { cart.splice(+b.dataset.rm, 1); saveCart(); render(); });
      const co = document.getElementById('confirm-order');
      if (co) co.onclick = () => {
        const name = (document.getElementById('f-name')?.value || '').trim();
        const addr = (document.getElementById('f-addr')?.value || '').trim();
        const tbl = QR_TABLE || (document.getElementById('f-table')?.value || '').trim();
        const notes = (document.getElementById('f-notes')?.value || '').trim();
        if (!name) { alert('اكتب اسمك الأول عشان نناديك'); return; }
        if (orderType === 'dinein' && !tbl) { alert('اكتب رقم الطاولة'); return; }
        if (orderType === 'delivery' && !addr) { alert('اكتب العنوان عشان نوصلك'); return; }
        write('cent_site_name', name);
        const subtotal = cartTotal();
        const o = C.addOrder({
          type: orderType, table: orderType === 'dinein' ? tbl : '', name, address: orderType === 'delivery' ? addr : '', notes,
          items: cart.map(c => ({ itemId: c.itemId, name: c.name, size: c.size, addons: c.addons, notes: c.notes, qty: c.qty, unit: c.unit, total: c.qty * c.unit })),
          subtotal, tax: 0, discount: 0, total: subtotal, pay: 'cod', paid: 0, source: 'site'
        });
        write(MY_KEY, myIds().concat(o.id));
        lastOrderId = o.id; cart = []; saveCart(); go('confirm');
      };
    }

    if (view === 'confirm') {
      const go1 = document.getElementById('go-orders'); if (go1) go1.onclick = () => go('orders');
      const go2 = document.getElementById('go-home'); if (go2) go2.onclick = () => go('home');
    }
    if (view === 'orders') {
      document.querySelectorAll('[data-track]').forEach(b => b.onclick = e => { e.preventDefault(); lastOrderId = b.dataset.track; go('confirm'); });
    }
  }

  /* live status updates from the POS (same device) */
  C.subscribe(() => { if (view === 'confirm' || view === 'orders') render(); });

  if (demo === 'cart') go('cart');
  else if (demo === 'confirm' || demo === 'orders') {
    const mine = C.orders().filter(o => myIds().includes(o.id));
    if (mine.length) { lastOrderId = mine[0].id; go(demo === 'confirm' ? 'confirm' : 'orders'); }
    else go('home');
  }
  else render();
})();
