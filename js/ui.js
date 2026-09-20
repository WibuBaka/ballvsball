/* ---------------------------- GAME STATE ---------------------------------*/
let selectedMap=0;
let p1Ball=null, p2Ball=null;
let vsAI=false;
let galleryFilter='all';
let gallerySelectedId=null; // ball currently shown in the gallery detail panel
let p1Filter='all', p2Filter='all';

// HP shown anywhere in the UI (gallery grid, hover popup, pick summary) is
// the REAL in-game max HP (def.hp*1.6, same formula the engine itself uses
// for ball.maxHp) - not the raw balance-only `hp` stat field. Gameplay HP
// values themselves are untouched; this only fixes what's displayed.
// Momentum-bar balls (Beyblade) have no real HP at all, so callers keep
// handling that case themselves with their own "ĐL 100%" label.
function maxHpDisplay(bt){
  return Math.round(bt.hp*1.6);
}

// Shared tab bar used by both the Gallery and the two ball-pick grids -
// "Tất cả" plus one tab per GROUP_META entry, color-matched to that group.
function renderGroupTabs(host, currentKey, onChange){
  host.innerHTML='';
  const makeTab=(key,label,color)=>{
    const tab=document.createElement('div');
    tab.className='group-tab'+(key===currentKey?' active':'');
    tab.textContent=label;
    tab.style.setProperty('--tab-color',color);
    tab.onclick=()=>onChange(key);
    host.appendChild(tab);
  };
  makeTab('all','Tất cả','#1a1a1a');
  Object.keys(GROUP_META).forEach(gKey=>makeTab(gKey,GROUP_META[gKey].label.replace(/^Nhóm /,'').split(' (')[0],GROUP_META[gKey].color));
}

const screens = {
  menu:document.getElementById('menuScreen'),
  map:document.getElementById('mapScreen'),
  ball:document.getElementById('ballScreen'),
  game:document.getElementById('gameScreen'),
};
function showScreen(name){
  Object.values(screens).forEach(s=>s.classList.remove('active'));
  screens[name].classList.add('active');
  // lets CSS react to the current screen (e.g. hide the secret-code box on
  // touch devices while a match is running)
  document.body.dataset.screen=name;
}
document.body.dataset.screen='menu';

/* ---------------------------- MENU NAV ------------------------------------*/
document.getElementById('btnPlay').onclick=()=>{ vsAI=false; buildMapGrid(); showScreen('map'); };
document.getElementById('btnPlayAI').onclick=()=>{ vsAI=true; p2Ball=null; buildMapGrid(); showScreen('map'); };
document.getElementById('btnGallery').onclick=()=>{ gallerySelectedId=null; buildGallery(); document.getElementById('galleryModal').classList.add('active'); };
document.getElementById('closeGallery').onclick=()=>{ document.getElementById('galleryModal').classList.remove('active'); };

/* ---------------------------- SECRET CODE ---------------------------------*/
function showSecretMsg(text,color){
  const el=document.getElementById('secretCodeMsg');
  el.textContent=text;
  el.style.color=color||'#8dff7a';
  clearTimeout(showSecretMsg._t);
  showSecretMsg._t=setTimeout(()=>{ el.textContent=''; },3000);
}
function submitSecretCode(){
  const input=document.getElementById('secretCodeInput');
  const code=input.value.trim().toUpperCase();
  input.value='';
  if(!code) return;
  if(code==='FLO'){
    if(florentinoUnlocked){
      showSecretMsg('Florentino Ball đã được mở khóa rồi.','#8fdcff');
    } else {
      florentinoUnlocked=true;
      showSecretMsg('🌹 Đã mở khóa Florentino Ball!','#8dff7a');
      buildBallGrids(); // refresh picker grids if the ball-select screen is open
    }
  } else if(code==='THENTHUNGNHINEMQUAYGOTDIMAI'){
    FLORENTINO_PICK_CHANCE=0.95;
    FLORENTINO_DASH_CHANCE=0.6;
    showSecretMsg('🌹 Florentino được buff: nhặt hoa 95%, lướt tới 60%!','#e0568a');
  } else {
    showSecretMsg('Mã không hợp lệ.','#ff8f6a');
  }
}
document.getElementById('secretCodeBtn').onclick=submitSecretCode;
// On phones/tablets the box is collapsed to just the key icon (see CSS) and
// expands when the icon is tapped, so it never covers the game or the buttons.
document.getElementById('secretCodeIcon').onclick=()=>{
  const box=document.getElementById('secretCodeBox');
  box.classList.toggle('open');
  if(box.classList.contains('open')) document.getElementById('secretCodeInput').focus();
};
document.getElementById('secretCodeInput').addEventListener('keydown',(e)=>{
  if(e.key==='Enter') submitSecretCode();
});
document.getElementById('mapBack').onclick=()=>showScreen('menu');
document.getElementById('mapNext').onclick=()=>{ buildBallGrids(); showScreen('ball'); };
document.getElementById('ballBack').onclick=()=>showScreen('map');
document.getElementById('ballNext').onclick=()=>{
  if(!p1Ball || !p2Ball){ alert('Vui lòng chọn bóng cho cả 2 người chơi!'); return; }
  showScreen('game'); startMatch();
};
document.getElementById('btnMenu').onclick=()=>{ stopMatch(); showScreen('menu'); };
document.getElementById('btnRematch').onclick=()=>{ startMatch(); };

