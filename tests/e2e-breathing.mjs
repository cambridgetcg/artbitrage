// Deterministic phase timing, then gallery integration. No sound is output.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { withBrowser, until, origin } from './helpers/browser.mjs';

const root=new URL('../',import.meta.url);
const page=readFileSync(new URL('visit.html',root),'utf8');
const breathing=readFileSync(new URL('breathing.js',root),'utf8');
const works=JSON.parse(readFileSync(new URL('assets/visit/works.json',root),'utf8'));
for(const file of ['breathing.js','breathing.css','visit.html','visit.js','visit.css','assets/visit/works.json'])assert.deepEqual(readFileSync(new URL(file,root)),readFileSync(new URL(`dist/${file}`,root)),`${file} deploy mirror`);
assert.equal(works.length,15);
assert.equal(new Set(works.map(work=>work.id)).size,15);
for(const work of works){
  assert.match(work.image,/^\/assets\/(?:welcome|visit|guide)\/[a-z0-9-]+\.jpg$/);
  assert.match(work.source,/^https:\/\/www\.artic\.edu\/artworks\/\d+$/);
  assert.ok(work.title&&work.maker&&work.alt&&['water','dusk','form','poems','colour'].includes(work.room));
}
assert.doesNotMatch(breathing,/\b(?:fetch|AudioContext|Audio|localStorage|sessionStorage)\b/);
assert.ok(process.argv.slice(2).every(arg=>arg==='--browser'));
console.log('breathing static checks passed: shared assets mirrored, fifteen bounded artwork records, guide has no audio/network API');
if(!process.argv.includes('--browser'))process.exit(0);

const files=new Set(['breathing.js','breathing.css','visit.js','visit.css',...works.map(work=>work.image.slice(1))]);
const route=url=>{const path=url.pathname.slice(1);return files.has(path)?{type:path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'image/jpeg',body:readFileSync(new URL(path,root))}:null;};
const init=`(() => {
  const originalSet=setTimeout.bind(window),originalClear=clearTimeout.bind(window);
  let id=-1000;const phases=window.__phaseTimers=new Map();
  window.setTimeout=(callback,delay,...args)=>{
    if(delay===4000||delay===7000){const key=id--;phases.set(key,{delay,run:()=>callback(...args)});return key;}
    return originalSet(callback,delay,...args);
  };
  window.clearTimeout=key=>{if(phases.has(key))phases.delete(key);else originalClear(key);};
  window.__firePhase=()=>{const next=phases.entries().next().value;if(!next)throw new Error('No breathing phase scheduled');phases.delete(next[0]);next[1].run();};
  window.__ready=[];document.addEventListener('breathing-ready',event=>__ready.push(event.target.id));
  window.__setHidden=hidden=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>hidden});document.dispatchEvent(new Event('visibilitychange'));};
  const audio=window.__audio={plays:0,pauses:0,paused:true,time:0};
  Object.defineProperty(HTMLMediaElement.prototype,'paused',{configurable:true,get(){return audio.paused;}});
  Object.defineProperty(HTMLMediaElement.prototype,'currentTime',{configurable:true,get(){return audio.time;},set(value){audio.time=value;}});
  HTMLMediaElement.prototype.play=function(){audio.plays++;audio.paused=false;this.dispatchEvent(new Event('play'));this.dispatchEvent(new Event('playing'));return Promise.resolve();};
  HTMLMediaElement.prototype.pause=function(){audio.pauses++;if(!audio.paused){audio.paused=true;this.dispatchEvent(new Event('pause'));}};
  window.AudioContext=window.webkitAudioContext=class{constructor(){throw new Error('No realtime sound in breathing tests');}};
})();`;
const specimen='<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="breathing.css"><style>*{box-sizing:border-box}body{margin:0;padding:16px;background:#172019}</style><script src="breathing.js" defer></script></head><body><main><section id="one" data-breathing></section><section id="two" data-breathing></section></main></body></html>';

