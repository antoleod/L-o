// ===== Utilities =====
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const store = {
  get(key, fallback){
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  },
  set(key, val){ localStorage.setItem(key, JSON.stringify(val)); }
};

// ===== Hero background =====
const HERO_KEY = 'heroImage';
const HERO_FALLBACKS = ['../img/baby.jpg', '../img/baby1.jpg'];

function normalizeHero(src){
  if(!src) return null;
  if(/^data:/.test(src) || /^https?:/.test(src) || src.startsWith('/')) return src;
  if(src.startsWith('../')) return src;
  if(src.startsWith('./')) return `../${src.slice(2)}`;
  if(src.startsWith('img/')) return `../${src}`;
  return src;
}

function clearHero(){
  document.documentElement.style.removeProperty('--hero-image');
  document.documentElement.classList.add('no-hero-image');
}

function applyHeroBackground(src){
  if(src){
    document.documentElement.style.setProperty('--hero-image', `url("${src}")`);
    document.documentElement.classList.remove('no-hero-image');
  }else{
    clearHero();
  }
}

function preloadImage(src){
  return new Promise(resolve => {
    if(!src){ resolve(false); return; }
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = src;
  });
}

function setHeroImage(src, {persist=true, fallbackIndex=0} = {}){
  const target = normalizeHero(src);
  return preloadImage(target).then(ok => {
    if(ok){
      applyHeroBackground(target);
      if(persist) store.set(HERO_KEY, target);
      return true;
    }
    if(fallbackIndex < HERO_FALLBACKS.length){
      return setHeroImage(HERO_FALLBACKS[fallbackIndex], {persist:false, fallbackIndex:fallbackIndex+1});
    }
    clearHero();
    if(persist) store.set(HERO_KEY, null);
    return false;
  });
}

setHeroImage(store.get(HERO_KEY, null), {persist:false}).then(ok => {
  if(!ok) setHeroImage(HERO_FALLBACKS[0], {persist:false, fallbackIndex:1});
});

// ===== DOM refs =====
const panePecho = $('#pane-pecho');
const paneBiberon = $('#pane-biberon');
const historyList = $('#history');
const summaryFeedEl = $('#summary-feed');
const summaryElimEl = $('#summary-elim');
const dashboardElimEl = $('#dashboard-elim');
const bgPicker = $('#bg-picker');
const avatarBtn = $('#avatar-btn');
const infoBtn = $('#info-btn');
const infoChevron = $('#info-chevron');

// ===== State =====
let feeds = store.get('feeds', []); // {id,dateISO,source,breastSide,durationSec,amountMl}
let elims = store.get('elims', []); // {id,dateISO,pee,poop,vomit}

// ===== History render =====
function renderHistory(){
  if(!historyList) return;
  const all = [
    ...feeds.map(f => ({type:'feed', item:f})),
    ...elims.map(e => ({type:'elim', item:e}))
  ].sort((a,b)=> a.item.dateISO < b.item.dateISO ? 1 : -1).slice(0,10);

  historyList.innerHTML = '';
  if(!all.length){
    const empty = document.createElement('div');
    empty.className = 'history-empty';
    empty.textContent = "Aucun enregistrement pour le moment. Ajoutez un premier suivi !";
    historyList.appendChild(empty);
  }else{
    for(const row of all){
      const div = document.createElement('div');
      div.className = 'item enter';
      const dateString = new Date(row.item.dateISO).toLocaleString();
      let title = '';
      if(row.type === 'feed'){
        if(row.item.source === 'breast'){
          const mins = Math.round((row.item.durationSec || 0) / 60);
          title = `🍼 Sein (${row.item.breastSide}) · ${mins} min`;
        }else{
          title = `🍼 Biberon · ${row.item.amountMl} ml`;
        }
      }else{
        title = `🚼 Eliminations · P:${row.item.pee} · C:${row.item.poop} · V:${row.item.vomit}`;
      }
      div.innerHTML = `
        <div class="item-content">
          <strong>${title}</strong>
          <div class="item-meta">${dateString}</div>
        </div>
        <button class="item-delete" data-type="${row.type}" data-id="${row.item.id}" aria-label="Supprimer l'entrée">
          <span>×</span>
        </button>
      `;
      historyList.appendChild(div);
      requestAnimationFrame(()=> div.classList.remove('enter'));
    }
  }
  $('#count-pill').textContent = feeds.length + elims.length;
  updateSummaries();
}
renderHistory();

