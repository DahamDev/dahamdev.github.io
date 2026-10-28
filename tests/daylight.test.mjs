import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../static/js/vendor/three.module.min.js';
import { TIME_TRAVEL_SECONDS, celestialState, aucklandTime, formatSceneTime, estimateSunTimes, parseSunTimes, daylightBlend, createDaylightControl, createAlpineWorld } from '../themes/portfolio/assets/js/alpine.js';
const date='2026-10-28';
const payload=(day=date)=>({status:'OK',results:{date:day,timezone:'Pacific/Auckland',dawn:'05:50:00',sunrise:'06:17:30',solar_noon:'13:05:00',sunset:'19:52:30',dusk:'20:20:00'}});
const sun=parseSunTimes(payload(),date);
function element(){
  const listeners=new Map(), captured=new Set();
  return {hidden:true,style:{setProperty(k,v){this[k]=v;}},dataset:{},attributes:{},
    setAttribute(k,v){this.attributes[k]=v;},addEventListener(k,fn){listeners.set(k,fn);},removeEventListener(k){listeners.delete(k);},
    focus(){this.focused=true;},
    setPointerCapture(id){captured.add(id);},hasPointerCapture(id){return captured.has(id);},releasePointerCapture(id){captured.delete(id);},
    getBoundingClientRect(){return {left:10,top:20,width:128,height:128};},
    dispatch(k,event){listeners.get(k)?.(event);}};
}
function controlHarness({cached=null,reject=false,deferred=false}={}){
  let instant='2026-10-27T23:00:00Z',requests=[],pending=[],interval;
  const elements=Object.fromEntries(['time','.scene-time-travel','[data-time-status]','[data-time-zone]','[data-sun-times]','[data-sun-status]'].map(s=>[s,element()]));
  const panel=Object.assign(element(),{querySelector:s=>elements[s]});
  const document=Object.assign(element(),{hidden:false});
  const storage=new Map(cached?[['alpine-auckland-sun',JSON.stringify(cached)]]:[]),changes=[];
  const runtime={document,Date:class extends Date{constructor(){super(instant);}},
    localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},setTimeout,clearTimeout,
    setInterval:fn=>{interval=fn;return 1;},clearInterval:()=>{interval=null;},
    fetch:async url=>{requests.push(url);if(reject)throw Error('Offline');const day=new URL(url).searchParams.get('date');if(deferred)return new Promise(resolve=>pending.push(()=>resolve({ok:true,json:async()=>payload(day)})));return {ok:true,json:async()=>payload(day)};}};
  const controller=createDaylightControl({querySelector:()=>panel},(minutes,solar)=>changes.push({minutes,solar}),runtime);
  return {controller,panel,elements,document,requests,changes,storage,pending,
    advance(value){instant=value;interval?.();},toggle(){elements['.scene-time-travel'].dispatch('click');}};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test('Auckland clock follows local date and NZ daylight saving transitions',()=>{
  assert.deepEqual({...aucklandTime(new Date('2026-10-27T23:00:00Z')),zone:undefined},{date,minutes:720,zone:undefined});
  assert.equal(aucklandTime(new Date('2026-09-26T13:59:00Z')).minutes,119);
  assert.equal(aucklandTime(new Date('2026-09-26T14:00:00Z')).minutes,180);
  assert.equal(aucklandTime(new Date('2026-04-04T13:59:00Z')).minutes,179);
  assert.equal(aucklandTime(new Date('2026-04-04T14:00:00Z')).minutes,120);
  assert.equal(formatSceneTime(0),'00:00');assert.equal(formatSceneTime(1439),'23:59');
});

test('sun data rejects wrong date, timezone, null values, errors and out-of-order events',()=>{
  assert.equal(sun.sunrise,377.5);
  for(const change of [{date:'2026-10-27'},{timezone:'UTC'},{sunrise:null},{sunrise:'25:61:00'},{sunset:'05:00:00'}]){
    const data=payload();Object.assign(data.results,change);assert.equal(parseSunTimes(data,date),null);
  }
  assert.equal(parseSunTimes({...payload(),status:'UNKNOWN_ERROR'},date),null);
});

test('offline estimate follows Auckland seasons and keeps all lighting transitions finite',()=>{
  const summer=estimateSunTimes(new Date('2026-12-21T00:00:00Z')),winter=estimateSunTimes(new Date('2026-06-21T00:00:00Z'));
  assert.ok(summer.sunset-summer.sunrise>850);assert.ok(winter.sunset-winter.sunrise<600);
  for(let month=1;month<=12;month++){
    const estimate=estimateSunTimes(new Date(`2026-${String(month).padStart(2,'0')}-15T00:00:00Z`));
    assert.ok(estimate.dawn>0 && estimate.dusk<1440);
    for(let minute=0;minute<1440;minute++){const blend=daylightBlend(minute,estimate);assert.ok(blend.blend>=0 && blend.blend<=1);}
  }
});