/* ---------------------------- BUILD: GALLERY ------------------------------*/
// Left column: browsable list of balls (short blurb only, clamped to 5 lines).
// Clicking a card opens its full breakdown in the detail column on the right,
// instead of a global toggle that used to switch every card at once.
function buildGallery(){
  const tabsHost=document.getElementById('galleryTabs');
  const host=document.getElementById('galleryCards');
  const keepScroll=host.scrollTop; // rebuilding the list would otherwise jump it back to the top
  host.innerHTML='';
  renderGroupTabs(tabsHost, galleryFilter, (key)=>{ galleryFilter=key; buildGallery(); });
  const groupsToShow = galleryFilter==='all' ? Object.keys(GROUP_META) : [galleryFilter];
  let firstBall=null;
  groupsToShow.forEach(gKey=>{
    const meta=GROUP_META[gKey];
    const block=document.createElement('div'); block.className='group-block';
    const title=document.createElement('div'); title.className='group-title';
    title.style.color=meta.color; title.textContent=meta.label;
    block.appendChild(title);
    const grid=document.createElement('div'); grid.className='ball-grid';
    BALL_TYPES.filter(bt=>bt.group===gKey).forEach(bt=>{
      if(!firstBall) firstBall=bt;
      const card=document.createElement('div');
      card.className='ball-card'+(bt.id===gallerySelectedId?' selected':'');
      card.style.setProperty('--card-color',meta.color);
      card.dataset.ballId=bt.id;
      card.innerHTML=`<div class="ball-dot" style="background:${meta.color};color:${meta.color}"></div>
        <div class="info">
          <b>${bt.icon} ${bt.name}</b>
          <div class="stat-row" style="margin:3px 0;font-size:.72rem;font-weight:700;color:var(--text-1);"><span>${bt.momentumBar?'ĐL 100%':'HP '+maxHpDisplay(bt)}</span><span>SPD ${bt.speed}</span><span>DMG ${bt.dmg}</span></div>
          <span class="ball-card-blurb">${bt.descSimple}</span>
        </div>`;
      card.onclick=()=>{ gallerySelectedId=bt.id; buildGallery(); };
      grid.appendChild(card);
    });
    block.appendChild(grid);
    host.appendChild(block);
  });
  // Keep a selection alive across tab switches when possible; otherwise land
  // on the first ball of whatever's currently visible so the panel is never
  // empty while browsing (it only shows the placeholder before any click).
  const stillVisible = gallerySelectedId && BALL_TYPES.some(bt=>bt.id===gallerySelectedId && (galleryFilter==='all'||bt.group===galleryFilter));
  if(gallerySelectedId && !stillVisible) gallerySelectedId=null;
  renderGalleryDetail(gallerySelectedId ? BALL_TYPES.find(bt=>bt.id===gallerySelectedId) : null);
  host.scrollTop=keepScroll;
}
function renderGalleryDetail(bt){
  const host=document.getElementById('galleryDetail');
  if(!bt){
    // on narrow screens the detail panel sits ABOVE the list, so point down
    const narrow=window.matchMedia && window.matchMedia('(max-width:720px)').matches;
    host.innerHTML='<div class="gallery-detail-empty">'+(narrow?'👇 Chạm vào một quả bóng để xem chi tiết':'👈 Chọn một quả bóng để xem chi tiết')+'</div>';
    return;
  }
  const meta=GROUP_META[bt.group];
  host.style.setProperty('--card-color',meta.color);
  host.innerHTML=`
    <div class="gallery-detail-head">
      <div class="gallery-detail-icon" style="background:${meta.color};color:${meta.color}">${bt.icon}</div>
      <div>
        <b class="gallery-detail-name">${bt.name}</b>
        <div class="gallery-detail-group" style="color:${meta.color}">${meta.label}</div>
      </div>
    </div>
    <div class="gallery-detail-stats">
      <div class="gd-stat"><span>${bt.momentumBar?'ĐL':'HP'}</span><b>${bt.momentumBar?'100%':maxHpDisplay(bt)}</b></div>
      <div class="gd-stat"><span>SPD</span><b>${bt.speed}</b></div>
      <div class="gd-stat"><span>DMG</span><b>${bt.dmg}</b></div>
    </div>
    <div class="gallery-detail-section-label">CÁCH HOẠT ĐỘNG</div>
    <div class="gallery-detail-text">${bt.desc}</div>`;
  host.scrollTop=0; // new ball -> start reading from the top
}