historyList?.addEventListener('click', (e)=>{
  const btn = e.target.closest('.item-delete');
  if(!btn) return;
  const {type, id} = btn.dataset;
  if(type === 'feed'){
    feeds = feeds.filter(f => f.id !== id);
    store.set('feeds', feeds);
  }else if(type === 'elim'){
    elims = elims.filter(el => el.id !== id);
    store.set('elims', elims);
  }
  btn.disabled = true;
  btn.closest('.item')?.classList.add('exiting');
  setTimeout(renderHistory, 180);
});

function updateSummaries(){
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

  if(summaryFeedEl){
    const todayFeeds = feeds.filter(f => new Date(f.dateISO).getTime() >= start);
    if(!todayFeeds.length){
      summaryFeedEl.innerHTML = "<strong>Aujourd'hui</strong><span>Aucun enregistrement</span>";
    }else{
      const breast = todayFeeds.filter(f => f.source === 'breast');
      const bottle = todayFeeds.filter(f => f.source === 'bottle');
      const breastMinutes = Math.round(breast.reduce((sum,f)=> sum + (f.durationSec || 0), 0) / 60);
      const bottleMl = bottle.reduce((sum,f)=> sum + (f.amountMl || 0), 0);
      summaryFeedEl.innerHTML = `
        <strong>Aujourd'hui</strong>
        <span>${todayFeeds.length} séances</span>
        <span>Sein ${breastMinutes} min</span>
        <span>Biberon ${bottleMl} ml</span>
      `;
    }
  }

  if(summaryElimEl || dashboardElimEl){
    const todayElims = elims.filter(e => new Date(e.dateISO).getTime() >= start);
    if(!todayElims.length){
      if(summaryElimEl) summaryElimEl.innerHTML = "<strong>Aujourd'hui</strong><span>Aucune donnée</span>";
      if(dashboardElimEl) dashboardElimEl.innerHTML = "<strong>Pipi / Caca / Vomi</strong><span>Aucune donnée aujourd'hui</span>";
    }else{
      const totals = todayElims.reduce((acc, cur)=> ({
        pee: acc.pee + (cur.pee || 0),
        poop: acc.poop + (cur.poop || 0),
        vomit: acc.vomit + (cur.vomit || 0)
      }), {pee:0, poop:0, vomit:0});
      const last = todayElims[0];
      const time = new Date(last.dateISO).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
      if(summaryElimEl){
        summaryElimEl.innerHTML = `
          <strong>Aujourd'hui</strong>
          <span>Pipi ${totals.pee}</span>
          <span>Caca ${totals.poop}</span>
          <span>Vomi ${totals.vomit}</span>
          <span>${todayElims.length} entrées</span>
        `;
      }
      if(dashboardElimEl){
        dashboardElimEl.innerHTML = `
          <strong>Pipi / Caca / Vomi</strong>
          <span>P ${totals.pee}</span>
          <span>C ${totals.poop}</span>
          <span>V ${totals.vomit}</span>
          <span>Dernier ${time}</span>
        `;
      }
    }
  }
}

function renderElimHistory(){
  const list = $('#elim-history-today');
  if(!list) return;
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const todays = elims
    .filter(e => new Date(e.dateISO).getTime() >= start)
    .sort((a,b)=> a.dateISO < b.dateISO ? 1 : -1);

  list.innerHTML = '';
  if(!todays.length){
    const empty = document.createElement('div');
    empty.className = 'history-empty';
    empty.textContent = "Aucune donnée aujourd'hui";
    list.appendChild(empty);
    return;
  }

  for(const elim of todays){
    const time = new Date(elim.dateISO).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    const item = document.createElement('div');
    item.className = 'item';
    item.textContent = `🚼 ${time} — P:${elim.pee} · C:${elim.poop} · V:${elim.vomit}`;
    list.appendChild(item);
  }
}

// ===== Modal helpers =====
function openModal(id){
  const modal = $(id);
  if(!modal) return;
  modal.classList.add('open');
  modal.setAttribute('aria-hidden','false');
  document.body.classList.add('modal-open');
}