test('daylight changes sky, water and lights without moving the hiker or camera; midnight is seamless',()=>{
  const world=createAlpineWorld(THREE,{compact:true});world.update(17);
  const camera=world.camera.position.clone(),hiker=world.hiker.root.position.clone(),time=world.clock.value;
  world.setDaylight(720,sun);const day=world.water.material.uniforms.waterColor.value.clone();
  const dayLights=world.scene.children.filter(o=>o.isLight).map(o=>o.intensity);
  world.setDaylight(0,sun);const night=world.water.material.uniforms.waterColor.value.clone();
  assert.ok(night.g<day.g/5);
  assert.ok(world.scene.children.filter(o=>o.isLight).some((o,i)=>o.intensity<dayLights[i]));
  assert.equal(world.scene.getObjectByName('daylight-sky').material.uniforms.daylight.value,0);
  world.setDaylight(1439,sun);assert.ok(world.water.material.uniforms.waterColor.value.equals(night));
  world.setDaylight(sun.sunset,sun);assert.ok(world.scene.getObjectByName('daylight-sky').material.uniforms.glow.value.r>.8);
  assert.ok(camera.equals(world.camera.position));assert.ok(hiker.equals(world.hiker.root.position));assert.equal(world.clock.value,time);
  world.dispose();
});

test('control starts live, travels independently, resumes live, caches API data, and refreshes after midnight',async()=>{
  const h=controlHarness();await flush();
  assert.equal(h.elements.time.textContent,'12:00');assert.equal(h.panel.dataset.mode,'live');
  assert.match(h.requests[0],/timezone=Pacific%2FAuckland/);assert.match(h.requests[0],/date=2026-10-28/);
  assert.equal(h.elements['[data-sun-status]'].textContent,'Sun times · ');assert.ok(h.storage.size);
  h.toggle();h.controller.advance(28.75);assert.equal(h.elements.time.textContent,'19:40');assert.equal(h.panel.dataset.mode,'travel');
  assert.equal(h.elements['.scene-time-travel'].attributes['aria-checked'],'true');
  h.advance('2026-10-28T00:00:00Z');assert.equal(h.elements.time.textContent,'19:40');assert.equal(h.requests.length,1);
  h.toggle();assert.equal(h.elements.time.textContent,'13:00');assert.equal(h.panel.dataset.mode,'live');
  h.advance('2026-10-28T11:01:00Z');await flush();assert.equal(h.requests.length,2);assert.match(h.requests[1],/date=2026-10-29/);
  assert.equal(h.elements.time.textContent,'00:01');h.controller.dispose();
});

test('cached sun data avoids a network request; offline mode labels estimates and limits retries',async()=>{
  const cached=controlHarness({cached:payload()});assert.equal(cached.requests.length,0);cached.controller.dispose();
  const offline=controlHarness({reject:true});await flush();
  assert.equal(offline.elements['[data-sun-status]'].textContent,'Estimated sun times · ');
  offline.toggle();offline.controller.advance(45);assert.equal(offline.elements.time.textContent,'00:00');
  offline.advance('2026-10-27T23:30:00Z');assert.equal(offline.requests.length,1);
  offline.advance('2026-10-28T00:01:00Z');await flush();assert.equal(offline.requests.length,2);offline.controller.dispose();
});

test('late API response cannot replace the next day, and hidden tabs do not keep updating',async()=>{
  const h=controlHarness({deferred:true});
  h.advance('2026-10-28T11:01:00Z');h.pending.shift()();await flush();
  assert.equal(h.elements['[data-sun-status]'].textContent,'Estimated sun times · ');
  h.controller.refresh();assert.equal(h.requests.length,2);h.pending.shift()();await flush();
  assert.equal(h.elements['[data-sun-status]'].textContent,'Sun times · ');
  const count=h.changes.length;h.document.hidden=true;h.advance('2026-10-28T12:00:00Z');assert.equal(h.changes.length,count);
  h.document.hidden=false;h.document.dispatch('visibilitychange');assert.equal(h.elements.time.textContent,'01:00');
  h.controller.dispose();
});

test('time travel loops a whole day every 90 seconds and turning it off restores live time',()=>{
  const h=controlHarness({cached:payload()});assert.equal(h.controller.travelling,false);
  h.controller.advance(30);assert.equal(h.elements.time.textContent,'12:00');
  h.toggle();assert.equal(h.controller.travelling,true);assert.equal(h.elements['[data-time-status]'].textContent,'Travelling');
  h.controller.advance(TIME_TRAVEL_SECONDS/4);assert.equal(h.elements.time.textContent,'18:00');
  h.controller.advance(TIME_TRAVEL_SECONDS/4);assert.equal(h.elements.time.textContent,'00:00');
  h.controller.advance(TIME_TRAVEL_SECONDS/2);assert.equal(h.elements.time.textContent,'12:00');
  h.controller.advance(TIME_TRAVEL_SECONDS*2);assert.equal(h.elements.time.textContent,'12:00');
  assert.equal(h.requests.length,0,'simulated days must not request other dates');
  h.advance('2026-10-28T00:00:00Z');h.toggle();
  assert.equal(h.controller.travelling,false);assert.equal(h.elements.time.textContent,'13:00');
  assert.equal(h.elements['.scene-time-travel'].attributes['aria-checked'],'false');
  h.controller.dispose();
});

