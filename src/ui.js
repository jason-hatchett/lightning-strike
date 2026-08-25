/* ============================================================
   Lightning Strike — UI, state, event wiring, and the skirmish
   cutscene. Imports the pure sim/data and the sprite renderer.
   ============================================================ */
import {
  PART, SLOTS, SLOT_LABEL, SLOT_BASE_HP, partsForSlot, partMaxHp, isWeaponPart,
  mechTags, derive, STAT_META, MOB_LABEL, TERRAINS, TERRAIN_META, canDeploy, terrainReason,
  CONDITIONS, PART_TARGETS, MISSIONS, EN, PRESETS, SCHEME_DEFAULTS, runtimeMech,
} from './data.js';
import { resolveSkirmish } from './sim.js';
import { SCHEMES, SCHEME_NAMES } from './schemes.js';
import {
  SPR, FRAME, ENEMY_KEY2SLOT, drawMech, drawMechCropped, drawMechTags, drawMonoSprite,
  preloadSprites, mkMechCanvas, schemeOf,
} from './render.js';

const state={
  mechs:PRESETS.map((m,i)=>({name:m.name,loadout:Object.assign({},m.loadout),tactics:{},partTargets:{},scheme:SCHEME_DEFAULTS[i]||'Vanguard'})),
  activeMech:0, selSlot:'rarm',
  deploy:null,      // {missionIdx, assign:[mechIdx|null per lane]}
  run:null,
};
const cur=()=>state.mechs[state.activeMech];
const $=s=>document.querySelector(s);
const el=(t,c,h)=>{const e=document.createElement(t);if(c)e.className=c;if(h!=null)e.innerHTML=h;return e;};

/* ---------- HANGAR TABS ---------- */
function renderHangar(){
  const box=$('#hangar');box.innerHTML='';
  state.mechs.forEach((m,i)=>{
    const tags=mechTags(m.loadout).map(t=>MOB_LABEL[t]).join(' · ');
    const b=el('div','mtab'+(i===state.activeMech?' sel':''));
    b.innerHTML=`<div class="mtn">Mech ${i+1}</div><div class="mtname">${m.name}</div><div class="mttags">${tags}</div>`;
    const cv=document.createElement('canvas');drawMechCropped(cv,m.loadout,schemeOf(m),3);b.appendChild(cv);
    b.onclick=()=>{state.activeMech=i;garageRefresh();};
    box.appendChild(b);
  });
}