function closeModal(id){
  const modal = $(id);
  if(!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden','true');
  if(!document.querySelector('.modal.open')){
    document.body.classList.remove('modal-open');
  }
}

// ===== Leche modal logic =====
let feedMode = 'breast';
let breastSide = 'Gauche';
let timer = 0; let interval = null;

function updateChrono(){
  const h = String(Math.floor(timer / 3600)).padStart(2, '0');
  const m = String(Math.floor((timer % 3600) / 60)).padStart(2, '0');
  const s = String(timer % 60).padStart(2, '0');
  $('#chrono').textContent = `${h}:${m}:${s}`;
}
updateChrono();

$('#btn-leche')?.addEventListener('click', ()=> openModal('#modal-leche'));
$('#close-leche')?.addEventListener('click', ()=> closeModal('#modal-leche'));

$('#seg-pecho')?.addEventListener('click', ()=>{
  feedMode = 'breast';
  $('#seg-pecho').classList.add('active');
  $('#seg-biberon').classList.remove('active');
  panePecho?.classList.remove('is-hidden');
  paneBiberon?.classList.add('is-hidden');
});

$('#seg-biberon')?.addEventListener('click', ()=>{
  feedMode = 'bottle';
  $('#seg-biberon').classList.add('active');
  $('#seg-pecho').classList.remove('active');
  panePecho?.classList.add('is-hidden');
  paneBiberon?.classList.remove('is-hidden');
});

$('#side-left')?.addEventListener('click', ()=>{
  breastSide = 'Gauche';
  $('#side-left').classList.add('active');
  $('#side-right').classList.remove('active');
  $('#side-both').classList.remove('active');
});

$('#side-right')?.addEventListener('click', ()=>{
  breastSide = 'Droite';
  $('#side-right').classList.add('active');
  $('#side-left').classList.remove('active');
  $('#side-both').classList.remove('active');
});

$('#side-both')?.addEventListener('click', ()=>{
  breastSide = 'Les deux';
  $('#side-both').classList.add('active');
  $('#side-left').classList.remove('active');
  $('#side-right').classList.remove('active');
});

function saveFeed(entry){
  feeds.push(entry);
  store.set('feeds', feeds);
  closeModal('#modal-leche');
  renderHistory();
}

$('#startStop')?.addEventListener('click', (e)=>{
  if(interval){
    clearInterval(interval);
    interval = null;
    const entry = {
      id: Date.now()+'',
      dateISO: new Date().toISOString(),
      source: 'breast',
      breastSide,
      durationSec: timer
    };
    saveFeed(entry);
    timer = 0;
    updateChrono();
    $('#start-time-display').textContent = '';
    e.target.textContent = 'Démarrer';
  }else{
    interval = setInterval(()=>{ timer++; updateChrono(); }, 1000);
    const startTime = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    $('#start-time-display').textContent = `Commencé à ${startTime}`;
    e.target.textContent = 'Stop';
  }
});

$('#save-biberon')?.addEventListener('click', () => {
  const ml = Number($('#ml').value || 0);
  if(ml > 0){
    const entry = {
      id: Date.now()+'',
      dateISO: new Date().toISOString(),
      source: 'bottle',
      amountMl: ml
    };
    saveFeed(entry);
    $('#ml').value = '';
  }
});

// ===== Eliminations modal logic =====
$('#btn-elim')?.addEventListener('click', ()=>{ renderElimHistory(); openModal('#modal-elim'); });
$('#close-elim')?.addEventListener('click', ()=> closeModal('#modal-elim'));
$('#cancel-elim')?.addEventListener('click', ()=> closeModal('#modal-elim'));

const scales = { pee:0, poop:0, vomit:0 };

function renderScale(root){
  root.innerHTML = '';
  const key = root.dataset.scale;
  for(let n=0; n<=3; n++){
    const btn = document.createElement('button');
    btn.textContent = n;
    if(scales[key] === n) btn.classList.add('active');
    btn.addEventListener('click', ()=>{ scales[key] = n; renderScale(root); });
    root.appendChild(btn);
  }
}
$$('.scale').forEach(renderScale);

$('#save-elim')?.addEventListener('click', ()=>{
  elims.push({
    id: Date.now()+'',
    dateISO: new Date().toISOString(),
    pee: scales.pee,
    poop: scales.poop,
    vomit: scales.vomit
  });
  store.set('elims', elims);
  closeModal('#modal-elim');
  renderHistory();
});

// ===== Avatar & info actions =====
if(bgPicker){
  bgPicker.addEventListener('change', handleBackgroundChange);
}

if(avatarBtn){
  avatarBtn.addEventListener('click', ()=>{
    bgPicker?.click();
  });
}

function showProfile(){
  alert('Profil de Léo:\n• Naissance: 27/10/25 16:13\n• Poids de naissance: 3800 gr');
}

infoBtn?.addEventListener('click', showProfile);
infoChevron?.addEventListener('click', showProfile);

function handleBackgroundChange(event){
  const input = event.target;
  const file = input.files && input.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = reader.result;
    if(typeof dataUrl === 'string'){
      setHeroImage(dataUrl);
    }
    input.value = '';
  };
  reader.readAsDataURL(file);
}