/* ---------------------------- BUILD: MAP GRID -----------------------------*/
function buildMapGrid(){
  const host=document.getElementById('mapGrid');
  host.innerHTML='';
  MAPS.forEach(m=>{
    const card=document.createElement('div'); card.className='map-card glass'+(m.id===selectedMap?' selected':'');
    const thumb=document.createElement('div'); thumb.className='map-thumb';
    thumb.appendChild(makeMapThumbSVG(m));
    card.appendChild(thumb);
    const b=document.createElement('b'); b.textContent=m.name; card.appendChild(b);
    const p=document.createElement('div'); p.style.cssText='font-size:.68rem;color:var(--text-1);margin-top:4px;'; p.textContent=m.desc; card.appendChild(p);
    card.onclick=()=>{ selectedMap=m.id; buildMapGrid(); };
    host.appendChild(card);
  });
}

/* ---------------------------- BUILD: BALL SELECT --------------------------*/
function buildBallGrids(){
  buildPickerGrid('p1Grid',1);
  buildPickerGrid('p2Grid',2);
  const p2Title=document.querySelector('.p2-panel h3');
  const p2Hint=document.getElementById('p2AiHint');
  if(vsAI){
    p2Title.textContent='🤖 ĐỐI THỦ (AI)';
    if(p2Hint) p2Hint.style.display='block';
    // auto-roll a random ball for the AI so the player doesn't have to pick
    // for both sides - they can still click the grid themselves to override it
    if(!p2Ball){
      const pool=BALL_TYPES.filter(bt=>bt.id!=='florentino' || florentinoUnlocked);
      const bt=pool[Math.floor(Math.random()*pool.length)];
      p2Ball=bt.id;
      updateSummary(2,bt);
      buildPickerGrid('p2Grid',2); // rebuild so the rolled ball shows as chosen
    }
  } else {
    p2Title.textContent='PLAYER 2';
    if(p2Hint) p2Hint.style.display='none';
  }
}
function buildPickerGrid(hostId, player){
  const filterKey = player===1 ? p1Filter : p2Filter;
  const tabsHost=document.getElementById(player===1?'p1Tabs':'p2Tabs');
  renderGroupTabs(tabsHost, filterKey, (key)=>{
    if(player===1) p1Filter=key; else p2Filter=key;
    buildPickerGrid(hostId,player);
  });

  const host=document.getElementById(hostId);
  host.innerHTML='';
  const poolForFilter = filterKey==='all' ? BALL_TYPES : BALL_TYPES.filter(bt=>bt.group===filterKey);

  // Random Ball option — rolls one real ball type from the CURRENT tab's pool
  // and picks it, highlighting that ball's own icon in the grid so the player
  // can see exactly what got chosen. Locked balls (e.g. Florentino before the
  // secret code) are excluded from the pool.
  const randomItem=document.createElement('div');
  randomItem.className='pick-item';
  randomItem.style.borderColor='#c9a8ff';
  randomItem.style.color='#c9a8ff';
  randomItem.textContent='🎲';
  randomItem.title='Ngẫu nhiên (trong tab đang chọn)';
  randomItem.onclick=()=>{
    const pool=poolForFilter.filter(bt=>bt.id!=='florentino' || florentinoUnlocked);
    if(!pool.length) return;
    const bt=pool[Math.floor(Math.random()*pool.length)];
    if(player===1) p1Ball=bt.id; else p2Ball=bt.id;
    updateSummary(player,bt);
    host.querySelectorAll('.pick-item').forEach(el=>el.classList.remove('chosen'));
    const matchEl=host.querySelector(`.pick-item[data-ball-id="${bt.id}"]`);
    if(matchEl) matchEl.classList.add('chosen');
  };
  host.appendChild(randomItem);

  const currentPick = player===1 ? p1Ball : p2Ball;
  poolForFilter.forEach(bt=>{
    const meta=GROUP_META[bt.group];
    const item=document.createElement('div');
    item.className='pick-item';
    // Florentino Ball stays locked (greyed out, unclickable) until the "FLO"
    // secret code is entered in the corner box.
    if(bt.id==='florentino' && !florentinoUnlocked){
      item.style.borderColor='#555a6e';
      item.style.color='#555a6e';
      item.style.cursor='not-allowed';
      item.style.opacity='0.55';
      item.textContent='🔒';
      item.title='Bí mật — nhập mã để mở khóa';
      host.appendChild(item);
      return;
    }
    item.style.borderColor=meta.color;
    item.style.color=meta.color;
    item.textContent=bt.icon;
    item.title=bt.name;
    item.dataset.ballId=bt.id;
    if(bt.id===currentPick) item.classList.add('chosen'); // keep highlight when switching tabs
    item.onclick=(e)=>{
      host.querySelectorAll('.pick-item').forEach(el=>el.classList.remove('chosen'));
      item.classList.add('chosen');
      if(player===1) p1Ball=bt.id; else p2Ball=bt.id;
      updateSummary(player,bt);
    };
    item.onmouseenter=(e)=>showStatPopup(e,bt);
    item.onmousemove=(e)=>positionStatPopup(e);
    item.onmouseleave=hideStatPopup;
    host.appendChild(item);
  });
}
function updateSummary(player, bt){
  const el=document.getElementById(player===1?'p1Summary':'p2Summary');
  el.innerHTML=`<b>${bt.icon} ${bt.name}</b>
    <div class="stat-row"><span>HP</span><span>${bt.momentumBar?'ĐL 100%':maxHpDisplay(bt)}</span></div>
    <div class="stat-row"><span>Speed</span><span>${bt.speed}</span></div>
    <div class="stat-row"><span>Damage</span><span>${bt.dmg}</span></div>
    <div style="margin-top:6px;color:var(--text-1)">${bt.descSimple}</div>`;
}
let statPopupEl=null;
function showStatPopup(e,bt){
  hideStatPopup();
  // hover tooltip - meaningless on touch (it would get stuck on screen after a
  // tap); the pick summary panel already shows the same stats there
  if(window.DEVICE && DEVICE.touchPrimary) return;
  const meta=GROUP_META[bt.group];
  statPopupEl=document.createElement('div');
  statPopupEl.className='stat-popup glass';
  statPopupEl.style.borderColor=meta.color;
  statPopupEl.innerHTML=`<b style="color:${meta.color}">${bt.icon} ${bt.name}</b>
    <div class="stat-row"><span>HP</span><span>${bt.momentumBar?'ĐL 100%':maxHpDisplay(bt)}</span></div>
    <div class="stat-row"><span>Speed</span><span>${bt.speed}</span></div>
    <div class="stat-row"><span>Damage</span><span>${bt.dmg}</span></div>`;
  document.getElementById('app').appendChild(statPopupEl);
  positionStatPopup(e);
}
function positionStatPopup(e){
  if(!statPopupEl) return;
  statPopupEl.style.left=(e.clientX+14)+'px';
  statPopupEl.style.top=(e.clientY+14)+'px';
}
function hideStatPopup(){ if(statPopupEl){ statPopupEl.remove(); statPopupEl=null; } }