/* ---------- GARAGE ---------- */
function renderPreview(){
  const box=$('#mechPreview');if(!box)return;box.innerHTML='';const m=cur();
  const cv=mkMechCanvas(3);drawMech(cv,m.loadout,schemeOf(m),3);box.appendChild(cv);
  const sel=el('select');
  SCHEME_NAMES.forEach(s=>{const o=document.createElement('option');o.value=s;o.textContent=s;if(s===schemeOf(m))o.selected=true;sel.appendChild(o);});
  sel.onchange=()=>{m.scheme=sel.value;renderPreview();renderHangar();};
  const pick=el('div','schemepick');pick.appendChild(el('span','ml','Paint scheme'));pick.appendChild(sel);box.appendChild(pick);
}
function renderFrame(){
  const f=$('#frame');f.innerHTML='';const lo=cur().loadout;
  const cls={head:'fr-head',backpack:'fr-bp',rarm:'fr-rarm',core:'fr-core',larm:'fr-larm',legs:'fr-legs'};
  for(const slot of SLOTS){
    const id=lo[slot];const p=id?PART[id]:null;
    const b=el('div','slotbtn '+cls[slot]+(slot==='core'?' core':'')+(slot===state.selSlot?' sel':''));
    b.innerHTML=`<span class="sl">${SLOT_LABEL[slot]}</span>
      <span class="eq ${p?'':'empty'}">${p?p.name.split(' ')[0]:'— empty'}</span>
      ${p?`<span class="hp">${partMaxHp(p)} hp</span>`:''}
      ${p&&p.ability?`<span class="ab">◈ ${p.ability.name}</span>`:''}`;
    b.onclick=()=>{state.selSlot=slot;renderFrame();renderParts();};
    f.appendChild(b);
  }
}
function chips(p){
  const short={integrity:'INT',firepower:'FP',armor:'ARM',speed:'SPD',charge:'CHG'};const st=p.stats;
  const out=[`<span class="chip hp">${partMaxHp(p)} HP</span>`];
  for(const k of Object.keys(short))if(st[k]){const v=st[k];const val=(k==='charge')?(v>0?'+':'')+v.toFixed(1):(v>0?'+':'')+v;out.push(`<span class="chip ${v>0?'pos':'neg'}">${short[k]} ${val}</span>`);}
  return out.join('');
}
function renderParts(){
  const box=$('#partList');box.innerHTML='';const slot=state.selSlot;const lo=cur().loadout;
  $('#partsHead').textContent=SLOT_LABEL[slot]+' — parts  ·  base HP '+SLOT_BASE_HP[slot];
  const un=el('div','part'+(lo[slot]?'':' equipped'));
  un.innerHTML=`<div class="pn" style="color:var(--dim)">— Empty slot</div><div class="abil ai">No part.</div>`;
  un.onclick=()=>{lo[slot]=null;clearSlotTac(slot);equipDone();};un.onmouseenter=()=>preview(slot,null);un.onmouseleave=clearPrev;
  box.appendChild(un);
  for(const p of partsForSlot(slot)){
    const eq=lo[slot]===p.id;const card=el('div','part'+(eq?' equipped':''));
    const cross=p.slot!==slot?`<span class="cross">↔ ${SLOT_LABEL[p.slot]}</span>`:(p.alsoFits?`<span class="cross">↔ ${p.alsoFits.map(s=>SLOT_LABEL[s]).join('/')}</span>`:'');
    let abil='<div class="abil ai">Passive — flat stats only</div>';
    if(p.ability){abil=`<div class="abil">◈ ${p.ability.name} <span class="ai">· ${p.ability.type}${p.ability.type==='attack'?' · pow '+p.ability.power:''}${p.ability.targeting==='multi'?' · multi':''}${p.ability.cooldown?' · cd'+p.ability.cooldown:''}${p.ability.status?' · '+(p.ability.status.type==='emp'?('⚡ stun '+p.ability.status.rounds):('🔥 burn '+p.ability.status.power+'×'+p.ability.status.rounds)):''}${p.ability.assist?' · ⟲ assist':''}</span></div>`;
      if(p.broken)abil+=`<div class="abil broken">✕ if disabled → <b>${p.broken.name}</b> (pow ${p.broken.power})</div>`;}
    const tagline=p.tags?`<div class="tagline2">▸ mobility: ${p.tags.map(t=>MOB_LABEL[t]).join(' + ')}</div>`:'';
    card.innerHTML=`<span class="arch">${p.arch}</span>${cross}<div class="pn">${p.name}</div>${abil}${tagline}<div class="chips">${chips(p)}</div>`;
    card.onclick=()=>{lo[slot]=p.id;clearSlotTac(slot);equipDone();};card.onmouseenter=()=>preview(slot,p.id);card.onmouseleave=clearPrev;
    box.appendChild(card);
  }
}
function clearSlotTac(slot){const m=cur();delete m.tactics[slot];delete m.partTargets[slot];}
function equipDone(){renderPreview();renderFrame();renderParts();renderStats();renderMobility();renderTactics();renderHangar();validate();}
function preview(slot,id){const pv=Object.assign({},cur().loadout);pv[slot]=id;renderStats(pv);}
function clearPrev(){renderStats();}
function renderStats(previewLo){
  const curl=cur().loadout;const c=derive(curl);const shown=previewLo?derive(previewLo):c;
  const box=$('#statPanel');box.innerHTML='';
  for(const m of STAT_META){
    const now=c[m.k],nv=shown[m.k];const pct=Math.min(100,nv/m.max*100);
    const up=previewLo&&nv>now,down=previewLo&&nv<now;const fmt=v=>m.k==='charge'?v.toFixed(1):Math.round(v);
    let dh='';if(previewLo&&nv!==now){const dv=nv-now;dh=`<span class="delta ${dv>0?'pos':'neg'}">${m.k==='charge'?(dv>0?'+':'')+dv.toFixed(1):(dv>0?'+':'')+Math.round(dv)}</span>`;}
    const row=el('div','stat');
    row.innerHTML=`<span class="lbl">${m.label}</span><span class="track"><span class="fill ${up?'up':''}" style="width:${pct}%;${down?'background:linear-gradient(90deg,#7a2b2b,var(--red))':''}"></span>${previewLo&&nv!==now?`<span class="ghost" style="left:${Math.min(100,now/m.max*100)}%"></span>`:''}</span><span class="val">${fmt(nv)}${dh}</span>`;
    box.appendChild(row);
  }
}
function renderMobility(previewLo){
  const lo=previewLo||cur().loadout;const tags=mechTags(lo);
  $('#tagPills').innerHTML=tags.map(t=>`<span class="tagpill">${MOB_LABEL[t]}</span>`).join('');
  $('#terrPills').innerHTML=TERRAINS.map(t=>{const ok=canDeploy(tags,t);return `<span class="terrpill ${ok?'ok':''}">${ok?'✓ ':''}${TERRAIN_META[t].label}</span>`;}).join('');
}
function renderTactics(){
  const box=$('#tacticsList');box.innerHTML='';const m=cur();
  const abils=[];
  for(const slot of SLOTS){const id=m.loadout[slot];if(!id)continue;const p=PART[id];if(p.ability)abils.push({slot,p,a:p.ability});}
  if(!abils.length){box.innerHTML='<div class="tac-empty">No active abilities — this mech is all passive stat parts.</div>';return;}
  for(const {slot,p,a} of abils){
    const row=el('div','tacrow');
    const cond=m.tactics[slot]||a.condition||'always';
    const condSel=`<select data-slot="${slot}" data-kind="cond">${Object.keys(CONDITIONS).map(c=>`<option value="${c}"${c===cond?' selected':''}>${CONDITIONS[c].label}</option>`).join('')}</select>`;
    let aimSel='';
    if(a.type==='attack'){const pt=m.partTargets[slot]||a.partTarget||'core';
      aimSel=`<select class="aim" data-slot="${slot}" data-kind="pt">${Object.keys(PART_TARGETS).map(c=>`<option value="${c}"${c===pt?' selected':''}>${PART_TARGETS[c]}</option>`).join('')}</select>`;}
    row.innerHTML=`<span class="an"><span class="tag">${a.type}</span>${a.name} <span class="slotname">· ${SLOT_LABEL[slot]}</span>${a.assist?'<span class="astar">⟲ assist</span>':''}</span><span class="tacsel">${condSel}${aimSel}</span>`;
    box.appendChild(row);
  }
  box.querySelectorAll('select').forEach(s=>s.onchange=(e)=>{const sl=e.target.dataset.slot;const mm=cur();
    if(e.target.dataset.kind==='cond')mm.tactics[sl]=e.target.value; else mm.partTargets[sl]=e.target.value;});
}
function validate(){
  const lo=cur().loadout;
  const hasAtk=SLOTS.some(s=>{const id=lo[s];return id&&PART[id].ability&&PART[id].ability.type==='attack';});
  $('#garageWarn').textContent=hasAtk?'':'⚠ '+cur().name+' has no attack ability — equip a weapon in R-Arm, L-Arm, or Backpack.';
  $('#toMission').disabled=!hasAtk;return hasAtk;
}
function garageRefresh(){$('#mechName').value=cur().name;equipDone();}
$('#mechName').oninput=(e)=>{cur().name=e.target.value.slice(0,14)||('MECH-'+(state.activeMech+1));renderHangar();};
$('#mechName').onblur=()=>{if(!cur().name.trim()){cur().name='MECH-'+(state.activeMech+1);garageRefresh();}};
$('#toMission').onclick=()=>{if(validate())show('mission');};
$('#resetBtn').onclick=()=>{const base=PRESETS[state.activeMech];state.mechs[state.activeMech]={name:base.name,loadout:Object.assign({},base.loadout),tactics:{},partTargets:{},scheme:SCHEME_DEFAULTS[state.activeMech]||'Vanguard'};garageRefresh();};
$('#randomBtn').onclick=()=>{const m=cur();for(const slot of SLOTS){const o=partsForSlot(slot);m.loadout[slot]=o[Math.floor(Math.random()*o.length)].id;}m.tactics={};m.partTargets={};
  if(!validate())m.loadout.rarm='vulcan';garageRefresh();};

