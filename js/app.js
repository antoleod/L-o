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

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

function focusFirstElement(modal){
  const preferred = modal.querySelector('[data-modal-focus]');
  const focusable = preferred || modal.querySelector(FOCUSABLE_SELECTOR);
  if(focusable && typeof focusable.focus === 'function'){
    focusable.focus({preventScroll:true});
  }
}

function escapeHtml(value){
  if(!value) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ===== Hero background =====
const HERO_KEY = 'heroImage';
const HERO_FALLBACKS = [
  'img/baby.jpg',
  'img/baby1.jpg',
  'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1528747045269-390fe33c19f2?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80'
];
let heroRotationTimer = null;
const HERO_ROTATION_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const HERO_ROTATION_META_KEY = 'heroRotationMeta';

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

function getHeroSources(){
  const list = [...HERO_FALLBACKS];
  const custom = store.get(HERO_KEY, null);
  if(custom && !list.includes(custom)){
    list.unshift(custom);
  }
  return list;
}

function getHeroMeta(){
  const meta = store.get(HERO_ROTATION_META_KEY, null);
  if(meta && typeof meta.index === 'number' && typeof meta.lastSwitch === 'number'){
    return meta;
  }
  const fresh = {index:0, lastSwitch: Date.now()};
  store.set(HERO_ROTATION_META_KEY, fresh);
  return fresh;
}

function saveHeroMeta(meta){
  store.set(HERO_ROTATION_META_KEY, meta);
}

function syncHeroRotation({advance=false, force=false} = {}){
  const sources = getHeroSources();
  if(!sources.length) return;
  let meta = getHeroMeta();
  const now = Date.now();
  let index = meta.index % sources.length;
  if(index < 0) index = (index + sources.length) % sources.length;

  if(force){
    setHeroImage(sources[index], {persist:false});
    meta = {index, lastSwitch: now};
    saveHeroMeta(meta);
    return;
  }

  if(advance){
    index = (index + 1) % sources.length;
    meta = {index, lastSwitch: now};
    saveHeroMeta(meta);
    setHeroImage(sources[index], {persist:false});
    return;
  }

  const elapsed = now - (meta.lastSwitch || 0);
  if(elapsed >= HERO_ROTATION_INTERVAL_MS){
    const steps = Math.max(1, Math.floor(elapsed / HERO_ROTATION_INTERVAL_MS));
    index = (index + steps) % sources.length;
    meta = {index, lastSwitch: now};
    saveHeroMeta(meta);
    setHeroImage(sources[index], {persist:false});
    return;
  }

  const target = sources[index];
  const currentCss = document.documentElement.style.getPropertyValue('--hero-image');
  if(!currentCss || !currentCss.includes(target)){
    setHeroImage(target, {persist:false});
  }
}

function rotateHeroImage(){
  syncHeroRotation({advance:true});
}

function stopHeroRotation(){
  if(heroRotationTimer){
    clearInterval(heroRotationTimer);
    heroRotationTimer = null;
  }
}

function startHeroRotation(){
  stopHeroRotation();
  syncHeroRotation();
  heroRotationTimer = setInterval(rotateHeroImage, HERO_ROTATION_INTERVAL_MS);
}

setHeroImage(store.get(HERO_KEY, null), {persist:false}).then(ok => {
  if(!ok) setHeroImage(HERO_FALLBACKS[0], {persist:false, fallbackIndex:1});
});
startHeroRotation();

// ===== DOM refs =====
const panePecho = $('#pane-pecho');
const paneBiberon = $('#pane-biberon');
const historyList = $('#history');
const historyRangeBtn = $('#history-range-btn');
const historyRangeLabelEl = $('#history-range-label');
const historyRangeMenu = $('#history-range-menu');
const historyRangeOptions = historyRangeMenu ? Array.from(historyRangeMenu.querySelectorAll('[data-range]')) : [];
const countPillEl = $('#count-pill');
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
const manualNotes = $('#manual-notes');
const manualPee = $('#manual-pee');
const manualPoop = $('#manual-poop');
const manualVomit = $('#manual-vomit');
const manualElimNotes = $('#manual-elim-notes');
const manualDatetime = $('#manual-datetime');
const closeManualBtn = $('#close-manual');
const cancelManualBtn = $('#cancel-manual');
const saveManualBtn = $('#save-manual');
const startStopBtn = $('#startStop');
const startTimeDisplay = $('#start-time-display');
const manualMedFields = $('#manual-med-fields');
const manualMedSelect = $('#manual-med-select');
const manualMedOtherField = $('#manual-med-other-field');
const manualMedOtherInput = $('#manual-med-other');
const manualMedDose = $('#manual-med-dose');
const manualMedNotes = $('#manual-med-notes');
const medsBtn = $('#btn-med');
const closeMedBtn = $('#close-med');
const cancelMedBtn = $('#cancel-med');
const saveMedBtn = $('#save-med');
const medSelect = $('#medication-select');
const medOtherField = $('#medication-other-field');
const medOtherInput = $('#medication-other');
const summaryMedEl = $('#summary-med');

// ===== State =====
let feeds = store.get('feeds', []); // {id,dateISO,source,breastSide,durationSec,amountMl}
let elims = store.get('elims', []); // {id,dateISO,pee,poop,vomit}
let meds = store.get('meds', []); // {id,dateISO,name}
let historyRange = 'day';
let historyRangeMenuOpen = false;
const TIMER_KEY = 'timerState';
let manualType = 'feed';
let timer = 0;
let timerStart = null;
let timerInterval = null;

const remoteClient = typeof window !== 'undefined' ? window.RemoteReports : null;
let remoteConfig = null;
if(typeof window !== 'undefined'){
  if(window.REMOTE_REPORTS_CONFIG){
    remoteConfig = window.REMOTE_REPORTS_CONFIG;
  }else{
    try{
      const storedConfig = window.localStorage.getItem('remoteReportsConfig');
      if(storedConfig){
        remoteConfig = JSON.parse(storedConfig);
      }
    }catch{
      remoteConfig = null;
    }
  }
}
let remoteEnabled = false;

function cloneDataSnapshot(){
  return {
    feeds: feeds.map(f => ({...f})),
    elims: elims.map(e => ({...e})),
    meds: meds.map(m => ({...m}))
  };
}

function persistAll(reason = 'Sync update'){
  store.set('feeds', feeds);
  store.set('elims', elims);
  store.set('meds', meds);
  if(remoteEnabled && remoteClient){
    const payload = cloneDataSnapshot();
    remoteClient.saveAll(payload, reason).catch(err => {
      console.error('Remote sync failed:', err);
    });
  }
}

function replaceDataFromSnapshot(snapshot, {persistLocal = true, skipRender = false} = {}){
  if(snapshot && typeof snapshot === 'object'){
    feeds = Array.isArray(snapshot.feeds) ? snapshot.feeds.map(f => ({...f})) : [];
    elims = Array.isArray(snapshot.elims) ? snapshot.elims.map(e => ({...e})) : [];
    meds = Array.isArray(snapshot.meds) ? snapshot.meds.map(m => ({...m})) : [];
  }else{
    feeds = [];
    elims = [];
    meds = [];
  }
  if(persistLocal){
    store.set('feeds', feeds);
    store.set('elims', elims);
    store.set('meds', meds);
  }
  if(!skipRender){
    renderHistory();
  }
}

function datasetHasLocalExtras(local, remote){
  const snapshot = remote && typeof remote === 'object' ? remote : {};
  const makeSet = (list=[]) => new Set(list.filter(Boolean).map(item => item.id));
  const remoteFeeds = makeSet(snapshot.feeds);
  const remoteElims = makeSet(snapshot.elims);
  const remoteMeds = makeSet(snapshot.meds);
  const localFeeds = (local.feeds || []).some(item => item && !remoteFeeds.has(item.id));
  const localElims = (local.elims || []).some(item => item && !remoteElims.has(item.id));
  const localMeds = (local.meds || []).some(item => item && !remoteMeds.has(item.id));
  return localFeeds || localElims || localMeds;
}

// ===== History render =====
const HISTORY_LABELS = {
  day: "Aujourd'hui",
  week: '7 derniers jours',
  month: '30 derniers jours'
};

const HISTORY_EMPTY_MESSAGES = {
  day: "Aucun enregistrement pour aujourd'hui.",
  week: 'Aucun enregistrement sur les 7 derniers jours.',
  month: 'Aucun enregistrement sur les 30 derniers jours.'
};

const DAY_MS = 24 * 60 * 60 * 1000;

function getHistoryRangeWindow(range){
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const startOfToday = todayStart.getTime();
  const endOfToday = startOfToday + DAY_MS;
  switch(range){
    case 'week':
      return {start: startOfToday - (6 * DAY_MS), end: endOfToday};
    case 'month':
      return {start: startOfToday - (29 * DAY_MS), end: endOfToday};
    case 'day':
    default:
      return {start: startOfToday, end: endOfToday};
  }
}

function isEntryWithinRange(dateISO, range, windowBounds){
  if(!dateISO) return false;
  const time = new Date(dateISO).getTime();
  if(Number.isNaN(time)) return false;
  const bounds = windowBounds || getHistoryRangeWindow(range);
  const {start, end} = bounds;
  return time >= start && time < end;
}

function renderHistory(){
  if(!historyList) return;
  const all = [
    ...feeds.map(f => ({type:'feed', item:f})),
    ...elims.map(e => ({type:'elim', item:e})),
    ...meds.map(m => ({type:'med', item:m}))
  ].sort((a,b)=> a.item.dateISO < b.item.dateISO ? 1 : -1);
  const rangeBounds = getHistoryRangeWindow(historyRange);
  const filtered = all.filter(entry => isEntryWithinRange(entry.item.dateISO, historyRange, rangeBounds));
  const limited = filtered.slice(0, 20);

  historyList.innerHTML = '';
  if(!limited.length){
    const empty = document.createElement('div');
    empty.className = 'history-empty';
    const msg = HISTORY_EMPTY_MESSAGES[historyRange] || "Aucun enregistrement pour le moment. Ajoutez un premier suivi !";
    empty.textContent = msg;
    historyList.appendChild(empty);
  }else{
    for(const row of limited){
      const div = document.createElement('div');
      div.className = 'item enter';
      const dateString = new Date(row.item.dateISO).toLocaleString();
      let title = '';
      if(row.type === 'feed'){
        if(row.item.source === 'breast'){
          const mins = Math.round((row.item.durationSec || 0) / 60);
          title = `🍼 Sein (${escapeHtml(row.item.breastSide || '')}) · ${mins} min`;
        }else{
          const ml = Number(row.item.amountMl || 0);
          title = `🍼 Biberon · ${ml} ml`;
        }
      }else if(row.type === 'elim'){
        title = `🚼 Eliminations · P:${row.item.pee} · C:${row.item.poop} · V:${row.item.vomit}`;
      }else if(row.type === 'med'){
        const doseSuffix = row.item.dose ? ` · ${escapeHtml(row.item.dose)}` : '';
        title = `💊 ${escapeHtml(row.item.name)}${doseSuffix}`;
      }
      const metaParts = [`<span class="item-meta-time">${escapeHtml(dateString)}</span>`];
      if(row.type === 'med' && row.item.medKey){
        const medLabel = row.item.medKey === 'other' ? 'AUTRE' : String(row.item.medKey).toUpperCase();
        metaParts.push(`<span class="item-meta-tag">${escapeHtml(medLabel)}</span>`);
      }
      if(row.item.notes){
        metaParts.push(`<span class="item-note">${escapeHtml(row.item.notes)}</span>`);
      }
      div.innerHTML = `
        <div class="item-content">
          <strong>${title}</strong>
          <div class="item-meta">${metaParts.join('')}</div>
        </div>
        <button class="item-delete" data-type="${row.type}" data-id="${row.item.id}" aria-label="Supprimer l'entrée">
          <span>×</span>
        </button>
      `;
      historyList.appendChild(div);
      requestAnimationFrame(()=> div.classList.remove('enter'));
    }
  }
  if(countPillEl){
    countPillEl.textContent = String(filtered.length);
    const label = HISTORY_LABELS[historyRange] || '';
    countPillEl.setAttribute('title', label ? `Total visibles - ${label}` : 'Total visibles');
  }
  updateSummaries();
  renderFeedHistory();
}

function toggleHistoryRangeMenu(force){
  const next = typeof force === 'boolean' ? force : !historyRangeMenuOpen;
  historyRangeMenuOpen = !!next && !!historyRangeMenu && !!historyRangeBtn;
  if(!historyRangeMenu || !historyRangeBtn) return;
  historyRangeBtn.setAttribute('aria-expanded', historyRangeMenuOpen ? 'true' : 'false');
  historyRangeMenu.classList.toggle('is-open', historyRangeMenuOpen);
}

function setHistoryRange(range, {silent=false} = {}){
  if(!HISTORY_LABELS[range]){
    range = 'day';
  }
  historyRange = range;
  if(historyRangeLabelEl){
    historyRangeLabelEl.textContent = HISTORY_LABELS[range];
  }
  historyRangeOptions.forEach(btn => {
    const active = btn.dataset.range === range;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-checked', active ? 'true' : 'false');
  });
  toggleHistoryRangeMenu(false);
  if(countPillEl){
    const label = HISTORY_LABELS[range] || '';
    countPillEl.setAttribute('title', label ? `Total visibles - ${label}` : 'Total visibles');
  }
  if(!silent){
    renderHistory();
  }
}
renderHistory();

if(historyRangeBtn && historyRangeMenu){
  historyRangeBtn.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    toggleHistoryRangeMenu();
  });
  historyRangeMenu.addEventListener('click', e => e.stopPropagation());
  historyRangeOptions.forEach(btn => {
    btn.addEventListener('click', ()=>{
      const range = btn.dataset.range || 'day';
      setHistoryRange(range);
    });
  });
  document.addEventListener('click', ()=>{
    if(historyRangeMenuOpen){
      toggleHistoryRangeMenu(false);
    }
  });
  document.addEventListener('keydown', e =>{
    if(e.key === 'Escape' && historyRangeMenuOpen){
      toggleHistoryRangeMenu(false);
      if(typeof historyRangeBtn.focus === 'function'){
        historyRangeBtn.focus({preventScroll:true});
      }
    }
  });
  setHistoryRange(historyRange, {silent:true});
}

