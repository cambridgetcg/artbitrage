// Decode the actual soundtrack and exercise native media playback without sound
// reaching the device. Lifecycle failures are covered in e2e-visit.mjs.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { withBrowser, until, delay, origin } from './helpers/browser.mjs';

const root = new URL('../', import.meta.url);
const html = readFileSync(new URL('visit.html', root), 'utf8');
const soundtrack = 'assets/audio/rooms-of-light.mp3';
const bytes = readFileSync(new URL(soundtrack, root));
const creditsFile = 'assets/audio/credits.json';
const creditsBytes = readFileSync(new URL(creditsFile, root));
const credits = JSON.parse(creditsBytes);
assert.ok(bytes.length > 100000, 'the local soundtrack contains an encoded recording');
assert.deepEqual(bytes, readFileSync(new URL(`dist/${soundtrack}`, root)), 'soundtrack deploy mirror');
assert.deepEqual(creditsBytes, readFileSync(new URL(`dist/${creditsFile}`, root)), 'soundtrack credits deploy mirror');
assert.equal(`assets/audio/${credits.file}`, soundtrack);
assert.ok(credits.title && credits.creation && credits.sources && credits.instruments, 'track provenance and instrumentation are recorded');
assert.equal(credits.playback.opt_in, true);
assert.equal(credits.playback.suggested_initial_volume, .65);
assert.deepEqual(credits.passages.map(passage=>passage.room), ['water','dusk','form','poems','colour']);
assert.equal((html.match(/<audio\b/g) || []).length, 1);
assert.ok(html.includes(`src="${soundtrack}"`));
assert.ok(html.includes(credits.title), 'the soundtrack title is visible in the gallery');
assert.doesNotMatch(html, /<audio[^>]*autoplay/i);
assert.ok(process.argv.slice(2).every(arg => arg === '--browser'));
console.log('soundtrack static checks passed: one local recording, credits, deploy mirrors, no autoplay');
if (!process.argv.includes('--browser')) process.exit(0);

const fixtures = new Set(['visit.css', 'visit.js', 'breathing.css', 'breathing.js', soundtrack, ...Array.from(html.matchAll(/src="(assets\/[^\"]+)"/g), match => match[1])]);
const route = url => {
  const path = url.pathname.slice(1);
  if (!fixtures.has(path)) return null;
  return { type: path.endsWith('.mp3') ? 'audio/mpeg' : path.endsWith('.css') ? 'text/css' : path.endsWith('.js') ? 'text/javascript' : 'image/jpeg', body: readFileSync(new URL(path, root)) };
};

// No realtime Web Audio output is permitted. Every native .play() is forced
// muted before it reaches Chrome, including any attempted unmute by page code.
const init = `(() => {
  window.__nativeAudio={playCalls:0, gestures:[], mutedAtPlay:[]};
  const proto=HTMLMediaElement.prototype, mute=Object.getOwnPropertyDescriptor(proto,'muted'), play=proto.play;
  Object.defineProperty(proto,'muted',{configurable:true,get:mute.get,set(){mute.set.call(this,true);}});
  proto.play=function(){
    mute.set.call(this,true);this.defaultMuted=true;
    __nativeAudio.playCalls++;__nativeAudio.gestures.push(navigator.userActivation.isActive);__nativeAudio.mutedAtPlay.push(this.muted);
    return play.apply(this,arguments);
  };
  window.AudioContext=window.webkitAudioContext=class{constructor(){throw new Error('Realtime AudioContext output is not permitted in the soundtrack test');}};
  window.__setHidden=hidden=>{
    Object.defineProperty(document,'hidden',{configurable:true,get:()=>hidden});
    Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>hidden?'hidden':'visible'});
    document.dispatchEvent(new Event('visibilitychange'));
  };
})();`;