/* ---------- MISSION SELECT ---------- */
function renderMissions(){
  const box=$('#missionCards');box.innerHTML='';
  MISSIONS.forEach((m,i)=>{const c=el('div','mcard');
    const pips=[1,2,3].map(n=>`<span class="pip ${n<=m.diff?'on':''}"></span>`).join('');
    const laneBadges=m.lanes.map(L=>`<span class="terr terr-${L.terrain}">${TERRAIN_META[L.terrain].label}</span>`).join(' ');
    const encPreview=m.lanes.map(L=>L.nodes.filter(n=>n.kind==='fight').map(n=>n.name).join(' → ')).join('  ·  ');
    c.innerHTML=`<div class="mno">DEPLOYMENT ${String(i+1).padStart(2,'0')} · ${m.lanes.length} LANE${m.lanes.length>1?'S':''}</div>
      <div class="mt">${m.name}</div><div class="md">${m.desc}</div>
      <div class="lanes">${laneBadges}</div>
      <div class="enc">▷ ${encPreview}</div><div class="diff">${pips}</div>`;
    c.onclick=()=>openDeploy(i);box.appendChild(c);});
}
$('#backToGarage').onclick=()=>show('garage');

/* ---------- DEPLOY (assign mechs to lanes) ---------- */
function openDeploy(mi){
  const m=MISSIONS[mi];
  state.deploy={missionIdx:mi,assign:m.lanes.map(()=>null)};
  // auto-assign: give each lane the first eligible unused mech (best-effort convenience)
  const used=new Set();
  m.lanes.forEach((L,li)=>{
    for(let k=0;k<state.mechs.length;k++){if(used.has(k))continue;if(canDeploy(mechTags(state.mechs[k].loadout),L.terrain)){state.deploy.assign[li]=k;used.add(k);break;}}
  });
  show('deploy');
}
function renderDeploy(){
  const d=state.deploy,m=MISSIONS[d.missionIdx];
  $('#deployTitle').textContent='Deploy · '+m.name+' · one mech per lane · terrain gates who can go where';
  const box=$('#deployLanes');box.innerHTML='';
  m.lanes.forEach((L,li)=>{
    const card=el('div','dlane');
    const track=L.nodes.map(n=>{
      if(n.kind==='assist')return '<span class="as">◈ assist</span>';
      if(n.kind==='segment')return `<span class="seg">▚ ${n.name}</span>`;
      return n.name;
    }).join(' <span class="arrow">→</span> ');
    // options
    let opts='<option value="">— none —</option>';
    state.mechs.forEach((mech,k)=>{
      const tags=mechTags(mech.loadout);const ok=canDeploy(tags,L.terrain);
      const takenElsewhere=d.assign.some((a,ai)=>ai!==li&&a===k);
      const dis=(!ok||takenElsewhere)?' disabled':'';
      const why=!ok?' ✕ '+terrainReason(L.terrain):(takenElsewhere?' (assigned)':'');
      opts+=`<option value="${k}"${d.assign[li]===k?' selected':''}${dis}>${mech.name}${why}</option>`;
    });
    card.innerHTML=`<div class="dlt"><span class="dln">Lane ${li+1}</span><span class="terr terr-${L.terrain}">${TERRAIN_META[L.terrain].label}</span></div>
      <div class="dltrack">${track}</div>
      <select data-lane="${li}">${opts}</select>
      <div class="dhint" data-dh="${li}"></div>`;
    box.appendChild(card);
  });
  box.querySelectorAll('select').forEach(s=>s.onchange=(e)=>{const li=+e.target.dataset.lane;const v=e.target.value;
    d.assign[li]=v===''?null:+v;renderDeploy();});
  // per-lane hints + warn
  m.lanes.forEach((L,li)=>{
    const hint=box.querySelector(`[data-dh="${li}"]`);const k=d.assign[li];
    if(k==null){hint.className='dhint bad';hint.textContent='No mech assigned — '+terrainReason(L.terrain)+'.';}
    else{const tags=mechTags(state.mechs[k].loadout);hint.className='dhint good';hint.textContent='✓ '+state.mechs[k].name+' — '+tags.map(t=>MOB_LABEL[t]).join('/');}
  });
  const allAssigned=d.assign.every(a=>a!=null);
  $('#deployWarn').textContent=allAssigned?'':'⚠ Every lane needs an eligible mech. If none fits a terrain, rebuild one in the garage (add a jetpack / dive legs / etc.).';
  $('#launchBtn').disabled=!allAssigned;
}
$('#deployBack').onclick=()=>show('mission');
$('#deployGarage').onclick=()=>show('garage');
$('#launchBtn').onclick=()=>launchRun();

