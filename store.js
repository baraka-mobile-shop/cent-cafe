/* Cent — shared data layer (POS + customer site). Same-origin localStorage + BroadcastChannel sync. */
(function () {
  const K = { menu: 'cent_menu_v1', orders: 'cent_orders_v1', hist: 'cent_hist_v1', shift: 'cent_shift_v1', seq: 'cent_seq_v1' };

  const CATS = [
    { id: 'hot', name: 'مشروبات ساخنة', cls: 'g-hot' },
    { id: 'cold', name: 'مشروبات مثلجة', cls: 'g-cold' },
    { id: 'juice', name: 'عصائر', cls: 'g-juice' },
    { id: 'dessert', name: 'حلويات', cls: 'g-dessert' },
    { id: 'sand', name: 'سندوتشات', cls: 'g-sand' },
  ];

  const DEFAULT_ITEMS = [
    { id: 'turk', name: 'قهوة تركي', cat: 'hot', letter: 'ق', sizes: { 'سنجل': 30, 'دبل': 38 }, addons: true, available: true },
    { id: 'espr', name: 'اسبريسو', cat: 'hot', letter: 'ا', sizes: { 'سنجل': 35, 'دبل': 45 }, addons: true, available: true },
    { id: 'capp', name: 'كابتشينو', cat: 'hot', letter: 'ك', sizes: { 'صغير': 55, 'وسط': 65, 'كبير': 75 }, addons: true, available: true },
    { id: 'latte', name: 'لاتيه', cat: 'hot', letter: 'ل', sizes: { 'صغير': 50, 'وسط': 60, 'كبير': 70 }, addons: true, available: true },
    { id: 'mocha', name: 'موكا', cat: 'hot', letter: 'م', sizes: { 'صغير': 55, 'وسط': 65, 'كبير': 75 }, addons: true, available: true },
    { id: 'tea', name: 'شاي', cat: 'hot', letter: 'ش', price: 20, addons: false, available: true },
    { id: 'hotchoc', name: 'هوت شوكليت', cat: 'hot', letter: 'هـ', sizes: { 'صغير': 45, 'وسط': 55 }, addons: true, available: true },
    { id: 'frap', name: 'فرابتشينو', cat: 'cold', letter: 'ف', sizes: { 'صغير': 65, 'وسط': 75, 'كبير': 85 }, addons: true, available: true },
    { id: 'icelatte', name: 'آيس لاتيه', cat: 'cold', letter: 'آ', sizes: { 'صغير': 55, 'وسط': 65, 'كبير': 75 }, addons: true, available: true },
    { id: 'icemocha', name: 'آيس موكا', cat: 'cold', letter: 'م', sizes: { 'صغير': 60, 'وسط': 70 }, addons: true, available: true },
    { id: 'milkshake', name: 'ميلك شيك', cat: 'cold', letter: 'ش', sizes: { 'فانيليا': 75, 'شوكولاتة': 75, 'فراولة': 75 }, addons: true, available: true },
    { id: 'mango', name: 'عصير مانجو', cat: 'juice', letter: 'م', price: 55, addons: false, available: true },
    { id: 'orange', name: 'برتقال طازة', cat: 'juice', letter: 'ب', price: 45, addons: false, available: true },
    { id: 'lemon', name: 'ليمون بالنعناع', cat: 'juice', letter: 'ل', price: 40, addons: false, available: true },
    { id: 'cocktail', name: 'كوكتيل فواكه', cat: 'juice', letter: 'ك', price: 65, addons: false, available: true },
    { id: 'cheesecake', name: 'تشيز كيك', cat: 'dessert', letter: 'ت', price: 85, addons: false, available: true },
    { id: 'brownies', name: 'براونيز', cat: 'dessert', letter: 'ب', price: 65, addons: false, available: true },
    { id: 'croissant', name: 'كرواسون', cat: 'dessert', letter: 'ك', price: 45, addons: false, available: true },
    { id: 'muffin', name: 'مافن', cat: 'dessert', letter: 'م', price: 50, addons: false, available: true },
    { id: 'panini', name: 'بانيني فراخ', cat: 'sand', letter: 'ب', price: 85, addons: false, available: true },
    { id: 'club', name: 'كلوب ساندوتش', cat: 'sand', letter: 'ك', price: 95, addons: false, available: true },
  ];

  const ADDONS = [
    { id: 'shot', name: 'شوت اكسترا', price: 15 },
    { id: 'oat', name: 'لبن شوفان', price: 20 },
    { id: 'cream', name: 'كريمة', price: 10 },
    { id: 'caramel', name: 'كراميل', price: 10 },
  ];

  const TAX = 0;
  const bc = ('BroadcastChannel' in window) ? new BroadcastChannel('cent-sync') : null;

  function read(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
  }
  function write(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }
  function notify(what) { if (bc) bc.postMessage({ what }); }
  function subscribe(fn) {
    if (bc) bc.onmessage = (e) => fn(e.data && e.data.what);
    window.addEventListener('storage', () => fn('storage'));
  }

  /* menu (with owner overrides) */
  function getMenu() {
    const over = read(K.menu, null);
    if (over && Array.isArray(over.items) && over.items.length) return over;
    return { cats: CATS, items: DEFAULT_ITEMS };
  }
  function saveMenu(menu) { write(K.menu, menu); notify('menu'); }

  /* orders */
  function orders() { return read(K.orders, []); }
  function saveOrders(list) { write(K.orders, list); notify('orders'); }
  function dayKey(d) { const x = d || new Date(); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); }
  function nextSeq() {
    const s = read(K.seq, { day: '', n: 100 });
    const today = dayKey();
    const n = (s.day === today) ? s.n + 1 : 101;
    write(K.seq, { day: today, n });
    return n;
  }
  function addOrder(o) {
    const list = orders();
    o.id = 'o' + Date.now().toString(36) + Math.floor(Math.random() * 999);
    o.seq = nextSeq();
    o.ts = o.ts || Date.now();
    o.status = o.status || 'new';
    list.unshift(o);
    saveOrders(list.slice(0, 500));
    return o;
  }
  function updateOrder(id, patch) {
    const list = orders();
    const i = list.findIndex(o => o.id === id);
    if (i >= 0) { Object.assign(list[i], patch); saveOrders(list); }
  }
  function todayOrders() { const t = dayKey(); return orders().filter(o => dayKey(new Date(o.ts)) === t); }

  /* deterministic demo history seeding (past 6 days) */
  function rng(seedStr) {
    let h = 2166136261;
    for (let i = 0; i < seedStr.length; i++) { h ^= seedStr.charCodeAt(i); h = Math.imul(h, 16777619); }
    return function () { h = Math.imul(h ^ (h >>> 15), 2246822519); h = Math.imul(h ^ (h >>> 13), 3266489917); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  }
  function history() {
    let h = read(K.hist, null);
    if (h) return h;
    h = {};
    const names = ['turk', 'capp', 'frap', 'mango', 'latte', 'tea', 'panini'];
    for (let d = 6; d >= 1; d--) {
      const date = new Date(); date.setDate(date.getDate() - d);
      const r = rng(dayKey(date));
      const count = 95 + Math.floor(r() * 60);
      const total = count * (55 + Math.floor(r() * 25));
      const top = {};
      names.forEach(n => top[n] = Math.floor(r() * 45) + 5);
      h[dayKey(date)] = { total, count, top };
    }
    write(K.hist, h);
    return h;
  }
  function weekSeries() {
    const h = history();
    const out = [];
    const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    for (let d = 6; d >= 1; d--) {
      const date = new Date(); date.setDate(date.getDate() - d);
      const rec = h[dayKey(date)] || { total: 0 };
      out.push({ day: days[date.getDay()], total: rec.total, today: false });
    }
    const tt = todayOrders().filter(o => o.status !== 'canceled');
    out.push({ day: 'اليوم', total: tt.reduce((s, o) => s + o.total, 0), today: true });
    return out;
  }
  function topItemsToday() {
    const qty = {};
    todayOrders().forEach(o => (o.items || []).forEach(it => qty[it.name] = (qty[it.name] || 0) + it.qty));
    return Object.entries(qty).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }

  /* shift */
  function getShift() { return read(K.shift, null); }
  function openShift(float, by) {
    const s = { openedAt: Date.now(), float: float || 0, by: by || '', closed: false };
    write(K.shift, s); notify('shift'); return s;
  }
  function closeShift() {
    const s = getShift();
    if (s) { s.closed = true; s.closedAt = Date.now(); write(K.shift, s); notify('shift'); }
  }

  /* demo live tickets (first run only) */
  function seedLive() {
    if (read('cent_seeded_v2', false)) return;
    write('cent_seeded_v2', true);
    if (read('cent_seeded_v1', false)) write(K.orders, []);
    const mk = (type, table, items, status, minsAgo, source, pay) => {
      const total = items.reduce((s, i) => s + i.total, 0);
      addOrder({
        type, table, items, subtotal: total, tax: 0,
        discount: 0, total,
        pay: pay || 'cash', source: source || 'pos', status, ts: Date.now() - minsAgo * 60000
      });
    };
    const it = (id, name, size, addons, notes, qty, unit) => ({ itemId: id, name, size, addons, notes, qty, unit, total: qty * unit });
    mk('dinein', '4', [it('turk', 'قهوة تركي', 'سنجل', [], 'سكر مظبوط', 2, 30), it('capp', 'كابتشينو', 'وسط', ['شوت اكسترا'], '', 1, 80)], 'new', 2, 'pos', 'cash');
    mk('pickup', '', [it('icelatte', 'آيس لاتيه', 'كبير', ['لبن شوفان'], 'سكر قليل', 1, 95)], 'new', 3, 'site', 'cod');
    mk('dinein', '2', [it('mocha', 'موكا', 'وسط', [], '', 1, 65), it('mango', 'عصير مانجو', '', [], '', 1, 55), it('panini', 'بانيني فراخ', '', [], 'من غير بصل', 1, 85)], 'prep', 4, 'pos', 'visa');
    mk('delivery', '', [it('milkshake', 'ميلك شيك', 'فانيليا', [], '', 2, 75), it('brownies', 'براونيز', '', [], '', 1, 65)], 'prep', 12, 'site', 'cod');
    mk('pickup', '', [it('espr', 'اسبريسو', 'دبل', [], '', 1, 45), it('hotchoc', 'هوت شوكليت', 'وسط', ['كريمة'], '', 1, 65)], 'ready', 5, 'pos', 'cash');
    openShift(500, 'أحمد');
  }

  function fmt(n) {
    const v = Math.round((n || 0) * 10) / 10;
    return v.toLocaleString('ar-EG', { maximumFractionDigits: 1 });
  }
  function minsAgo(ts) { return Math.max(0, Math.round((Date.now() - ts) / 60000)); }

  window.Cent = {
    CATS, ADDONS, TAX, getMenu, saveMenu, orders, addOrder, updateOrder, todayOrders,
    weekSeries, topItemsToday, history, getShift, openShift, closeShift, seedLive,
    subscribe, notify, fmt, minsAgo, dayKey
  };
})();
