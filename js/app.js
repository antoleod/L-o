// ===== Utilities =====
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const store = {
  get(key, fallback){
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  },
  set(key, val){ localStorage.setItem(key, JSON.stringify(val)); },
  remove(key){ localStorage.removeItem(key); }
};

// ===== Hero background =====
const HERO_KEY = 'heroImage';
const HERO_FALLBACKS = ['img/baby.jpg', 'img/baby1.jpg'];

function isAbsolutePath(src){
  return /^data:/.test(src) || /^https?:/.test(src) || src.startsWith('/');
}

function toDocPath(src){
  if(!src) return null;
  if(isAbsolutePath(src)) return src;
  if(src.startsWith('../')) return src.replace(/^\.\.\//,'');
  if(src.startsWith('./')) return src.slice(2);
  return src;
}

function toCssPath(src){
  if(!src) return null;
  if(isAbsolutePath(src)) return src;
  if(src.startsWith('../')) return src;
  return `../${src}`;
}

function clearHero(){
  document.documentElement.style.removeProperty('--hero-image');
  document.documentElement.classList.add('no-hero-image');
}

function applyHeroBackground(docPath){
  const cssPath = toCssPath(docPath);
  if(cssPath){
    document.documentElement.style.setProperty('--hero-image', `url("${cssPath}")`);
    document.documentElement.classList.remove('no-hero-image');
  }else{
    clearHero();
  }
}

function preloadImage(docPath){
  return new Promise(resolve => {
    if(!docPath){ resolve(false); return; }
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = docPath;
  });
}

function setHeroImage(src, {persist=true, fallbackIndex=0} = {}){
  const docPath = toDocPath(src);
  return preloadImage(docPath).then(ok => {
    if(ok){
      applyHeroBackground(docPath);
      if(persist) store.set(HERO_KEY, docPath);
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
const addManualBtn = $('#add-manual');
const manualModal = $('#modal-manual');
const manualTypeButtons = $$('#manual-type button');
const manualFeedFields = $('#manual-feed-fields');
const manualElimFields = $('#manual-elim-fields');
const manualSource = $('#manual-source');
const manualBreastField = $('#manual-breast-field');
const manualDurationField = $('#manual-duration-field');
const manualAmountField = $('#manual-amount-field');
const manualBreast = $('#manual-breast');
const manualDuration = $('#manual-duration');
const manualAmount = $('#manual-amount');
const manualPee = $('#manual-pee');
const manualPoop = $('#manual-poop');
const manualVomit = $('#manual-vomit');
const manualDatetime = $('#manual-datetime');
const closeManualBtn = $('#close-manual');
const cancelManualBtn = $('#cancel-manual');
const saveManualBtn = $('#save-manual');
const startStopBtn = $('#startStop');
const startTimeDisplay = $('#start-time-display');

// ===== State =====
let feeds = store.get('feeds', []); // {id,dateISO,source,breastSide,durationSec,amountMl}
let elims = store.get('elims', []); // {id,dateISO,pee,poop,vomit}
const TIMER_KEY = 'timerState';
let manualType = 'feed';
let timer = 0;
let timerStart = null;
let timerInterval = null;

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
  renderFeedHistory();
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
  const item = btn.closest('.item');
  item?.classList?.add('exiting');
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

function renderFeedHistory(){
  const container = $('#feed-history');
  if(!container) return;
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const todaysFeeds = feeds
    .filter(f => new Date(f.dateISO).getTime() >= start)
    .sort((a,b)=> a.dateISO < b.dateISO ? 1 : -1);

  container.innerHTML = '';
  if(!todaysFeeds.length){
    const empty = document.createElement('div');
    empty.className = 'history-empty';
    empty.textContent = "Aucun enregistrement aujourd'hui";
    container.appendChild(empty);
    return;
  }

  todaysFeeds.forEach(feed => {
    const div = document.createElement('div');
    div.className = 'item';
    const time = new Date(feed.dateISO).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    if(feed.source === 'breast'){
      const mins = Math.round((feed.durationSec || 0)/60);
      div.textContent = `🍼 ${time} — Sein (${feed.breastSide}) · ${mins} min`;
    }else{
      div.textContent = `🍼 ${time} — Biberon · ${feed.amountMl} ml`;
    }
    container.appendChild(div);
  });
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

function updateChrono(){
  const h = String(Math.floor(timer / 3600)).padStart(2, '0');
  const m = String(Math.floor((timer % 3600) / 60)).padStart(2, '0');
  const s = String(timer % 60).padStart(2, '0');
  const chrono = $('#chrono');
  if(chrono){
    chrono.textContent = `${h}:${m}:${s}`;
  }
}
updateChrono();

function setFeedMode(mode){
  feedMode = mode;
  const pecho = $('#seg-pecho');
  const biberon = $('#seg-biberon');
  pecho?.classList?.toggle('active', mode === 'breast');
  biberon?.classList?.toggle('active', mode === 'bottle');
  panePecho?.classList?.toggle('is-hidden', mode !== 'breast');
  paneBiberon?.classList?.toggle('is-hidden', mode !== 'bottle');
}

function setBreastSide(side){
  breastSide = side;
  $('#side-left')?.classList?.toggle('active', side === 'Gauche');
  $('#side-right')?.classList?.toggle('active', side === 'Droite');
  $('#side-both')?.classList?.toggle('active', side === 'Les deux');
  if(timerStart){
    store.set(TIMER_KEY, { start: timerStart, breastSide });
  }
}

function tickTimer(){
  if(!timerStart) return;
  timer = Math.max(0, Math.floor((Date.now() - timerStart) / 1000));
  updateChrono();
}

function beginTimer(startTimestamp = Date.now(), persist = true){
  timerStart = startTimestamp;
  timerInterval && clearInterval(timerInterval);
  timerInterval = setInterval(tickTimer, 1000);
  tickTimer();
  const label = new Date(timerStart).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
  startTimeDisplay && (startTimeDisplay.textContent = `Commencé à ${label}`);
  startStopBtn && (startStopBtn.textContent = 'Stop');
  if(persist){
    store.set(TIMER_KEY, { start: timerStart, breastSide });
  }
}

function stopTimerWithoutSaving(){
  if(timerInterval){
    clearInterval(timerInterval);
    timerInterval = null;
  }
  timerStart = null;
  store.remove(TIMER_KEY);
  startStopBtn && (startStopBtn.textContent = 'Démarrer');
  startTimeDisplay && (startTimeDisplay.textContent = '');
  timer = 0;
  updateChrono();
}

function saveFeed(entry){
  feeds.push(entry);
  store.set('feeds', feeds);
  closeModal('#modal-leche');
  renderHistory();
}

$('#btn-leche')?.addEventListener('click', ()=> openModal('#modal-leche'));
$('#close-leche')?.addEventListener('click', ()=> closeModal('#modal-leche'));

$('#seg-pecho')?.addEventListener('click', ()=> setFeedMode('breast'));
$('#seg-biberon')?.addEventListener('click', ()=> setFeedMode('bottle'));

$('#side-left')?.addEventListener('click', ()=> setBreastSide('Gauche'));
$('#side-right')?.addEventListener('click', ()=> setBreastSide('Droite'));
$('#side-both')?.addEventListener('click', ()=> setBreastSide('Les deux'));

startStopBtn?.addEventListener('click', () => {
  if(timerInterval){
    const elapsed = Math.max(1, Math.floor((Date.now() - timerStart) / 1000));
    stopTimerWithoutSaving();
    const entry = {
      id: Date.now()+'',
      dateISO: new Date().toISOString(),
      source: 'breast',
      breastSide,
      durationSec: elapsed
    };
    saveFeed(entry);
  }else{
    setFeedMode('breast');
    beginTimer(Date.now(), true);
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

setFeedMode('breast');
setBreastSide(breastSide);
const savedTimer = store.get(TIMER_KEY, null);
if(savedTimer && savedTimer.start){
  setFeedMode('breast');
  if(savedTimer.breastSide) setBreastSide(savedTimer.breastSide);
  beginTimer(savedTimer.start, false);
}

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

// ===== Manual entry =====
function formatDateInput(date){
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0,16);
}

function clamp(value, min, max){
  return Math.min(max, Math.max(min, value));
}

function setManualType(type){
  manualType = type;
  manualTypeButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.type === type));
  manualFeedFields?.classList?.toggle('is-hidden', type !== 'feed');
  manualElimFields?.classList?.toggle('is-hidden', type !== 'elim');
  if(type === 'feed') updateManualSourceFields();
}

function updateManualSourceFields(){
  const source = manualSource?.value || 'breast';
  const isBreast = source === 'breast';
  manualBreastField?.classList?.toggle('is-hidden', !isBreast);
  manualDurationField?.classList?.toggle('is-hidden', !isBreast);
  manualAmountField?.classList?.toggle('is-hidden', isBreast);
}

function openManualModal(){
  setManualType('feed');
  manualSource && (manualSource.value = 'breast');
  updateManualSourceFields();
  manualBreast && (manualBreast.value = 'Gauche');
  manualDuration && (manualDuration.value = '');
  manualAmount && (manualAmount.value = '');
  manualPee && (manualPee.value = 0);
  manualPoop && (manualPoop.value = 0);
  manualVomit && (manualVomit.value = 0);
  manualDatetime && (manualDatetime.value = formatDateInput(new Date()));
  openModal('#modal-manual');
}

function closeManualModal(){
  closeModal('#modal-manual');
}

function saveManualEntry(){
  let date = manualDatetime && manualDatetime.value ? new Date(manualDatetime.value) : new Date();
  if(Number.isNaN(date.getTime())) date = new Date();
  const dateISO = date.toISOString();

  if(manualType === 'feed'){
    const source = manualSource?.value || 'breast';
    if(source === 'breast'){
      const mins = Math.max(0, Number(manualDuration?.value || 0));
      const durationSec = Math.round(mins * 60);
      const entry = {
        id: Date.now()+'',
        dateISO,
        source: 'breast',
        breastSide: manualBreast?.value || 'Gauche',
        durationSec
      };
      feeds.push(entry);
      store.set('feeds', feeds);
    }else{
      const amountMl = Math.max(0, Number(manualAmount?.value || 0));
      const entry = {
        id: Date.now()+'',
        dateISO,
        source: 'bottle',
        amountMl
      };
      feeds.push(entry);
      store.set('feeds', feeds);
    }
  }else{
    const entry = {
      id: Date.now()+'',
      dateISO,
      pee: clamp(Number(manualPee?.value || 0), 0, 3),
      poop: clamp(Number(manualPoop?.value || 0), 0, 3),
      vomit: clamp(Number(manualVomit?.value || 0), 0, 3)
    };
    elims.push(entry);
    store.set('elims', elims);
  }

  closeManualModal();
  renderHistory();
}

addManualBtn?.addEventListener('click', openManualModal);
closeManualBtn?.addEventListener('click', closeManualModal);
cancelManualBtn?.addEventListener('click', closeManualModal);
saveManualBtn?.addEventListener('click', saveManualEntry);
manualTypeButtons.forEach(btn => btn.addEventListener('click', ()=> setManualType(btn.dataset.type)));
manualSource?.addEventListener('change', updateManualSourceFields);
if(manualModal){
  setManualType('feed');
  updateManualSourceFields();
}