/* ---------- RUN (multi-lane) ---------- */
function launchRun(){
  const d=state.deploy,m=MISSIONS[d.missionIdx];
  const lanes=m.lanes.map((L,li)=>({
    terrain:L.terrain, nodes:L.nodes, idx:0,
    mech:runtimeMech(state.mechs[d.assign[li]]),
    assisting:null, prebuff:null, done:false, lost:false, msg:''
  }));
  state.run={missionIdx:d.missionIdx,mission:m,lanes,lightning:30,lightningSpent:0,fights:0};
  repairPickLane=-1;prebuffPickLane=-1;show('lane');renderRun();
}
function laneMechPartArray(lane){const out=[];for(const slot of SLOTS){if(lane.mech.parts[slot])out.push({slot,ps:lane.mech.parts[slot],p:PART[lane.mech.loadout[slot]]});}return out;}
function laneTag(lane){return mechTags(lane.mech.loadout);}
function activeLanes(){return state.run.lanes.filter(L=>!L.done&&!L.lost);}
function adjacentAssistTargets(li){
  // lanes li-1 and li+1 that are active fightable
  const out=[];const L=state.run.lanes;
  [li-1,li+1].forEach(j=>{if(j>=0&&j<L.length&&!L[j].done&&!L[j].lost)out.push(j);});
  return out;
}
// find the assist ability a held lane can lend (first non-disabled assist attack, else any non-disabled attack)
function laneAssistSpec(lane){
  const pick=(requireAssist)=>{
    for(const slot of SLOTS){const id=lane.mech.loadout[slot];if(!id)continue;const p=PART[id];const ps=lane.mech.parts[slot];
      if(ps.disabled)continue;
      if(p.ability&&p.ability.type==='attack'&&(!requireAssist||p.ability.assist))
        return {name:lane.mech.name,ability:Object.assign({},p.ability),speed:lane.mech.derived.speed,firepower:lane.mech.derived.firepower,abilityName:p.ability.name};
    }
    return null;
  };
  return pick(true)||pick(false);
}

