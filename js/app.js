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

function formatNumber(value, minimumFractionDigits=0, maximumFractionDigits){
  const safe = Number.isFinite(value) ? value : 0;
  const maxDigits = typeof maximumFractionDigits === 'number' ? maximumFractionDigits : minimumFractionDigits;
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits,
    maximumFractionDigits: maxDigits
  }).format(safe);
}

const DAY_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
// ===== Hero background =====
const HERO_KEY = 'heroImage';
const HERO_FALLBACKS = [
  'img/baby.jpg',
  'img/baby1.jpg'
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
const countPillEl = $('#count-pill');
const historyRangeBtn = $('#history-range-btn');
const historyRangeLabel = $('#history-range-label');
const historyRangeMenu = $('#history-range-menu');
const historyRangeDateInput = $('#history-range-date');
const historyRangeOptions = $$('#history-range-menu .range-option[data-range]');
const statsBtn = $('#btn-stats');
const statsModal = $('#modal-stats');
const closeStatsBtn = $('#close-stats');
const statsCanvas = $('#stats-chart');
const statsSummaryEl = $('#stats-summary');
const statsDailyList = $('#stats-day-list');
const statsBreakdownLabel = $('#stats-breakdown-label');
const saveIndicatorEl = $('#save-indicator');
const saveLabelEl = $('#save-label');
const exportReportsBtn = $('#export-pdf');
const btnElim = $('#btn-elim');
const footerAddManualBtn = $('#footer-add-manual');
const summaryElimEl = $('#summary-elim');
const dashboardElimEl = $('#dashboard-elim');
const bgPicker = $('#bg-picker');
const avatarBtn = $('#avatar-btn');
const infoBtn = $('#info-btn');
const infoChevron = $('#info-chevron');
const leoSummaryInfoEl = $('#leo-summary-info');
const addManualBtn = $('#add-manual');
const summaryFeedEl = $('#summary-feed');
const manualModal = $('#modal-manual');
const manualTitle = manualModal ? manualModal.querySelector('h2') : null;
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
const cancelSelectBtn = $('#cancel-select-btn');
const deleteSelectedBtn = $('#delete-selected-btn');
const selectionActions = $('#selection-actions');
const startTimeDisplay = $('#start-time-display');
const manualMedFields = $('#manual-med-fields');
const manualMedSelect = $('#manual-med-select');
const manualMedOtherField = $('#manual-med-other-field');
const manualMedOtherInput = $('#manual-med-other');
const manualMedDose = $('#manual-med-dose');
const manualMedNotes = $('#manual-med-notes');
const manualMesuresFields = $('#manual-mesures-fields');
const manualMesureTemp = $('#manual-mesure-temp');
const manualMesurePoids = $('#manual-mesure-poids');
const manualMesureTaille = $('#manual-mesure-taille');

const SAVE_MESSAGES = {
  idle: 'Prêt',
  saving: 'Synchronisation…',
  offline: 'Enregistré localement',
  error: 'Erreur de synchronisation',
  synced: 'Sauvegardé dans le cloud'
};

let saveIndicatorResetTimer = null;
const summaryMedEl = $('#summary-med');

// ===== State =====
const state = {
  feeds: [], // {id,dateISO,source,breastSide,durationSec,amountMl}
  elims: [], // {id,dateISO,pee,poop,vomit}
  meds: [], // {id,dateISO,name}
  measurements: [] // {id,dateISO,temp,weight,height}
};

function updateState(updater) {
  // The updater function receives the current state and returns the new state.
  const newState = updater(state);
  state.feeds = newState.feeds ?? [];
  state.elims = newState.elims ?? [];
  state.meds = newState.meds ?? [];
  state.measurements = newState.measurements ?? [];
  
  // La persistencia es manejada por el módulo de persistencia.
  // No se usa store.set() aquí. Las llamadas a persistenceApi se hacen
  // en las funciones que guardan/eliminan datos.
}

const HISTORY_RANGE_KEY = 'historyRange';

// Variable para el modo de edición, se gestionará a través de las funciones del modal
let editingEntry = null;


let historyRange = normalizeHistoryRange(store.get(HISTORY_RANGE_KEY, {mode:'day'}));
let statsChart = null;
const TIMER_KEY = 'timerState';
let manualType = 'feed';
let timer = 0;
let timerStart = null;
let timerInterval = null;
let isDeleteMode = false;

function cloneDataSnapshot(){
  return {
    feeds: state.feeds.map(f => ({...f})),
    elims: state.elims.map(e => ({...e})),
    meds: state.meds.map(m => ({...m})),
    measurements: state.measurements.map(m => ({...m}))
  };
}

function isOnline(){
  return navigator.onLine !== false;
}

function updateOfflineIndicator(){
  if(!saveIndicatorEl) return;
  const offline = !isOnline();
  saveIndicatorEl.classList.toggle('is-offline', offline);
  if(offline && saveIndicatorEl.dataset.state !== 'saving'){
    setSaveIndicator('idle', SAVE_MESSAGES.offline);
  }else if(!offline && saveIndicatorEl.dataset.state === 'idle' && saveLabelEl && saveLabelEl.textContent === SAVE_MESSAGES.offline){
    setSaveIndicator('idle', SAVE_MESSAGES.idle);
  }
}

function replaceDataFromSnapshot(snapshot, {skipRender = false} = {}){
  updateState(() => {
    const data = {
      feeds: [],
      elims: [],
      meds: [],
      measurements: []
    };
    if (snapshot && typeof snapshot === 'object') {
      data.feeds = Array.isArray(snapshot.feeds) ? snapshot.feeds.map(f => ({...f})) : [];
      data.elims = Array.isArray(snapshot.elims) ? snapshot.elims.map(e => ({...e})) : [];
      data.meds = Array.isArray(snapshot.meds) ? snapshot.meds.map(m => ({...m})) : [];
      data.measurements = Array.isArray(snapshot.measurements) ? snapshot.measurements.map(m => ({...m})) : [];
    }
    return data;
  });

  if(!skipRender){
    renderHistory();
  }
}

function parseDateInput(value){
  if(value instanceof Date){
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  if(typeof value === 'string'){
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if(match){
      const year = Number(match[1]);
      const month = Number(match[2]) - 1;
      const day = Number(match[3]);
      const candidate = new Date(year, month, day);
      if(candidate.getFullYear() === year && candidate.getMonth() === month && candidate.getDate() === day){
        return candidate;
      }
    }
  }
  const fallback = new Date(value);
  if(Number.isNaN(fallback.getTime())){
    return null;
  }
  return new Date(fallback.getFullYear(), fallback.getMonth(), fallback.getDate());
}

function toDateInputValue(date){
  const parsed = parseDateInput(date);
  if(!parsed) return '';
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, '0');
  const d = String(parsed.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function normalizeHistoryRange(raw){
  const fallback = {mode:'day'};
  if(!raw || typeof raw !== 'object'){
    return {...fallback};
  }
  const validModes = ['day','week','month','custom'];
  const mode = validModes.includes(raw.mode) ? raw.mode : fallback.mode;
  const result = {mode};
  if(mode === 'custom'){
    const parsed = parseDateInput(raw.date);
    if(parsed){
      result.date = toDateInputValue(parsed);
    }else{
      result.mode = 'day';
    }
  }
  return result;
}

function getHistoryRangeBounds(range = historyRange){
  const today = parseDateInput(new Date());
  today.setHours(0, 0, 0, 0);
  const todayStart = today.getTime();
  const todayEnd = todayStart + DAY_MS - 1;

  if(range.mode === 'custom' && range.date){
    const custom = parseDateInput(range.date);
    if(custom){
      custom.setHours(0, 0, 0, 0);
      const start = custom.getTime();
      return {start, end: start + DAY_MS - 1};
    }
  }

  let start = todayStart;
  if(range.mode === 'week'){
    start = todayStart - (6 * DAY_MS);
  }else if(range.mode === 'month'){
    start = todayStart - (29 * DAY_MS);
  }

  return {start, end: todayEnd};
}

function formatHistoryRangeLabel(range = historyRange){
  switch(range.mode){
    case 'week':
      return '7 derniers jours';
    case 'month':
      return '30 derniers jours';
    case 'custom': {
      if(range.date){
        const parsed = parseDateInput(range.date);
        if(parsed){
          return parsed.toLocaleDateString('fr-FR', {weekday:'short', day:'numeric', month:'short'});
        }
      }
      return 'Date personnalisée';
    }
    case 'day':
    default:
      return "Aujourd'hui";
  }
}

function syncHistoryRangeUI(){
  if(historyRangeLabel){
    historyRangeLabel.textContent = formatHistoryRangeLabel(historyRange);
  }
  historyRangeOptions.forEach(option => {
    const isActive = option.dataset.range === historyRange.mode;
    option.classList.toggle('active', isActive);
    option.setAttribute('aria-checked', isActive ? 'true' : 'false');
  });
  if(historyRangeDateInput){
    historyRangeDateInput.disabled = historyRange.mode !== 'custom';
    const value = historyRange.mode === 'custom' && historyRange.date ? historyRange.date : '';
    historyRangeDateInput.value = value;
  }
}

function setHistoryRange(mode, extra = {}){
  const next = normalizeHistoryRange({...historyRange, ...extra, mode});
  historyRange = next;
  store.set(HISTORY_RANGE_KEY, historyRange);
  syncHistoryRangeUI();
  renderHistory();
}

function closeHistoryRangeMenu(){
  if(!historyRangeMenu) return;
  if(!historyRangeMenu.classList.contains('is-open')) return;
  historyRangeMenu.classList.remove('is-open');
  historyRangeBtn?.setAttribute('aria-expanded','false');
  if(historyMenuOutsideHandler){
    document.removeEventListener('pointerdown', historyMenuOutsideHandler);
    historyMenuOutsideHandler = null;
  }
  if(historyMenuKeydownHandler){
    document.removeEventListener('keydown', historyMenuKeydownHandler);
    historyMenuKeydownHandler = null;
  }
}

function openHistoryRangeMenu(){
  if(!historyRangeMenu) return;
  if(historyRangeMenu.classList.contains('is-open')) return;
  historyRangeMenu.classList.add('is-open');
  historyRangeBtn?.setAttribute('aria-expanded','true');
  historyMenuOutsideHandler = (event) => {
    if(historyRangeMenu.contains(event.target) || historyRangeBtn?.contains(event.target)){
      return;
    }
    closeHistoryRangeMenu();
  };
  historyMenuKeydownHandler = (event) => {
    if(event.key === 'Escape'){
      closeHistoryRangeMenu();
      historyRangeBtn?.focus();
    }
  };
  document.addEventListener('pointerdown', historyMenuOutsideHandler);
  document.addEventListener('keydown', historyMenuKeydownHandler);
}

function toggleHistoryRangeMenu(force){
  if(!historyRangeMenu) return;
  const shouldOpen = typeof force === 'boolean'
    ? force
    : !historyRangeMenu.classList.contains('is-open');
  if(shouldOpen){
    openHistoryRangeMenu();
  }else{
    closeHistoryRangeMenu();
  }
}

function handleHistoryRangeMenuSelection(target){
  const option = target?.closest?.('.range-option[data-range]');
  if(!option || !historyRangeMenu?.contains(option)) return;
  const mode = option.dataset.range;
  if(!mode) return;
  if(mode === 'custom'){
    const fallbackValue = historyRangeDateInput?.value || historyRange.date || toDateInputValue(new Date());
    if(historyRangeDateInput){
      historyRangeDateInput.disabled = false;
      if(!historyRangeDateInput.value){
        historyRangeDateInput.value = fallbackValue;
      }
    }
    setHistoryRange('custom', {date: fallbackValue});
    historyRangeDateInput?.focus();
    return;
  }
  setHistoryRange(mode);
  closeHistoryRangeMenu();
  historyRangeBtn?.focus();
}

// ===== History render =====
function getHistoryEntriesForRange(range = historyRange){
  const bounds = getHistoryRangeBounds(range);
  return [
    ...state.feeds.map(f => ({type:'feed', item:f})),
    ...state.elims.map(e => ({type:'elim', item:e})),
    ...state.meds.map(m => ({type:'med', item:m})),
    ...state.measurements.map(m => ({type:'measurement', item:m}))
  ]
    .filter(entry => {
      const timestamp = new Date(entry.item.dateISO).getTime();
      if(Number.isNaN(timestamp)) return false;
      if(bounds.start != null && timestamp < bounds.start) return false;
      if(bounds.end != null && timestamp > bounds.end) return false;
      return true;
    })
    .sort((a,b)=> a.item.dateISO < b.item.dateISO ? 1 : -1);
}

function getFeedStats(range = historyRange){
  const bounds = getHistoryRangeBounds(range);
  const base = {
    label: formatHistoryRangeLabel(range),
    perDay: [],
    totals: {
      feedCount: 0,
      breastMinutes: 0,
      bottleMl: 0,
      breastSessions: 0,
      bottleSessions: 0
    },
    dayCount: 0
  };
  if(!bounds || bounds.start == null || bounds.end == null){
    return base;
  }

  const buckets = new Map();
  for(let ts = bounds.start; ts <= bounds.end; ts += DAY_MS){
    const day = new Date(ts);
    day.setHours(0, 0, 0, 0);
    const key = toDateInputValue(day);
    const entry = {
      dateISO: key,
      feedCount: 0,
      breastMinutes: 0,
      bottleMl: 0,
      breastSessions: 0,
      bottleSessions: 0
    };
    base.perDay.push(entry);
    buckets.set(key, entry);
  }

  const feedEntries = getHistoryEntriesForRange(range).filter(entry => entry.type === 'feed');
  for(const entry of feedEntries){
    const parsed = parseDateInput(entry.item.dateISO);
    if(!parsed) continue;
    const key = toDateInputValue(parsed);
    const bucket = buckets.get(key);
    if(!bucket) continue;

    bucket.feedCount += 1;
    base.totals.feedCount += 1;

    if(entry.item.source === 'breast'){
      const minutes = (entry.item.durationSec || 0) / 60;
      bucket.breastMinutes += minutes;
      bucket.breastSessions += 1;
      base.totals.breastMinutes += minutes;
      base.totals.breastSessions += 1;
    }else if(entry.item.source === 'bottle'){
      const ml = Number(entry.item.amountMl || 0);
      if(Number.isFinite(ml)){
        bucket.bottleMl += ml;
        bucket.bottleSessions += 1;
        base.totals.bottleMl += ml;
        base.totals.bottleSessions += 1;
      }
    }
  }

  base.perDay.forEach(day => {
    day.breastMinutes = Number(day.breastMinutes.toFixed(1));
    day.bottleMl = Number(day.bottleMl.toFixed(0));
  });
  base.totals.breastMinutes = Number(base.totals.breastMinutes.toFixed(1));
  base.totals.bottleMl = Number(base.totals.bottleMl.toFixed(0));
  base.dayCount = base.perDay.length;
  return base;
}

function formatStatsDayLabel(dateISO, options = {weekday:'short', day:'numeric'}){
  const parsed = parseDateInput(dateISO);
  if(!parsed) return dateISO || '';
  const label = parsed.toLocaleDateString('fr-FR', options);
  if(!label) return '';
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function getStatsChartData(range = historyRange){
  const stats = getFeedStats(range);
  const labels = stats.perDay.map(day => formatStatsDayLabel(day.dateISO, {weekday:'short', day:'numeric'}));
  const breastMinutes = stats.perDay.map(day => day.breastMinutes);
  const bottleMl = stats.perDay.map(day => day.bottleMl);
  return {
    labels,
    breastMinutes,
    bottleMl,
    rangeLabel: stats.label,
    stats
  };
}

function updateStatsSummary(stats = null){
  if(!statsSummaryEl) return;
  const data = stats || getFeedStats();
  const totals = data?.totals || {feedCount:0, breastMinutes:0, bottleMl:0, breastSessions:0, bottleSessions:0};
  const perDay = Array.isArray(data?.perDay) ? data.perDay : [];
  const dayCountRaw = data?.dayCount ?? perDay.length ?? 0;
  const dayCount = Math.max(dayCountRaw, 1);
  const hasData = totals.feedCount > 0 || totals.breastMinutes > 0 || totals.bottleMl > 0;
  if(!hasData){
    statsSummaryEl.innerHTML = '<div class="stat-placeholder">Aucune donnee pour cette periode.</div>';
    if(statsBreakdownLabel) statsBreakdownLabel.textContent = data?.label || '';
    renderStatsDailyList(data);
    return;
  }

  const dayLabel = dayCount === 1 ? '1 jour' : `${dayCount} jours`;
  const avgFeeds = totals.feedCount / dayCount;
  const avgBreastMinutes = totals.breastMinutes / dayCount;
  const avgBottleMl = totals.bottleMl / dayCount;

  const busiestDay = perDay.reduce((best, day) => {
    if(!day) return best;
    if(!best) return day;
    const dayFeeds = day.feedCount || 0;
    const bestFeeds = best.feedCount || 0;
    if(dayFeeds > bestFeeds) return day;
    if(dayFeeds === bestFeeds){
      const dayVolume = (day.breastMinutes || 0) + (day.bottleMl || 0) / 60;
      const bestVolume = (best.breastMinutes || 0) + (best.bottleMl || 0) / 60;
      return dayVolume > bestVolume ? day : best;
    }
    return best;
  }, null);

  const insightItems = [];
  if(busiestDay && (busiestDay.feedCount > 0 || busiestDay.breastMinutes > 0 || busiestDay.bottleMl > 0)){
    const busyLabel = formatStatsDayLabel(busiestDay.dateISO, {weekday:'long', day:'numeric', month:'short'});
    const sessionsLabel = busiestDay.feedCount === 1 ? '1 session' : `${formatNumber(busiestDay.feedCount)} sessions`;
    const detailParts = [];
    if(busiestDay.breastMinutes > 0){
      detailParts.push(`${formatNumber(busiestDay.breastMinutes, 1, 1)} min sein`);
    }
    if(busiestDay.bottleMl > 0){
      detailParts.push(`${formatNumber(busiestDay.bottleMl)} ml biberon`);
    }
    const sub = detailParts.length ? `${sessionsLabel} | ${detailParts.join(' | ')}` : sessionsLabel;
    insightItems.push({
      label: 'Jour le plus actif',
      value: busyLabel,
      sub
    });
  }

  const totalSessions = (totals.breastSessions || 0) + (totals.bottleSessions || 0);
  if(totalSessions > 0){
    const ratioBreast = Math.round((totals.breastSessions / totalSessions) * 100);
    const ratioBottle = Math.max(0, 100 - ratioBreast);
    insightItems.push({
      label: 'Répartition sessions',
      value: `${ratioBreast}% sein | ${ratioBottle}% biberon`,
      sub: `${formatNumber(totals.breastSessions)} sein | ${formatNumber(totals.bottleSessions)} biberon`
    });
  }

  if(totals.feedCount > 0){
    const sessionDetails = [];
    if(totals.breastSessions > 0){
      const avgPerSessionBreast = totals.breastMinutes / totals.breastSessions;
      sessionDetails.push(`${formatNumber(avgPerSessionBreast, 1, 1)} min sein`);
    }
    if(totals.bottleSessions > 0){
      const avgPerSessionBottle = totals.bottleMl / totals.bottleSessions;
      sessionDetails.push(`${formatNumber(avgPerSessionBottle)} ml biberon`);
    }
    if(sessionDetails.length){
      insightItems.push({
        label: 'Moyenne par session',
        value: sessionDetails.join(' | '),
        sub: `${formatNumber(avgFeeds, 1, 1)} sessions / jour`
      });
    }
  }

  const insightsHtml = insightItems.length
    ? `<div class="stat-insights">${insightItems.map(item => `
        <div class="stat-insight">
          <span class="stat-insight-label">${escapeHtml(item.label)}</span>
          <span class="stat-insight-value">${escapeHtml(item.value)}</span>
          ${item.sub ? `<span class="stat-insight-sub">${escapeHtml(item.sub)}</span>` : ''}
        </div>
      `).join('')}</div>`
    : '';

  statsSummaryEl.innerHTML = `
    <div class="stat-period">
      <strong>${escapeHtml(data.label)}</strong>
      <span>${escapeHtml(dayLabel)}</span>
    </div>
    <article class="stat-card">
      <span class="stat-title">Sessions</span>
      <span class="stat-value">${formatNumber(totals.feedCount)}</span>
      <span class="stat-sub">${formatNumber(avgFeeds, 1, 1)} / jour | Sein ${formatNumber(totals.breastSessions)} | Biberon ${formatNumber(totals.bottleSessions)}</span>
    </article>
    <article class="stat-card">
      <span class="stat-title">Sein</span>
      <span class="stat-value">${formatNumber(totals.breastMinutes, 1, 1)} min</span>
      <span class="stat-sub">${formatNumber(avgBreastMinutes, 1, 1)} min / jour</span>
    </article>
    <article class="stat-card">
      <span class="stat-title">Biberon</span>
      <span class="stat-value">${formatNumber(totals.bottleMl)} ml</span>
      <span class="stat-sub">${formatNumber(avgBottleMl)} ml / jour</span>
    </article>
    ${insightsHtml}
  `;
  if(statsBreakdownLabel) statsBreakdownLabel.textContent = data?.label || '';
  renderStatsDailyList(data);
}

function renderStatsDailyList(stats = null){
  if(!statsDailyList) return;
  const data = stats || getFeedStats();
  const perDay = Array.isArray(data?.perDay) ? data.perDay : [];
  if(!perDay.length){
    statsDailyList.innerHTML = '<div class="stat-placeholder">Aucune activite pour cette periode.</div>';
    return;
  }

  const hasActivity = perDay.some(day => (day?.feedCount || 0) > 0 || (day?.breastMinutes || 0) > 0 || (day?.bottleMl || 0) > 0);
  if(!hasActivity){
    statsDailyList.innerHTML = '<div class="stat-placeholder">Aucune activite pour cette periode.</div>';
    return;
  }

  const maxBreast = perDay.reduce((max, day) => Math.max(max, day?.breastMinutes || 0), 0);
  const maxBottle = perDay.reduce((max, day) => Math.max(max, day?.bottleMl || 0), 0);

  statsDailyList.innerHTML = perDay.map(day => {
    const dateISO = day?.dateISO || '';
    const labelShort = formatStatsDayLabel(dateISO, {weekday:'short', day:'numeric'});
    const labelFull = formatStatsDayLabel(dateISO, {weekday:'long', day:'numeric', month:'short'});
    const feedCount = day?.feedCount || 0;
    const breastMinutes = day?.breastMinutes || 0;
    const bottleMl = day?.bottleMl || 0;
    const breastPercent = maxBreast > 0 ? Math.round((breastMinutes / maxBreast) * 100) : 0;
    const bottlePercent = maxBottle > 0 ? Math.round((bottleMl / maxBottle) * 100) : 0;
    const breastValue = `${formatNumber(breastMinutes, 1, 1)} min`;
    const bottleValue = `${formatNumber(bottleMl)} ml`;
    const dayHasActivity = feedCount > 0 || breastMinutes > 0 || bottleMl > 0;
    const countText = dayHasActivity
      ? (feedCount === 1 ? '1 session' : `${formatNumber(feedCount)} sessions`)
      : 'Aucune session';

    const safeBreastPercent = Math.min(100, Math.max(0, breastPercent));
    const safeBottlePercent = Math.min(100, Math.max(0, bottlePercent));

    return `
      <article class="stats-day" data-day="${escapeHtml(dateISO)}">
        <div class="stats-day-head">
          <span class="stats-day-date" title="${escapeHtml(labelFull)}">${escapeHtml(labelShort)}</span>
          <span class="stats-day-count">${escapeHtml(countText)}</span>
        </div>
        <div class="stats-day-metric">
          <span class="metric-label"><span class="metric-dot breast"></span> Sein</span>
          <div class="metric-bar" title="Sein ${escapeHtml(breastValue)}">
            <div class="stats-bar breast" style="--percent:${safeBreastPercent}%"></div>
          </div>
          <span class="metric-value">${escapeHtml(breastValue)}</span>
        </div>
        <div class="stats-day-metric">
          <span class="metric-label"><span class="metric-dot bottle"></span> Biberon</span>
          <div class="metric-bar" title="Biberon ${escapeHtml(bottleValue)}">
            <div class="stats-bar bottle" style="--percent:${safeBottlePercent}%"></div>
          </div>
          <span class="metric-value">${escapeHtml(bottleValue)}</span>
        </div>
      </article>
    `;
  }).join('');
}

function updateStatsChart(force = false){
  const summary = getStatsChartData();
  updateStatsSummary(summary.stats);

  if(!statsCanvas || typeof Chart === 'undefined') return;
  if(!statsChart && !force) return;
  const ctx = statsCanvas.getContext('2d');
  if(!ctx) return;

  if(!statsChart){
    statsChart = new Chart(ctx, {
      data: {
        labels: summary.labels,
        datasets: [
          {
            type: 'bar',
            label: 'Sein (minutes)',
            data: summary.breastMinutes,
            backgroundColor: 'rgba(37, 99, 235, 0.55)',
            borderColor: 'rgba(37, 99, 235, 0.85)',
            borderWidth: 1,
            borderRadius: 12,
            maxBarThickness: 48,
            yAxisID: 'y',
            order: 2
          },
          {
            type: 'line',
            label: 'Biberon (ml)',
            data: summary.bottleMl,
            borderColor: 'rgba(249, 115, 22, 0.9)',
            backgroundColor: 'rgba(249, 115, 22, 0.2)',
            borderWidth: 3,
            tension: 0.35,
            pointRadius: 4,
            pointHoverRadius: 6,
            fill: false,
            yAxisID: 'y1',
            order: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {mode:'index', intersect:false},
        scales: {
          y: {
            type: 'linear',
            position: 'left',
            beginAtZero: true,
            title: {display:true, text:'Minutes sein'},
            ticks: {precision:0},
            grid: {color:'rgba(148, 163, 184, 0.25)'}
          },
          y1: {
            type: 'linear',
            position: 'right',
            beginAtZero: true,
            title: {display:true, text:'Millilitres biberon'},
            ticks: {precision:0},
            grid: {drawOnChartArea:false}
          },
          x: {
            grid: {display:false},
            ticks: {
              color: '#1f2937',
              font: {weight:'600'}
            }
          }
        },
        plugins: {
          legend: {
            display: true,
            labels: {usePointStyle:true}
          },
          tooltip: {
            callbacks: {
              label(context){
                const value = context.parsed.y ?? 0;
                if(context.dataset?.yAxisID === 'y1'){
                  return `${formatNumber(value)} ml`;
                }
                return `${formatNumber(value, 1, 1)} min`;
              }
            }
          },
          title: {
            display: true,
            text: `Periode : ${summary.rangeLabel}`,
            color: '#0f172a',
            font: {
              size: 14,
              weight: '600'
            },
            padding: {
              top: 6,
              bottom: 12
            }
          }
        }
      }
    });
  }else{
    statsChart.data.labels = summary.labels;
    if(statsChart.data.datasets[0]){
      statsChart.data.datasets[0].data = summary.breastMinutes;
    }
    if(statsChart.data.datasets[1]){
      statsChart.data.datasets[1].data = summary.bottleMl;
    }
    if(statsChart.options?.plugins?.title){
      statsChart.options.plugins.title.text = `Periode : ${summary.rangeLabel}`;
    }
    statsChart.update();
  }
}
function renderHistory(){
  if(!historyList) return;
  const itemTemplate = $('#history-item-template');
  const all = getHistoryEntriesForRange();

  historyList.innerHTML = '';
  if(!all.length){
    const empty = document.createElement('div');
    empty.className = 'history-empty';
    empty.textContent = "Aucun enregistrement pour le moment. Ajoutez un premier suivi !";
    historyList.appendChild(empty);
  }else{
    const fragment = document.createDocumentFragment();
    const newItems = [];
    const groupedByDay = all.reduce((acc, entry) => {
      const date = new Date(entry.item.dateISO);
      const dayKey = toDateInputValue(date); // YYYY-MM-DD
      if (!acc[dayKey]) {
        acc[dayKey] = [];
      }
      acc[dayKey].push(entry);
      return acc;
    }, {});

    for (const dayKey in groupedByDay) {
      const dayHeader = document.createElement('div');
      dayHeader.className = 'history-day-header';
      const date = parseDateInput(dayKey);
      const isToday = toDateInputValue(new Date()) === dayKey;
      dayHeader.textContent = isToday ? "Aujourd'hui" : date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
      fragment.appendChild(dayHeader);

      const entriesForDay = groupedByDay[dayKey];
      for (const row of entriesForDay) {
        const clone = itemTemplate.content.cloneNode(true);
        const div = clone.querySelector('.history-item');
        const dateString = new Date(row.item.dateISO).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        let title = '';

        if(row.type === 'feed'){
          if(row.item.source === 'breast'){
            const mins = Math.round((row.item.durationSec || 0) / 60);
            title = `🍼 Sein (${row.item.breastSide || ''}) · ${mins} min`;
          }else{
            const ml = Number(row.item.amountMl || 0);
            title = `🍼 Biberon · ${ml} ml`;
          }
        }else if(row.type === 'elim'){
          title = `🚼 Eliminations · P:${row.item.pee} · C:${row.item.poop} · V:${row.item.vomit}`;
        }else if(row.type === 'med'){
          const doseSuffix = row.item.dose ? ` · ${row.item.dose}` : '';
          title = `💊 ${row.item.name}${doseSuffix}`;
        }else if(row.type === 'measurement'){
          const parts = ['📏 Mesures'];
          if(row.item.temp) parts.push(`Temp ${row.item.temp}°C`);
          if(row.item.weight) parts.push(`Poids ${row.item.weight}kg`);
          if(row.item.height) parts.push(`Taille ${row.item.height}cm`);
          title = parts.join(' · ');
        }

        const metaHtml = [`<span class="item-meta-time">${escapeHtml(dateString)}</span>`];
        if(row.type === 'med' && row.item.medKey){
          const medLabel = row.item.medKey === 'other' ? 'AUTRE' : String(row.item.medKey).toUpperCase();
          metaHtml.push(`<span class="item-meta-tag">${escapeHtml(medLabel)}</span>`);
        }
        if(row.item.notes){
          metaHtml.push(`<span class="item-note">${escapeHtml(row.item.notes)}</span>`);
        }

        div.querySelector('.item-title').textContent = title;
        div.querySelector('.item-meta').innerHTML = metaHtml.join('');

        const checkbox = div.querySelector('.history-item-checkbox');
        checkbox.dataset.id = row.item.id;
        checkbox.dataset.type = row.type;

        div.querySelector('.item-edit').dataset.id = row.item.id;
        div.querySelector('.item-edit').dataset.type = row.type;
        div.querySelector('.item-delete').dataset.id = row.item.id;
        div.querySelector('.item-delete').dataset.type = row.type;

        fragment.appendChild(div);
        newItems.push(div);
      }
    }
    historyList.appendChild(fragment);
    requestAnimationFrame(() => {
      newItems.forEach(item => item.classList.remove('enter'));
    });
  }
  if(countPillEl){
    countPillEl.textContent = String(all.length);
  }
  updateSummaries();
  renderFeedHistory();
  updateStatsChart();
}
syncHistoryRangeUI();
renderHistory();

historyRangeBtn?.addEventListener('click', (event) => {
  event.preventDefault();
  toggleHistoryRangeMenu();
});

historyRangeMenu?.addEventListener('click', (event) => {
  handleHistoryRangeMenuSelection(event.target);
});

historyRangeDateInput?.addEventListener('change', () => {
  const value = historyRangeDateInput.value;
  if(!value){
    return;
  }
  setHistoryRange('custom', { date: value });
  closeHistoryRangeMenu();
  historyRangeBtn?.focus();
});

statsBtn?.addEventListener('click', () => {
  openModal('#modal-stats');
  updateStatsSummary();
  requestAnimationFrame(() => updateStatsChart(true));
});

closeStatsBtn?.addEventListener('click', () => {
  closeModal('#modal-stats');
});

let longPressTimer = null;
let longPressTarget = null;
const LONG_PRESS_DURATION = 500;

historyList?.addEventListener('pointerdown', (e) => {
  if (isDeleteMode) return;
  const item = e.target.closest('.history-item');
  if (!item) return;

  longPressTarget = item;
  longPressTimer = setTimeout(() => {
    if (longPressTarget) {
      toggleDeleteMode(true);
      const checkbox = longPressTarget.querySelector('.history-item-checkbox');
      if (checkbox) {
        checkbox.checked = true;
        longPressTarget.classList.add('is-selected');
        updateSelectionCount();
      }
    }
    longPressTimer = null;
  }, LONG_PRESS_DURATION);
});

function cancelLongPress() {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
  longPressTarget = null;
}

historyList?.addEventListener('pointerup', cancelLongPress);
historyList?.addEventListener('pointerleave', cancelLongPress);
historyList?.addEventListener('contextmenu', (e) => e.preventDefault()); // Evita el menú contextual

historyList?.addEventListener('click', (e) => {
  if (longPressTimer) {
    cancelLongPress();
  }
  
  if (isDeleteMode) {
    const item = e.target.closest('.history-item');
    const checkbox = item?.querySelector('.history-item-checkbox');
    if (item && checkbox && e.target !== checkbox) {
      checkbox.checked = !checkbox.checked;
      item.classList.toggle('is-selected', checkbox.checked);
      updateSelectionCount();
    } else if (e.target.classList.contains('history-item-checkbox')) {
      e.target.closest('.item')?.classList.toggle('is-selected', e.target.checked);
      updateSelectionCount();
    }
    return;
  }
  
  const editBtn = e.target.closest('.item-edit');
  if (editBtn) {
    const { type, id } = editBtn.dataset;
    if (type && id) {
      beginEditEntry(type, id);
    }
    return;
  }

  const deleteBtn = e.target.closest('.item-delete');
  if (deleteBtn) {
    const { type, id } = deleteBtn.dataset;
    confirmAndDelete([{ type, id }]);
  }
});

function confirmAndDelete(itemsToDelete) {
  if (!itemsToDelete || itemsToDelete.length === 0) return;

  const modal = $('#modal-confirm-delete');
  const messageEl = $('#confirm-delete-message');
  const pinInput = $('#security-pin');
  const confirmBtn = $('#confirm-delete-btn');
  const cancelBtn = $('#cancel-confirm-delete');
  const closeBtn = $('#close-confirm-delete');

  messageEl.textContent = `Voulez-vous vraiment supprimer ${itemsToDelete.length} élément(s) ?`;
  pinInput.value = '';

  const closeConfirmModal = () => closeModal('#modal-confirm-delete');

  const onConfirm = () => {
    if (pinInput.value !== '2410') {
      alert('Code de sécurité incorrect.');
      pinInput.value = '';
      pinInput.focus();
      return;
    }

    let changed = false;
    const idsByType = itemsToDelete.reduce((acc, item) => {
      if (!acc[item.type]) acc[item.type] = new Set();
      acc[item.type].add(String(item.id));
      return acc;
    }, {});

    updateState(currentData => {
      for (const type in idsByType) {
        const ids = idsByType[type];
        if (currentData[type + 's']) {
          const initialCount = currentData[type + 's'].length;
          currentData[type + 's'] = currentData[type + 's'].filter(item => !ids.has(String(item.id)));
          if (currentData[type + 's'].length < initialCount) changed = true;
        }
      }
      return currentData;
    });

    if (changed) {
      for (const type in idsByType) {
        const idsToDelete = Array.from(idsByType[type]);
        const api = getPersistenceApi();
        api?.deleteEntries?.(type, idsToDelete, `Delete ${idsToDelete.length} ${type}(s)`);
      }
    }
    toggleDeleteMode(false);
    closeConfirmModal();
  }

  confirmBtn.onclick = onConfirm;
  cancelBtn.onclick = closeConfirmModal;
  closeBtn.onclick = closeConfirmModal;

  openModal('#modal-confirm-delete');
  pinInput.focus();
}

function getPersistenceApi() {
  if (!persistenceApi) {
    console.warn("Persistence API not initialized yet. Action delayed or ignored.");
    setSaveIndicator('error', 'API no lista. Intente de nuevo.');
    return null;
  }
  return persistenceApi;
}

function setSaveIndicator(status = 'idle', message){
  if(!saveIndicatorEl || !saveLabelEl) return;
  if(saveIndicatorResetTimer){
    clearTimeout(saveIndicatorResetTimer);
    saveIndicatorResetTimer = null;
  }
  saveIndicatorEl.dataset.state = status || 'idle';
  saveLabelEl.textContent = message || SAVE_MESSAGES[status] || SAVE_MESSAGES.idle;
  if(status === 'synced'){
    saveIndicatorResetTimer = setTimeout(() => {
      if(saveIndicatorEl && saveIndicatorEl.dataset.state === 'synced'){
        setSaveIndicator('idle');
      }
    }, 4000);
  }
}

function exportReports(){
  if (exportReportsBtn.classList.contains('is-loading')) return;
  exportReportsBtn.classList.add('is-loading');
  exportReportsBtn.disabled = true;
  try {
    const snapshot = cloneDataSnapshot();
    snapshot.exportedAt = new Date().toISOString();
    const json = JSON.stringify(snapshot, null, 2);
    const blob = new Blob([json], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const now = new Date();
    const pad = (val) => String(val).padStart(2, '0');
    const filename = `leo-reports-${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.json`;
    const a = Object.assign(document.createElement('a'), { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setSaveIndicator('synced', 'Exportation réussie');
  } catch(err) {
    console.error('Export failed:', err);
    setSaveIndicator('error', "L'exportation a échoué");
  } finally {
    setTimeout(() => {
      exportReportsBtn.classList.remove('is-loading');
      exportReportsBtn.disabled = false;
    }, 1000);
  }
}

function updateMedSummary(){
  if(!summaryMedEl) return;
  const nowString = new Date().toLocaleString();
  if(!state.meds.length){
    summaryMedEl.innerHTML = `<strong>Derniere prise</strong><span>Aucun medicament enregistre</span><span>Nouvelle prise ${escapeHtml(nowString)}</span>`;
    return;
  }
  const latest = state.meds.reduce((acc, cur)=> acc && acc.dateISO > cur.dateISO ? acc : cur, state.meds[0]);
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

function updateLeoSummary() {
  if (!leoSummaryInfoEl) return;

  const latestWeight = state.measurements
    .filter(m => m.weight != null && m.weight > 0)
    .sort((a, b) => (a.dateISO < b.dateISO ? 1 : -1))[0];

  const latestHeight = state.measurements
    .filter(m => m.height != null && m.height > 0)
    .sort((a, b) => (a.dateISO < b.dateISO ? 1 : -1))[0];

  const parts = [];
  if (latestWeight) parts.push(`Poids: ${latestWeight.weight} kg`);
  if (latestHeight) parts.push(`Taille: ${latestHeight.height} cm`);

  if (parts.length > 0) {
    leoSummaryInfoEl.textContent = parts.join(' · ');
  } else {
    leoSummaryInfoEl.textContent = 'Touchez pour voir les informations';
  }
}

function updateSummaries(){
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

  if(summaryFeedEl){
    const todayFeeds = state.feeds.filter(f => new Date(f.dateISO).getTime() >= start);
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
    const todayElims = state.elims.filter(e => new Date(e.dateISO).getTime() >= start);
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
  updateLeoSummary();
}

function renderElimHistory(){
  const list = $('#elim-history-today');
  if(!list) return;
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const todays = state.elims
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
  const todaysFeeds = state.feeds
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
  updateState(currentData => {
    currentData.feeds.push(entry);
    return currentData;
  });
  closeModal('#modal-leche');
  const api = getPersistenceApi();
  api?.saveEntry?.('feed', entry, 'Save feed entry');
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
btnElim?.addEventListener('click', ()=>{ renderElimHistory(); openModal('#modal-elim'); });
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
  updateState(currentData => {
    currentData.elims.push({
      id: Date.now()+'',
      dateISO: new Date().toISOString(),
      pee: scales.pee,
      poop: scales.poop,
      vomit: scales.vomit
    });
    return currentData;
  });
  const api = getPersistenceApi();
  api?.saveEntry?.('elim', { id: Date.now()+'', dateISO: new Date().toISOString(), ...scales }, 'Add elimination entry');
  closeModal('#modal-elim');
  renderHistory();
});

// ===== Medications modal logic =====
function setupMedicationModal(){
  const medsBtn = $('#btn-med');
  const medSelect = $('#medication-select');
  const medOtherField = $('#medication-other-field');
  const medOtherInput = $('#medication-other');
  const closeMedBtn = $('#close-med');
  const cancelMedBtn = $('#cancel-med');
  const saveMedBtn = $('#save-med');

  if(!medsBtn && !medSelect){
    return;
  }

  const updateMedOtherField = () => {
    const isOther = medSelect?.value === 'other';
    medOtherField?.classList?.toggle('is-hidden', !isOther);
    if(!isOther && medOtherInput){
      medOtherInput.value = '';
    }
  };

  const resetMedForm = () => {
    if(medSelect) medSelect.value = 'ibufrone';
    updateMedOtherField();
    if(medOtherInput) medOtherInput.value = '';
  };

  const closeMedModal = () => closeModal('#modal-med');

  const saveMedication = () => {
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
    const entry = {
      id: Date.now()+'',
      dateISO: new Date().toISOString(),
      name,
      medKey: selection
    };
    updateState(currentData => {
      currentData.meds.push(entry);
      return currentData;
    });
    updateMedSummary();
    try {
      const api = getPersistenceApi();
      api?.saveEntry?.('med', entry, 'Add medication entry');
    } catch (error) {
      console.warn('Medication persistence failed:', error);
    }
    renderHistory();
    closeMedModal();
  };

  const openMedModal = () => {
    resetMedForm();
    updateMedSummary();
    openModal('#modal-med');
  };

  medsBtn?.addEventListener('click', openMedModal);
  closeMedBtn?.addEventListener('click', closeMedModal);
  cancelMedBtn?.addEventListener('click', closeMedModal);
  saveMedBtn?.addEventListener('click', saveMedication);
  medSelect?.addEventListener('change', updateMedOtherField);
  updateMedOtherField();
}

setupMedicationModal();

// ===== Mesures modal logic =====
const mesuresBtn = $('#btn-mesures');
const mesuresModal = $('#modal-mesures');
const closeMesuresBtn = $('#close-mesures');
const cancelMesuresBtn = $('#cancel-mesures');
const saveMesuresBtn = $('#save-mesures');
const tempInput = $('#mesure-temp');
const poidsInput = $('#mesure-poids');
const tailleInput = $('#mesure-taille');

function resetMesuresForm() {
  if (tempInput) tempInput.value = '';
  if (poidsInput) poidsInput.value = '';
  if (tailleInput) tailleInput.value = '';
}

function saveMesures() {
  const temp = tempInput.value ? parseFloat(tempInput.value) : null;
  const weight = poidsInput.value ? parseFloat(poidsInput.value) : null;
  const height = tailleInput.value ? parseFloat(tailleInput.value) : null;

  if (temp === null && weight === null && height === null) {
    alert("Veuillez entrer au moins une mesure.");
    return;
  }

  const entry = { id: Date.now() + '', dateISO: new Date().toISOString() };
  if (temp !== null) entry.temp = temp;
  if (weight !== null) entry.weight = weight;
  if (height !== null) entry.height = height;

  updateState(currentData => {
    currentData.measurements.push(entry);
    return currentData;
  });
  const api = getPersistenceApi();
  api?.saveEntry?.('measurement', entry, 'Add measurement entry');
  closeModal('#modal-mesures');
  renderHistory();
}

mesuresBtn?.addEventListener('click', () => {
  resetMesuresForm();
  openModal('#modal-mesures');
});
closeMesuresBtn?.addEventListener('click', () => closeModal('#modal-mesures'));
cancelMesuresBtn?.addEventListener('click', () => closeModal('#modal-mesures'));
saveMesuresBtn?.addEventListener('click', saveMesures);

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

function handleBackgroundChange(event) {
  const input = event.target;
  const file = input.files && input.files[0];
  if (!file) return;

  if (firebaseInitialized && firebaseStorageInstance && firebaseStorageFns) {
    const { createRef, uploadBytes, getDownloadURL } = firebaseStorageFns;
    const avatarRef = createRef(firebaseStorageInstance, "backgrounds/leo-main-avatar.jpg");

    setSaveIndicator('saving', 'Chargement de la photo...');

    uploadBytes(avatarRef, file)
      .then(() => getDownloadURL(avatarRef))
      .then(downloadURL => {
        console.log('Image uploaded to Firebase, URL:', downloadURL);
        setSaveIndicator('synced', 'Photo sauvegardée !');
        return setHeroImage(downloadURL);
      })
      .then(ok => {
        if (ok) {
          saveHeroMeta({ index: 0, lastSwitch: Date.now() });
          startHeroRotation();
        }
      })
      .catch(error => {
        console.error("Error uploading to Firebase Storage:", error);
        setSaveIndicator('error', 'Erreur de chargement');
      });
  } else {
    console.warn("Firebase Storage not available. Image will not be saved to the cloud.");
    setSaveIndicator('error', 'Stockage cloud indisponible');
  }

  input.value = ''; // Limpiar el input para poder seleccionar el mismo archivo de nuevo
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
  manualMesuresFields?.classList?.toggle('is-hidden', type !== 'measurement');
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

function getListByType(type){
  if(type === 'feed') return state.feeds;
  if(type === 'elim') return state.elims;
  if(type === 'med') return state.meds;
  if(type === 'measurement') return state.measurements;
  return null;
}

function findEntryById(type, id){
  const list = getListByType(type);
  if(!list) return null;
  return list.find(item => item && String(item.id) === String(id)) || null;
}

function replaceEntryInList(type, entry){
  const list = getListByType(type); // This is a copy from state
  if(!list) return false;
  const idx = list.findIndex(item => item && item.id === entry.id);
  if(idx !== -1){
    list[idx] = entry;
    return true;
  }
  return false;
}

function setManualMode(isEdit){
  manualTypeButtons.forEach(btn => {
    if(btn){
      btn.disabled = isEdit;
      btn.classList.toggle('is-disabled', isEdit);
    }
  });
  if(saveManualBtn){
    saveManualBtn.textContent = isEdit ? 'Mettre à jour' : 'Enregistrer';
  }
  const titleNode = manualTitle || manualModal?.querySelector('h2');
  if(titleNode){
    titleNode.textContent = isEdit ? 'Modifier un enregistrement' : 'Nouvel enregistrement';
  }
  manualModal?.classList?.toggle('is-editing', isEdit);
}

function resetManualFields(){
  if(manualSource) manualSource.value = 'breast';
  updateManualSourceFields();
  if(manualBreast) manualBreast.value = 'Gauche';
  if(manualDuration) manualDuration.value = '';
  if(manualAmount) manualAmount.value = '';
  if(manualNotes) manualNotes.value = '';
  if(manualPee) manualPee.value = 0;
  if(manualPoop) manualPoop.value = 0;
  if(manualVomit) manualVomit.value = 0;
  if(manualElimNotes) manualElimNotes.value = '';
  if(manualMedSelect) manualMedSelect.value = 'ibufrone';
  if(manualMedOtherInput) manualMedOtherInput.value = '';
  if(manualMedDose) manualMedDose.value = '';
  if(manualMedNotes) manualMedNotes.value = '';
  if(manualMesureTemp) manualMesureTemp.value = '';
  if(manualMesurePoids) manualMesurePoids.value = '';
  if(manualMesureTaille) manualMesureTaille.value = '';
  updateManualMedFields();
  if(manualDatetime) manualDatetime.value = formatDateInput(new Date());
}

function populateManualForm(type, entry){
  if(!entry) return;
  if(manualDatetime && entry.dateISO){
    manualDatetime.value = formatDateInput(new Date(entry.dateISO));
  }
  if(type === 'feed'){
    const source = entry.source === 'bottle' ? 'bottle' : 'breast';
    if(manualSource){
      manualSource.value = source;
    }
    updateManualSourceFields();
    if(source === 'breast'){
      if(manualBreast) manualBreast.value = entry.breastSide || 'Gauche';
      if(manualDuration) manualDuration.value = Math.round((entry.durationSec || 0) / 60);
      if(manualAmount) manualAmount.value = '';
    }else{
      if(manualAmount) manualAmount.value = entry.amountMl != null ? entry.amountMl : '';
      if(manualDuration) manualDuration.value = '';
    }
    if(manualNotes) manualNotes.value = entry.notes || '';
  }else if(type === 'elim'){
    if(manualPee) manualPee.value = clamp(Number(entry.pee ?? 0), 0, 3);
    if(manualPoop) manualPoop.value = clamp(Number(entry.poop ?? 0), 0, 3);
    if(manualVomit) manualVomit.value = clamp(Number(entry.vomit ?? 0), 0, 3);
    if(manualElimNotes) manualElimNotes.value = entry.notes || '';
  }else if(type === 'med'){
    let selection = entry.medKey || 'other';
    const allowed = new Set(['ibufrone','dalfalgan','other']);
    if(!allowed.has(selection)){
      selection = 'other';
    }
    if(manualMedSelect){
      manualMedSelect.value = selection;
    }
    updateManualMedFields();
    if(selection === 'other'){
      if(manualMedOtherInput) manualMedOtherInput.value = entry.name || '';
    }else if(manualMedOtherInput){
      manualMedOtherInput.value = '';
    }
    if(selection !== 'other' && !entry.name){
      const labels = {ibufrone:'Ibufrone', dalfalgan:'Dalfalgan'};
      entry.name = labels[selection];
    }
    if(manualMedDose) manualMedDose.value = entry.dose || '';
    if(manualMedNotes) manualMedNotes.value = entry.notes || '';
  }else if(type === 'measurement'){
    if(manualMesureTemp) manualMesureTemp.value = entry.temp ?? '';
    if(manualMesurePoids) manualMesurePoids.value = entry.weight ?? '';
    if(manualMesureTaille) manualMesureTaille.value = entry.height ?? '';
  }
}

function openManualModal({mode='create', type='feed', entry=null} = {}){
  const isEdit = mode === 'edit' && entry;
  editingEntry = isEdit ? {type, id: entry.id} : null;
  setManualMode(isEdit);
  resetManualFields();
  const effectiveType = isEdit && entry ? type : 'feed';
  setManualType(effectiveType);
  if(isEdit && entry){
    populateManualForm(type, entry);
  }
  if(!isEdit && manualDatetime){
    manualDatetime.value = formatDateInput(new Date());
  }
  openModal('#modal-manual');
}
function closeManualModal(){
  setManualMode(false);
  editingEntry = null;
  setManualType('feed');
  resetManualFields();
  closeModal('#modal-manual');

}

const DEFAULT_FIRESTORE_DOC_ID = 'family-shared';
const DOC_STORAGE_KEY = 'lo.sharedDocId';

function resolveSharedDocumentId() {
  try {
    const url = new URL(window.location.href);
    const queryDoc = url.searchParams.get('doc') || url.searchParams.get('docId');
    if (queryDoc) {
      localStorage.setItem(DOC_STORAGE_KEY, queryDoc);
      return queryDoc;
    }
    const stored = localStorage.getItem(DOC_STORAGE_KEY);
    if (stored) {
      return stored;
    }
  } catch (error) {
    console.warn('Could not resolve shared Firestore document id:', error);
  }
  return DEFAULT_FIRESTORE_DOC_ID;
}

let firebaseInitialized = false;
let firebaseDocId;
let firebaseDbInstance;
let firebaseStorageInstance;
let firebaseStorageFns;
// let firebaseReportsApi = null; // This seems unused with persistenceApi
let persistenceApi = null;


function beginEditEntry(type, id){
  const existing = findEntryById(type, id);
  if(!existing){
    console.warn('Entry not found for editing', type, id);
    return;
  }
  const copy = JSON.parse(JSON.stringify(existing));
  openManualModal({mode:'edit', type, entry: copy});

}



function saveManualEntry(){
  const isEdit = Boolean(editingEntry);
  const targetType = isEdit && editingEntry ? editingEntry.type : manualType;
  let date = manualDatetime && manualDatetime.value ? new Date(manualDatetime.value) : new Date();
  if(Number.isNaN(date.getTime())) date = new Date();
  let reason = null;
  let entry = null;

  updateState(currentData => {
    if (targetType === 'feed') {
      const sourceValue = (manualSource?.value || 'breast') === 'bottle' ? 'bottle' : 'breast';
      entry = { id: isEdit ? editingEntry.id : Date.now()+'', dateISO: date.toISOString(), source: sourceValue };
      if (sourceValue === 'breast') {
        const mins = Math.max(0, Number(manualDuration?.value || 0));
        entry.durationSec = Math.round(mins * 60);
        entry.breastSide = manualBreast?.value || 'Gauche';
      } else {
        entry.amountMl = Math.max(0, Number(manualAmount?.value || 0));
      }
      const notes = manualNotes?.value?.trim();
      if (notes) entry.notes = notes;

      if (isEdit) {
        const idx = currentData.feeds.findIndex(item => String(item.id) === String(entry.id));
        if (idx > -1) currentData.feeds[idx] = entry; else currentData.feeds.push(entry);
        reason = `Edit feed entry ${entry.id}`;
      } else {
        currentData.feeds.push(entry);
        reason = 'Manual feed entry';
      }
    } else if (targetType === 'elim') {
      entry = {
        id: isEdit ? editingEntry.id : Date.now()+'',
        dateISO: date.toISOString(),
        pee: clamp(Number(manualPee?.value || 0), 0, 3),
        poop: clamp(Number(manualPoop?.value || 0), 0, 3),
        vomit: clamp(Number(manualVomit?.value || 0), 0, 3)
      };
      const notes = manualElimNotes?.value?.trim();
      if (notes) entry.notes = notes;

      if (isEdit) {
        const idx = currentData.elims.findIndex(item => String(item.id) === String(entry.id));
        if (idx > -1) currentData.elims[idx] = entry; else currentData.elims.push(entry);
        reason = `Edit elimination entry ${entry.id}`;
      } else {
        currentData.elims.push(entry);
        reason = 'Manual elimination entry';
      }
    } else if (targetType === 'med') {
    let selection = manualMedSelect?.value || 'ibufrone';
    const labels = {ibufrone:'Ibufrone', dalfalgan:'Dalfalgan', other:''};
    if(!labels[selection]) selection = 'other';
    let name = labels[selection] || selection;
    if(selection === 'other'){
      name = (manualMedOtherInput?.value || '').trim();
      if(!name){
        alert('Veuillez indiquer le nom du medicament.');
        manualMedOtherInput?.focus();
        throw new Error("Medication name required"); // Throw to stop execution
      }
    }
    const dose = (manualMedDose?.value || '').trim();
    const notes = (manualMedNotes?.value || '').trim();
    entry = { id: isEdit ? editingEntry.id : Date.now()+'', dateISO: date.toISOString(), name, medKey: selection };
    if (dose) entry.dose = dose;
    if (notes) entry.notes = notes;

      if (isEdit) {
        const idx = currentData.meds.findIndex(item => String(item.id) === String(entry.id));
        if (idx > -1) currentData.meds[idx] = entry; else currentData.meds.push(entry);
        reason = `Edit medication entry ${entry.id}`;
      } else {
        currentData.meds.push(entry);
        reason = 'Manual medication entry';
      }
    } else if (targetType === 'measurement') {
      const temp = manualMesureTemp.value ? parseFloat(manualMesureTemp.value) : null;
      const weight = manualMesurePoids.value ? parseFloat(manualMesurePoids.value) : null;
      const height = manualMesureTaille.value ? parseFloat(manualMesureTaille.value) : null;

      if (temp === null && weight === null && height === null) {
        alert("Veuillez entrer au moins une mesure.");
        throw new Error("At least one measurement is required");
      }

      entry = { id: isEdit ? editingEntry.id : Date.now() + '', dateISO: date.toISOString() };
      if (temp !== null) entry.temp = temp;
      if (weight !== null) entry.weight = weight;
      if (height !== null) entry.height = height;

      if (isEdit) {
        const idx = currentData.measurements.findIndex(item => String(item.id) === String(entry.id));
        if (idx > -1) currentData.measurements[idx] = entry; else currentData.measurements.push(entry);
        reason = `Edit measurement entry ${entry.id}`;
      } else {
        currentData.measurements.push(entry);
        reason = 'Manual measurement entry';
      }
    }
    return currentData;
  });

  if(reason && entry){
    const api = getPersistenceApi();
    api?.saveEntry?.(targetType, entry, reason);
  }
  closeManualModal();
  renderHistory();
}


async function initFirebaseSync() {
  const { db: firebaseDb } = await import('./firebase.js');
  firebaseDbInstance = firebaseDb;
  if (!firebaseDbInstance || !firebaseDocId) {
    console.warn("Firebase dependencies not ready.");
    setSaveIndicator('error', 'Dependencias no listas.');
    return;
  }

  try {
    persistenceApi.init(firebaseDbInstance, firebaseDocId);
    firebaseInitialized = true;

    // Esperamos a que lleguen los primeros datos y los renderizamos.
    const initialData = await persistenceApi.connect();
    console.log(`Firebase sync connected for document ${firebaseDocId}. Initial data received.`);
    replaceDataFromSnapshot(initialData, { skipRender: false });

    persistenceApi.on((event, payload) => {
      // Ahora, cualquier 'data-changed' se trata como la fuente de la verdad.
      // La lógica de fusión compleja ya no es necesaria en el cliente.
      if (event === 'data-changed') {
        replaceDataFromSnapshot(payload.snapshot, { skipRender: false });
      } else if (event === 'sync-status') {
        setSaveIndicator(payload.status, payload.message);
      } else if (event === 'server-update') {
        setSaveIndicator('synced', 'Données à jour');
      }
    });

  } catch (error) {
    console.error("Firebase init failed:", error);
    setSaveIndicator('error', SAVE_MESSAGES.error);
  }
}

async function bootstrap() {
  try {
    const { db, storage, storageFns } = await import('./firebase.js');
    const persistenceModule = await import('./persistence.js');
    const { Persistence } = persistenceModule;

    persistenceApi = Persistence;
    firebaseDbInstance = db;
    firebaseStorageInstance = storage;
    firebaseStorageFns = storageFns;
    firebaseDocId = resolveSharedDocumentId();

    setSaveIndicator('idle', isOnline() ? SAVE_MESSAGES.idle : SAVE_MESSAGES.offline);
    updateOfflineIndicator();

    await initFirebaseSync();
  } catch (error) {
    console.error("Failed to bootstrap Firebase or app modules:", error);
    setSaveIndicator('error', 'Erreur de chargement');
  }

  cancelSelectBtn?.addEventListener('click', () => toggleDeleteMode(false));
  deleteSelectedBtn?.addEventListener('click', () => {
    const selectedItems = $$('.history-item-checkbox:checked', historyList)
      .map(cb => ({ type: cb.dataset.type, id: cb.dataset.id }));

    if (selectedItems.length > 0) {
      confirmAndDelete(selectedItems);
    } else {
      toggleDeleteMode(false);
    }
  });
}

addManualBtn?.addEventListener('click', ()=> openManualModal({mode:'create', type:'feed'}));
footerAddManualBtn?.addEventListener('click', ()=> openManualModal({mode:'create', type:'feed'}));
exportReportsBtn?.addEventListener('click', exportReports);
closeManualBtn?.addEventListener('click', closeManualModal);
cancelManualBtn?.addEventListener('click', closeManualModal);
saveManualBtn?.addEventListener('click', () => {
  try {
    saveManualEntry();
  } catch (e) {
    console.warn("Save manual entry failed:", e.message);
    // Alert the user that something went wrong, as the function might have bailed early.
  }
});
manualTypeButtons.forEach(btn => btn.addEventListener('click', ()=> setManualType(btn.dataset.type)));
manualSource?.addEventListener('change', updateManualSourceFields);
manualMedSelect?.addEventListener('change', updateManualMedFields);
if(manualModal){
  setManualType('feed');
  updateManualSourceFields();
  updateManualMedFields();
}

window.addEventListener('online', () => {
  updateOfflineIndicator();
});

window.addEventListener('offline', () => {
  updateOfflineIndicator();
});

// Temporarily disable service worker registration to avoid caching stale bundles.
// if ('serviceWorker' in navigator) {
//   window.addEventListener('load', () => {
//     navigator.serviceWorker.register('./sw.js').catch(err => {
//       console.error('Service worker registration failed:', err);
//     });
//   });
// }

bootstrap();
