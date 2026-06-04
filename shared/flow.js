/* Generic n8n-style flow renderer.
   Consumes window.FLOW = { meta, canvas, legend, nodes, edges, walk, details, rules }
*/
(function(){
const F = window.FLOW;
if(!F){document.body.innerHTML='<pre style="color:#fff;padding:20px">window.FLOW missing</pre>';return;}
const CW = (F.canvas&&F.canvas.w)||2150;
const CH = (F.canvas&&F.canvas.h)||620;

// ── Build skeleton UI ─────────────────────────────────────────────
document.body.insertAdjacentHTML('beforeend', `
<header>
  <a class="back" href="../">← all flows</a>
  <h1><span class="sw" style="background:var(--loop)"></span> ${F.meta.title} ${F.meta.file?`<span class="file">${F.meta.file}</span>`:''}</h1>
  <div class="legend" id="legend"></div>
</header>
<div class="stage" id="stage"><div class="canvas" id="canvas" style="width:${CW}px;height:${CH}px"><svg class="edges" id="edges" style="width:${CW}px;height:${CH}px"></svg></div></div>
<div class="toolbar">
  <button id="prev">‹</button>
  <button id="play" class="primary">▶ Run flow</button>
  <button id="next">›</button>
  <button id="reset">↺ Reset</button>
</div>
<div class="zoomctl">
  <button id="zin">+</button><button id="zout">−</button><button id="zfit" title="fit">⊡</button>
</div>
<aside class="drawer" id="drawer"><button class="x" onclick="window.__closeDrawer()">✕</button><div id="dcontent"></div></aside>
`);

document.title = F.meta.title + (F.meta.file?' — '+F.meta.file:'');

// Legend
const LEGEND = F.legend || [
  {label:'Trigger',color:'var(--trig)'},{label:'API',color:'var(--exa)'},
  {label:'LLM',color:'var(--gem)'},{label:'IF / branch',color:'var(--if)'},
  {label:'Loop',color:'var(--loop)'},{label:'Output',color:'var(--out)'}
];
document.getElementById('legend').innerHTML =
  LEGEND.map(l=>`<span class="k"><span class="sw" style="background:${l.color}"></span>${l.label}</span>`).join('');

// ── Nodes ─────────────────────────────────────────────────────────
const N = F.nodes;
const canvas = document.getElementById('canvas');
function nh(id){return N[id].kind==='if'?64:70;}
function nw(id){return N[id].kind==='if'?120:182;}
function port(id,side){const n=N[id];const w=nw(id),h=nh(id);const y=n.y+h/2;return side==='l'?{x:n.x,y}:side==='r'?{x:n.x+w,y}:side==='t'?{x:n.x+w/2,y:n.y}:{x:n.x+w/2,y:n.y+h};}

Object.entries(N).forEach(([id,n])=>{
  const el=document.createElement('div');
  el.className=`node k-${n.kind}`; el.id='node-'+id;
  el.style.left=n.x+'px'; el.style.top=n.y+'px';
  if(n.kind==='if'){
    el.innerHTML=`<div class="top"><span class="ic">${n.ic||'◆'}</span></div><div class="ttl">${n.ttl}</div><span class="port l"></span><span class="port r"></span>`;
  }else{
    el.innerHTML=`<div class="top"><span class="ic">${n.ic||'•'}</span><span class="nm">${n.nm||''}</span></div><div class="ttl">${n.ttl}</div>${n.sb?`<div class="sb">${n.sb}</div>`:''}<span class="port l"></span><span class="port r"></span>`;
  }
  el.addEventListener('click',e=>{e.stopPropagation();openDrawer(id);});
  canvas.appendChild(el);
});

// ── Edges ─────────────────────────────────────────────────────────
const svg = document.getElementById('edges');
svg.insertAdjacentHTML('afterbegin',`<defs>
  <marker id="arrow" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="#39414f"/></marker>
  <marker id="arrowlp" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="#ffd479"/></marker>
</defs>`);
const C=64;
function norm(p,side){return side==='l'?{x:p.x-C,y:p.y}:side==='r'?{x:p.x+C,y:p.y}:side==='t'?{x:p.x,y:p.y-C}:{x:p.x,y:p.y+C};}
const edgeEls={};
(F.edges||[]).forEach(([f,fs,t,ts,label,cls])=>{
  const p1=port(f,fs),p2=port(t,ts);const c1=norm(p1,fs),c2=norm(p2,ts);
  const d=`M ${p1.x} ${p1.y} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${p2.x} ${p2.y}`;
  const path=document.createElementNS('http://www.w3.org/2000/svg','path');
  path.setAttribute('d',d);
  path.setAttribute('class','edge'+(cls==='lp'?' loop':(cls==='t'||cls==='f'?' branch':'')));
  path.setAttribute('marker-end','url(#arrow'+(cls==='lp'?'lp':'')+')');
  svg.appendChild(path);
  edgeEls[f+'>'+t]=path;
  if(label){
    const mid=path.getPointAtLength(path.getTotalLength()*0.5);
    const tw=label.length*6.2+12;
    const bg=document.createElementNS('http://www.w3.org/2000/svg','rect');
    bg.setAttribute('x',mid.x-tw/2);bg.setAttribute('y',mid.y-9);bg.setAttribute('width',tw);bg.setAttribute('height',17);
    bg.setAttribute('rx',4);bg.setAttribute('class','elabel-bg');svg.appendChild(bg);
    const tx=document.createElementNS('http://www.w3.org/2000/svg','text');
    tx.setAttribute('x',mid.x);tx.setAttribute('y',mid.y+3.5);tx.setAttribute('text-anchor','middle');
    tx.setAttribute('class','elabel '+(cls||''));tx.textContent=label;svg.appendChild(tx);
  }
});
const token=document.createElementNS('http://www.w3.org/2000/svg','circle');
token.setAttribute('class','token');token.setAttribute('r','5.5');svg.appendChild(token);

// ── Drawer ────────────────────────────────────────────────────────
const drawer=document.getElementById('drawer'),dcontent=document.getElementById('dcontent');
const DET = F.details||{};
const RULES = F.rules||[];
function esc(t){return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function hl(c){return esc(c)
  .replace(/("[^"]*")/g,'<span class="s">$1</span>')
  .replace(/\b(POST|GET|for|if|break|OR|AND|return|while|site:)\b/g,'<span class="k">$1</span>')
  .replace(/(q1|q2|q3|exa_search|exa_crawl|crawl|gemini|llm_analyze)/g,'<span class="n">$1</span>')
  .replace(/(#.*$)/gm,'<span class="c">$1</span>');}
function openDrawer(id){
  const dd=DET[id];
  document.querySelectorAll('.node').forEach(n=>n.classList.remove('active'));
  const el=document.getElementById('node-'+id);if(el)el.classList.add('active');
  if(!dd){drawer.classList.remove('open');return;}
  let h=`<h2>${dd.h||''}</h2><div class="dt">${dd.t||N[id].ttl}</div>`;
  if(dd.d)h+=`<div class="blk"><div class="dsc">${dd.d}</div></div>`;
  if(dd.io){h+=`<div class="blk"><div class="lab">I/O</div>`;dd.io.forEach(([a,v])=>h+=`<div class="io"><span class="a">${a}</span><span class="pill">${esc(v)}</span></div>`);h+=`</div>`;}
  if(dd.code)h+=`<div class="blk"><div class="lab">${dd.ct||'code'}</div><pre>${hl(dd.code)}</pre></div>`;
  if(dd.rules){h+=`<div class="blk"><div class="lab" style="color:var(--out)">Validation rules</div><ul class="rules">`;RULES.forEach(([k,v])=>h+=`<li><b>${k}.</b> ${v}</li>`);h+=`</ul></div>`;}
  dcontent.innerHTML=h;drawer.classList.add('open');
}
window.__closeDrawer = ()=>drawer.classList.remove('open');

// ── Pan & zoom ────────────────────────────────────────────────────
const stage=document.getElementById('stage');
let scale=1,tx=0,ty=0,panning=false,sx,sy;
function apply(){canvas.style.transform=`translate(${tx}px,${ty}px) scale(${scale})`;}
function fit(){const r=stage.getBoundingClientRect();scale=Math.min(r.width/CW,r.height/CH)*0.96;tx=(r.width-CW*scale)/2;ty=(r.height-CH*scale)/2+10;apply();}
stage.addEventListener('mousedown',e=>{if(e.target.closest('.node'))return;panning=true;stage.classList.add('grabbing');sx=e.clientX-tx;sy=e.clientY-ty;});
window.addEventListener('mousemove',e=>{if(!panning)return;tx=e.clientX-sx;ty=e.clientY-sy;apply();});
window.addEventListener('mouseup',()=>{panning=false;stage.classList.remove('grabbing');});
stage.addEventListener('wheel',e=>{e.preventDefault();const f=e.deltaY<0?1.1:0.9;const r=stage.getBoundingClientRect();const mx=e.clientX-r.left,my=e.clientY-r.top;tx=mx-(mx-tx)*f;ty=my-(my-ty)*f;scale*=f;apply();},{passive:false});
document.getElementById('zin').onclick=()=>{scale*=1.15;apply();};
document.getElementById('zout').onclick=()=>{scale*=0.87;apply();};
document.getElementById('zfit').onclick=fit;
stage.addEventListener('click',e=>{if(!e.target.closest('.node')&&!e.target.closest('.drawer'))window.__closeDrawer();});

// ── Play sequence ─────────────────────────────────────────────────
const WALK=F.walk||[];
let wi=-1,playing=false,raf=null;
function setActive(id){document.querySelectorAll('.node').forEach(n=>n.classList.remove('active'));const el=document.getElementById('node-'+id);if(el)el.classList.add('active');}
function markDone(id){const el=document.getElementById('node-'+id);if(el)el.classList.add('done');}
function animEdge(from,to,cb){const p=edgeEls[from+'>'+to];if(!p){cb();return;}const len=p.getTotalLength();let t0=null;const dur=620;token.style.opacity=1;function fr(ts){if(t0===null)t0=ts;const k=Math.min((ts-t0)/dur,1);const pt=p.getPointAtLength(len*k);token.setAttribute('cx',pt.x);token.setAttribute('cy',pt.y);if(k<1){raf=requestAnimationFrame(fr);}else{token.style.opacity=0;cb();}}raf=requestAnimationFrame(fr);}
function stepTo(idx){if(idx>=WALK.length){stopPlay();return;}const id=WALK[idx];if(idx>0){animEdge(WALK[idx-1],id,()=>{markDone(WALK[idx-1]);setActive(id);wi=idx;if(playing)setTimeout(()=>stepTo(idx+1),650);});}else{setActive(id);wi=idx;if(playing)setTimeout(()=>stepTo(idx+1),900);}}
function stopPlay(){playing=false;document.getElementById('play').textContent='▶ Run flow';cancelAnimationFrame(raf);token.style.opacity=0;}
document.getElementById('play').onclick=()=>{if(playing){stopPlay();return;}playing=true;document.getElementById('play').textContent='⏸ Pause';document.querySelectorAll('.node').forEach(n=>n.classList.remove('done'));if(wi>=WALK.length-1)wi=-1;stepTo(wi+1);};
document.getElementById('next').onclick=()=>{stopPlay();wi=Math.min(wi+1,WALK.length-1);setActive(WALK[wi]);};
document.getElementById('prev').onclick=()=>{stopPlay();wi=Math.max(wi-1,0);setActive(WALK[wi]);};
document.getElementById('reset').onclick=()=>{stopPlay();wi=-1;document.querySelectorAll('.node').forEach(n=>n.classList.remove('done','active'));window.__closeDrawer();};
window.addEventListener('keydown',e=>{if(e.key===' '&&e.target.tagName!=='INPUT'){e.preventDefault();document.getElementById('play').click();}if(e.key==='ArrowRight')document.getElementById('next').click();if(e.key==='ArrowLeft')document.getElementById('prev').click();});

fit();
})();
