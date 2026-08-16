(function(){
"use strict";
const $=id=>document.getElementById(id);
let zipData=null, animInfo=null, previewFrames={}, playing=false, timer=null, curPart='__all__', seq=null, sIdx=0, fIdx=0, rIdx=0, pauseLeft=0, fileName='';
let currentHex=null;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function toast(msg){
  const s=$('snack');
  $('snackText').textContent=msg;
  s.classList.add('show');
  clearTimeout(s._h);
  s._h=setTimeout(()=>s.classList.remove('show'),2600);
}

/* ===== 主题：双层圆洞展开 ===== */
let themeBusy=false, holeOK=false;
if(window.CSS&&CSS.registerProperty){
  try{ CSS.registerProperty({name:'--hole',syntax:'<length>',inherits:false,initialValue:'0px'}); holeOK=true; }catch(e){}
}
function applyTheme(t){
  document.documentElement.setAttribute('data-theme',t);
  $('iconMoon').style.display=t==='dark'?'none':'block';
  $('iconSun').style.display=t==='dark'?'block':'none';
}
const saved=localStorage.getItem('tf-theme');
applyTheme(saved||'light');

$('themeToggle').addEventListener('click',()=>{
  if(themeBusy) return;
  const cur=document.documentElement.getAttribute('data-theme');
  const next=cur==='dark'?'light':'dark';
  const apply=()=>{ applyTheme(next); localStorage.setItem('tf-theme',next); };

  if(matchMedia('(prefers-reduced-motion: reduce)').matches||!holeOK){ apply(); return; }
  themeBusy=true;

  const btn=$('themeToggle');
  const r=btn.getBoundingClientRect();
  const cx=Math.round(r.left+r.width/2), cy=Math.round(r.top+r.height/2);
  const sy=window.scrollY||document.documentElement.scrollTop||0;

  const clone=document.body.cloneNode(true);
  const cs=getComputedStyle(document.documentElement);
  const vars=['--bg','--card','--fill','--line','--text','--text-2','--text-3','--accent','--accent-press','--accent-disabled','--ring','--hl','--snack-bg','--snack-fg'];
  vars.forEach(v=>{ const val=cs.getPropertyValue(v).trim(); if(val) clone.style.setProperty(v,val); });
  clone.style.cssText+=';position:fixed;inset:0;margin:0;overflow:auto;pointer-events:none;z-index:97;background:var(--bg);transform:translateZ(0)';
  clone.style.setProperty('--hx',cx+'px');
  clone.style.setProperty('--hy',cy+'px');
  clone.style.setProperty('--hole','0px');
  clone.querySelectorAll('canvas').forEach(c=>{c.style.visibility='hidden'});
  clone.querySelectorAll('.snack,.overlay').forEach(s=>s.remove());
  const maskVal='radial-gradient(circle var(--hole) at var(--hx) var(--hy), transparent var(--hole), #000 var(--hole))';
  clone.style.mask=maskVal;
  clone.style.webkitMask=maskVal;

  document.body.appendChild(clone);
  clone.scrollTop=sy;
  apply();

  const maxR=Math.ceil(Math.hypot(window.innerWidth,window.innerHeight)*1.12);
  const dur=520, t0=performance.now();
  function frame(t){
    const p=Math.min((t-t0)/dur,1);
    const e=1+2.70158*Math.pow(p-1,3)+1.70158*Math.pow(p-1,2);
    clone.style.setProperty('--hole',Math.round(maxR*e)+'px');
    if(p<1) requestAnimationFrame(frame);
    else { clone.remove(); themeBusy=false; }
  }
  requestAnimationFrame(frame);
});

/* 上传 */
const drop=$('drop');
drop.addEventListener('click',()=>$('fileInput').click());
drop.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('drag')});
drop.addEventListener('dragleave',()=>drop.classList.remove('drag'));
drop.addEventListener('drop',e=>{
  e.preventDefault();drop.classList.remove('drag');
  const f=e.dataTransfer.files[0]; if(f) loadZip(f);
});
$('fileInput').addEventListener('change',e=>{ if(e.target.files[0]) loadZip(e.target.files[0]); });

