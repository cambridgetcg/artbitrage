// Comparison stays within the fifteen local artworks. Browser fixtures never
// reach the network, clipboard, or speakers outside this isolated test.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { withBrowser, until, origin } from './helpers/browser.mjs';

const root = new URL('../', import.meta.url);
const html = readFileSync(new URL('visit.html', root), 'utf8');
const companions = JSON.parse(readFileSync(new URL('assets/visit/credits.json', root), 'utf8'));
const works = [
  { id:'water', image:'assets/welcome/seurat.jpg', title:'A Sunday on La Grande Jatte — 1884', maker:'Georges Seurat · 1884–86', source:'27992' },
  { id:'dusk', image:'assets/welcome/moonrise.jpg', title:'Moonrise', maker:'George Inness · 1891', source:'64754' },
  { id:'form', image:'assets/welcome/moon-jar.jpg', title:'Moon Jar', maker:'Korea · Joseon dynasty', source:'158472' },
  { id:'poems', image:'assets/welcome/maples.jpg', title:'Autumn Maples with Poem Slips', maker:'Tosa Mitsuoki · c. 1675', source:'127644' },
  { id:'colour', image:'assets/guide/kandinsky.jpg', title:'Improvisation No. 30 (Cannons)', maker:'Vasily Kandinsky · 1913', source:'8991' },
  ...companions.map(work => ({id:work.id,image:`assets/visit/${work.file}`,title:work.display_title,maker:`${work.artist} · ${work.date}`,source:String(work.museum_id)})),
];
const byId = new Map(works.map(work => [work.id,work]));
assert.equal(byId.size,15);
for (const file of ['visit.html','visit.css','visit.js']) assert.deepEqual(readFileSync(new URL(file,root)),readFileSync(new URL(`dist/${file}`,root)),`${file} deploy mirror`);
assert.equal((html.match(/class="gallery-room\b/g)||[]).length,5,'the gallery keeps five rooms');
assert.equal((html.match(/<details class="museum-note">/g)||[]).length,15,'all artwork notes remain');
assert.equal((html.match(/<audio\b/g)||[]).length,1,'comparison shares the existing soundtrack');
assert.equal((html.match(/class="echo-card"/g)||[]).length,3,'three pairings are present without JavaScript');
assert.ok(html.includes('id="between-works"') && html.includes('id="encounter-dialog"'));
assert.ok(process.argv.slice(2).every(arg=>arg==='--browser'));
console.log('encounter static checks passed: five rooms, fifteen notes, one soundtrack, comparison markup and deploy mirrors');
if(!process.argv.includes('--browser'))process.exit(0);

const files = new Set(['visit.css','visit.js','breathing.css','breathing.js',...works.map(work=>work.image)]);
const route = url => {
  const path=url.pathname.slice(1);
  if(!files.has(path))return null;
  return {type:path.endsWith('.css')?'text/css':path.endsWith('.js')?'text/javascript':'image/jpeg',body:readFileSync(new URL(path,root))};
};
const init = `(() => {
  window.__injected=0;
  const clipboard=window.__clipboard={fail:false,writes:[],attempts:0};
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{async writeText(text){clipboard.attempts++;if(clipboard.fail)throw new DOMException('Clipboard denied for test','NotAllowedError');clipboard.writes.push(text);}}});
  const exec=document.execCommand.bind(document);
  document.execCommand=(command,...args)=>command.toLowerCase()==='copy'?false:exec(command,...args);
  const audio=window.__audio={plays:0,pauses:0,paused:true,time:0};
  Object.defineProperty(HTMLMediaElement.prototype,'paused',{configurable:true,get(){return audio.paused;}});
  Object.defineProperty(HTMLMediaElement.prototype,'currentTime',{configurable:true,get(){return audio.time;},set(value){audio.time=value;}});
  HTMLMediaElement.prototype.play=function(){audio.plays++;audio.paused=false;this.dispatchEvent(new Event('play'));this.dispatchEvent(new Event('playing'));return Promise.resolve();};
  HTMLMediaElement.prototype.pause=function(){audio.pauses++;if(!audio.paused){audio.paused=true;this.dispatchEvent(new Event('pause'));}};
  window.AudioContext=window.webkitAudioContext=class{constructor(){throw new Error('Comparison must not create an AudioContext');}};
})();`;

await withBrowser('visit-encounters',async b=>{
  const {load,evaluate,click,send,media,viewport,shot,requests}=b;
  const choose = (side,id) => evaluate(`(() => {const select=document.querySelector(${JSON.stringify('#encounter-'+side)});select.value=${JSON.stringify(id)};select.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  const key = async (key,code) => {
    await send('Input.dispatchKeyEvent',{type:'keyDown',key,code:key,windowsVirtualKeyCode:code});
    await send('Input.dispatchKeyEvent',{type:'keyUp',key,code:key,windowsVirtualKeyCode:code});
  };
  const imagesLoaded = () => until(()=>evaluate(`Array.from(document.querySelectorAll('#encounter-dialog .encounter-image img')).every(img=>img.naturalWidth>0)`),'both comparison images load');
  const close = async (opener,escape=false) => {
    if(escape)await key('Escape',27);else await click('#encounter-dialog .dialog-close');
    await until(()=>evaluate(`!document.querySelector('#encounter-dialog').open && document.activeElement===document.querySelector(${JSON.stringify(opener)})`),'comparison closes and returns focus');
  };
  const figureState = async (side,id) => {
    const work=byId.get(id);
    assert.ok(work,`${id} is a known artwork`);
    await imagesLoaded();
    const actual=await evaluate(`(() => {const figure=document.querySelector('#encounter-dialog figure[data-slot="${side}"]');return {image:new URL(figure.querySelector('img').src).pathname,title:figure.querySelector('h3').textContent,maker:figure.querySelector('figcaption p').textContent,source:figure.querySelector('figcaption a').getAttribute('href'),alt:figure.querySelector('img').alt};})()`);
    assert.equal(actual.image,`/${work.image}`);
    assert.equal(actual.title,work.title);
    assert.equal(actual.maker,work.maker);
    assert.equal(actual.source,`https://www.artic.edu/artworks/${work.source}`);
    assert.equal(actual.alt,await evaluate(`document.querySelector('.artwork-view[data-art="${id}"] img').alt`));
  };
  const layout = async label => {
    const state=await evaluate(`(() => {const dialog=document.querySelector('#encounter-dialog'),scope=dialog.open?dialog:document,small=[];for(const element of scope.querySelectorAll('a,button,select,input,summary')){const rect=element.getBoundingClientRect();if(element.getClientRects().length&&getComputedStyle(element).visibility!=='hidden'&&rect.bottom>0&&rect.top<innerHeight&&rect.right>0&&rect.left<innerWidth&&(rect.width<43.9||rect.height<43.9))small.push({id:element.id,text:element.textContent.trim().slice(0,50),width:rect.width,height:rect.height});}return {width:innerWidth,page:document.documentElement.scrollWidth,dialog:dialog.open?dialog.scrollWidth:0,dialogWidth:dialog.open?dialog.clientWidth:0,small};})()`);
    assert.ok(state.page<=state.width+1,`${label}: page does not overflow`);
    assert.ok(state.dialog<=state.dialogWidth+1,`${label}: dialog does not overflow`);
    assert.deepEqual(state.small,[],`${label}: visible controls have 44px targets`);
  };
  const reopen = async url => {
    const result=await send('Page.navigate',{url});
    assert.ok(!result.errorText,result.errorText);
    await until(()=>evaluate(`location.href===${JSON.stringify(url)} && document.readyState==='complete' && document.querySelector('#sound-toggle')?.hidden===false`),'shared document loads');
  };

  await media([{name:'prefers-reduced-motion',value:'reduce'}]);
  await load({html,path:'/visit.html',route,init});
  assert.equal(await evaluate(`document.querySelector('#encounter-dialog').open`),false);
  assert.equal(await evaluate('__audio.plays'),0,'comparison is opt-in and never starts music');
  const cards=await evaluate(`Array.from(document.querySelectorAll('.echo-card'),card=>({pair:card.dataset.pair.split(','),prompt:card.querySelector('.echo-description').textContent,question:card.querySelector('.echo-question').textContent}))`);
  assert.equal(cards.length,3);
  for(const side of ['left','right']){
    const options=await evaluate(`Array.from(document.querySelector('#encounter-${side}').options,option=>({id:option.value,title:option.textContent}))`);
    assert.deepEqual(options.map(option=>option.id).sort(),works.map(work=>work.id).sort(),`${side} offers all fifteen works`);
    for(const option of options)assert.equal(option.title,byId.get(option.id).title);
    assert.equal(await evaluate(`document.querySelector('#encounter-${side}').tagName`),'SELECT');
    assert.ok(await evaluate(`document.querySelector('#encounter-${side}').labels.length > 0`),`${side} has an accessible label`);
  }
  const entrance='.between-invitation';
  await click(entrance);
  assert.equal(await evaluate(`document.querySelector('#encounter-dialog').open`),true);
  assert.equal(await evaluate(`document.activeElement.matches('#encounter-dialog .dialog-close')`),true);
  assert.equal(await evaluate(`document.querySelector('.encounter-stage').dataset.view`),'beside');
  assert.equal(await evaluate(`document.querySelector('.layer-control').hidden`),true);

  // Every suggested pair has the same prompt in either order. The static copy
  // remains the reference; custom pairs get an open invitation instead.
  for(const card of cards){
    await click(`#encounter-dialog button[data-pair="${card.pair.join(',')}"]`);
    await figureState('left',card.pair[0]);await figureState('right',card.pair[1]);
    assert.equal(await evaluate(`document.querySelector('#encounter-prompt').textContent`),card.prompt);
    assert.equal(await evaluate(`document.querySelector('#encounter-question').textContent`),card.question);
    assert.equal(await evaluate(`document.querySelector('#encounter-dialog button[data-pair="${card.pair.join(',')}"]').getAttribute('aria-pressed')`),'true');
    // Use a third work to reverse a pair without selecting a disabled duplicate.
    const third=works.find(work=>!card.pair.includes(work.id)).id;
    await choose('left',third);await choose('right',card.pair[0]);await choose('left',card.pair[1]);
    assert.equal(await evaluate(`document.querySelector('#encounter-prompt').textContent`),card.prompt);
    assert.equal(await evaluate(`document.querySelector('#encounter-question').textContent`),card.question);
  }
  for(const side of ['left','right']){
    const other=side==='left'?'right':'left';
    for(const work of works){
      if(await evaluate(`document.querySelector('#encounter-${other}').value`)===work.id){
        const selected=await evaluate(`document.querySelector('#encounter-${side}').value`);
        await choose(other,works.find(candidate=>candidate.id!==work.id&&candidate.id!==selected).id);
      }
      await choose(side,work.id);
      assert.equal(await evaluate(`document.querySelector('#encounter-${side}').value`),work.id);
      await figureState(side,work.id);
    }
  }
  for(const side of ['left','right']){
    const other=side==='left'?'right':'left';
    const before=await evaluate(`Array.from(document.querySelectorAll('.encounter-selectors select'),select=>select.value)`);
    const duplicate=await evaluate(`document.querySelector('#encounter-${other}').value`);
    assert.equal(await evaluate(`Array.from(document.querySelector('#encounter-${side}').options).find(option=>option.value===${JSON.stringify(duplicate)}).disabled`),true,'the opposite work is disabled in the selector');
    await choose(side,duplicate);
    assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('.encounter-selectors select'),select=>select.value)`),before,'forced duplicate selection is rejected');
  }
  await choose('left','water');await choose('right','dusk');
  const customPrompt=await evaluate(`document.querySelector('#encounter-prompt').textContent`);
  const customQuestion=await evaluate(`document.querySelector('#encounter-question').textContent`);
  assert.ok(customPrompt.length>30&&customQuestion.length>30);
  assert.ok(cards.every(card=>card.prompt!==customPrompt),'a custom pairing does not inherit an unrelated curated claim');
  assert.equal(await evaluate(`document.querySelectorAll('#encounter-dialog [data-pair][aria-pressed="true"]').length`),0);

  // Layering is an explicit choice; keyboard changes and both endpoints are
  // reflected in the output, accessible value text, and shareable state.
  await click('#encounter-layer');
  const layerState=async value=>{
    assert.equal(await evaluate(`document.querySelector('.encounter-stage').dataset.view`),'layer');
    assert.equal(await evaluate(`document.querySelector('#encounter-layer').getAttribute('aria-pressed')`),'true');
    assert.equal(await evaluate(`document.querySelector('#encounter-beside').getAttribute('aria-pressed')`),'false');
    assert.equal(await evaluate(`document.querySelector('.layer-control').hidden`),false);
    assert.equal(await evaluate(`document.querySelector('#encounter-mix').value`),String(value));
    assert.equal(await evaluate(`document.querySelector('#encounter-balance').value`),`${value}%`);
    assert.match(await evaluate(`document.querySelector('#encounter-mix').getAttribute('aria-valuetext')`),new RegExp(`^${value}% `));
    assert.equal(await evaluate(`Number(document.querySelector('.encounter-stage').style.getPropertyValue('--mix'))`),value/100);
    const visual=await evaluate(`Array.from(document.querySelectorAll('.encounter-image'),element=>{const rect=element.getBoundingClientRect();return{opacity:Number(getComputedStyle(element).opacity),x:rect.x,y:rect.y,width:rect.width,height:rect.height,fit:getComputedStyle(element.querySelector('img')).objectFit};})`);
    assert.ok(Math.abs(visual[0].opacity-(1-value/100))<.001 && Math.abs(visual[1].opacity-value/100)<.001,'the visible image opacities follow the selected balance');
    for(const dimension of ['x','y','width','height'])assert.ok(Math.abs(visual[0][dimension]-visual[1][dimension])<1,'layered images occupy the same frame');
    assert.ok(visual.every(image=>image.fit==='contain'),'layering retains each whole image');
  };
  await layerState(50);
  await evaluate(`document.querySelector('#encounter-mix').focus()`);
  await key('Home',36);await layerState(0);
  await key('End',35);await layerState(100);
  await key('ArrowLeft',37);await layerState(99);
  await click('#encounter-beside');
  assert.equal(await evaluate(`document.querySelector('.encounter-stage').dataset.view`),'beside');
  assert.ok(await evaluate(`Array.from(document.querySelectorAll('.encounter-image')).every(element=>Number(getComputedStyle(element).opacity)===1)`),'returning to beside restores both images to full opacity');
  assert.equal(await evaluate(`document.querySelector('.layer-control').hidden`),true);
  await click('#encounter-layer');
  await evaluate(`document.querySelector('#encounter-mix').value='37';document.querySelector('#encounter-mix').dispatchEvent(new Event('input',{bubbles:true}))`);
  await layerState(37);
  const share=await evaluate(`document.querySelector('#encounter-url').value`);
  const shared=new URL(share);
  assert.equal(shared.origin,origin);
  assert.equal(shared.pathname,'/visit.html');
  assert.equal(shared.searchParams.get('pair'),'water,dusk');
  assert.equal(shared.searchParams.get('view'),'layer');
  assert.equal(shared.searchParams.get('mix'),'37');
  assert.deepEqual([...shared.searchParams.keys()].sort(),['mix','pair','view']);
  assert.equal(shared.hash,'#between-works');
  assert.equal(await evaluate(`document.querySelector('#encounter-url').readOnly`),true);
  await click('#encounter-copy');
  await until(()=>evaluate('__clipboard.writes.length===1'),'copy succeeds through the mocked clipboard');
  assert.equal(await evaluate('__clipboard.writes[0]'),share);
  assert.match(await evaluate(`document.querySelector('#encounter-status').textContent`),/copied/i);
  await evaluate('__clipboard.fail=true');
  await click('#encounter-copy');
  await until(()=>evaluate(`document.activeElement.id==='encounter-url'`),'clipboard failure focuses the selectable link');
  assert.deepEqual(await evaluate(`(()=>{const input=document.querySelector('#encounter-url');return[input.selectionStart,input.selectionEnd,input.value.length];})()`),[0,share.length,share.length]);
  assert.match(await evaluate(`document.querySelector('#encounter-status').textContent`),/select and copy/i);
  await close(entrance,true);

  // Pair the currently viewed artwork, while keeping the original opener as the
  // final focus destination after the two dialogs hand control to each other.
  const artOpener='.artwork-view[data-art="water"]';
  await click(artOpener);await click('#viewer-next');await click('#viewer-pair');
  assert.equal(await evaluate(`document.querySelector('#art-viewer').open`),false);
  assert.equal(await evaluate(`document.querySelector('#encounter-dialog').open`),true);
  assert.equal(await evaluate(`document.querySelector('#encounter-left').value`),'monet-water-lilies');
  await figureState('left','monet-water-lilies');
  await close(artOpener);
  assert.equal(await evaluate('__audio.plays'),0);

  // Opening, arranging, and closing a comparison never resets existing music.
  await click('#sound-toggle');await evaluate('__audio.time=42');
  const audioBefore=await evaluate('({...__audio})');
  await click(entrance);await click('#encounter-layer');await choose('left','colour');await close(entrance);
  assert.deepEqual(await evaluate('({...__audio})'),audioBefore);
  assert.equal(await evaluate(`document.querySelectorAll('audio').length`),1);
  await click('#sound-toggle');

  await reopen(share);
  assert.equal(await evaluate(`document.querySelector('#encounter-dialog').open`),true,'a shared meeting opens on arrival');
  await layerState(37);await figureState('left','water');await figureState('right','dusk');
  assert.equal(await evaluate('__audio.plays'),0,'shared meetings never autoplay music');
  assert.equal(await evaluate(`document.querySelector('#drift-toggle').getAttribute('aria-pressed')`),'false');
  await close('#between-works',true);
  // Canonical links omit display defaults and unrelated incoming parameters.
  await reopen(`${origin}/visit.html?pair=form,whistler-nocturne&campaign=unrelated#between-works`);
  assert.equal(await evaluate(`document.querySelector('.encounter-stage').dataset.view`),'beside');
  const canonical=new URL(await evaluate(`document.querySelector('#encounter-url').value`));
  assert.deepEqual([...canonical.searchParams.keys()],['pair']);
  assert.equal(canonical.searchParams.get('pair'),'form,whistler-nocturne');
  await close('#between-works');

  const invalid=[
    '?pair=water', '?pair=water,water', '?pair=water,dusk,form', '?pair=water,missing',
    '?pair=water,dusk&pair=form,colour', '?pair=water,dusk&view=outside',
    '?pair=water,dusk&mix=-1', '?pair=water,dusk&mix=101', '?pair=water,dusk&mix=3.5',
    '?pair=water,dusk&mix=NaN', '?pair=water,dusk&mix=',
    '?pair='+encodeURIComponent('water,<img src="https://invalid.example/pixel" onerror="window.__injected=1">'),
    '?pair='+encodeURIComponent('water,javascript:window.__injected=1'),
  ];
  for(const query of invalid){
    await reopen(`${origin}/visit.html${query}#between-works`);
    assert.equal(await evaluate(`document.querySelector('#encounter-dialog').open`),false,`${query}: invalid shared state is ignored`);
    assert.equal(await evaluate('__injected'),0);
    assert.equal(await evaluate('__audio.plays'),0);
    assert.equal(await evaluate(`document.querySelectorAll('.gallery-room').length`),5);
  }

  for(const width of [320,390,768,1440]){
    await viewport(width,900,width<600);
    await click(entrance);await imagesLoaded();
    await layout(`beside at ${width}px`);
    if(width===1440||width===390)await shot(`encounter-beside-${width}`);
    await click('#encounter-layer');
    await imagesLoaded();await layout(`layer at ${width}px`);
    if(width===1440||width===390)await shot(`encounter-layer-${width}`);
    await evaluate(`document.querySelector('#encounter-copy').scrollIntoView({block:'center',behavior:'instant'})`);
    await layout(`share controls at ${width}px`);
    await close(entrance);
  }

  // The inline invitations must remain readable around the gallery's layout
  // breakpoints. A former 880→881px switch squeezed six images into one row.
  for(const width of [320,390,768,880,881,1024,1100,1101,1200,1280,1440]){
    await viewport(width,900,width<600);
    for(const card of cards){
      const selector=`.echo-card[data-pair="${card.pair.join(',')}"]`;
      await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center',behavior:'instant'})`);
      await until(()=>evaluate(`Array.from(document.querySelectorAll(${JSON.stringify(selector+' img')})).every(image=>image.naturalWidth>0)`),'inline pairing images load');
      const dimensions=await evaluate(`(() => {const card=document.querySelector(${JSON.stringify(selector)});return {width:card.getBoundingClientRect().width,images:Array.from(card.querySelectorAll('img'),image=>{const rect=image.getBoundingClientRect(),scale=Math.min(rect.width/image.naturalWidth,rect.height/image.naturalHeight);return {paintedWidth:image.naturalWidth*scale,fit:getComputedStyle(image).objectFit,left:rect.left,right:rect.right};})};})()`);
      for(const image of dimensions.images){
        assert.equal(image.fit,'contain','inline art remains whole');
        assert.ok(image.left>=0&&image.right<=width+1,`inline artwork fits at ${width}px`);
        if(width>=768)assert.ok(image.paintedWidth>=180,`inline artwork stays legible at ${width}px (${image.paintedWidth.toFixed(1)}px wide)`);
      }
      if(width>=768&&card.pair[0]==='hokusai-great-wave')assert.ok(dimensions.images[0].paintedWidth>=220,`the landscape does not collapse near a breakpoint at ${width}px`);
      const readingOrder=await evaluate(`(() => {const card=document.querySelector(${JSON.stringify(selector)});return ['h3','.echo-description','.echo-question','.echo-open'].map(selector=>card.querySelector(selector).getBoundingClientRect().top);})()`);
      assert.ok(readingOrder.every((top,index)=>index===0||top>readingOrder[index-1]),`pairing heading, description, question, and action stay in reading order at ${width}px`);
      await layout(`inline pairing at ${width}px`);
    }
    if(width===881||width===1200){
      await evaluate(`document.querySelector('#between-works').scrollIntoView({block:'start',behavior:'instant'})`);
      await shot(`inline-pairings-${width}`);
    }
  }

  await send('Emulation.setScriptExecutionDisabled',{value:true});
  await load({html,path:'/visit.html',route});
  await viewport(320,900,true);
  assert.equal(await evaluate(`document.querySelector('#encounter-dialog').open`),false);
  assert.equal(await evaluate(`document.querySelectorAll('.echo-card').length`),3);
  assert.equal(await evaluate(`document.querySelectorAll('.gallery-room .artwork-view').length`),15);
  assert.ok(await evaluate(`Array.from(document.querySelectorAll('.echo-open')).every(button=>button.hidden)`),'enhanced actions are hidden without JavaScript');
  await click(entrance);
  await until(()=>evaluate(`location.hash==='#between-works'`),'the static invitation remains a working anchor');
  for(const card of cards){
    const selector=`.echo-card[data-pair="${card.pair.join(',')}"]`;
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center',behavior:'instant'})`);
    await until(()=>evaluate(`Array.from(document.querySelectorAll(${JSON.stringify(selector+' img')})).every(image=>image.naturalWidth>0)`),'static pairing images load');
    assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll(${JSON.stringify(selector+' .echo-pictures a')}),link=>link.getAttribute('href'))`),card.pair.map(id=>byId.get(id).image));
    assert.equal(await evaluate(`document.querySelector(${JSON.stringify(selector+' .echo-description')}).textContent`),card.prompt);
    await layout(`no-JavaScript ${card.pair.join('/')} at 320px`);
  }
  await shot('encounter-static-nojs-320','#between-works');
  assert.ok(!requests.some(request=>new URL(request.url).pathname.endsWith('.mp3')),'comparison never requests the soundtrack automatically');
  assert.ok(requests.every(request=>new URL(request.url).origin===origin),'comparison and malformed links never request an outside origin');
  const fallback=cards[2].pair[1];
  await click(`.echo-card[data-pair="${cards[2].pair.join(',')}"] .echo-pictures figure:last-child a`);
  await until(()=>evaluate(`location.pathname===${JSON.stringify('/'+byId.get(fallback).image)} && document.querySelector('img')?.naturalWidth>0`),'the static comparison opens a full artwork image without JavaScript');
  console.log('encounter browser passed: all fifteen works on either side, curated/custom prompts, duplicate protection, layer keyboard controls, exact share state + malformed input, mocked clipboard fallback, focus return, music continuity, responsive layouts, and static no-JavaScript pairings');
});