historyList?.addEventListener('click', (e)=>{
  const btn = e.target.closest('.item-delete');
  if(!btn) return;
  const {type, id} = btn.dataset;
  let changed = false;
  if(type === 'feed'){
    feeds = feeds.filter(f => f.id !== id);
    changed = true;
  }else if(type === 'elim'){
    elims = elims.filter(el => el.id !== id);
    changed = true;
  }else if(type === 'med'){
    meds = meds.filter(m => m.id !== id);
    changed = true;
  }
  if(changed){
    persistAll('Delete entry');
  }
  btn.disabled = true;
  const item = btn.closest('.item');
  item?.classList?.add('exiting');
  setTimeout(renderHistory, 180);
});

function updateMedSummary(){
  if(!summaryMedEl) return;
  const nowString = new Date().toLocaleString();
  if(!meds.length){
    summaryMedEl.innerHTML = `<strong>Derniere prise</strong><span>Aucun medicament enregistre</span><span>Nouvelle prise ${escapeHtml(nowString)}</span>`;
    return;
  }
  const latest = meds.reduce((acc, cur)=> acc && acc.dateISO > cur.dateISO ? acc : cur, meds[0]);
  const dateString = new Date(latest.dateISO).toLocaleString();
  const parts = [
    '<strong>Derniere prise</strong>',
    `<span>${escapeHtml(latest.name)} - ${escapeHtml(dateString)}</span>`
  ];
  if(latest.dose){
    parts.push(`<span>Dose ${escapeHtml(latest.dose)}</span>`);
  }
  if(latest.notes){
    parts.push(`<span>Note ${escapeHtml(latest.notes)}</span>`);
  }
  parts.push(`<span>Nouvelle prise ${escapeHtml(nowString)}</span>`);
  summaryMedEl.innerHTML = parts.join('');
}

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
  updateMedSummary();
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
    let line = '';
    if(feed.source === 'breast'){
      const mins = Math.round((feed.durationSec || 0)/60);
      line = `🍼 ${escapeHtml(time)} — Sein (${escapeHtml(feed.breastSide || '')}) · ${mins} min`;
    }else{
      const ml = Number(feed.amountMl || 0);
      line = `🍼 ${escapeHtml(time)} — Biberon · ${ml} ml`;
    }
    let html = `<div class="feed-history-line">${line}</div>`;
    if(feed.notes){
      html += `<div class="item-note">${escapeHtml(feed.notes)}</div>`;
    }
    div.innerHTML = html;
    container.appendChild(div);
  });
}