await withBrowser('breathing',async b=>{
  const {load,evaluate,click,media,viewport,send,shot,requests}=b;
  const phase=async(id,next,seconds,moving=true)=>{
    assert.deepEqual(await evaluate(`(()=>{const host=document.querySelector('#${id}');return{running:host.breathing.running,state:host.dataset.breathPhase,label:host.querySelector('.breath-phase').textContent,count:host.querySelector('.breath-count').textContent,pressed:host.querySelector('.breath-switch').getAttribute('aria-pressed')};})()`),{running:true,state:next,label:next==='in'?'Breathe in':'Breathe out',count:`${seconds} seconds · gently`,pressed:'true'});
    const animations=await evaluate(`document.querySelector('#${id} .breath-ring').getAnimations().map(animation=>({duration:animation.effect.getTiming().duration,frames:animation.effect.getKeyframes().map(frame=>frame.transform)}))`);
    assert.deepEqual(animations,moving?[{duration:seconds*1000,frames:next==='in'?['scale(0.72)','scale(1)']:['scale(1)','scale(0.72)']}]:[],`${id}: ring follows the same phase and duration as the cue`);
    assert.equal(await evaluate(`document.querySelector('#${id} .breath-phase').getAttribute('aria-live')`),'polite');
  };
  const paused=async id=>{
    assert.equal(await evaluate(`document.querySelector('#${id}').breathing.running`),false);
    assert.equal(await evaluate(`document.querySelector('#${id}').dataset.breathPhase`),'rest');
    assert.equal(await evaluate(`document.querySelector('#${id} .breath-ring').getAnimations().length`),0);
    assert.equal(await evaluate(`document.querySelector('#${id} .breath-phase').getAttribute('aria-live')`),'off');
  };
  await media([{name:'prefers-reduced-motion',value:'no-preference'}]);
  await load({html:specimen,route,init});
  assert.deepEqual(await evaluate('__ready'),['one','two']);
  assert.equal(await evaluate('__phaseTimers.size'),0,'no guide starts on arrival');
  await paused('one');await paused('two');
  await click('#one .breath-switch');await phase('one','in',4);
  assert.deepEqual(await evaluate('Array.from(__phaseTimers.values(),timer=>timer.delay)'),[4000]);
  await evaluate('__firePhase()');await phase('one','out',4);
  await evaluate('__firePhase()');await phase('one','in',4);
  assert.equal(await evaluate('__phaseTimers.size'),1,'successive phases own only one timer');
  await evaluate(`document.querySelector('#one .breath-rhythm').value='longer';document.querySelector('#one .breath-rhythm').dispatchEvent(new Event('change',{bubbles:true}))`);
  await paused('one');assert.equal(await evaluate('__phaseTimers.size'),0,'changing rhythm pauses instead of jumping into a phase');
  await click('#one .breath-switch');await phase('one','in',4);
  await evaluate('__firePhase()');await phase('one','out',7);
  assert.deepEqual(await evaluate('Array.from(__phaseTimers.values(),timer=>timer.delay)'),[7000]);
  await evaluate('__firePhase()');await phase('one','in',4);
  await evaluate('window.__stalePhase=__phaseTimers.values().next().value.run');
  await click('#one .breath-switch');await evaluate('__stalePhase()');
  await paused('one');assert.equal(await evaluate('__phaseTimers.size'),0,'a stale callback cannot revive a paused guide');

  await click('#one .breath-switch');await click('#two .breath-switch');
  assert.equal(await evaluate('__phaseTimers.size'),2,'two hosts keep independent schedules');
  await click('#one .breath-switch');await paused('one');
  assert.equal(await evaluate('__phaseTimers.size'),1);
  await evaluate('__firePhase()');await phase('two','out',4);
  await evaluate('__setHidden(true)');await paused('two');
  assert.equal(await evaluate('__phaseTimers.size'),0);
  await evaluate('__setHidden(false)');await paused('one');await paused('two');
  await click('#one .breath-switch');await evaluate(`window.dispatchEvent(new Event('pagehide'))`);
  await paused('one');assert.equal(await evaluate('__phaseTimers.size'),0);
  await click('#one .breath-switch');
  await media([{name:'prefers-reduced-motion',value:'reduce'}]);
  await until(()=>evaluate(`!document.querySelector('#one').breathing.running`),'the motion preference event pauses the running guide');
  await paused('one');assert.equal(await evaluate('__phaseTimers.size'),0,'a changed motion preference pauses the guide');
  await click('#one .breath-switch');await phase('one','in',4,false);
  await evaluate('__firePhase()');await phase('one','out',7,false);
  await click('#one .breath-switch');
  await media([{name:'prefers-reduced-motion',value:'no-preference'}]);
  await evaluate(`document.querySelector('#one').dataset.breathMotion='off'`);
  await click('#one .breath-switch');await phase('one','in',4,false);
  await click('#one .breath-switch');
  await viewport(320,900,true);
  assert.ok(await evaluate(`document.documentElement.scrollWidth<=innerWidth+1`));
  assert.ok(await evaluate(`Array.from(document.querySelectorAll('.breath-switch,.breath-rhythm')).every(element=>{const rect=element.getBoundingClientRect();return rect.height>=44&&rect.width>=44;})`));
  await shot('shared-guide-320','#one');

  await viewport(1440,1000);
  await load({html:page,path:'/visit.html',route,init});
  await until(()=>evaluate(`!!document.querySelector('#gallery-breath-host').breathing`),'gallery guide is ready');
  assert.equal(await evaluate('__phaseTimers.size'),0);
  const displayedWorks=await evaluate(`Array.from(document.querySelectorAll('.gallery-room .artwork-view'),link=>{const exhibit=link.closest('.exhibit'),image=link.querySelector('img');return{id:link.dataset.art,title:exhibit.querySelector('cite').textContent,maker:exhibit.querySelector('.work-heading p').textContent,image:new URL(image.src).pathname,alt:image.alt,source:exhibit.querySelector('.museum-source').href,room:link.closest('.gallery-room').id};})`);
  assert.deepEqual(works,displayedWorks,'all fifteen Trip records exactly preserve the gallery artwork metadata');
  const context=async id=>{
    const work=works.find(work=>work.id===id);
    await until(()=>evaluate(`document.querySelector('#breathing-work-image').naturalWidth>0`),'context artwork loads');
    assert.deepEqual(await evaluate(`({title:document.querySelector('#breathing-work-title').textContent,maker:document.querySelector('#breathing-work-maker').textContent,image:new URL(document.querySelector('#breathing-work-image').src).pathname,alt:document.querySelector('#breathing-work-image').alt,source:document.querySelector('#breathing-work-source').getAttribute('href'),fit:getComputedStyle(document.querySelector('#breathing-work-image')).objectFit})`),{title:work.title,maker:work.maker,image:work.image,alt:work.alt,source:work.source,fit:'contain'});
    const destination=new URL(await evaluate(`document.querySelector('#breathing-trip').href`));
    assert.equal(destination.origin,origin);assert.equal(destination.pathname,'/trip');
    assert.equal(destination.searchParams.get('work'),work.id);assert.equal(destination.searchParams.get('room'),work.room);
  };
  const close=async(opener,escape=false)=>{
    if(escape){await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',windowsVirtualKeyCode:27});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',windowsVirtualKeyCode:27});}
    else await click('#breathing-dialog .dialog-close');
    await until(()=>evaluate(`!document.querySelector('#breathing-dialog').open&&!document.querySelector('#gallery-breath-host').breathing.running&&document.activeElement===document.querySelector(${JSON.stringify(opener)})`),'gallery pause stops the guide and restores its opener');
    await paused('gallery-breath-host');assert.equal(await evaluate('__phaseTimers.size'),0);
  };
  await click('#drift-toggle');
  assert.equal(await evaluate(`document.querySelector('#drift-toggle').getAttribute('aria-pressed')`),'true');
  await click('#breath-toggle');await context('water');await paused('gallery-breath-host');
  assert.equal(await evaluate(`document.querySelector('#drift-toggle').getAttribute('aria-pressed')`),'false','opening a breathing pause stops the drift');
  assert.equal(await evaluate(`document.activeElement.matches('#breathing-dialog .dialog-close')`),true);
  await click('#gallery-breath-host .breath-switch');await phase('gallery-breath-host','in',4);
  await shot('gallery-breath-desktop');await close('#breath-toggle',true);
  await click('[data-rest-work="dusk"]');await context('dusk');await close('[data-rest-work="dusk"]');
  const opener='.artwork-view[data-art="water"]';
  await click(opener);await click('#viewer-next');await click('#viewer-rest');
  assert.equal(await evaluate(`document.querySelector('#art-viewer').open`),false);
  await context('monet-water-lilies');await close(opener,true);
  await evaluate(`document.querySelector('.artwork-view[data-art="monet-water-lilies"]').scrollIntoView({block:'center',behavior:'instant'})`);
  await until(()=>evaluate(`document.body.dataset.room==='water'`),'the visible companion stays in the water room');
  await click('#breath-toggle');await context('monet-water-lilies');await close('#breath-toggle');
  await evaluate(`document.querySelector('#water').scrollIntoView({block:'start',behavior:'instant'})`);
  assert.equal(await evaluate('__audio.plays'),0,'artwork pauses never start music');
  await click('#sound-toggle');await evaluate('__audio.time=42');
  const audioBefore=await evaluate('({...__audio})');
  await click('#breath-toggle');await click('#gallery-breath-host .breath-switch');await close('#breath-toggle');
  assert.deepEqual(await evaluate('({...__audio})'),audioBefore,'the existing soundtrack continues without restart during a breathing pause');
  await click('#breath-toggle');
  assert.equal(await evaluate(`document.querySelector('#breathing-sound').getAttribute('aria-pressed')`),'true');
  await click('#breathing-sound');assert.equal(await evaluate(`document.querySelector('#sound-toggle').getAttribute('aria-pressed')`),'false');
  await click('#breathing-sound');assert.equal(await evaluate(`document.querySelector('#sound-toggle').getAttribute('aria-pressed')`),'true');
  await evaluate(`document.querySelector('#breathing-volume').value='31';document.querySelector('#breathing-volume').dispatchEvent(new Event('input',{bubbles:true}))`);
  assert.equal(await evaluate(`document.querySelector('#gallery-soundtrack').volume`),.31);
  assert.equal(await evaluate(`document.querySelector('#sound-volume').value`),'31');
  assert.equal(await evaluate(`document.querySelectorAll('audio').length`),1);
  await close('#breath-toggle');
  await click('#sound-toggle');
  await click('#motion-toggle');
  assert.equal(await evaluate('document.body.dataset.motion'),'off');
  await click('#breath-toggle');await click('#gallery-breath-host .breath-switch');await phase('gallery-breath-host','in',4,false);
  await close('#breath-toggle');
  for(const width of [320,390,601,640,700,768,1440]){
    await viewport(width,900,width<600);
    for(const playing of [false,true]){
      if(playing)await click('#sound-toggle');
      const header=await evaluate(`(()=>{const rect=el=>{const r=el.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};return{width:innerWidth,brand:rect(document.querySelector('.visit-header .brand')),tools:Array.from(document.querySelectorAll('.visit-tools .tool')).filter(el=>el.getClientRects().length).map(el=>({id:el.id||el.className,...rect(el)}))};})()`);
      for(const tool of header.tools){
        assert.ok(tool.left>=-1&&tool.right<=header.width+1,`${tool.id} stays inside the header at ${width}px while music ${playing?'plays':'is paused'}`);
        assert.ok(tool.width>=44&&tool.height>=44,`${tool.id} has a 44px target at ${width}px`);
        const overlapX=Math.min(tool.right,header.brand.right)-Math.max(tool.left,header.brand.left);
        const overlapY=Math.min(tool.bottom,header.brand.bottom)-Math.max(tool.top,header.brand.top);
        assert.ok(overlapX<=1||overlapY<=1,`${tool.id} does not overlap the brand at ${width}px`);
      }
      if(playing)await click('#sound-toggle');
    }
    await click('#breath-toggle');await context('water');
    const dimensions=await evaluate(`(()=>{const dialog=document.querySelector('#breathing-dialog');return{page:document.documentElement.scrollWidth,width:innerWidth,scroll:dialog.scrollWidth,client:dialog.clientWidth};})()`);
    assert.ok(dimensions.page<=dimensions.width+1&&dimensions.scroll<=dimensions.client+1,`breathing fits at ${width}px`);
    for(const selector of ['#gallery-breath-host .breath-switch','#breathing-trip']){
      await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center',behavior:'instant'})`);
      assert.ok(await evaluate(`Array.from(document.querySelectorAll('#breathing-dialog button,#breathing-dialog select,#breathing-dialog a')).filter(el=>{const r=el.getBoundingClientRect();return r.top<innerHeight&&r.bottom>0;}).every(el=>{const r=el.getBoundingClientRect();return r.width>=44&&r.height>=44;})`),`breathing controls have 44px targets at ${width}px`);
    }
    if(width===390){await evaluate(`document.querySelector('#breathing-dialog').scrollTop=0`);await shot('gallery-breath-mobile');}
    await close('#breath-toggle');
  }
  await send('Emulation.setScriptExecutionDisabled',{value:true});await load({html:page,path:'/visit.html',route});
  assert.equal(await evaluate(`document.querySelector('#breath-toggle').hidden`),true);
  assert.equal(await evaluate(`document.querySelector('#viewer-rest').hidden`),true);
  assert.equal(await evaluate(`document.querySelectorAll('.gallery-room .artwork-view').length`),15);
  const fallback=new URL(await evaluate(`document.querySelector('[data-rest-work="dusk"]').href`));
  assert.equal(fallback.pathname,'/trip');assert.equal(fallback.searchParams.get('work'),'dusk');
  assert.ok(requests.every(request=>new URL(request.url).origin===origin));
  assert.ok(!requests.some(request=>new URL(request.url).pathname.endsWith('.mp3')),'breathing never requests audio automatically');
  console.log('breathing browser passed: matching phase/ring timing, independent hosts, timer cancellation, still-ring modes, gallery artwork context, focus, soundtrack continuity, 320–1440px and no-JavaScript handoff');
});
