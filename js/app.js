// ===== Hero background =====
const heroImages = ['../img/baby1.jpg','../img/baby.jpg'];
(async function setHeroBackground(){
  for(const src of shuffle(heroImages)){
    const ok = await preloadImage(src);
    if(ok){
      document.documentElement.style.setProperty('--hero-image', `url("${src}")`);
      return;
    }
  }
  document.documentElement.classList.add('no-hero-image');
})();

function preloadImage(src){
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = src;
  });
}

function shuffle(arr){
  return [...arr].sort(()=>Math.random()-0.5);
}

// ===== Utilities =====
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const store = {
  get(key, fallback){ try{ return JSON.parse(localStorage.getItem(key)) ?? fallback }catch{ return fallback } },
  set(key, val){ localStorage.setItem(key, JSON.stringify(val)) }
};

// ===== State =====
let feeds = store.get('feeds', []); // {id,dateISO,source,breastSide,durationSec,amountMl}
let elims = store.get('elims', []); // {id,dateISO,pee,poop,vomit}

// ===== History render =====
function renderHistory(){
  const list = $('#history');
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
      const d = new Date(row.item.dateISO).toLocaleString();
      if(row.type==='feed'){
        div.textContent = `🍼 ${d} — ` + (row.item.source==='breast' ? `Sein (${row.item.breastSide}) · ${Math.round((row.item.durationSec||0)/60)} min` : `Biberon · ${row.item.amountMl} ml`);
      }else{
        div.textContent = `🚼 ${d} — Pipi ${row.item.pee} · Caca ${row.item.poop} · Vomi ${row.item.vomit}`;
      }
      list.appendChild(div);
      requestAnimationFrame(()=> div.classList.remove('enter'));
    }
  }
  $('#count-pill').textContent = feeds.length + elims.length;
}
renderHistory();

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

$('#seg-pecho').addEventListener('click', ()=>{ feedMode='breast'; $('#seg-pecho').classList.add('active'); $('#seg-biberon').classList.remove('active'); $('#pane-pecho').style.display='grid'; $('#pane-biberon').style.display='none'; });
$('#seg-biberon').addEventListener('click', ()=>{ feedMode='bottle'; $('#seg-biberon').classList.add('active'); $('#seg-pecho').classList.remove('active'); $('#pane-pecho').style.display='none'; $('#pane-biberon').style.display='grid'; });

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