// ===== Modal helpers =====
function openModal(id){
  const modal = $(id);
  if(!modal) return;
  modal.__prevFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  modal.removeAttribute('inert');
  modal.classList.add('open');
  modal.setAttribute('aria-hidden','false');
  document.body.classList.add('modal-open');
  focusFirstElement(modal);
}

function closeModal(id){
  const modal = $(id);
  if(!modal) return;
  const active = document.activeElement;
  if(active && modal.contains(active) && typeof active.blur === 'function'){
    active.blur();
  }
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden','true');
  modal.setAttribute('inert','');
  if(!document.querySelector('.modal.open')){
    document.body.classList.remove('modal-open');
  }
  const prev = modal.__prevFocus;
  if(prev && typeof prev.focus === 'function'){
    prev.focus({preventScroll:true});
  }else if(document.body){
    if(!document.body.hasAttribute('tabindex')) document.body.setAttribute('tabindex','-1');
    document.body.focus({preventScroll:true});
  }
  modal.__prevFocus = null;
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
  persistAll('Save feed entry');
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
  persistAll('Add elimination entry');
  closeModal('#modal-elim');
  renderHistory();
});

// ===== Medications modal logic =====
function updateMedOtherField(){
  const isOther = medSelect?.value === 'other';
  medOtherField?.classList?.toggle('is-hidden', !isOther);
  if(!isOther && medOtherInput){
    medOtherInput.value = '';
  }
}

