(function(){
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const LS_KEY = 'grill_site_data_v1';
  const CART_KEY = 'grill_cart_v1';
  const initialUrl = 'data/initial_backup.json';

  const state = {
    data: { items: [], settings: {} },
    cart: [],
    activeTabs: {} // keyed by section key
  };

  const DEFAULT_SECTIONS = [
    {key:'promos', name:'Promos', tabs:10},
    {key:'combos', name:'Combos', tabs:10},
    {key:'menu', name:'Menú', tabs:20},
    {key:'bebidas', name:'Bebidas', tabs:10},
    {key:'extras', name:'Extras', tabs:10},
  ];

  function currency(n){ return `$${(n||0).toFixed(2)}`; }

  async function loadData(){
    const inLS = localStorage.getItem(LS_KEY);
    if(inLS){
      state.data = JSON.parse(inLS);
    }else{
      try{
        const res = await fetch(initialUrl, {cache:'no-store'});
        if(res.ok){
          const raw = await res.json();
          const items = Array.isArray(raw.items)? raw.items : (Array.isArray(raw)? raw : []);
          const settings = raw.settings || {};
          const mapped = items.map((it, idx)=>{
            let sec = (it.section||it.category||'menu').toLowerCase();
            if(sec==='promo') sec='promos';
            if(sec==='combo') sec='combos';
            if(sec==='bebida') sec='bebidas';
            return {
              id: it.id ?? (idx+1),
              name: it.name || 'Ítem',
              price: Number(it.price||0),
              desc: it.desc || '',
              img: it.img || it.imgUrl || '',
              section: sec,
              tab: Number(it.tab||1)
            };
          });
          state.data = {
            items: mapped,
            settings: {
              bizName: settings.bizName || 'Tu Marca',
              waNumber: (settings.waNumber||'').toString(),
              insta: settings.insta || '',
              fb: settings.fb || '',
              primary: settings.primary || '#f97316',
              pin: settings.pin || (window.__PIN_DEFAULT__||'0000'),
              sections: Array.isArray(settings.sections) && settings.sections.length ? settings.sections : DEFAULT_SECTIONS
            }
          };
          localStorage.setItem(LS_KEY, JSON.stringify(state.data));
        }else{
          state.data = { items: [], settings: {bizName:'Tu Marca', waNumber:'', insta:'', fb:'', primary:'#f97316', pin:(window.__PIN_DEFAULT__||'0000'), sections: DEFAULT_SECTIONS} };
        }
      }catch(e){
        state.data = { items: [], settings: {bizName:'Tu Marca', waNumber:'', insta:'', fb:'', primary:'#f97316', pin:(window.__PIN_DEFAULT__||'0000'), sections: DEFAULT_SECTIONS} };
      }
    }
  }
  function saveData(){ localStorage.setItem(LS_KEY, JSON.stringify(state.data)); }
  function loadCart(){ state.cart = JSON.parse(localStorage.getItem(CART_KEY)||'[]'); }
  function saveCart(){ localStorage.setItem(CART_KEY, JSON.stringify(state.cart)); }

  function applySettings(){
    const s = state.data.settings || {};
    document.documentElement.style.setProperty('--primary', s.primary||'#f97316');
    $('#brandName').textContent = s.bizName || 'Tu Marca';
    $('#footerBrand').textContent = s.bizName || 'Tu Marca';
    if(s.waNumber){
      $('#footerPhone').textContent = 'WhatsApp: +' + (s.waNumber.startsWith('+')? s.waNumber.slice(1) : s.waNumber);
      $('#footerPhone').href = `https://wa.me/${s.waNumber.replace(/\D/g,'')}`;
    }
    if(s.insta) $('#footerInsta').href = s.insta;
    if(s.fb) $('#footerFb').href = s.fb;
    const wa = s.waNumber ? `https://wa.me/${s.waNumber.replace(/\D/g,'')}` : '#';
    $('#waFloat').href = wa;
  }

  function buildNavAndSections(){
    const contNav = $('#dynNav');
    const contMain = $('#dynMain');
    const secs = state.data.settings.sections || [];
    secs.forEach(s=>{ if(state.activeTabs[s.key]==null) state.activeTabs[s.key]=0; });
    contNav.innerHTML = secs.map(s=>`<a href="#${s.key}">${s.name}</a>`).join('');
    contMain.innerHTML = secs.map(s=>`
      <section id="${s.key}" class="section">
        <h2>${s.name}</h2>
        <div class="filters" data-sec="${s.key}"></div>
        <div id="${s.key}Grid" class="grid"></div>
      </section>
    `).join('');
  }

  function buildFilters(secKey){
    const secs = state.data.settings.sections || [];
    const sec = secs.find(x=>x.key===secKey); if(!sec) return;
    const limit = Number(sec.tabs||10);
    const wrap = document.querySelector(\`.filters[data-sec="${secKey}"]\`);
    if(!wrap) return;
    let html = `<button class="filter-chip ${state.activeTabs[secKey]===0?'active':''}" data-sec="${secKey}" data-tab="0">Todo</button>`;
    for(let i=1;i<=limit;i++){
      html += `<button class="filter-chip ${state.activeTabs[secKey]===i?'active':''}" data-sec="${secKey}" data-tab="${i}">Pestaña ${i}</button>`;
    }
    wrap.innerHTML = html;
  }

  function render(){
    (state.data.settings.sections||[]).forEach(s=> buildFilters(s.key));
    const q = ($('#search').value||'').toLowerCase();
    const renderCard = (i) => {
      if(q && !(`${i.name} ${i.desc||''}`.toLowerCase().includes(q))) return '';
      const img = i.img || '';
      return `<article class="card">
        ${img ? `<img src="${img}" alt="${i.name}">` : ''}
        <div class="cbody">
          <strong>${i.name||''}</strong>
          <small class="muted">${i.desc||''}</small>
          <div class="row">
            <span class="price">${currency(Number(i.price||0))}</span>
            <div class="qty"><button data-add='${i.id}'>+</button></div>
          </div>
        </div>
      </article>`;
    };
    (state.data.settings.sections||[]).forEach(s=>{
      const key = s.key;
      const activeTab = Number(state.activeTabs[key]||0);
      const items = state.data.items.filter(i=> (i.section||'')===key && (!activeTab || Number(i.tab||1)===activeTab));
      const html = items.map(renderCard).join('');
      const grid = document.getElementById(`${key}Grid`);
      if(grid) grid.innerHTML = html;
    });
    $('#cartCount').textContent = state.cart.reduce((a,c)=>a+c.qty,0);
  }

  // Events
  document.addEventListener('click', (e)=>{
    const t = e.target;
    const add = t.getAttribute('data-add');
    if(add){ addToCart(add); }
    if(t.classList.contains('filter-chip')){
      const sec = t.getAttribute('data-sec');
      const tab = Number(t.getAttribute('data-tab'));
      state.activeTabs[sec] = tab;
      render();
    }
    const inc = t.getAttribute('data-inc');
    if(inc){ const r = state.cart.find(x=> String(x.id)===String(inc)); if(r){r.qty++; saveCart(); updateCart();} }
    const dec = t.getAttribute('data-dec');
    if(dec){ const r = state.cart.find(x=> String(x.id)===String(dec)); if(r){r.qty=Math.max(0,r.qty-1); if(r.qty===0){state.cart=state.cart.filter(z=>String(z.id)!==String(dec));} saveCart(); updateCart();} }
    const del = t.getAttribute('data-del');
    if(del){ state.cart = state.cart.filter(z=> String(z.id)!==String(del)); saveCart(); updateCart(); }
  });

  function addToCart(id){
    const item = state.data.items.find(x=> String(x.id)===String(id));
    if(!item) return;
    const found = state.cart.find(c=> String(c.id)===String(id));
    if(found) found.qty+=1; else state.cart.push({id:item.id,name:item.name,price:Number(item.price||0),qty:1});
    saveCart(); updateCart();
  }
  function updateCart(){
    $('#cartItems').innerHTML = state.cart.map(c=>{
      const subtotal = c.price*c.qty;
      return `<div class="ci">
        <div>${c.name}</div>
        <div class="muted">x${c.qty}</div>
        <div>${currency(subtotal)}</div>
        <div class="row" style="grid-column:1/-1;gap:.4rem">
          <button data-dec='${c.id}'>-</button>
          <button data-inc='${c.id}'>+</button>
          <button data-del='${c.id}'>Eliminar</button>
        </div>
      </div>`;
    }).join('');
    const total = state.cart.reduce((a,c)=>a+(c.price*c.qty),0);
    $('#cartTotal').textContent = currency(total);
    $('#cartCount').textContent = state.cart.reduce((a,c)=>a+c.qty,0);
  }
  function openCart(){ $('#cart').classList.add('open'); updateCart(); }
  function closeCart(){ $('#cart').classList.remove('open'); }

  $('#openCart').addEventListener('click', openCart);
  $('#closeCart').addEventListener('click', closeCart);
  $('#checkout').addEventListener('click', ()=>{
    const s = state.data.settings||{};
    const num = (s.waNumber||'').replace(/\D/g,'');
    if(!num){ alert('Configura un número de WhatsApp en Ajustes del Admin.'); return; }
    const txt = state.cart.map(c=>`• ${c.name} x${c.qty} — ${currency(c.price*c.qty)}`).join('%0A');
    const total = state.cart.reduce((a,c)=>a+(c.price*c.qty),0);
    const url = `https://wa.me/${num}?text=Hola,%20quiero%20hacer%20este%20pedido:%0A${txt}%0A%0ATotal:%20${currency(total)}`;
    window.open(url, '_blank');
  });
  const keep = document.getElementById('keepShopping');
  if(keep){
    keep.addEventListener('click', ()=>{
      document.getElementById('cart').classList.remove('open');
      const firstSec = (state.data.settings.sections||[{}])[0]?.key || 'menu';
      location.hash = `#${firstSec}`;
      document.getElementById(firstSec)?.scrollIntoView({behavior:'smooth'});
    });
  }
  $('#search').addEventListener('input', render);

  (async function(){
    await loadData();
    loadCart();
    applySettings();
    buildNavAndSections();
    render();
  })();
})();