// ===== Hero background =====
const HERO_KEY = 'heroImage';
const savedHero = storeGetHero();
applyHeroBackground(savedHero);

// ===== Utilities =====
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const store = {
  get(key, fallback){ try{ return JSON.parse(localStorage.getItem(key)) ?? fallback }catch{ return fallback } },
  set(key, val){ localStorage.setItem(key, JSON.stringify(val)) }
};

const panePecho = $('#pane-pecho');
const paneBiberon = $('#pane-biberon');
const historyList = $('#history');
const summaryFeedEl = $('#summary-feed');
const summaryElimEl = $('#summary-elim');
const dashboardElimEl = $('#dashboard-elim');

// ===== State =====
let feeds = store.get('feeds', []); // {id,dateISO,source,breastSide,durationSec,amountMl}
let elims = store.get('elims', []); // {id,dateISO,pee,poop,vomit}

// ===== History render =====
function renderHistory(){
  const list = historyList;
  const all = [
    ...feeds.map(f=>({type:'feed', item:f})),
    ...elims.map(e=>({type:'elim', item:e}))
  ].sort((a,b)=> a.item.dateISO < b.item.dateISO ? 1 : -1).slice(0,10);

  list.innerHTML = '';
  if(!all.length){
    const empty = document.createElement('div');
    empty.className = 'history-empty';
    empty.textContent = 'Aucun enregistrement pour le moment. Ajoutez un premier suivi !';
    list.appendChild(empty);
  } else {
    for(const row of all){
      const div = document.createElement('div');
      div.className = 'item enter';
      const dateString = new Date(row.item.dateISO).toLocaleString();
      let title = '';
      if(row.type==='feed'){
        if(row.item.source==='breast'){
          const mins = Math.round((row.item.durationSec||0)/60);
          title = `🍼 Sein (${row.item.breastSide}) · ${mins} min`;
        } else {
          title = `🍼 Biberon · ${row.item.amountMl} ml`;
        }
      } else {
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
      list.appendChild(div);
      requestAnimationFrame(()=> div.classList.remove('enter'));
    }
  }
  $('#count-pill').textContent = feeds.length + elims.length;
  updateSummaries();
}
renderHistory();

historyList.addEventListener('click', (e)=>{
  const btn = e.target.closest('.item-delete');
  if(!btn) return;
  const {type, id} = btn.dataset;
  if(type==='feed'){
    feeds = feeds.filter(f=>f.id !== id);
    store.set('feeds', feeds);
  }else if(type==='elim'){
    elims = elims.filter(el=>el.id !== id);
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
    const todayFeeds = feeds.filter(f=> new Date(f.dateISO).getTime() >= start);
    if(!todayFeeds.length){
      summaryFeedEl.innerHTML = "<strong>Aujourd'hui</strong><span>Aucun enregistrement</span>";
    }else{
      const breast = todayFeeds.filter(f=>f.source==='breast');
      const bottle = todayFeeds.filter(f=>f.source==='bottle');
      const breastMinutes = Math.round(breast.reduce((sum,f)=> sum + (f.durationSec||0),0)/60);
      const bottleMl = bottle.reduce((sum,f)=> sum + (f.amountMl||0),0);
      summaryFeedEl.innerHTML = `
        <strong>Aujourd'hui</strong>
        <span>${todayFeeds.length} séances</span>
        <span>Sein ${breastMinutes} min</span>
        <span>Biberon ${bottleMl} ml</span>
      `;
    }
  }
  if(summaryElimEl){
    const todayElims = elims.filter(e=> new Date(e.dateISO).getTime() >= start);
    if(!todayElims.length){
      summaryElimEl.innerHTML = "<strong>Aujourd'hui</strong><span>Aucune donnée</span>";
    }else{
      const totals = todayElims.reduce((acc, cur)=> ({
        pee: acc.pee + (cur.pee||0),
        poop: acc.poop + (cur.poop||0),
        vomit: acc.vomit + (cur.vomit||0)
      }), {pee:0, poop:0, vomit:0});
      summaryElimEl.innerHTML = `
        <strong>Aujourd'hui</strong>
        <span>Pipi ${totals.pee}</span>
        <span>Caca ${totals.poop}</span>
        <span>Vomi ${totals.vomit}</span>
        <span>${todayElims.length} entrées</span>
      `;
    }
  }
  if(dashboardElimEl){
    const todayElims = elims.filter(e=> new Date(e.dateISO).getTime() >= start);
    if(!todayElims.length){
      dashboardElimEl.innerHTML = "<strong>Pipi / Caca / Vomi</strong><span>Aucune donnée aujourd'hui</span>";
    }else{
      const totals = todayElims.reduce((acc, cur)=> ({
        pee: acc.pee + (cur.pee||0),
        poop: acc.poop + (cur.poop||0),
        vomit: acc.vomit + (cur.vomit||0)
      }), {pee:0, poop:0, vomit:0});
      const last = todayElims[0];
      const time = new Date(last.dateISO).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
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

// ===== Avatar tap (placeholder) =====
$('#leo-card').addEventListener('click', () => {
  alert('Profil de Léo:\n• Naissance: 27/10/25 16:13\n• Poids de naissance: 3800 gr');
});

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

$('#btn-leche').addEventListener('click', ()=> openModal('#modal-leche'));
$('#close-leche').addEventListener('click', ()=> closeModal('#modal-leche'));

$('#seg-pecho').addEventListener('click', ()=>{
  feedMode='breast';
  $('#seg-pecho').classList.add('active');
  $('#seg-biberon').classList.remove('active');
  panePecho.classList.remove('is-hidden');
  paneBiberon.classList.add('is-hidden');
});
$('#seg-biberon').addEventListener('click', ()=>{
  feedMode='bottle';
  $('#seg-biberon').classList.add('active');
  $('#seg-pecho').classList.remove('active');
  panePecho.classList.add('is-hidden');
  paneBiberon.classList.remove('is-hidden');
});

$('#side-left').addEventListener('click', ()=>{ breastSide='Gauche'; $('#side-left').classList.add('active'); $('#side-right').classList.remove('active'); $('#side-both').classList.remove('active'); });
$('#side-right').addEventListener('click', ()=>{ breastSide='Droite'; $('#side-right').classList.add('active'); $('#side-left').classList.remove('active'); $('#side-both').classList.remove('active'); });
$('#side-both').addEventListener('click', ()=>{ breastSide='Les deux'; $('#side-both').classList.add('active'); $('#side-left').classList.remove('active'); $('#side-right').classList.remove('active'); });

function saveFeed(entry) {
  feeds.push(entry);
  store.set('feeds', feeds);
  closeModal('#modal-leche');
  renderHistory();
}

$('#startStop').addEventListener('click', (e)=>{
  if(interval){ // Is running, so stop and save
    clearInterval(interval);
    interval = null;
    const entry = { id: Date.now()+'', dateISO: new Date().toISOString(), source: 'breast', breastSide: breastSide, durationSec: timer };
    saveFeed(entry);
    // Reset UI
    timer = 0;
    updateChrono();
    $('#start-time-display').textContent = '';
    e.target.textContent = 'Démarrer';
  } else { // Is stopped, so start
    interval = setInterval(()=>{ timer++; updateChrono(); }, 1000);
    const startTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    $('#start-time-display').textContent = `Commencé à ${startTime}`;
    e.target.textContent = 'Stop';
  }
});

$('#save-biberon').addEventListener('click', () => {
  const ml = Number($('#ml').value || 0);
  if (ml > 0) {
    const entry = { id: Date.now()+'', dateISO: new Date().toISOString(), source: 'bottle', amountMl: ml };
    saveFeed(entry);
    $('#ml').value = ''; // Reset input
  }
});

// ===== Eliminaciones modal logic =====
$('#btn-elim').addEventListener('click', ()=> openModal('#modal-elim'));
$('#close-elim').addEventListener('click', ()=> closeModal('#modal-elim'));
$('#cancel-elim').addEventListener('click', ()=> closeModal('#modal-elim'));

const scales = { pee:0, poop:0, vomit:0 };
function renderScale(root){
  root.innerHTML = '';
  const key = root.dataset.scale;
  for(let n=0;n<=3;n++){
    const b = document.createElement('button'); b.textContent = n;
    if(scales[key]==n) b.classList.add('active');
    b.addEventListener('click',()=>{ scales[key]=n; renderScale(root); });
    root.appendChild(b);
  }
}
$$('.scale').forEach(renderScale);

$('#save-elim').addEventListener('click', ()=>{
  elims.push({ id: Date.now()+'', dateISO: new Date().toISOString(), pee: scales.pee, poop: scales.poop, vomit: scales.vomit });
  store.set('elims', elims);
  closeModal('#modal-elim');
  renderHistory();
});