function resetMedForm(){
  if(medSelect) medSelect.value = 'ibufrone';
  updateMedOtherField();
  if(medOtherInput) medOtherInput.value = '';
}

function openMedModal(){
  resetMedForm();
  updateMedSummary();
  openModal('#modal-med');
}

function closeMedModal(){
  closeModal('#modal-med');
}

function saveMedication(){
  if(!medSelect) return;
  const selection = medSelect.value || 'ibufrone';
  const labels = {
    ibufrone: 'Ibufrone',
    dalfalgan: 'Dalfalgan'
  };
  let name = labels[selection] || selection;
  if(selection === 'other'){
    name = (medOtherInput?.value || '').trim();
    if(!name){
      alert('Veuillez indiquer le nom du medicament.');
      medOtherInput?.focus();
      return;
    }
  }
  meds.push({
    id: Date.now()+'',
    dateISO: new Date().toISOString(),
    name,
    medKey: selection
  });
  persistAll('Add medication entry');
  updateMedSummary();
  renderHistory();
  closeMedModal();
}

medsBtn?.addEventListener('click', openMedModal);
closeMedBtn?.addEventListener('click', closeMedModal);
cancelMedBtn?.addEventListener('click', closeMedModal);
saveMedBtn?.addEventListener('click', saveMedication);
medSelect?.addEventListener('change', updateMedOtherField);
updateMedOtherField();

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
      setHeroImage(dataUrl).then(ok => {
        if(ok){
          saveHeroMeta({index:0, lastSwitch: Date.now()});
          startHeroRotation();
        }
      });
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
  manualMedFields?.classList?.toggle('is-hidden', type !== 'med');
  if(type === 'feed') updateManualSourceFields();
  if(type === 'med') updateManualMedFields();
}