function esc(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function softBreak(s){ return esc(s).replace(/(.{8})/g,'$1<wbr>'); }

async function loadZip(file){
  if(!window.JSZip){ toast('JSZip 没加载，检查网络'); return; }
  fileName=file.name;
  $('dropTitle').textContent='解析中…';
  try{
    const buf=await file.arrayBuffer();
    zipData=await JSZip.loadAsync(buf);
    animInfo=await parseZip(zipData);
    renderSummary();
    $('processBtn').disabled=false;
    $('dropTitle').innerHTML=softBreak(file.name);
    $('dropHint').textContent='点这里可以换一个';
    toast('解析完成，共 '+animInfo.totalFrames+' 帧');
  }catch(err){
    console.error(err);
    $('dropTitle').textContent='这个包读不了';
    $('dropHint').textContent=err.message;
  }
}

async function parseZip(zip){
  const names=Object.keys(zip.files);
  const isDir=n=>zip.files[n].dir;
  const descEntry=names.find(n=>!isDir(n)&&n.toLowerCase().endsWith('desc.txt'));
  if(!descEntry) throw new Error('找不到 desc.txt');
  const descRaw=await zip.files[descEntry].async('string');
  let W=960,H=2142,fps=60; const segs=[];
  for(const ln of descRaw.split(/\r?\n/)){
    const s=ln.trim(); if(!s||s.startsWith('#')) continue;
    const t=s.split(/\s+/);
    if(t[0]==='g'&&t.length>=6){W=+t[1];H=+t[2];fps=+t[5];}
    else if(/^\d+$/.test(t[0])&&t.length>=3){W=+t[0];H=+t[1];fps=+t[2];}
    else if(['p','c','f'].includes(t[0])&&t.length>=4) segs.push(t.slice(0,4));
  }
  const pmap={};
  for(const n of names){
    const m=n.match(/^(.*\/)?(part\d+)\/(.+)$/i);
    if(m&&!isDir(n))(pmap[m[2].toLowerCase()]=pmap[m[2].toLowerCase()]||[]).push({name:n,leaf:m[3]});
  }
  const parts=[];
  for(const k of Object.keys(pmap)){
    const fs=pmap[k];
    const hasTrim=fs.some(f=>f.leaf.toLowerCase()==='trim.txt');
    const pngs=fs.filter(f=>/\.png$/i.test(f.leaf)).sort((a,b)=>numOf(a.leaf)-numOf(b.leaf));
    parts.push({name:k,files:fs,pngs,hasTrim});
  }
  parts.sort((a,b)=>numOf(a.name)-numOf(b.name));
  for(const p of parts){
    if(p.hasTrim){
      const tf=p.files.find(f=>f.leaf.toLowerCase()==='trim.txt');
      const txt=await zip.files[tf.name].async('string');
      p.trimLines=txt.split(/\r?\n/).filter(l=>/^\d+x\d+\+\d+\+\d+$/.test(l.trim()));
    }
  }
  return {W,H,fps,segs,descRaw,parts,totalFrames:parts.reduce((s,p)=>s+p.pngs.length,0)};
}
function numOf(n){const m=n.match(/(\d+)/);return m?+m[0]:0}

function renderSummary(){
  const a=animInfo;
  const trimN=a.parts.filter(p=>p.hasTrim).length;
  $('summary').style.display='block';
  $('fname').innerHTML=softBreak(fileName);
  $('meta').innerHTML=
    '<span>'+a.W+'×'+a.H+' · '+a.fps+'fps · '+a.parts.length+' 段 · '+a.totalFrames+' 帧</span>'+
    '<span class="'+(trimN?'tag':'tag off')+'">'+(trimN?('trim ×'+trimN):'无 trim')+'</span>';
  $('setW').value=a.W; $('setH').value=a.H;
  const sel=$('previewPart');
  sel.innerHTML='<option value="__all__">全部动画（按顺序播放）</option>';
  a.parts.forEach(p=>{const o=document.createElement('option');o.value=p.name;o.textContent=p.name+' · '+p.pngs.length+' 帧';sel.appendChild(o);});
}

/* ===== HSV 取色面板 ===== */
const svCv=$('svCanvas'), hueCv=$('hueCanvas');
const svCtx=svCv.getContext('2d'), hueCtx=hueCv.getContext('2d');
const SV_W=svCv.width, SV_H=svCv.height, HUE_W=hueCv.width;
let pickH=0, pickS=0, pickV=0.5;
function closePicker(){ $('pickerOverlay').style.display='none'; }

function hsvToHex(h,s,v){
  h=(h%360+360)%360; s=Math.max(0,Math.min(1,s)); v=Math.max(0,Math.min(1,v));
  const c=v*s, x=c*(1-Math.abs((h/60)%2-1)), m=v-c;
  let r,g,b;
  if(h<60){r=c;g=x;b=0}else if(h<120){r=x;g=c;b=0}else if(h<180){r=0;g=c;b=x}
  else if(h<240){r=0;g=x;b=c}else if(h<300){r=x;g=0;b=c}else{r=c;g=0;b=x}
  r=Math.round((r+m)*255); g=Math.round((g+m)*255); b=Math.round((b+m)*255);
  return '#'+((1<<24)|(r<<16)|(g<<8)|b).toString(16).slice(1);
}
function hexToHsv(hex){
  const h=hex.replace('#',''); const v=parseInt(h.length===3?h.split('').map(c=>c+c).join(''):h,16);
  const r=(v>>16&255)/255, g=(v>>8&255)/255, b=(v&255)/255;
  const max=Math.max(r,g,b), min=Math.min(r,g,b), d=max-min;
  let hh=0;
  if(d!==0){
    if(max===r) hh=((g-b)/d)%6;
    else if(max===g) hh=(b-r)/d+2;
    else hh=(r-g)/d+4;
    hh*=60; if(hh<0) hh+=360;
  }
  return {h:hh, s:max===0?0:d/max, v:max};
}
function drawSV(){
  svCtx.fillStyle='hsl('+pickH+',100%,50%)';
  svCtx.fillRect(0,0,SV_W,SV_H);
  let g=svCtx.createLinearGradient(0,0,SV_W,0);
  g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(1,'rgba(255,255,255,0)');
  svCtx.fillStyle=g; svCtx.fillRect(0,0,SV_W,SV_H);
  g=svCtx.createLinearGradient(0,0,0,SV_H);
  g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(1,'rgba(0,0,0,1)');
  svCtx.fillStyle=g; svCtx.fillRect(0,0,SV_W,SV_H);
  const x=pickS*SV_W, y=(1-pickV)*SV_H;
  svCtx.beginPath(); svCtx.arc(x,y,7,0,Math.PI*2);
  svCtx.strokeStyle='#fff'; svCtx.lineWidth=2.5; svCtx.stroke();
  svCtx.beginPath(); svCtx.arc(x,y,7,0,Math.PI*2);
  svCtx.strokeStyle='rgba(0,0,0,.5)'; svCtx.lineWidth=1; svCtx.stroke();
}
function drawHue(){
  const g=hueCtx.createLinearGradient(0,0,HUE_W,0);
  const stops=['#FF0000','#FFFF00','#00FF00','#00FFFF','#0000FF','#FF00FF','#FF0000'];
  stops.forEach((c,i)=>g.addColorStop(i/(stops.length-1),c));
  hueCtx.fillStyle=g; hueCtx.fillRect(0,0,HUE_W,16);
  const x=pickH/360*HUE_W;
  hueCtx.beginPath(); hueCtx.arc(x,8,6,0,Math.PI*2);
  hueCtx.strokeStyle='#fff'; hueCtx.lineWidth=2; hueCtx.stroke();
}
function syncPickerUI(){
  const hex=hsvToHex(pickH,pickS,pickV);
  $('pickerHex').value=hex;
  $('pickerCur').style.background=hex;
  drawSV(); drawHue();
}
function applySV(ev){
  const r=svCv.getBoundingClientRect();
  const x=Math.max(0,Math.min(1,(ev.clientX-r.left)/r.width));
  const y=Math.max(0,Math.min(1,(ev.clientY-r.top)/r.height));
  pickS=x; pickV=1-y; syncPickerUI();
}
function applyHue(ev){
  const r=hueCv.getBoundingClientRect();
  const x=Math.max(0,Math.min(1,(ev.clientX-r.left)/r.width));
  pickH=x*360; syncPickerUI();
}
function dragBind(cv,fn){
  cv.addEventListener('pointerdown',e=>{ cv.setPointerCapture(e.pointerId); fn(e); });
  cv.addEventListener('pointermove',e=>{ if(e.buttons&1) fn(e); });
}
dragBind(svCv,applySV);
dragBind(hueCv,applyHue);

$('swatch').addEventListener('click',()=>{
  $('pickerOverlay').style.display='flex';
  if(currentHex){ const h=hexToHsv(currentHex); pickH=h.h; pickS=h.s; pickV=h.v; }
  else { pickH=0; pickS=0; pickV=0.5; }
  syncPickerUI();
});
$('pickerDone').addEventListener('click',()=>{
  const hex=$('pickerHex').value;
  if(/^#[0-9a-fA-F]{6}$/.test(hex)) commitColor(hex);
  closePicker();
});
$('pickerOverlay').addEventListener('click',e=>{ if(e.target===$('pickerOverlay')) closePicker(); });
$('pickerHex').addEventListener('input',()=>{
  const v=$('pickerHex').value;
  if(/^#[0-9a-fA-F]{6}$/.test(v)){ const h=hexToHsv(v); pickH=h.h; pickS=h.s; pickV=h.v; syncPickerUI(); }
});
function commitColor(hex){
  currentHex=hex.toLowerCase();
  $('colorHex').value=currentHex;
  $('swatch').style.background=currentHex;
}
$('colorHex').addEventListener('input',()=>{
  const v=$('colorHex').value;
  if(/^#[0-9a-fA-F]{6}$/.test(v)) commitColor(v);
});

/* 背景色行：纯 grid 平滑折叠 */
function syncBgRow(){
  const show=!$('autoBg').checked, wrap=$('bgRowWrap');
  if(!show) closePicker();
  wrap.classList.toggle('open',show);
}
syncBgRow();
$('autoBg').addEventListener('change',()=>{
  closePicker();
  syncBgRow();
});

async function detectBg(entry){
  const blob=await zipData.files[entry.name].async('blob');
  const bmp=await createImageBitmap(blob);
  const c=document.createElement('canvas'); c.width=bmp.width;c.height=bmp.height;
  const cx=c.getContext('2d',{willReadFrequently:true}); cx.drawImage(bmp,0,0);
  const w=bmp.width,h=bmp.height;
  const pts=[cx.getImageData(0,0,1,1).data,cx.getImageData(w-1,0,1,1).data,cx.getImageData(0,h-1,1,1).data,cx.getImageData(w-1,h-1,1,1).data];
  bmp.close();
  const cnt={}; pts.forEach(d=>{const k=[d[0],d[1],d[2],d[3]].join(',');cnt[k]=(cnt[k]||0)+1;});
  const top=Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0][0].split(',').map(Number);
  return {r:top[0],g:top[1],b:top[2],a:top[3]};
}
function hex2rgba(h){
  const v=(h.replace('#','').length===3?h.replace('#','').split('').map(c=>c+c).join(''):h.replace('#',''));
  return {r:parseInt(v.slice(0,2),16),g:parseInt(v.slice(2,4),16),b:parseInt(v.slice(4,6),16),a:255};
}

/* 处理 */
$('processBtn').addEventListener('click',processZip);
async function processZip(){
  if(!zipData||!animInfo) return;
  const btn=$('processBtn'); btn.disabled=true;
  $('progress').classList.add('show'); stopPlay();
  try{
    const W=Math.max(1,+$('setW').value||animInfo.W);
    const H=Math.max(1,+$('setH').value||animInfo.H);
    /* 自定义分辨率：等比缩放 + 居中，边缘用背景色兜底，画面不变形 */
    const scale=Math.min(W/animInfo.W,H/animInfo.H);
    const ox=(W-animInfo.W*scale)/2, oy=(H-animInfo.H*scale)/2;
    const fillTrans=$('transBlack').checked;
    const useColoros=$('colorosDesc').checked;
    let bg={r:0,g:0,b:0,a:255};
    if($('autoBg').checked){
      const p0=animInfo.parts.find(p=>p.pngs.length)||animInfo.parts[0];
      if(p0) bg=await detectBg(zipData.files[p0.pngs[0].name]);
    } else bg=hex2rgba(currentHex||'#000000');
    $('swatch').style.background='rgb('+bg.r+','+bg.g+','+bg.b+')';
    let descOut;
    if(useColoros){
      descOut='g '+W+' '+H+' 0 0 '+animInfo.fps+'\n';
      animInfo.segs.forEach(s=>{descOut+='c '+s[1]+' '+s[2]+' '+s[3]+'\n';});
    } else {
      /* 非 ColorOS：保留原格式，只把第一行尺寸换成新值，保证 desc 与画面一致 */
      descOut=animInfo.descRaw.split(/\r?\n/).map(ln=>{
        const s=ln.trim();
        if(!s||s.startsWith('#')) return ln;
        const t=s.split(/\s+/);
        if(t[0]==='g'&&t.length>=6) return 'g '+W+' '+H+' '+t[3]+' '+t[4]+' '+t[5];
        if(/^\d+$/.test(t[0])&&t.length>=3) return W+' '+H+' '+t[2];
        return ln;
      }).join('\n');
    }
    const out=new JSZip(); out.file('desc.txt',descOut);
    previewFrames={};
    let done=0; const total=animInfo.totalFrames;
    const upd=()=>{ $('progressFill').style.width=(done/total*100)+'%'; $('progressPct').textContent=Math.round(done/total*100)+'%'; $('progressText').textContent='处理中 '+done+' / '+total; };
    for(const part of animInfo.parts){
      previewFrames[part.name]=[];
      for(const f of part.files){
        const leaf=f.leaf.toLowerCase();
        if(leaf==='trim.txt') continue;
        const blob=await zipData.files[f.name].async('blob');
        if(leaf==='audio.wav'){ out.file(part.name+'/'+f.leaf,blob,{compression:'STORE'}); continue; }
        if(!/\.png$/i.test(leaf)) continue;
        const idx=part.pngs.indexOf(f);
        const line=part.hasTrim&&part.trimLines&&part.trimLines[idx]?part.trimLines[idx].trim():null;
        if(line){
          const m=line.match(/^(\d+)x(\d+)\+(\d+)\+(\d+)$/);
          if(!m){ out.file(part.name+'/'+f.leaf,blob,{compression:'STORE'}); done++; continue; }
          const [, , , tx, ty]=m.map(Number);
          const bmp=await createImageBitmap(blob);
          /* 绘制尺寸以 PNG 实际尺寸为准：trim 行的 WxH 在部分包里写的是完整画布尺寸而非裁剪图尺寸 */
          const pngW=bmp.width, pngH=bmp.height;
          const cv=document.createElement('canvas'); cv.width=W; cv.height=H;
          const cx=cv.getContext('2d');
          cx.fillStyle='rgba('+bg.r+','+bg.g+','+bg.b+','+(bg.a/255)+')';
          cx.fillRect(0,0,W,H);
          /* trim 坐标跟着新画布一起缩放平移，图片尺寸按同一比例缩放 */
          cx.drawImage(bmp,tx*scale+ox,ty*scale+oy,pngW*scale,pngH*scale);
          bmp.close();
          if(fillTrans){
            const id=cx.getImageData(0,0,W,H), d=id.data;
            for(let i=3;i<d.length;i+=4){ if(d[i]===0){ d[i-3]=bg.r; d[i-2]=bg.g; d[i-1]=bg.b; d[i]=255; } }
            cx.putImageData(id,0,0);
          }
          const outBlob=await new Promise(r=>cv.toBlob(r,'image/png'));
          out.file(part.name+'/'+f.leaf,outBlob,{compression:'STORE'});
          previewFrames[part.name].push(cv);
        }else{
          out.file(part.name+'/'+f.leaf,blob,{compression:'STORE'});
          const bmp=await createImageBitmap(blob);
          const cv=document.createElement('canvas'); cv.width=W; cv.height=H;
          const cx=cv.getContext('2d');
          /* 完整帧也按同一比例缩放居中，边缘用背景色兜底 */
          cx.fillStyle='rgba('+bg.r+','+bg.g+','+bg.b+','+(bg.a/255)+')';
          cx.fillRect(0,0,W,H);
          cx.drawImage(bmp,ox,oy,animInfo.W*scale,animInfo.H*scale);
          bmp.close();
          previewFrames[part.name].push(cv);
        }
        done++;
        if(done%4===0){ upd(); await sleep(0); }
      }
    }
    upd(); $('progressText').textContent='打包中…';
    const blob=await out.generateAsync({type:'blob',compression:'STORE'},m=>{ $('progressPct').textContent=Math.round(m.percent)+'%'; });
    $('downloadBtn').style.display='';
    $('downloadBtn').dataset.url=URL.createObjectURL(blob);
    $('previewEmpty').style.display='none';
    $('stageWrap').style.display='flex';
    $('controls').style.display='flex';
    $('previewPart').disabled=false; $('playBtn').disabled=false;
    curPart=$('previewPart').value;
    if(curPart!=='__all__'&&previewFrames[curPart]&&previewFrames[curPart][0]) renderFrame(previewFrames[curPart][0]);
    toast('完成，'+total+' 帧全部还原');
  }catch(err){
    console.error(err); toast('处理失败：'+err.message);
  }finally{
    btn.disabled=false;
    setTimeout(()=>$('progress').classList.remove('show'),500);
  }
}

$('downloadBtn').addEventListener('click',()=>{
  const a=document.createElement('a');
  a.href=$('downloadBtn').dataset.url;
  a.download=$('outName').value.trim()||'bootanimation_new.zip';
  document.body.appendChild(a);a.click();a.remove();
  toast('开始下载');
});

/* 预览 */
$('previewPart').addEventListener('change',e=>{
  curPart=e.target.value; stopPlay();
  if(curPart!=='__all__'&&previewFrames[curPart]&&previewFrames[curPart][0]) renderFrame(previewFrames[curPart][0]);
});
$('playBtn').addEventListener('click',()=>playing?stopPlay():startPlay());

function buildSeq(){
  const out=[];
  for(const seg of animInfo.segs){
    const name=seg[3];
    const p=animInfo.parts.find(x=>x.name.toLowerCase()===name.toLowerCase());
    if(!p) continue;
    const frames=previewFrames[p.name];
    if(!frames||!frames.length) continue;
    out.push({name, frames, count:parseInt(seg[1])||0, pause:parseInt(seg[2])||0});
  }
  return out;
}
function startPlay(){
  if(!previewFrames||!Object.keys(previewFrames).length) return;
  playing=true; $('icPlay').style.display='none'; $('icPause').style.display='block';
  const fps=Math.min(animInfo.fps||30,60);
  const stepMs=()=>1000/fps;
  if(curPart==='__all__'){
    seq=buildSeq(); sIdx=0; fIdx=0; rIdx=0; pauseLeft=0;
    if(!seq.length){ stopPlay(); return; }
    const stepAll=()=>{
      if(!playing) return;
      const s=seq[sIdx];
      if(pauseLeft>0){ pauseLeft--; renderFrame(s.frames[Math.min(fIdx-1,s.frames.length-1)]); timer=setTimeout(stepAll,stepMs()); return; }
      if(fIdx<s.frames.length){ renderFrame(s.frames[fIdx]); fIdx++; timer=setTimeout(stepAll,stepMs()); return; }
      rIdx++;
      if(rIdx<(s.count||1)){ fIdx=0; timer=setTimeout(stepAll,stepMs()); return; }
      pauseLeft=s.pause; sIdx=(sIdx+1)%seq.length; rIdx=0; fIdx=0;
      timer=setTimeout(stepAll,stepMs());
    };
    stepAll();
  }else{
    const frames=previewFrames[curPart];
    if(!frames||!frames.length){ stopPlay(); return; }
    let i=0;
    const step=()=>{ if(!playing) return; renderFrame(frames[i]); i=(i+1)%frames.length; timer=setTimeout(step,stepMs()); };
    step();
  }
}
function stopPlay(){ playing=false; clearTimeout(timer); $('icPlay').style.display='block'; $('icPause').style.display='none'; }
function renderFrame(cv){ if(!cv) return; const c=$('previewCanvas'); c.width=cv.width; c.height=cv.height; c.getContext('2d').drawImage(cv,0,0); }
})();