let repairPickLane=-1, prebuffPickLane=-1;
function renderRun(){
  const r=state.run;
  $('#runName').textContent='▷ '+r.mission.name;
  const done=r.lanes.filter(L=>L.done).length, lost=r.lanes.filter(L=>L.lost).length;
  $('#runHint').textContent=`${done}/${r.lanes.length} lanes cleared${lost?` · ${lost} lost`:''}. Clear every lane to win the deployment.`;
  $('#lightFill').style.width=Math.min(100,r.lightning)+'%';$('#lightTxt').textContent=Math.round(r.lightning)+' / 100';
  const board=$('#lanesBoard');board.innerHTML='';
  r.lanes.forEach((lane,li)=>board.appendChild(renderLaneCard(lane,li)));
}
function renderLaneCard(lane,li){
  const r=state.run;
  const card=el('div','lcard'+(lane.done?' done':'')+(lane.lost?' lost':'')+(lane.assisting!=null?' holding':''));
  // header
  const term=`<span class="terr terr-${lane.terrain}">${TERRAIN_META[lane.terrain].label}</span>`;
  card.appendChild(el('div','lh',`<span class="lhn">Lane ${li+1}</span>${term}`));
  // node track
  const track=el('div','lctrack');
  lane.nodes.forEach((n,i)=>{
    if(i)track.appendChild(el('span','arrow','→'));
    const st=lane.done||i<lane.idx?'done':i===lane.idx&&!lane.lost?'cur':'';
    const kindCls=n.kind==='assist'?' assist':n.kind==='segment'?' segment':'';
    const node=el('div','node '+st+kindCls);
    node.innerHTML=`<div class="nk">${lane.done||i<lane.idx?'✓':i===lane.idx?'▶':'·'} ${n.kind==='fight'?(n.threat||''):n.kind}</div><div class="nn">${n.name}</div>`;
    track.appendChild(node);
  });
  card.appendChild(track);
  // mech status
  card.appendChild(el('div','lmech',`<b>${lane.mech.name}</b> <span style="color:var(--dim)">· ${laneTag(lane).map(t=>MOB_LABEL[t]).join('/')}</span>`));
  const core=lane.mech.parts.core;const cfrac=core?core.hp/core.maxHp:0;
  const coreBox=el('div','lcore');
  coreBox.innerHTML=`<span class="lcorehp">${Math.round(core.hp)}/${Math.round(core.maxHp)}</span><span style="font-size:10px;color:var(--cyan);letter-spacing:.1em">CORE</span><div class="corebar"><div class="corefill" style="width:${Math.max(0,cfrac*100)}%"></div></div>`;
  card.appendChild(coreBox);
  // part strip
  const strip=el('div','lanestrip');
  for(const {slot,ps,p} of laneMechPartArray(lane)){
    if(slot==='core')continue;const max=partMaxHp(p);const frac=ps.hp/max;
    const chip=el('div','pchip '+(isWeaponPart(p)?'weapon ':'')+(ps.disabled?'disabled':frac<0.5?'hurt':''));
    chip.innerHTML=`<div class="pcl">${SLOT_LABEL[slot]}</div><div class="pcv">${ps.disabled?(isWeaponPart(p)?'DEGR':'DOWN'):Math.round(ps.hp)}</div><div class="pcfill" style="width:${Math.max(0,frac*100)}%"></div>`;
    strip.appendChild(chip);
  }
  card.appendChild(strip);
  // status line
  const statusEl=el('div','lstatus');
  // actions
  const acts=el('div','lacts');
  if(lane.lost){statusEl.textContent='✕ Core destroyed — lane lost.';statusEl.style.color='var(--red)';card.appendChild(statusEl);card.appendChild(acts);return card;}
  if(lane.done){statusEl.textContent='✓ Lane cleared.';statusEl.style.color='var(--lime)';card.appendChild(statusEl);card.appendChild(acts);return card;}

  const node=lane.nodes[lane.idx];
  // incoming assist indicator
  const incoming=r.lanes.findIndex(L=>L.assisting===li);
  if(incoming>=0)statusEl.innerHTML=`<span class="assisting">⟲ ${r.lanes[incoming].mech.name} (Lane ${incoming+1}) is lending fire here.</span>`;
  if(lane.assisting!=null)statusEl.innerHTML=`<span class="assisting">⟲ Holding — lending a shot to Lane ${lane.assisting+1}.</span>`;
  card.appendChild(statusEl);

  // between-fight actions (Repair / Full-Repair / Pre-load), collapsible pickers per lane
  if(node.kind==='fight'){
    const anyHurt=laneMechPartArray(lane).some(x=>x.ps.hp<partMaxHp(x.p));
    const anyDisabled=laneMechPartArray(lane).some(x=>x.ps.disabled);
    const row1=el('div','row');
    const repBtn=el('button','btn ghostbtn sm',`Repair<span class="cost">25⚡</span>`);
    repBtn.disabled=r.lightning<25||!anyHurt;repBtn.onclick=()=>{r.lightning-=25;r.lightningSpent+=25;for(const {ps,p} of laneMechPartArray(lane))if(!ps.disabled)ps.hp=Math.min(partMaxHp(p),ps.hp+partMaxHp(p)*0.4);renderRun();};
    const frBtn=el('button','btn ghostbtn sm',`Full-Repair<span class="cost">35⚡</span>`);
    frBtn.disabled=r.lightning<35||!anyDisabled;frBtn.onclick=()=>{repairPickLane=repairPickLane===li?-1:li;prebuffPickLane=-1;renderRun();};
    row1.appendChild(repBtn);row1.appendChild(frBtn);acts.appendChild(row1);
    if(repairPickLane===li){
      const pick=el('div','repairpick');pick.innerHTML='<div style="font-size:9px;color:var(--dim);text-transform:uppercase;letter-spacing:.1em;margin-bottom:3px">Full-Repair which part?</div>';
      laneMechPartArray(lane).filter(x=>x.ps.disabled).forEach(({slot,p})=>{const b=el('button','pb',`◈ ${SLOT_LABEL[slot]} — ${p.name}`);
        b.onclick=()=>{r.lightning-=35;r.lightningSpent+=35;lane.mech.parts[slot]={hp:partMaxHp(p),maxHp:partMaxHp(p),disabled:false};repairPickLane=-1;renderRun();};pick.appendChild(b);});
      acts.appendChild(pick);
    }
    // pre-load
    if(lane.prebuff){acts.appendChild(el('div','prebuffnote',`◈ Pre-loaded: <b>${lane.prebuff.name}</b> — +50% power, round 1.`));}
    else{
      const pbBtn=el('button','btn ghostbtn sm',`Pre-load an attack<span class="cost">25⚡</span>`);
      pbBtn.disabled=r.lightning<25;pbBtn.onclick=()=>{prebuffPickLane=prebuffPickLane===li?-1:li;repairPickLane=-1;renderRun();};
      acts.appendChild(pbBtn);
      if(prebuffPickLane===li){
        const pick=el('div','repairpick');pick.innerHTML='<div style="font-size:9px;color:var(--dim);text-transform:uppercase;letter-spacing:.1em;margin-bottom:3px">Spike which attack?</div>';
        let any=false;
        for(const slot of SLOTS){const id=lane.mech.loadout[slot];if(id&&PART[id].ability&&PART[id].ability.type==='attack'&&!lane.mech.parts[slot].disabled){any=true;const a=PART[id].ability;
          const b=el('button','pb',`◈ ${a.name} · ${SLOT_LABEL[slot]}`);b.onclick=()=>{r.lightning-=25;r.lightningSpent+=25;lane.prebuff={key:slot,name:a.name,mult:1.5};prebuffPickLane=-1;renderRun();};pick.appendChild(b);}}
        if(!any)pick.innerHTML+='<div style="font-size:10px;color:var(--dim)">No live attack to spike.</div>';
        acts.appendChild(pick);
      }
    }
    const eng=el('button','btn primary sm',`Engage: ${node.name} ▷`);
    eng.onclick=()=>engageFight(li);acts.appendChild(eng);
  }
  else if(node.kind==='assist'){
    if(lane.assisting!=null){
      const rel=el('button','btn ghostbtn sm','Release &amp; push on ▷');rel.onclick=()=>{lane.assisting=null;lane.idx++;afterAdvance(lane,li);};acts.appendChild(rel);
    } else {
      const spec=laneAssistSpec(lane);
      const targets=adjacentAssistTargets(li);
      if(spec&&targets.length){
        const info=el('div','lstatus',`Hold to lend <b style="color:var(--violet)">${spec.abilityName}</b> into an adjacent lane's next fight:`);acts.appendChild(info);
        targets.forEach(j=>{const b=el('button','btn ghostbtn sm',`Hold ▸ Lane ${j+1} (${TERRAIN_META[state.run.lanes[j].terrain].label})`);
          b.onclick=()=>{lane.assisting=j;renderRun();};acts.appendChild(b);});
      } else {
        acts.appendChild(el('div','lstatus',spec?'No adjacent lane to assist right now.':'No ability to lend.'));
      }
      const push=el('button','btn primary sm','Push on ▷');push.onclick=()=>{lane.idx++;afterAdvance(lane,li);};acts.appendChild(push);
    }
  }
  else if(node.kind==='segment'){
    const tags=laneTag(lane);const passes=node.require.some(t=>tags.includes(t));
    const info=el('div','lstatus',passes
      ?`✓ ${lane.mech.name} has ${node.require.map(t=>MOB_LABEL[t]).join('/')} — crosses the ${node.name.toLowerCase()} freely.`
      :`⚠ No ${node.require.map(t=>MOB_LABEL[t]).join('/')} — crossing the ${node.name.toLowerCase()} costs ${node.dmg} Core HP (attrition).`);
    acts.appendChild(info);
    const b=el('button','btn primary sm',passes?`Cross ${node.name} ▷`:`Force crossing (−${node.dmg} HP) ▷`);
    b.onclick=()=>crossSegment(li);acts.appendChild(b);
  }
  card.appendChild(acts);
  return card;
}
function afterAdvance(lane,li){
  if(lane.idx>=lane.nodes.length){lane.done=true;checkRunEnd();}
  renderRun();
}
function crossSegment(li){
  const lane=state.run.lanes[li];const node=lane.nodes[lane.idx];
  const tags=laneTag(lane);const passes=node.require.some(t=>tags.includes(t));
  if(!passes){const core=lane.mech.parts.core;core.hp=Math.max(1,core.hp-node.dmg);}
  lane.idx++;afterAdvance(lane,li);
}
function checkRunEnd(){
  const r=state.run;
  if(r.lanes.every(L=>L.done||L.lost)){
    const anyWon=r.lanes.some(L=>L.done);
    finishRun(anyWon && r.lanes.every(L=>L.done));
    return true;
  }
  if(r.lanes.every(L=>L.lost)){finishRun(false);return true;}
  return false;
}