await withBrowser('visit-soundtrack', async b => {
  const { load, evaluate, media, send, requests } = b;
  const player = `document.querySelector('#gallery-soundtrack')`;
  const pressed = `document.querySelector('#sound-toggle').getAttribute('aria-pressed')`;
  const trustedClick = async selector => {
    const { x, y } = await evaluate(`(() => {const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2};})()`);
    await send('Input.dispatchMouseEvent', {type:'mousePressed',x,y,button:'left',clickCount:1});
    await send('Input.dispatchMouseEvent', {type:'mouseReleased',x,y,button:'left',clickCount:1});
  };
  await media([{name:'prefers-reduced-motion',value:'reduce'}]);
  await load({html,route,init});
  await delay(300);
  assert.ok(!requests.some(request => new URL(request.url).pathname === `/${soundtrack}`), 'preload=none defers the MP3 request until Play');
  assert.deepEqual(await evaluate(`({players:document.querySelectorAll('audio').length,paused:${player}.paused,controls:${player}.controls,loop:${player}.loop,preload:${player}.preload,autoplay:${player}.autoplay,playCalls:__nativeAudio.playCalls})`), {players:1,paused:true,controls:true,loop:true,preload:'none',autoplay:false,playCalls:0});

  await trustedClick('#sound-toggle');
  await until(() => evaluate(`${player}.currentTime > .15 && !${player}.paused && ${pressed} === 'true'`), 'muted native MP3 playback advances', 15000);
  assert.deepEqual(await evaluate(`({playCalls:__nativeAudio.playCalls,gestures:__nativeAudio.gestures,mutedAtPlay:__nativeAudio.mutedAtPlay,muted:${player}.muted,volume:${player}.volume,error:${player}.error?.code || null})`), {playCalls:1,gestures:[true],mutedAtPlay:[true],muted:true,volume:.65,error:null});
  const duration = await evaluate(`${player}.duration`);
  assert.ok(duration >= 180 && duration <= 250, `soundtrack lasts about three to four minutes (${duration}s)`);
  assert.ok(Math.abs(duration-credits.duration_seconds) < 1, 'the recording matches its documented duration');
  const firstTime = await evaluate(`${player}.currentTime`);
  await b.click('.room-stops a[href="#dusk"]');
  await delay(250);
  assert.ok(await evaluate(`${player}.currentTime`) > firstTime, 'room navigation preserves continuous playback');
  assert.equal(await evaluate('__nativeAudio.playCalls'), 1, 'room navigation never starts a second copy');

  await trustedClick('#sound-toggle');
  await until(() => evaluate(`${player}.paused && ${pressed} === 'false'`), 'header pauses the native player');
  const pauseTime = await evaluate(`${player}.currentTime`);
  await delay(200);
  assert.equal(await evaluate(`${player}.currentTime`), pauseTime, 'paused playhead stays still');
  await trustedClick('#sound-toggle');
  await until(() => evaluate(`${player}.currentTime > ${pauseTime + .1}`), 'an explicit second gesture resumes the same track');
  await evaluate('__setHidden(true)');
  await until(() => evaluate(`${player}.paused && ${pressed} === 'false'`), 'hidden page pauses the native player');
  const hiddenTime = await evaluate(`${player}.currentTime`), calls = await evaluate('__nativeAudio.playCalls');
  await evaluate('__setHidden(false)');
  await delay(200);
  assert.equal(await evaluate(`${player}.currentTime`), hiddenTime);
  assert.equal(await evaluate('__nativeAudio.playCalls'), calls, 'returning to the page does not restart the native player');

  // Decode the real MP3 in a disconnected offline context. Measure several
  // portions, including the middle and end, rather than trusting a nonempty file.
  const signal = await evaluate(`(async()=>{
    const response=await fetch(${JSON.stringify('/' + soundtrack)});
    if(!response.ok)throw new Error('Soundtrack fixture unavailable');
    const context=new OfflineAudioContext(2,1,44100);
    const buffer=await context.decodeAudioData(await response.arrayBuffer());
    let peak=0,clipped=0;
    for(let channel=0;channel<buffer.numberOfChannels;channel++){
      const data=buffer.getChannelData(channel);
      for(let i=0;i<data.length;i++){const absolute=Math.abs(data[i]);peak=Math.max(peak,absolute);if(absolute>=.999)clipped++;}
    }
    const windows=[5,buffer.duration*.25,buffer.duration*.5,buffer.duration*.75,buffer.duration-10].map(start=>{
      let sum=0,count=0;
      for(let channel=0;channel<buffer.numberOfChannels;channel++){
        const data=buffer.getChannelData(channel),from=Math.floor(start*buffer.sampleRate),to=Math.min(data.length,from+buffer.sampleRate*3);
        for(let i=from;i<to;i++){sum+=data[i]*data[i];count++;}
      }
      const rms=Math.sqrt(sum/count);return{start,rms,dbFS:20*Math.log10(rms)};
    });
    return{duration:buffer.duration,channels:buffer.numberOfChannels,sampleRate:buffer.sampleRate,peak,peakDbFS:20*Math.log10(peak),clipped,windows};
  })()`);
  assert.ok(Math.abs(signal.duration-duration) < 1, 'native player and offline decoder agree on duration');
  assert.ok(signal.channels >= 1 && signal.channels <= 2);
  assert.ok(signal.peak > .1 && signal.peak < 1, 'the track contains signal with peak headroom');
  assert.equal(signal.clipped, 0, 'decoded samples do not hit digital full scale');
  for (const window of signal.windows) assert.ok(window.dbFS > -38 && window.dbFS < -8, `signal at ${window.start.toFixed(1)}s has a useful, bounded level (${window.dbFS.toFixed(1)} dBFS)`);

  await load({html,init,route:url => url.pathname === `/${soundtrack}` ? {status:404,type:'audio/mpeg',body:''} : route(url)});
  await trustedClick('#sound-toggle');
  await until(() => evaluate(`${player}.error !== null && ${player}.paused && ${pressed} === 'false' && /could not/i.test(document.querySelector('#sound-status').textContent)`), 'a real missing-file error restores the paused UI with an explanation', 15000);
  assert.equal(await evaluate(`document.querySelector('#sound-toggle').disabled`), false, 'missing audio leaves Play available for retry');
  assert.ok(await evaluate(`document.querySelector('#sound-status').getBoundingClientRect().height > 1`), 'the native media failure message is visibly rendered');
  assert.ok(requests.every(request => new URL(request.url).origin === origin), 'all requests use local fixtures');
  console.log(JSON.stringify({nativePlayback:'PASS — forcibly muted; playhead advanced',offlineSignal:signal},null,2));
  console.log('No speaker audibility claim: native playback was forced muted and signal analysis used OfflineAudioContext only.');
});
