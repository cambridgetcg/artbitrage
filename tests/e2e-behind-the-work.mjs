// A material history chapter remains readable as a document. All requests are local fixtures.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { Script } from 'node:vm';
import { withBrowser, until, origin } from './helpers/browser.mjs';

const root=new URL('../',import.meta.url);
const read=file=>readFileSync(new URL(file,root),'utf8');
const html=read('behind-the-work.html');
const script=read('behind-the-work.js');
const gallery=read('visit.html');
const works=JSON.parse(read('assets/visit/works.json'));
const colours=['ultramarine','cochineal','mauveine'];
const sections=['wave','seurat','jar','colour','care'];
const contexts={water:'seurat','hokusai-great-wave':'wave',form:'jar'};
const imagePaths=[...new Set([...html.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)].map(match=>match[1].replace(/^\//,'')))];
assert.ok(imagePaths.length>=3,'the chapter uses existing artworks');
for(const file of ['behind-the-work.html','behind-the-work.css','behind-the-work.js',...imagePaths]){
  assert.deepEqual(readFileSync(new URL(file,root)),readFileSync(new URL(`dist/${file}`,root)),`${file} deploy mirror`);
}
for(const path of imagePaths)assert.ok(works.some(work=>work.image===`/${path}`),`${path} has an existing gallery credit`);
for(const id of [...sections,...colours])assert.ok(html.includes(`id="${id}"`),`${id} is a static destination`);
assert.match(html,/<[^>]+id="colour-story-controls"[^>]*\bhidden\b/);
assert.doesNotMatch(html,/<(?:audio|video|iframe)\b|\bautoplay\b/i);
new Script(script);
assert.doesNotMatch(script,/\b(?:fetch|XMLHttpRequest|WebSocket|sendBeacon|AudioContext|localStorage|sessionStorage)\b/);

function localTarget(href,from){
  const target=new URL(href.replaceAll('&amp;','&'),`${origin}/${from}`);
  assert.ok(['http:','https:'].includes(target.protocol),`${from} has a navigable link: ${href}`);
  if(target.origin!==origin){assert.equal(target.protocol,'https:',`${href} is a secure source link`);return;}
  const path=decodeURIComponent(target.pathname).replace(/^\//,'');
  const file=!path?'index.html':path.includes('.')?path:`${path}.html`;
  assert.ok(existsSync(new URL(file,root)),`${from}: ${href} resolves to a local file`);
  if(target.hash){
    const id=decodeURIComponent(target.hash.slice(1));
    assert.ok(read(file).includes(`id="${id}"`),`${from}: ${href} has a real destination anchor`);
  }
}
for(const match of html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g))localTarget(match[1],'behind-the-work.html');
for(const file of ['visit.html','index.html','map.html','pigments.html']){
  const source=read(file);
  const entries=[...source.matchAll(/<a\b[^>]*\bhref="([^"]*behind-the-work[^\"]*)"/g)];
  assert.ok(entries.length,`${file} has an entry into the chapter`);
  for(const match of entries)localTarget(match[1],file);
  assert.equal(read(`dist/${file}`),source,`${file} integration deploy mirror`);
}
const map=JSON.parse(read('map.json'));
assert.equal(map.groups.flatMap(group=>group.rooms).filter(room=>room.path==='/behind-the-work').length,1);
assert.equal(read('sitemap.xml').split('<loc>https://artbitrage.io/behind-the-work</loc>').length-1,1);
assert.ok(process.argv.slice(2).every(arg=>arg==='--browser'));
console.log('behind-the-work static checks passed: chapter and artwork mirrors, static story anchors, local sources/context routes and visitor entries');
if(!process.argv.includes('--browser'))process.exit(0);

const fixtures=new Set(['behind-the-work.css','behind-the-work.js','visit.css','visit.js','breathing.css','breathing.js',...works.map(work=>work.image.slice(1)),...imagePaths]);
const route=url=>{
  const path=url.pathname.slice(1);
  if(!fixtures.has(path))return null;
  return {type:path.endsWith('.css')?'text/css':path.endsWith('.js')?'text/javascript':'image/jpeg',body:readFileSync(new URL(path,root))};
};
const init=`window.__playCalls=0;HTMLMediaElement.prototype.play=function(){window.__playCalls++;return Promise.reject(new Error('No audio in chapter tests'));};HTMLMediaElement.prototype.pause=function(){};window.AudioContext=window.webkitAudioContext=class{constructor(){throw new Error('No realtime audio in chapter tests');}};`;

await withBrowser('behind-the-work',async b=>{
  const {load,evaluate,viewport,media,send,click,shot,requests}=b;
  const press=async(key,code)=>{await send('Input.dispatchKeyEvent',{type:'keyDown',key,windowsVirtualKeyCode:code});await send('Input.dispatchKeyEvent',{type:'keyUp',key,windowsVirtualKeyCode:code});};
  const selected=async id=>{
    assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('.colour-story')).filter(el=>!el.hidden&&getComputedStyle(el).display!=='none').map(el=>el.id)`),[id]);
    assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('[data-colour][aria-pressed="true"]'),el=>el.dataset.colour)`),[id]);
    assert.equal(await evaluate(`document.querySelector('#colour-stage').dataset.colour`),id);
  };
  const targets=async()=>{
    const state=await evaluate(`({width:innerWidth,scroll:document.documentElement.scrollWidth,bad:Array.from(document.querySelectorAll('a,button,summary')).filter(el=>el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden').filter(el=>{const r=el.getBoundingClientRect();return r.top<innerHeight&&r.bottom>0&&(r.height<44||r.width<44);}).map(el=>({text:el.textContent.trim(),height:el.getBoundingClientRect().height,width:el.getBoundingClientRect().width}))})`);
    assert.ok(state.scroll<=state.width+1,`page fits ${state.width}px`);
    assert.deepEqual(state.bad,[],`visible controls have 44px targets at ${state.width}px`);
  };
  const chapter=()=>load({html,path:'/behind-the-work',route,init});
  await chapter();
  assert.equal(await evaluate(`document.querySelector('#colour-story-controls').hidden`),false);
  await selected('ultramarine');
  assert.equal(await evaluate(`document.querySelectorAll('#colour-story-controls button[data-colour]').length`),3);
  assert.equal(await evaluate(`document.querySelectorAll('#colour-stage img').length`),0,'screen colour illustrations do not alter an artwork');
  await shot('chapter-arrival-desktop');
  const nonImages=()=>requests.filter(request=>request.resourceType!=='Image'&&new URL(request.url).pathname!=='/favicon.ico').length;
  const before=nonImages();
  for(const id of colours){await click(`[data-colour="${id}"]`);await selected(id);assert.equal(await evaluate('location.hash'),`#${id}`);}
  assert.equal(nonImages(),before,'colour choices require no API or document requests');
  await evaluate(`document.querySelector('[data-colour="cochineal"]').focus()`);await press(' ',32);await selected('cochineal');
  assert.equal(await evaluate(`document.activeElement.dataset.colour`),'cochineal');
  await press('Tab',9);
  assert.equal(await evaluate(`document.activeElement.dataset.colour`),'mauveine');
  assert.ok(await evaluate(`document.activeElement.matches(':focus-visible')&&parseFloat(getComputedStyle(document.activeElement).outlineWidth)>=2`));
  await press(' ',32);await selected('mauveine');
  assert.ok(await evaluate(`document.querySelectorAll('details.care-step').length>=3`));
  const details=await evaluate(`Array.from(document.querySelectorAll('details'),(element,index)=>({element,index})).filter(({element})=>element.getClientRects().length).map(({index})=>index)`);
  for(const index of details){
    const wasOpen=await evaluate(`document.querySelectorAll('details')[${index}].open`);
    await evaluate(`document.querySelectorAll('details')[${index}].querySelector('summary').focus()`);
    await press(' ',32);assert.equal(await evaluate(`document.querySelectorAll('details')[${index}].open`),!wasOpen);
    assert.ok(await evaluate(`document.querySelectorAll('details')[${index}].textContent.trim().length>40`));
    await press(' ',32);assert.equal(await evaluate(`document.querySelectorAll('details')[${index}].open`),wasOpen);
  }
  const direct=async hash=>{
    await evaluate(`history.replaceState(null,'',${JSON.stringify('/behind-the-work')}+${JSON.stringify(hash)});window.__beforeReload=true`);
    await send('Page.reload');
    await until(()=>evaluate(`!window.__beforeReload&&document.readyState==='complete'&&!document.querySelector('#colour-story-controls').hidden`),'direct colour story loads');
  };
  for(const id of colours){await direct(`#${id}`);await selected(id);}
  for(const hash of ['#unknown-colour','#%3Cimg%20src=x%20onerror=alert(1)%3E','#cochineal%00']){
    await direct(hash);
    await selected('ultramarine');assert.equal(await evaluate(`document.querySelectorAll('[onerror]').length`),0);
  }
  for(const width of [320,390,601,768,1024,1440]){
    await viewport(width,900,width<600);
    for(const id of ['top',...sections]){
      await evaluate(id==='top'?`scrollTo({top:0,behavior:'instant'})`:`document.getElementById('${id}').scrollIntoView({block:'start',behavior:'instant'})`);
      await targets();
      if(width===390&&id==='top')await shot('chapter-arrival-mobile');
      if(width===390&&id==='colour')await shot('colour-biography-mobile');
    }
  }
  await viewport(1440,1000);await evaluate(`document.querySelector('#wave').scrollIntoView({behavior:'instant'})`);await shot('work-and-labour-desktop');
  await evaluate(`document.querySelector('#colour').scrollIntoView({behavior:'instant'})`);await shot('colour-biography-desktop');
  await media([{name:'prefers-reduced-motion',value:'reduce'}]);
  assert.equal(await evaluate(`getComputedStyle(document.documentElement).scrollBehavior`),'auto');
  assert.equal(await evaluate(`document.getAnimations().filter(animation=>animation.playState==='running').length`),0);
  await click('[data-colour="cochineal"]');await selected('cochineal');
  for(const image of imagePaths){
    await evaluate(`document.querySelector('img[src="/${image}"],img[src="${image}"]').scrollIntoView({block:'center',behavior:'instant'})`);
    await until(()=>evaluate(`Array.from(document.images).filter(image=>new URL(image.src).pathname===${JSON.stringify(`/${image}`)}).every(image=>image.complete&&image.naturalWidth>0&&(image.alt.trim()||image.closest('[aria-hidden="true"]')))`),'chapter artwork loads with a description or is decorative');
  }

  await viewport(1440,1000);await load({html:gallery,path:'/visit',route,init});
  const inline=await evaluate(`Array.from(document.querySelectorAll('[data-behind-work]'),link=>({work:link.closest('.exhibit').querySelector('[data-art]').dataset.art,href:link.getAttribute('href')}))`);
  assert.deepEqual(inline.map(link=>link.work).sort(),Object.keys(contexts).sort());
  for(const link of inline)assert.equal(link.href,`/behind-the-work#${contexts[link.work]}`);
  for(const work of works){
    await click(`.artwork-view[data-art="${work.id}"]`);
    const link=await evaluate(`({href:document.querySelector('#viewer-behind').getAttribute('href'),label:document.querySelector('#viewer-behind').textContent,source:document.querySelector('#viewer-source').href})`);
    assert.equal(link.href,`/behind-the-work#${contexts[work.id]||'care'}`);
    assert.equal(link.label,contexts[work.id]?'Behind this work ↗':'Making & caring for art ↗');assert.equal(link.source,work.source,'the contextual chapter keeps the museum source');
    await click('#art-viewer .dialog-close');await until(()=>evaluate(`!document.querySelector('#art-viewer').open`),'artwork viewer closes');
  }
  const viewerIssues=[];
  for(const [width,height] of [[320,568],[390,700],[844,390]]){
    await viewport(width,height,width<600);
    for(const id of ['water','cycladic-figure']){
      await click(`.artwork-view[data-art="${id}"]`);
      await until(()=>evaluate(`document.querySelector('#viewer-image').complete&&document.querySelector('#viewer-image').naturalWidth>0`),'viewer artwork loads');
      const layout=await evaluate(`(()=>{const dialog=document.querySelector('#art-viewer'),image=document.querySelector('#viewer-image'),r=image.getBoundingClientRect(),style=getComputedStyle(image);return{imageHeight:r.height-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom),scroll:dialog.scrollWidth,width:dialog.clientWidth,controls:Array.from(dialog.querySelectorAll('button,a')).filter(el=>el.getClientRects().length).map(el=>{const r=el.getBoundingClientRect();return{id:el.id||el.className,top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height,width:r.width};})};})()`);
      if(layout.imageHeight<80)viewerIssues.push({work:id,width,height,imageHeight:layout.imageHeight});
      assert.ok(layout.scroll<=layout.width+1,`viewer fits ${width}×${height}`);
      for(const control of layout.controls){
        assert.ok(control.width>=44&&control.height>=44,`${control.id} has a 44px target at ${width}×${height}`);
        assert.ok(control.left>=-1&&control.right<=width+1&&control.top>=-1&&control.bottom<=height+1,`${control.id} is not clipped at ${width}×${height}`);
      }
      if(id==='cycladic-figure')await shot(`viewer-context-${width}x${height}`);
      await click('#art-viewer .dialog-close');
    }
  }
  assert.equal(await evaluate('__playCalls'),0);
  await send('Emulation.setScriptExecutionDisabled',{value:true});await chapter();
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('#colour-story-controls')).display`),'none');
  assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('.colour-story')).filter(el=>!el.hidden&&getComputedStyle(el).display!=='none').map(el=>el.id)`),colours);
  for(const id of sections)assert.ok(await evaluate(`document.getElementById('${id}').getBoundingClientRect().height>0`));
  await viewport(320,900,true);
  for(const id of ['top',...sections,...colours]){
    await evaluate(id==='top'?`scrollTo({top:0,behavior:'instant'})`:`document.getElementById('${id}').scrollIntoView({block:'start',behavior:'instant'})`);await targets();
  }
  await evaluate(`document.querySelectorAll('.care-step summary')[1].focus()`);await press(' ',32);
  assert.equal(await evaluate(`document.querySelectorAll('.care-step')[1].open`),true,'native preservation details work without JavaScript');
  await shot('preservation-nojs-320');
  await load({html:gallery,path:'/visit',route});
  assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('[data-behind-work]'),link=>link.getAttribute('href'))`),inline.map(link=>link.href));
  assert.ok(requests.every(request=>new URL(request.url).origin===origin));
  assert.ok(!requests.some(request=>/\/api\/|\.(?:mp3|wav)(?:$|\?)/.test(new URL(request.url).pathname)),'the chapter and context links do not request APIs or sound');
  assert.deepEqual(viewerIssues,[],'short viewers retain at least80px of artwork above the three actions');
  console.log('behind-the-work browser passed: three colour biographies, direct and malformed hashes, keyboard details, source/context links for all fifteen works, 320–1440px, reduced motion, and complete no-JavaScript stories');
});