function updateManualSourceFields(){
  const source = manualSource?.value || 'breast';
  const isBreast = source === 'breast';
  manualBreastField?.classList?.toggle('is-hidden', !isBreast);
  manualDurationField?.classList?.toggle('is-hidden', !isBreast);
  manualAmountField?.classList?.toggle('is-hidden', isBreast);
}

function updateManualMedFields(){
  const isOther = manualMedSelect?.value === 'other';
  manualMedOtherField?.classList?.toggle('is-hidden', !isOther);
  if(!isOther && manualMedOtherInput){
    manualMedOtherInput.value = '';
  }
  if(isOther){
    requestAnimationFrame(() => manualMedOtherInput?.focus());
  }
}

function openManualModal(){
  setManualType('feed');
  manualSource && (manualSource.value = 'breast');
  updateManualSourceFields();
  manualBreast && (manualBreast.value = 'Gauche');
  manualDuration && (manualDuration.value = '');
  manualAmount && (manualAmount.value = '');
  manualNotes && (manualNotes.value = '');
  manualPee && (manualPee.value = 0);
  manualPoop && (manualPoop.value = 0);
  manualVomit && (manualVomit.value = 0);
  manualElimNotes && (manualElimNotes.value = '');
  manualMedSelect && (manualMedSelect.value = 'ibufrone');
  manualMedOtherInput && (manualMedOtherInput.value = '');
  manualMedDose && (manualMedDose.value = '');
  manualMedNotes && (manualMedNotes.value = '');
  updateManualMedFields();
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
  let reason = null;

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
      const notes = manualNotes?.value?.trim();
      if(notes) entry.notes = notes;
      feeds.push(entry);
      reason = 'Manual feed entry (breast)';
    }else{
      const amountMl = Math.max(0, Number(manualAmount?.value || 0));
      const entry = {
        id: Date.now()+'',
        dateISO,
        source: 'bottle',
        amountMl
      };
      const notes = manualNotes?.value?.trim();
      if(notes) entry.notes = notes;
      feeds.push(entry);
      reason = 'Manual feed entry (bottle)';
    }
  }else if(manualType === 'elim'){
    const entry = {
      id: Date.now()+'',
      dateISO,
      pee: clamp(Number(manualPee?.value || 0), 0, 3),
      poop: clamp(Number(manualPoop?.value || 0), 0, 3),
      vomit: clamp(Number(manualVomit?.value || 0), 0, 3)
    };
    const notes = manualElimNotes?.value?.trim();
    if(notes) entry.notes = notes;
    elims.push(entry);
    reason = 'Manual elimination entry';
  }else if(manualType === 'med'){
    const selection = manualMedSelect?.value || 'ibufrone';
    const labels = {
      ibufrone: 'Ibufrone',
      dalfalgan: 'Dalfalgan',
      other: ''
    };
    let name = labels[selection] || selection;
    if(selection === 'other'){
      name = (manualMedOtherInput?.value || '').trim();
      if(!name){
        alert('Veuillez indiquer le nom du medicament.');
        manualMedOtherInput?.focus();
        return;
      }
    }
    const dose = (manualMedDose?.value || '').trim();
    const notes = (manualMedNotes?.value || '').trim();
    const entry = {
      id: Date.now()+'',
      dateISO,
      name,
      medKey: selection
    };
    if(dose) entry.dose = dose;
    if(notes) entry.notes = notes;
    meds.push(entry);
    reason = 'Manual medication entry';
  }

  if(reason){
    persistAll(reason);
  }
  closeManualModal();
  renderHistory();
}