test('travel pauses in hidden tabs and stops accepting ticks or toggles after disposal',()=>{
  const h=controlHarness({cached:payload()});h.toggle();h.controller.advance(10);
  const display=h.elements.time.textContent;
  h.document.hidden=true;h.controller.advance(180);assert.equal(h.elements.time.textContent,display);
  h.document.hidden=false;h.controller.advance(1);assert.notEqual(h.elements.time.textContent,display);
  for(const delta of [NaN,Infinity,-1,0]){const count=h.changes.length;h.controller.advance(delta);assert.equal(h.changes.length,count);}
  h.controller.dispose();const count=h.changes.length;h.toggle();h.controller.advance(180);
  assert.equal(h.changes.length,count);assert.equal(h.controller.travelling,false);
});

test('sun and moon exchange light smoothly at the horizon and across midnight',()=>{
  const noon=celestialState(sun.solar_noon,sun), midnight=celestialState(0,sun);
  assert.equal(noon.sunVisibility,1);assert.equal(noon.moonVisibility,0);assert.equal(noon.moonPower,0);
  assert.equal(midnight.sunVisibility,0);assert.equal(midnight.moonVisibility,1);assert.ok(midnight.moonPower>.8);
  for(const boundary of [0,sun.sunrise,sun.sunset]){
    const before=celestialState(boundary-.001,sun),after=celestialState(boundary+.001,sun);
    assert.ok(Math.abs(before.moonPower-after.moonPower)<.001);
    assert.ok(Math.abs(before.sunVisibility-after.sunVisibility)<.001);
    assert.ok(new THREE.Vector3(...before.moonDirection).distanceTo(new THREE.Vector3(...after.moonDirection))<.001);
  }
  for(let minute=0;minute<1440;minute++){
    const state=celestialState(minute,sun);
    assert.ok(state.sunVisibility>=0 && state.sunVisibility<=1);
    assert.ok(state.moonPower>=0 && state.moonPower<=.95);
    assert.ok([...state.sunDirection,...state.moonDirection].every(Number.isFinite));
  }
});

test('moonlight illuminates the scene with matching sky and lake directions while daylight switches it off',()=>{
  const world=createAlpineWorld(THREE,{compact:true});
  const sky=world.scene.getObjectByName('daylight-sky').material.uniforms;
  const lake=world.water.material.uniforms;
  const moonlight=world.scene.getObjectByName('moonlight'),sunlight=world.scene.getObjectByName('sunlight');
  world.setDaylight(0,sun);
  assert.ok(moonlight.intensity>.8);assert.equal(sunlight.intensity,0);
  assert.ok(moonlight.color.b>moonlight.color.r);
  assert.equal(sky.moonVisibility.value,1);assert.equal(lake.moonVisibility,sky.moonVisibility);
  assert.equal(lake.moonDirection,sky.moonDirection);
  assert.ok(moonlight.position.clone().normalize().distanceTo(sky.moonDirection.value)<1e-10);
  const midnightDirection=sky.moonDirection.value.clone();
  world.setDaylight(sun.sunrise-50,sun);assert.ok(midnightDirection.distanceTo(sky.moonDirection.value)>.05);
  world.setDaylight(sun.solar_noon,sun);assert.equal(moonlight.intensity,0);assert.ok(sunlight.intensity>3);
  assert.equal(sky.sunVisibility.value,1);assert.equal(lake.sunDirection,sky.sunDirection);
  assert.ok(sunlight.position.clone().normalize().distanceTo(sky.sunDirection.value)<1e-10);
  world.dispose();
});

test('sun at midday and moon at midnight stay inside the default mobile and desktop camera views',()=>{
  const world=createAlpineWorld(THREE,{compact:true});
  const sky=world.scene.getObjectByName('daylight-sky').material.uniforms;
  for(const portrait of [true,false]){
    world.worldFraming.compact=portrait;world.camera.aspect=portrait?390/660:1440/810;world.camera.fov=portrait?58:46;world.camera.updateProjectionMatrix();
    for(const time of [0,8,35])for(const [minutes,key] of [[sun.solar_noon,'sunDirection'],[0,'moonDirection']]){
      world.update(time);world.setDaylight(minutes,sun);world.camera.updateMatrixWorld();
      const position=sky[key].value.clone().multiplyScalar(3500),projected=position.clone().project(world.camera);
      assert.ok(Math.abs(projected.x)<.9 && Math.abs(projected.y)<.95,`${key} outside default view at ${time}, portrait=${portrait}`);
      world.scene.updateMatrixWorld(true);
      const ray=new THREE.Raycaster(world.camera.position,position.sub(world.camera.position).normalize());
      assert.equal(ray.intersectObject(world.scene.getObjectByName('snowy-massif')).length,0,`${key} hidden by the mountain at ${time}`);
    }
  }
  world.dispose();
});
