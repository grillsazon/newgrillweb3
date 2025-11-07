(function(){
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const LS_KEY = 'grill_site_data_v1';
  const PIN_KEY = 'grill_site_pin_v1';
  const initialUrl = 'data/initial_backup.json';
  const DEFAULT_SECTIONS = [
    {key:'promos', name:'Promos', tabs:10},
    {key:'combos', name:'Combos', tabs:10},
    {key:'menu', name:'Menú', tabs:20},
    {key:'bebidas', name:'Bebidas', tabs:10},
    {key:'extras', name:'Extras', tabs:10},
  ];

  const state = {
    data: { items: [], settings: {bizName:'Tu Marca', waNumber:'', insta:'', fb:'', primary:'#f97316', pin:'0000', sections: DEFAULT_SECTIONS} },
    tab: 'menu',
    editingSectionIndex: -1
  };

  function save(){ localStorage.setItem(LS_KEY, JSON.stringify(state.data)); }
  function secLimit(sectionKey){
    const sec = (state.data.settings.sections||[]).find(s=>s.key===sectionKey);
    return sec? Number(sec.tabs||10) : 20;
  }
  function validTabForSection(sectionKey, tab){
    const limit = secLimit(sectionKey);
    return tab>=1 && tab<=limit;
  }

  // Gate by PIN
  function gate(){
    const saved = JSON.parse(localStorage.getItem(LS_KEY)||'{}');
    const pin = (saved.settings && saved.settings.pin) || window.__PIN_DEFAULT__ || '0000';
    const ok = sessionStorage.getItem(PIN_KEY) === pin;
    if(!ok){
      $('#login').style.display='grid';
      $('#panel').hidden=true;
      $('#pinBtn').onclick = ()=>{
        const val = $('#pinInput').value.trim();
        if(val === pin){
          sessionStorage.setItem(PIN_KEY, val);
          $('#login').style.display='none';
          $('#panel').hidden=false;
          init();
        }else{
          alert('PIN incorrecto');
        }
      };
    }else{
      $('#login').style.display='none';
      $('#panel').hidden=false;
      init();
    }
  }

  async function init(){
    const inLS = localStorage.getItem(LS_KEY);
    if(inLS){
      state.data = JSON.parse(inLS);
      if(!Array.isArray(state.data.settings.sections) || !state.data.settings.sections.length){
        state.data.settings.sections = DEFAULT_SECTIONS;
      }
    }else{
      try{
        const res = await fetch(initialUrl, {cache:'no-store'});
        if(res.ok){
          const raw = await res.json();
          normalizeFromBackup(raw);
        }else{
          state.data = { items: [], settings:{bizName:'Tu Marca', waNumber:'', insta:'', fb:'', primary:'#f97316', pin:'0000', sections: DEFAULT_SECTIONS} };
        }
      }catch(e){
        state.data = { items: [], settings:{bizName:'Tu Marca', waNumber:'', insta:'', fb:'', primary:'#f97316', pin:'0000', sections: DEFAULT_SECTIONS} };
      }
      save();
    }
    bind();
    render();
  }

  function normalizeFromBackup(raw){
    const items = Array.isArray(raw.items) ? raw.items : (Array.isArray(raw) ? raw : []);
    const mapped = items.map((it, idx)=>{
      let sec = (it.section||it.category||'menu').toLowerCase();
      if(sec==='promo') sec='promos';
      if(sec==='combo') sec='combos';
      if(sec==='bebida') sec='bebidas';
      return {
        id: it.id ?? (idx+1),
        name: it.name || 'Ítem',
        price: Number(it.price || 0),
        desc: it.desc || '',
        img: it.imgUrl || it.img || '',
        section: sec,
        tab: Number(it.tab||1)
      };
    });
    const s = raw.settings || {};
    state.data = {
      items: mapped,
      settings: {
        bizName: s.bizName || 'Tu Marca',
        waNumber: (s.waNumber||'').replace(/\s/g,''),
        insta: s.insta || '',
        fb: s.fb || '',
        primary: s.primary || '#f97316',
        pin: s.pin || '0000',
        sections: Array.isArray(s.sections) && s.sections.length ? s.sections : DEFAULT_SECTIONS
      }
    };
  }

  function bind(){
    // Change between tabs/panels
    $$('.toolbar button[data-tab]').forEach(b=>{
      b.onclick = ()=>{
        const t = b.dataset.tab;
        document.getElementById('itemsPanel').hidden = (t==='secciones');
        document.getElementById('sectionsPanel').hidden = (t!=='secciones');
        if(t!=='secciones') state.tab = t;
        renderList();
      };
    });

    $('#adminSearch').oninput = renderList;
    $('#addItem').onclick = ()=>{
      const nid = (state.data.items.reduce((m,i)=>Math.max(m, Number(i.id||0)),0) + 1);
      const firstSec = (state.data.settings.sections||DEFAULT_SECTIONS)[0]?.key || 'menu';
      const secKey = (state.data.settings.sections||[]).some(s=>s.key===state.tab) ? state.tab : firstSec;
      const rec = {id:nid, name:'Nuevo', price:0, desc:'', img:'', section:secKey, tab:1};
      state.data.items.unshift(rec); save(); renderList(); edit(rec);
    };
    $('#saveItem').onclick = ()=>{
      const id = Number($('#f_id').value);
      const r = state.data.items.find(i=>Number(i.id)===id); if(!r) return;
      r.name = $('#f_name').value.trim();
      r.price = Number($('#f_price').value||0);
      r.desc = $('#f_desc').value.trim();
      r.section = $('#f_section').value;
      r.img = $('#f_img').value.trim();
      r.tab = Math.max(1, Number($('#f_tab').value||1));
      if(!validTabForSection(r.section, r.tab)){
        const secs = state.data.settings.sections||[];
        const sec = secs.find(s=>s.key===r.section);
        alert(`La pestaña para ${sec?.name||r.section} debe estar entre 1 y ${sec?.tabs||10}`);
        return;
      }
      save(); renderList();
      alert('Guardado');
    };
    $('#deleteItem').onclick = ()=>{
      const id = Number($('#f_id').value);
      if(confirm('¿Eliminar el ítem?')){
        state.data.items = state.data.items.filter(i=>Number(i.id)!==id);
        save(); renderList(); clearForm();
      }
    };

    // Settings
    $('#saveSettings').onclick = ()=>{
      state.data.settings.bizName = $('#s_brand').value.trim() || 'Tu Marca';
      state.data.settings.waNumber = $('#s_phone').value.trim();
      state.data.settings.insta = $('#s_insta').value.trim();
      state.data.settings.fb = $('#s_fb').value.trim();
      state.data.settings.primary = $('#s_primary').value || '#f97316';
      state.data.settings.pin = $('#s_pin').value.trim() || '0000';
      save(); alert('Ajustes guardados');
    };
    $('#resetData').onclick = async ()=>{
      if(!confirm('Esto borrará lo actual y recargará el backup inicial.')) return;
      const res = await fetch(initialUrl, {cache:'no-store'});
      if(res.ok){
        const raw = await res.json();
        normalizeFromBackup(raw);
        save(); render();
        alert('Se restauró el backup inicial.');
      }else alert('No se encontró el backup inicial.');
    };

    // Import/Export
    $('#btnExport').onclick = ()=>{
      const blob = new Blob([JSON.stringify(state.data, null, 2)], {type:'application/json'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'backup_export.json';
      a.click();
    };
    $('#fileImport').onchange = async (e)=>{
      const file = e.target.files[0];
      if(!file) return;
      const txt = await file.text();
      try{
        const raw = JSON.parse(txt);
        if(raw.items && raw.settings){
          state.data = raw;
        }else{
          normalizeFromBackup(raw);
        }
        save(); render();
        alert('Importado OK');
      }catch(err){ alert('Archivo inválido'); }
      e.target.value='';
    };

    $('#btnLogout').onclick = ()=>{
      sessionStorage.removeItem(PIN_KEY);
      location.reload();
    };

    // Secciones
    $('#addSection').onclick = ()=>{
      const secs = state.data.settings.sections||[];
      let base = 'seccion', k = base, i=1;
      while(secs.some(s=>s.key===k)){ k = base + i++; }
      secs.push({key:k, name:'Nueva sección', tabs:10});
      state.data.settings.sections = secs;
      save(); renderSections();
    };
    $('#saveSection').onclick = ()=>{
      const idx = state.editingSectionIndex;
      if(idx<0){ alert('Selecciona una sección'); return; }
      const secs = state.data.settings.sections;
      const name = $('#sec_name').value.trim() || 'Sección';
      const key = $('#sec_key').value.trim().toLowerCase().replace(/\s+/g,'-') || 'seccion';
      const tabs = Math.max(1, Number($('#sec_tabs').value||10));
      if(secs.some((s,ii)=> ii!==idx && s.key===key)){
        alert('La clave (slug) ya existe. Elige otra.');
        return;
      }
      secs[idx] = {key,name,tabs};
      save(); renderSections(); alert('Sección guardada');
    };
    $('#deleteSection').onclick = ()=>{
      const idx = state.editingSectionIndex;
      if(idx<0) return;
      const sec = state.data.settings.sections[idx];
      const hasItems = state.data.items.some(i=>i.section===sec.key);
      if(hasItems){ alert('No puedes eliminar una sección con ítems. Reasigna o elimina esos ítems primero.'); return; }
      if(confirm('¿Eliminar la sección?')){
        state.data.settings.sections.splice(idx,1);
        state.editingSectionIndex = -1;
        save(); renderSections();
      }
    };
  }

  function render(){
    // settings
    $('#s_brand').value = state.data.settings.bizName || '';
    $('#s_phone').value = state.data.settings.waNumber || '';
    $('#s_insta').value = state.data.settings.insta || '';
    $('#s_fb').value = state.data.settings.fb || '';
    $('#s_primary').value = state.data.settings.primary || '#f97316';
    $('#s_pin').value = state.data.settings.pin || '0000';
    renderList();
    renderSections();
  }

  function renderList(){
    const q = ($('#adminSearch').value||'').toLowerCase();
    const inKnown = (state.data.settings.sections||[]).some(s=>s.key===state.tab);
    const secKey = inKnown? state.tab : null;
    const items = state.data.items.filter(i=>{
      const ok = !secKey || i.section===secKey;
      const matches = !q || (`${i.name} ${i.desc||''}`.toLowerCase().includes(q));
      return ok && matches;
    });
    $('#itemList').innerHTML = items.map(i=>`
      <div class="item" data-id="${i.id}">
        <div class="flex">
          <span class="badge">${i.section}</span>
          <span class="badge">Tab ${Number(i.tab||1)}</span>
          <strong>${i.name}</strong>
        </div>
        <div class="flex">
          <span>$${Number(i.price||0).toFixed(2)}</span>
          <button class="btn ghost" data-edit="${i.id}">Editar</button>
        </div>
      </div>
    `).join('');
    $$('#itemList [data-edit]').forEach(b=> b.onclick = ()=>{
      const id = Number(b.getAttribute('data-edit'));
      const r = state.data.items.find(x=>Number(x.id)===id);
      if(r) edit(r);
    });
    // fill select
    const sel = $('#f_section');
    if(sel){
      sel.innerHTML = (state.data.settings.sections||[]).map(s=>`<option value="${s.key}">${s.name}</option>`).join('');
    }
  }

  function edit(r){
    $('#f_id').value = r.id;
    $('#f_name').value = r.name||'';
    $('#f_price').value = Number(r.price||0);
    $('#f_desc').value = r.desc||'';
    $('#f_section').value = r.section||'menu';
    $('#f_img').value = r.img||r.imgUrl||'';
    $('#f_tab').value = Number(r.tab||1);
  }
  function clearForm(){ $('#itemForm').reset(); }

  function renderSections(){
    const secs = state.data.settings.sections||[];
    const list = $('#secList');
    if(!list) return;
    list.innerHTML = secs.map((s,i)=>`
      <div class="item" data-i="${i}">
        <div class="flex"><strong>${s.name}</strong><span class="badge">${s.key}</span></div>
        <div class="flex"><span>Tabs: ${s.tabs}</span><button class="btn ghost" data-sec-edit="${i}">Editar</button></div>
      </div>
    `).join('');
    $$('#secList [data-sec-edit]').forEach(b=> b.onclick = ()=>{
      const i = Number(b.getAttribute('data-sec-edit'));
      state.editingSectionIndex = i;
      const s = secs[i];
      $('#sec_id').value = i;
      $('#sec_name').value = s.name;
      $('#sec_key').value = s.key;
      $('#sec_tabs').value = s.tabs;
    });
  }

  gate();
})();