async function initRemoteSync(){
  if(!remoteClient || !remoteConfig) return;
  try{
    const config = {...remoteConfig};
    if(!config.getToken){
      config.getToken = () => {
        try{
          return localStorage.getItem('gh_pat');
        }catch{
          return null;
        }
      };
    }
    remoteClient.configure(config);
    const localSnapshot = cloneDataSnapshot();
    let remoteSnapshot = await remoteClient.load();
    if(datasetHasLocalExtras(localSnapshot, remoteSnapshot)){
      try{
        remoteSnapshot = await remoteClient.merge(localSnapshot, 'Merge cached updates');
      }catch(err){
        console.warn('Remote merge failed, continuing with remote data', err);
      }
    }
    remoteEnabled = true;
    replaceDataFromSnapshot(remoteSnapshot, {persistLocal:true});
  }catch(err){
    console.error('Remote sync initialization failed:', err);
  }
}

addManualBtn?.addEventListener('click', openManualModal);
closeManualBtn?.addEventListener('click', closeManualModal);
cancelManualBtn?.addEventListener('click', closeManualModal);
saveManualBtn?.addEventListener('click', saveManualEntry);
manualTypeButtons.forEach(btn => btn.addEventListener('click', ()=> setManualType(btn.dataset.type)));
manualSource?.addEventListener('change', updateManualSourceFields);
manualMedSelect?.addEventListener('change', updateManualMedFields);
if(manualModal){
  setManualType('feed');
  updateManualSourceFields();
  updateManualMedFields();
}

if(remoteClient && remoteConfig){
  initRemoteSync();
}