/* ---------- SKIRMISH ---------- */
let cutscene=null;
function engageFight(li){
  const r=state.run;const lane=r.lanes[li];const node=lane.nodes[lane.idx];
  const enemyDefs=node.enemies.map(id=>EN[id]);
  // assist: any lane holding to assist THIS lane, with a usable ability
  let assistSpec=null,assistFrom=-1;
  r.lanes.forEach((L,j)=>{if(L.assisting===li&&!L.done&&!L.lost){const s=laneAssistSpec(L);if(s&&assistSpec===null){assistSpec=s;assistFrom=j;}}});
  const seed=(r.missionIdx+1)*10007+li*911+lane.idx*331+17;
  const log=resolveSkirmish(lane.mech,enemyDefs,seed,lane.prebuff,assistSpec);
  lane.prebuff=null;
  playCutscene(log,node,li,assistFrom);
}
const TYPELAB={mech:'Mech',trap:'Trap',tank:'Tank',sniper:'Sniper',swarm:'Bot',boss:'Boss',assist:'Assist'};
function playCutscene(log,node,li,assistFrom){
  show('skirmish');$('#skName').textContent='▷ '+node.name+' · Lane '+(li+1);$('#skEnd').innerHTML='';$('#skContinue').style.display='none';$('#skSkip').style.display='';$('#banner').innerHTML='&nbsp;';
  const disp={},refs={},sprState={},statusDisp={};
  const sideP=$('#sidePlayer'),sideE=$('#sideEnemy');sideP.innerHTML='';sideE.innerHTML='';
  for(const u of log.units){
    const card=el('div','ucard '+(u.isAssist?'player assist':u.side==='player'?'player':'enemy'));
    let inner=`<div class="un">${u.name}<span class="corehp" data-core="${u.id}"></span></div><div class="utype">${u.isAssist?'Assist · lent shot':(TYPELAB[u.type]||'Unit')+' · ARM '+u.armor+' · SPD '+u.speed}</div><div class="statusrow" data-status="${u.id}"></div><div class="corebar"><div class="corefill" data-corefill="${u.id}"></div></div>`;
    if(u.mono){disp[u.id]={mono:true,hp:u.hp,max:u.maxHp,isAssist:!!u.isAssist};}
    else{disp[u.id]={mono:false,parts:{}};
      inner+='<div class="partstrip">';
      for(const p of u.parts){disp[u.id].parts[p.key]={hp:p.startHp,max:p.maxHp,disabled:p.startDisabled,isWeapon:p.isWeapon,isCore:p.isCore};
        if(p.isCore)continue;
        inner+=`<div class="pchip ${p.isWeapon?'weapon ':''}" data-chip="${u.id}_${p.key}"><div class="pcl">${p.label}</div><div class="pcv" data-cv="${u.id}_${p.key}"></div><div class="pcfill" data-cf="${u.id}_${p.key}"></div></div>`;}
      inner+='</div>';
    }
    card.innerHTML=inner;(u.side==='player'?sideP:sideE).appendChild(card);refs[u.id]=card;
    if(u.sprite&&!u.isAssist){const flip=u.side==='enemy',S=2;let cv=document.createElement('canvas');
      if(u.sprite.mono){const m=SPR['mono/'+u.sprite.mono],sz=m?(Array.isArray(m.size)?m.size:[m.size,m.size]):[64,64];
        cv.width=sz[0]*S;cv.height=sz[1]*S;sprState[u.id]={mono:u.sprite.mono,scheme:'Enemy',scale:S,cv};}
      else{cv.width=FRAME*S;cv.height=FRAME*S;
        sprState[u.id]={loadout:u.sprite.loadout,scheme:(u.side==='player'?(u.sprite.scheme||'Vanguard'):'Enemy'),scale:S,tags:{},latched:{},cv};}
      cv.className='usprite'+(flip?' flip':'');card.insertBefore(cv,card.firstChild);}
  }
  const STATUS_META={burn:{icon:'🔥',label:'Burn'},emp:{icon:'⚡',label:'EMP'}};
  function renderStatus(id){const card=refs[id];if(!card)return;const row=card.querySelector(`[data-status="${id}"]`);if(!row)return;
    const list=statusDisp[id]||[];
    row.innerHTML=list.map(s=>{const m=STATUS_META[s.type]||{icon:'?',label:s.type};
      return `<span class="spip ${s.type}" title="${m.label}: ${s.rounds} round${s.rounds===1?'':'s'} left">${m.icon} ${s.rounds}</span>`;}).join('');}
  function drawUnitSprite(id){const s=sprState[id];if(!s)return;
    if(s.mono)drawMonoSprite(s.cv,s.mono,s.scheme,s.scale);else drawMechTags(s.cv,s.loadout,s.scheme,s.tags,s.latched,s.scale);}
  function setUnit(id){
    const d=disp[id],card=refs[id];
    let coreHp,coreMax,dead;
    if(d.mono){coreHp=d.hp;coreMax=d.max;dead=d.isAssist?false:d.hp<=0;}
    else{const c=d.parts[Object.keys(d.parts).find(k=>d.parts[k].isCore)];coreHp=c.hp;coreMax=c.max;dead=c.hp<=0;}
    card.querySelector(`[data-corefill="${id}"]`).style.width=Math.max(0,coreHp/coreMax*100)+'%';
    card.querySelector(`[data-core="${id}"]`).textContent=d.isAssist?'':Math.round(coreHp);
    card.classList.toggle('dead',dead);
    if(!d.mono)for(const k in d.parts){if(d.parts[k].isCore)continue;const pp=d.parts[k];
      const chip=card.querySelector(`[data-chip="${id}_${k}"]`);if(!chip)continue;
      card.querySelector(`[data-cf="${id}_${k}"]`).style.width=Math.max(0,pp.hp/pp.max*100)+'%';
      card.querySelector(`[data-cv="${id}_${k}"]`).textContent=pp.disabled?(pp.isWeapon?'DEGRADED':'DISABLED'):Math.round(pp.hp);
      chip.classList.toggle('disabled',pp.disabled&&!pp.isWeapon);chip.classList.toggle('degraded',pp.disabled&&pp.isWeapon);
      chip.classList.toggle('hurt',!pp.disabled&&pp.hp/pp.max<0.5);}
  }
  for(const id in disp){setUnit(id);renderStatus(id);}
  for(const id in sprState)drawUnitSprite(id);
  function coreDead(id){const d=disp[id];if(!d)return false;if(d.mono)return d.hp<=0&&!d.isAssist;
    const c=d.parts[Object.keys(d.parts).find(k=>d.parts[k].isCore)];return c&&c.hp<=0;}
  function floatNum(id,txt,color){const c=refs[id];if(!c)return;const f=el('span','float',txt);f.style.color=color;c.appendChild(f);setTimeout(()=>f.remove(),1000);}
  function applyAction(a,instant){
    if(a.statusChanges){for(const id in a.statusChanges){statusDisp[id]=a.statusChanges[id];renderStatus(id);}}
    const realAct=a.kind!=='status'&&a.kind!=='stunned'; // burn/stun ticks aren't the actor "acting"
    if(!instant){Object.values(refs).forEach(c=>c.classList.remove('acting'));if(realAct)refs[a.actorId]&&refs[a.actorId].classList.add('acting');
      $('#banner').innerHTML=`<span class="rd">R${a.round}</span>${a.actorName} ▸ ${a.abilityName}${a.broken?' <span style="color:var(--red)">(degraded)</span>':''}`;
      for(const id in sprState){const s=sprState[id];if(s.tags)s.tags={};}
      if(realAct){const as=sprState[a.actorId];if(as&&as.tags){const w=as.loadout.rarm?'rarm':(as.loadout.larm?'larm':'core');as.tags[w]='act';drawUnitSprite(a.actorId);}}}
    for(const t of a.targets){const d=disp[t.unitId];if(!d)continue;
      if(t.heal){if(d.mono)d.hp=t.hpAfter;else d.parts[t.partKey].hp=t.hpAfter;}
      else if(t.revived){d.parts[t.partKey].hp=t.hpAfter;d.parts[t.partKey].disabled=false;}
      else{if(d.mono)d.hp=t.hpAfter;else{d.parts[t.partKey].hp=t.hpAfter;if(t.disabled)d.parts[t.partKey].disabled=true;}}
      setUnit(t.unitId);
      const st=sprState[t.unitId];
      if(st&&!st.mono){const slot=ENEMY_KEY2SLOT[t.partKey]||t.partKey;
        if(t.revived){delete st.latched[slot];}
        else if(!t.heal){if(t.disabled&&slot!=='core')st.latched[slot]='disabled';else if(!coreDead(t.unitId))st.tags[slot]='hit';}
        if(coreDead(t.unitId))st.latched['core']='destroyed';
        drawUnitSprite(t.unitId);}
      if(!instant){let txt,col;
        if(t.heal){txt='+'+t.value;col='var(--lime)';}
        else if(t.revived){txt='REPAIRED';col='var(--lime)';}
        else if(t.blocked){txt='BLOCK';col='var(--violet)';}
        else{txt='-'+t.value+(t.partLabel&&!d.mono?' '+t.partLabel:'');col='var(--red)';}
        floatNum(t.unitId,txt,col);
        if(t.disabled&&!t.heal&&!t.revived)setTimeout(()=>floatNum(t.unitId,d.parts&&d.parts[t.partKey]&&d.parts[t.partKey].isWeapon?'DEGRADED!':'DISABLED!','var(--amber)'),240);
        if(t.appliedStatus)setTimeout(()=>floatNum(t.unitId,t.appliedStatus==='emp'?'STUNNED! ⚡':'BURNING! 🔥',t.appliedStatus==='emp'?'var(--cyan)':'var(--amber)'),260);}
    }
    if(!instant&&a.kind==='guard')floatNum(a.actorId,'GUARD ▲','var(--violet)');
    if(!instant&&a.kind==='buff')floatNum(a.actorId,'FP +'+a.value,'var(--amber)');
    if(!instant&&a.kind==='stunned')floatNum(a.actorId,'STUNNED ⚡','var(--cyan)');
  }
  let i=0,timer=null;
  function finish(){Object.values(refs).forEach(c=>c.classList.remove('acting'));$('#banner').innerHTML='&nbsp;';
    for(const id in sprState){const s=sprState[id];if(s.tags)s.tags={};drawUnitSprite(id);}
    const win=log.result==='win';
    $('#skEnd').innerHTML=`<div class="skirmend"><span class="st ${win?'win':'lose'}">${win?'SKIRMISH WON':'CORE DESTROYED'}</span></div>`;
    $('#skSkip').style.display='none';$('#skContinue').style.display='';}
  function play(){timer=setInterval(()=>{if(i>=log.flat.length){clearInterval(timer);finish();return;}applyAction(log.flat[i],false);i++;},820);}
  $('#skSkip').onclick=()=>{if(timer)clearInterval(timer);for(;i<log.flat.length;i++)applyAction(log.flat[i],true);finish();};
  $('#skContinue').onclick=()=>onResolved(log,li,assistFrom);
  cutscene={log};play();
}
function onResolved(log,li,assistFrom){
  const r=state.run;r.fights++;
  const lane=r.lanes[li];
  lane.mech.parts=Object.assign({},lane.mech.parts);for(const slot in log.playerPartsAfter)lane.mech.parts[slot]=log.playerPartsAfter[slot];
  // consume assist: the assisting lane advances past its assist node
  if(assistFrom>=0){const A=r.lanes[assistFrom];if(A.assisting===li){A.assisting=null;if(A.nodes[A.idx]&&A.nodes[A.idx].kind==='assist'){A.idx++;if(A.idx>=A.nodes.length)A.done=true;}}}
  if(log.result==='lose'){lane.lost=true;lane.mech.alive=false;if(checkRunEnd())return;show('lane');renderRun();return;}
  lane.idx++;
  r.lightning=Math.min(100,r.lightning+38+Math.round(lane.mech.derived.charge*3));
  if(lane.idx>=lane.nodes.length){lane.done=true;}
  if(checkRunEnd())return;
  show('lane');renderRun();
}
function finishRun(win){
  const r=state.run;
  const cleared=r.lanes.filter(L=>L.done).length;
  $('#rTitle').textContent=win?'DEPLOYMENT CLEARED':'DEPLOYMENT FAILED';$('#rTitle').className='rtitle '+(win?'win':'lose');
  $('#rSub').textContent=(win?'all lanes secured — ':'lanes overrun — ')+r.mission.name;
  $('#rFights').textContent=r.fights;$('#rLanes').textContent=cleared+'/'+r.lanes.length;$('#rLight').textContent=r.lightningSpent;
  $('#rHint').textContent=win
    ?'Try a tougher deployment, or rebuild a mech for a different terrain mix.'
    :'Tip: match mechs to terrain, hold an assist point to gang up on a deadly fight, and Full-Repair downed weapons between clashes.';
  show('result');
}
$('#rRetry').onclick=()=>{openDeploy(state.run.missionIdx);};
$('#rGarage').onclick=()=>show('garage');
$('#laneAbort').onclick=()=>{state.run=null;show('garage');};

/* ---------- ROUTER ---------- */
function show(name){for(const s of document.querySelectorAll('.screen'))s.classList.toggle('active',s.id===name);
  if(cutscene&&name!=='skirmish')cutscene=null;
  if(name==='garage'){garageRefresh();}
  if(name==='mission')renderMissions();
  if(name==='deploy')renderDeploy();
  window.scrollTo({top:0});}
garageRefresh();
preloadSprites(()=>{renderPreview();renderHangar();});

/* ---------- info / how-to-play ---------- */
function openInfo(){$('#infoModal').classList.add('open');}
function closeInfo(){$('#infoModal').classList.remove('open');}
$('#infoBtn').onclick=openInfo;
$('#infoClose').onclick=closeInfo;
$('#infoGo').onclick=closeInfo;
$('#infoModal').addEventListener('click',e=>{if(e.target===$('#infoModal'))closeInfo();});
window.addEventListener('keydown',e=>{if(e.key==='Escape')closeInfo();});
openInfo();
