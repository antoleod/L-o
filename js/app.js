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
const summaryFeedEl = $('#summary-feed');
const summaryElimEl = $('#summary-elim');
const dashboardElimEl = $('#dashboard-elim');
const bgPicker = $('#bg-picker');
const avatarBtn = $('#avatar-btn');
const infoBtn = $('#info-btn');
const infoChevron = $('#info-chevron');
const addManualBtn = $('#add-manual');
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
const HISTORY_RANGE_KEY = 'historyRange';
let historyRange = normalizeHistoryRange(store.get(HISTORY_RANGE_KEY, {mode:'day'}));
let statsChart = null;
const TIMER_KEY = 'timerState';
let manualType = 'feed';
let timer = 0;
let timerStart = null;
let timerInterval = null;

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
  // La sincronización con Firebase se hace a través de un listener,
  // pero guardamos explícitamente para asegurar que los cambios se envíen.
  if (window.FirebaseReports) {
    const payload = cloneDataSnapshot();
    window.FirebaseReports.saveAll(payload, reason).catch(err => console.error('Firebase save failed:', err));
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

let historyMenuOutsideHandler = null;
let historyMenuKeydownHandler = null;

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
    ...feeds.map(f => ({type:'feed', item:f})),
    ...elims.map(e => ({type:'elim', item:e})),
    ...meds.map(m => ({type:'med', item:m}))
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

function getStatsChartData(range = historyRange){
  const stats = getFeedStats(range);
  const labels = stats.perDay.map(day => {
    const parsed = parseDateInput(day.dateISO);
    return parsed
      ? parsed.toLocaleDateString('fr-FR', {weekday:'short', day:'numeric'})
      : day.dateISO;
  });
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
  const totals = data.totals;
  const dayCount = Math.max(data.dayCount || (data.perDay?.length ?? 0), 1);
  const hasData = totals.feedCount > 0 || totals.breastMinutes > 0 || totals.bottleMl > 0;
  if(!hasData){
    statsSummaryEl.innerHTML = '<div class="stat-placeholder">Aucune donnee pour cette periode.</div>';
    return;
  }

  const dayLabel = dayCount === 1 ? '1 jour' : `${dayCount} jours`;
  const avgFeeds = totals.feedCount / dayCount;
  const avgBreastMinutes = totals.breastMinutes / dayCount;
  const avgBottleMl = totals.bottleMl / dayCount;

  statsSummaryEl.innerHTML = `
    <div class="stat-period">Periode : <strong>${escapeHtml(data.label)}</strong><span>${escapeHtml(dayLabel)}</span></div>
    <div class="stat-card">
      <span class="stat-title">Sessions</span>
      <span class="stat-value">${formatNumber(totals.feedCount)}</span>
      <span class="stat-sub">${formatNumber(avgFeeds, 1, 1)} par jour | Sein ${formatNumber(totals.breastSessions)} | Biberon ${formatNumber(totals.bottleSessions)}</span>
    </div>
    <div class="stat-card">
      <span class="stat-title">Sein</span>
      <span class="stat-value">${formatNumber(totals.breastMinutes, 1, 1)} min</span>
      <span class="stat-sub">${formatNumber(avgBreastMinutes, 1, 1)} min/jour</span>
    </div>
    <div class="stat-card">
      <span class="stat-title">Biberon</span>
      <span class="stat-value">${formatNumber(totals.bottleMl)} ml</span>
      <span class="stat-sub">${formatNumber(avgBottleMl)} ml/jour</span>
    </div>
  `;
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
  const all = getHistoryEntriesForRange();

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

historyRangeMenu?.addEventListener('keydown', (event) => {
  if(event.key === 'Enter' || event.key === ' '){
    event.preventDefault();
    handleHistoryRangeMenuSelection(event.target);
  }
});

historyRangeMenu?.addEventListener('focusout', (event) => {
  const nextTarget = event.relatedTarget;
  if(nextTarget && historyRangeMenu?.contains(nextTarget)){
    return;
  }
  closeHistoryRangeMenu();
});

historyRangeDateInput?.addEventListener('change', (event) => {
  const value = event.target.value;
  if(!value) return;
  setHistoryRange('custom', {date: value});
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

historyList?.addEventListener('click', (e)=>{

  const editBtn = e.target.closest('.item-edit');

  if(editBtn){

    const {type, id} = editBtn.dataset;

    if(type && id){

      beginEditEntry(type, id);

    }

    return;

  }

  const deleteBtn = e.target.closest('.item-delete');

  if (deleteBtn) {
    const securityCode = prompt("Pour supprimer, veuillez entrer le code de sécurité :");
    if (securityCode !== '2410') {
      if (securityCode !== null) { // No mostrar alerta si el usuario simplemente cancela
        alert("Code incorrect. La suppression a été annulée.");
      }
      return; // Detener el proceso de eliminación
    }

    const {type, id} = deleteBtn.dataset;
    let changed = false;

    if (type === 'feed') {
      feeds = feeds.filter(f => f.id !== id);
      changed = true;
    } else if (type === 'elim') {
      elims = elims.filter(el => el.id !== id);
      changed = true;
    } else if (type === 'med') {
      meds = meds.filter(m => m.id !== id);
      changed = true;
    }

    if (changed) {
      persistAll('Delete entry');
    }
    deleteBtn.disabled = true;
    setTimeout(renderHistory, 180);
  }
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

function getListByType(type){
  if(type === 'feed') return feeds;
  if(type === 'elim') return elims;
  if(type === 'med') return meds;
  return null;
}

function findEntryById(type, id){
  const list = getListByType(type);
  if(!list) return null;
  return list.find(item => item && item.id === id) || null;
}

function replaceEntryInList(type, entry){
  const list = getListByType(type);
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
  }
}

function openManualModal({mode='create', type='feed', entry=null} = {}){
  const isEdit = mode === 'edit' && entry;
  editingEntry = isEdit && entry ? {type, id: entry.id} : null;
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

  manualType = targetType;

  let date = manualDatetime && manualDatetime.value ? new Date(manualDatetime.value) : new Date();

  if(Number.isNaN(date.getTime())) date = new Date();

  const dateISO = date.toISOString();

  let reason = null;



  if(targetType === 'feed'){

    const sourceValue = (manualSource?.value || 'breast') === 'bottle' ? 'bottle' : 'breast';

    const entry = {

      id: isEdit && editingEntry ? editingEntry.id : Date.now()+'',

      dateISO,

      source: sourceValue

    };

    if(sourceValue === 'breast'){

      const mins = Math.max(0, Number(manualDuration?.value || 0));

      entry.durationSec = Math.round(mins * 60);

      entry.breastSide = manualBreast?.value || 'Gauche';

    }else{

      entry.amountMl = Math.max(0, Number(manualAmount?.value || 0));

    }

    const notes = manualNotes?.value?.trim();

    if(notes) entry.notes = notes;

    if(isEdit){

      if(!replaceEntryInList('feed', entry)){

        feeds.push(entry);

      }

      reason = `Edit feed entry ${entry.id}`;

    }else{

      feeds.push(entry);

      reason = sourceValue === 'breast' ? 'Manual feed entry (breast)' : 'Manual feed entry (bottle)';

    }

  }else if(targetType === 'elim'){

    const entry = {

      id: isEdit && editingEntry ? editingEntry.id : Date.now()+'',

      dateISO,

      pee: clamp(Number(manualPee?.value || 0), 0, 3),

      poop: clamp(Number(manualPoop?.value || 0), 0, 3),

      vomit: clamp(Number(manualVomit?.value || 0), 0, 3)

    };

    const notes = manualElimNotes?.value?.trim();

    if(notes) entry.notes = notes;

    if(isEdit){

      if(!replaceEntryInList('elim', entry)){

        elims.push(entry);

      }

      reason = `Edit elimination entry ${entry.id}`;

    }else{

      elims.push(entry);

      reason = 'Manual elimination entry';

    }

  }else if(targetType === 'med'){

    let selection = manualMedSelect?.value || 'ibufrone';

    const labels = {ibufrone:'Ibufrone', dalfalgan:'Dalfalgan', other:''};

    if(!labels[selection]) selection = 'other';

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

      id: isEdit && editingEntry ? editingEntry.id : Date.now()+'',

      dateISO,

      name,

      medKey: selection

    };

    if(dose) entry.dose = dose;

    if(notes) entry.notes = notes;

    if(isEdit){

      if(!replaceEntryInList('med', entry)){

        meds.push(entry);

      }

      reason = `Edit medication entry ${entry.id}`;

    }else{

      meds.push(entry);

      reason = 'Manual medication entry';

    }

  }else{

    console.warn('Unknown manual type:', targetType);

  }



  if(reason){

    persistAll(reason);

  }

  closeManualModal();

  renderHistory();

}


function initFirebaseSync() {
  if (window.firebase && window.FirebaseReports) {
    const firebaseApp = window.firebase.app();
    window.FirebaseReports.init(firebaseApp, 'leo-reports'); // Usamos 'leo-reports' como ID del documento

    window.FirebaseReports.on((event, payload) => {
      if (event === 'synced') {
        console.log('Datos sincronizados desde Firebase:', payload);
        // Reemplaza los datos locales con los de Firebase y renderiza
        replaceDataFromSnapshot(payload, { persistLocal: true, skipRender: false });
      }
    });
  }
}

addManualBtn?.addEventListener('click', ()=> openManualModal({mode:'create', type:'feed'}));
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

initFirebaseSync();
