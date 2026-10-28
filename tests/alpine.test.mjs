// Node 22+: node --test tests/alpine.test.mjs
// Geometry and runtime checks; these do not substitute for a GPU/browser review.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../static/js/vendor/three.module.min.js';
import { createAlpineWorld, createHiker, summitHeight, terrainHeight, startAlpineRenderer, createLakeReflection, HIKER_SEATED_TIME, HIKER_SIT_START, TEA_PICKUP_TIME } from '../themes/portfolio/assets/js/alpine.js';

function harness({reduced=false, fail=false}={}) {
  let renders=0, mainRenders=0, reflectionRenders=0, next=0;
  const frames=new Map(), events={}, canvasEvents={}, motionEvents={}, buttonEvents={}, replayEvents={};
  const label={},icon={},attributes={},classes=new Set(),captured=new Set();
  const button={hidden:true,querySelector:s=>s.endsWith('-text')?label:icon,setAttribute:(k,v)=>attributes[k]=v,addEventListener:(k,cb)=>buttonEvents[k]=cb};
  const replay={hidden:true,addEventListener:(k,cb)=>replayEvents[k]=cb};
  const canvas={addEventListener:(k,cb)=>canvasEvents[k]=cb};
  const host={clientWidth:390,dataset:{},querySelector:s=>s==='canvas'?canvas:s==='.scene-replay'?replay:button,
    classList:{add:n=>classes.add(n),remove:n=>classes.delete(n)},
    setPointerCapture:id=>captured.add(id),hasPointerCapture:id=>captured.has(id),releasePointerCapture:id=>captured.delete(id),
    addEventListener:(k,cb)=>events[k]=cb,getBoundingClientRect:()=>({width:390,height:820,left:0,top:0})};
  const motion={matches:reduced,addEventListener:(k,cb)=>motionEvents[k]=cb};
  const document={hidden:false,addEventListener:(k,cb)=>events[k]=cb};
  class Renderer {
    constructor(){if(fail)throw Error('WebGL unavailable');this.shadowMap={};this.debug={};}
    setPixelRatio(){} setSize(){} dispose(){} clear(){}
    getRenderTarget(){return this.target||null;} setRenderTarget(target){this.target=target;}
    render(){renders++;if(this.target)reflectionRenders++;else mainRenders++;}
  }
  const runtime={document,devicePixelRatio:2,navigator:{},
    requestAnimationFrame:cb=>{frames.set(++next,cb);return next;},cancelAnimationFrame:id=>frames.delete(id),
    IntersectionObserver:class{constructor(cb){events.intersection=cb;}observe(){}},
    ResizeObserver:class{constructor(cb){events.resize=cb;}observe(){}}};
  const controller=startAlpineRenderer({...THREE,WebGLRenderer:Renderer},host,motion,runtime);
  return {host,motion,document,label,attributes,classes,captured,frames,events,canvasEvents,motionEvents,button,replay,controller,
    click:()=>buttonEvents.click(),replayScene:()=>replayEvents.click(),
    step(time){const batch=[...frames.values()];frames.clear();batch.forEach(cb=>cb(time));},get renders(){return renders;},get mainRenders(){return mainRenders;},get reflectionRenders(){return reflectionRenders;}};
}

test('hiker starts at the cliff without walking, sits down, and stays seated',()=>{
  const h=createHiker(THREE);
  const start=h.root.position.clone();h.pose(1.5);
  assert.ok(h.root.position.distanceTo(start)<.000001,'standing hiker must not walk');
  assert.equal(h.root.userData.phase,'standing');
  for(const arm of h.arms){
    assert.equal('pole' in arm,false);
    assert.equal(arm.fingers.length,4);assert.ok(arm.thumb.isGroup);
    assert.deepEqual(arm.elbow.children.filter(child=>child.isGroup),[arm.wrist]);
  }
  h.pose(HIKER_SIT_START);const standingHeight=h.body.position.y;
  h.pose(4.3);assert.equal(h.root.userData.phase,'sitting-down');
  assert.ok(h.body.position.y<standingHeight && h.body.position.y>-.8);
  for(let time=HIKER_SIT_START;time<=HIKER_SEATED_TIME;time+=.1){
    h.pose(time);h.root.updateMatrixWorld(true);
    for(const leg of h.legs)for(const z of [-.20,.08]){
      const sole=leg.ankle.localToWorld(new THREE.Vector3(0,-.12,z));
      assert.ok(sole.y>=summitHeight(sole.x,sole.z)-.12,`boot intersects cliff during sit at ${time}`);
    }
  }
  h.pose(HIKER_SEATED_TIME);const summit=h.root.position.clone();const angle=h.head.rotation.y;
  assert.equal(h.root.userData.phase,'seated');
  assert.equal(h.body.position.y,-.8);
  assert.equal(summit.y,summitHeight(summit.x,summit.z));
  h.root.updateMatrixWorld(true);
  for(const leg of h.legs){
    assert.ok(Math.abs(leg.hip.rotation.x-Math.PI/2)<.03);
    assert.ok(Math.abs(leg.knee.rotation.x+Math.PI/2)<.03);
    const boot=leg.ankle.localToWorld(new THREE.Vector3(0,-.135,-.057));
    assert.ok(boot.y>summitHeight(boot.x,boot.z)+.5,'seated boots clear the cliff face');
  }
  h.pose(90);assert.ok(h.root.position.distanceTo(summit)<.00001);
  assert.notEqual(h.head.rotation.y,angle);assert.ok(Math.abs(h.head.rotation.y)<.12);
  assert.equal(h.body.position.y,-.8);
});

test('scene uses live geometry and keeps the camera behind the hiker',()=>{
  const w=createAlpineWorld(THREE,{compact:true});
  assert.ok(w.scene.getObjectByName('summit-overlook'));
  assert.ok(w.scene.getObjectByName('animated-lake').material.isShaderMaterial);
  assert.ok(w.chunks[0].children[1].count>100);
  assert.ok(w.hiker.backpack.children.length>20);
  for(const compact of [false,true]){
    w.worldFraming.compact=compact;w.camera.aspect=compact?390/820:1440/810;
    w.camera.fov=compact?58:46;w.camera.updateProjectionMatrix();
    for(const t of [0,2,4,8,12,17,120]){
      w.update(t);w.scene.updateMatrixWorld(true);w.camera.updateMatrixWorld(true);
      assert.ok(w.camera.position.z>w.hiker.root.position.z+12);
      const center=w.hiker.body.localToWorld(new THREE.Vector3(0,1.1,0)).project(w.camera);
      assert.ok(Math.abs(center.x)<1 && Math.abs(center.y)<1,`hiker outside viewport at ${t}, compact=${compact}`);
    }
  }
  w.dispose();
});

test('camera approaches the hiker, holds the sit, then reveals the vista without cropping',()=>{
  const w=createAlpineWorld(THREE,{compact:true});
  for(const compact of [false,true]){
    w.worldFraming.compact=compact;w.camera.aspect=compact?390/820:1440/810;
    w.camera.fov=compact?58:46;w.camera.updateProjectionMatrix();
    w.update(0);const opening=w.camera.position.clone();
    w.update(3);const close=w.camera.position.clone();
    assert.ok(close.distanceTo(w.hiker.root.position)<opening.distanceTo(w.hiker.root.position)-5,'camera must visibly approach');
    w.update(26);assert.ok(w.camera.position.y>close.y+1,'landscape reveal cranes upward');
    for(let time=0;time<=30;time+=.1){
      w.update(time);w.scene.updateMatrixWorld(true);w.camera.updateMatrixWorld(true);
      for(const joint of [w.hiker.head,...w.hiker.legs.map(leg=>leg.ankle)]){
        const p=joint.getWorldPosition(new THREE.Vector3()).project(w.camera);
        assert.ok(Math.abs(p.x)<.92 && Math.abs(p.y)<.96,`camera crops hiker at ${time}, portrait=${compact}`);
      }
    }
  }
  w.dispose();
});

test('land geometry is finite and repeating boundaries have matching elevations',()=>{
  for(let x=-550;x<=550;x+=25){
    assert.ok(Number.isFinite(terrainHeight(x,-100)));
    assert.ok(Math.abs(terrainHeight(x,0)-terrainHeight(x,-720))<1e-8);
  }
});

test('pause freezes animation, resume continues, and replay restarts the summit moment',()=>{
  const s=harness();s.step(100);s.step(140);s.step(180);
  assert.ok(s.controller.elapsed>0);const elapsed=s.controller.elapsed;
  s.click();assert.equal(s.host.dataset.sceneState,'paused');assert.equal(s.frames.size,0);
  s.step(300);assert.equal(s.controller.elapsed,elapsed);
  assert.equal(s.attributes['aria-label'],'Play background animation');
  s.click();s.step(400);s.step(440);assert.ok(s.controller.elapsed>elapsed);
  s.replayScene();assert.equal(s.controller.elapsed,0);assert.equal(s.host.dataset.sceneState,'playing');
  s.controller.world.dispose();
});

test('reduced motion shows the completed seated pose and remains still',()=>{
  const s=harness({reduced:true});
  assert.equal(s.host.dataset.sceneState,'paused');assert.equal(s.frames.size,0);
  assert.equal(s.controller.world.hiker.root.userData.phase,'seated');
  s.replayScene();assert.equal(s.controller.world.hiker.root.userData.phase,'standing');
  s.motionEvents.change();assert.equal(s.controller.world.hiker.root.userData.phase,'seated');
  assert.equal(s.frames.size,0);s.controller.world.dispose();
});

test('offscreen and hidden tabs suspend work without losing the pause choice',()=>{
  const s=harness();s.events.intersection([{isIntersecting:false}]);
  assert.equal(s.host.dataset.sceneState,'suspended');assert.equal(s.frames.size,0);
  s.events.intersection([{isIntersecting:true}]);assert.equal(s.frames.size,1);
  s.document.hidden=true;s.events.visibilitychange();assert.equal(s.frames.size,0);
  s.click();s.document.hidden=false;s.events.visibilitychange();assert.equal(s.host.dataset.sceneState,'paused');
  s.controller.world.dispose();
});

test('unavailable WebGL, context loss and shader failure preserve the plain background fallback',()=>{
  const unavailable=harness({fail:true});assert.equal(unavailable.host.dataset.sceneState,'fallback');assert.equal(unavailable.button.hidden,true);
  const s=harness({reduced:true});let prevented=false;
  s.canvasEvents.webglcontextlost({preventDefault(){prevented=true;}});
  assert.ok(prevented);assert.equal(s.classes.has('is-ready'),false);assert.equal(s.replay.hidden,true);
  s.canvasEvents.webglcontextrestored();assert.equal(s.classes.has('is-ready'),true);assert.equal(s.frames.size,0);
  s.controller.renderer.debug.onShaderError();assert.equal(s.host.dataset.sceneState,'fallback');assert.equal(s.button.hidden,true);
  s.controller.world.dispose();
});


test('lake reflection mirrors the camera and restores renderer state even on failure',()=>{
  const world=createAlpineWorld(THREE,{compact:true});const reflection=createLakeReflection(THREE,world);
  const previous={name:'main-target'};let target=previous,throwDuringRender=false;
  const renderer={shadowMap:{autoUpdate:true},getRenderTarget:()=>target,setRenderTarget:t=>{target=t;},clear(){},
    render(scene,camera){assert.equal(world.water.visible,false);assert.ok(camera.position.y<0);if(throwDuringRender)throw Error('render failed');}};
  reflection.render(renderer);
  assert.equal(target,previous);assert.equal(world.water.visible,true);assert.equal(renderer.shadowMap.autoUpdate,true);
  assert.equal(world.water.material.uniforms.hasReflection.value,1);
  assert.ok(reflection.camera.projectionMatrix.elements.every(Number.isFinite));
  throwDuringRender=true;assert.throws(()=>reflection.render(renderer));
  assert.equal(target,previous);assert.equal(world.water.visible,true);assert.equal(renderer.shadowMap.autoUpdate,true);
  reflection.dispose();world.dispose();
});


test('planted feet and bracing hands stay locked without clipping or pose jumps',()=>{
  const h=createHiker(THREE);const previousFeet=new Map();let previousPelvis;
  let footContacts=0,handContacts=0;
  for(let frame=0;frame<=HIKER_SEATED_TIME*60;frame++){
    const time=frame/60;h.pose(time);h.root.updateMatrixWorld(true);
    const pelvis=h.body.localToWorld(new THREE.Vector3(0,.94,0));
    if(previousPelvis)assert.ok(pelvis.distanceTo(previousPelvis)<.05,`pelvis jump at ${time}`);
    previousPelvis=pelvis;
    for(const leg of h.legs){
      const contact=h.footContacts.get(leg.side);
      const ankle=leg.ankle.getWorldPosition(new THREE.Vector3());
      assert.ok(ankle.distanceTo(contact.target)<.001,`unreachable foot target at ${time}`);
      if(contact.planted){
        footContacts++;
        const previous=previousFeet.get(leg.side);
        if(previous)assert.ok(ankle.distanceTo(previous)<.001,`foot slides during stance at ${time}`);
        previousFeet.set(leg.side,ankle);
      }else previousFeet.delete(leg.side);
      for(const z of [-.18,.06]){
        const sole=leg.ankle.localToWorld(new THREE.Vector3(0,-.12,z));
        assert.ok(sole.y>=summitHeight(sole.x,sole.z)-.01,`boot intersects ground at ${time}`);
      }
    }
    for(const arm of h.arms){
      const contact=h.handContacts.get(arm.side);
      if(contact.planted){
        handContacts++;
        assert.ok(arm.wrist.getWorldPosition(new THREE.Vector3()).distanceTo(contact.target)<.001,`hand slides during support at ${time}`);
      }
    }
  }
  assert.ok(footContacts>450);assert.ok(handContacts>100);
});


test('tea stays on the fire until pickup, follows the hand, and returns on replay',()=>{
  const w=createAlpineWorld(THREE,{compact:true});
  const {hiker:h,teaFire:fire}=w;
  const start=fire.mug.position.clone();
  assert.ok(w.scene.getObjectByName('summit-tea-fire'));
  assert.ok(w.scene.getObjectByName('tea-steam'));
  for(const time of [0,2,5,7.8,9.9]){w.update(time);assert.ok(fire.mug.position.distanceTo(start)<1e-8);}
  let previousCup,previousHand;
  for(let frame=0;frame<=60*52;frame++){
    const time=frame/60;w.update(time);w.scene.updateMatrixWorld(true);
    const hand=h.arms.find(a=>a.side===-1).wrist.getWorldPosition(new THREE.Vector3());
    const grip=h.tea.grip.clone().applyQuaternion(fire.mug.quaternion).add(fire.mug.position);
    if(time>=TEA_PICKUP_TIME)assert.ok(hand.distanceTo(grip)<.001,`hand loses mug handle at ${time}`);
    if(previousCup)assert.ok(fire.mug.position.distanceTo(previousCup)<.06,`mug jumps at ${time}`);
    if(previousHand)assert.ok(hand.distanceTo(previousHand)<.10,`hand jumps at ${time}`);
    previousCup=fire.mug.position.clone();previousHand=hand;
  }
  w.update(16);assert.equal(fire.mug.userData.phase,'sipping');
  w.scene.updateMatrixWorld(true);
  const rim=fire.mug.localToWorld(h.tea.rim.clone());
  const face=h.head.localToWorld(new THREE.Vector3(0,-.06,-.13));
  assert.ok(rim.distanceTo(face)<.001,'mug must reach the mouth during the sip');
  w.update(20);assert.equal(fire.mug.userData.phase,'holding');
  w.update(0);assert.equal(fire.mug.userData.phase,'warming');assert.ok(fire.mug.position.distanceTo(start)<1e-8);
  w.dispose();
});


test('drinking keeps rim contact, an upright pickup and a relaxed elbow without joint flips',()=>{
  const h=createHiker(THREE),arm=h.arms.find(a=>a.side===-1);
  const previous=new Map();let previousElbow;let contactFrames=0;
  for(let frame=7*60;frame<=60*60;frame++){
    const time=frame/60;h.pose(time);h.root.updateMatrixWorld(true);
    const elbow=arm.elbow.getWorldPosition(new THREE.Vector3());
    if(previousElbow)assert.ok(elbow.distanceTo(previousElbow)<.06,`elbow jerks at ${time}`);
    previousElbow=elbow;
    for(const joint of [arm.shoulder,arm.elbow,arm.wrist]){
      const q=joint.getWorldQuaternion(new THREE.Quaternion());
      if(previous.has(joint))assert.ok(q.angleTo(previous.get(joint))<.13,`arm twists suddenly at ${time}`);
      previous.set(joint,q);
    }
    if(time>8.4)assert.ok(arm.shoulder.getWorldPosition(new THREE.Vector3()).y-elbow.y>.4,`elbow rises during drink at ${time}`);
    if(h.tea.contact){
      contactFrames++;
      const rim=h.tea.rim.clone().applyQuaternion(h.tea.quaternion).add(h.tea.position);
      const mouth=h.head.localToWorld(new THREE.Vector3(0,-.06,-.13));
      assert.ok(rim.distanceTo(mouth)<.001,`rim slips off lips at ${time}`);
    }
    if(time<14.8 || h.tea.phase==='holding'){
      const up=new THREE.Vector3(0,1,0).applyQuaternion(h.tea.quaternion);
      assert.ok(up.y>.999,'mug tips before reaching the lips');
    }
    const handle=new THREE.Vector3(1,0,0).applyQuaternion(h.tea.quaternion);
    handle.y=0;handle.normalize();
    if(time<10.35 || (time>=12.6 && h.tea.phase==='holding')){
      const towardHiker=arm.shoulder.getWorldPosition(new THREE.Vector3()).sub(h.tea.position);towardHiker.y=0;towardHiker.normalize();
      assert.ok(handle.dot(towardHiker)>.98,'handle must face the hiker during pickup and carrying');
    }
    if(h.tea.phase==='sipping'){
      const towardElbow=arm.elbow.getWorldPosition(new THREE.Vector3()).sub(h.tea.position);towardElbow.y=0;towardElbow.normalize();
      assert.ok(handle.dot(towardElbow)>.55,'handle must stay on the carrying arm side while drinking');
    }
  }
  assert.ok(contactFrames>300);
});


test('sitting palms face down with fingers forward and clear the rock',()=>{
  const h=createHiker(THREE),point=new THREE.Vector3();let samples=0;
  for(let frame=4.9*60;frame<=7.8*60;frame++){
    const time=frame/60;h.pose(time);h.root.updateMatrixWorld(true);
    for(const arm of h.arms){
      const q=arm.wrist.getWorldQuaternion(new THREE.Quaternion());
      const palmNormal=new THREE.Vector3(0,0,1).applyQuaternion(q);
      const fingerDirection=new THREE.Vector3(0,-1,0).applyQuaternion(q);
      assert.ok(palmNormal.y<-.98,'palm faces upward while sitting');
      assert.ok(fingerDirection.z<-.98,'fingers point backward while sitting');
      if(!h.handContacts.get(arm.side).planted)continue;
      arm.wrist.traverse(mesh=>{
        if(!mesh.isMesh)return;
        const positions=mesh.geometry.attributes.position;
        for(let i=0;i<positions.count;i++){
          point.fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld);
          assert.ok(point.y>=summitHeight(point.x,point.z)-.005,`hand enters rock at ${time}`);
        }
      });samples++;
    }
  }
  assert.ok(samples>100);
});

test('hand and forearm clear the mug body and grasp the handle facing the hiker',()=>{
  const h=createHiker(THREE),meshes=[],point=new THREE.Vector3(),cupInverse=new THREE.Matrix4(),transform=new THREE.Matrix4();
  h.arms.find(a=>a.side===-1).elbow.traverse(mesh=>{if(mesh.isMesh)meshes.push(mesh);});
  const scale=new THREE.Vector3(1,1,1);let contacts=0;
  for(let frame=8.4*60;frame<=60*60;frame++){
    const time=frame/60;h.pose(time);h.root.updateMatrixWorld(true);
    cupInverse.compose(h.tea.position,h.tea.quaternion,scale).invert();
    let handleDistance=Infinity;
    for(const mesh of meshes){
      transform.multiplyMatrices(cupInverse,mesh.matrixWorld);
      const positions=mesh.geometry.attributes.position;
      for(let i=0;i<positions.count;i++){
        point.fromBufferAttribute(positions,i).applyMatrix4(transform);
        if(point.y>=0 && point.y<=.38){
          assert.ok(Math.hypot(point.x,point.z)>.21,`hand penetrates mug at ${time}`);
        }
        const tubeDistance=Math.hypot(Math.hypot(point.x-.27,point.y-.18)-.125,point.z)-.025;
        handleDistance=Math.min(handleDistance,Math.abs(tubeDistance));
      }
    }
    if(time>=10.35){assert.ok(handleDistance<.015,`hand misses handle at ${time}`);contacts++;}
  }
  assert.ok(contacts>1000);
});


test('cup pickup keeps an open elbow, limits wrist bend and clears the jacket',()=>{
  const h=createHiker(THREE),arm=h.arms.find(a=>a.side===-1),meshes=[];
  arm.elbow.traverse(mesh=>{if(mesh.isMesh)meshes.push(mesh);});
  const inverse=new THREE.Matrix4(),transform=new THREE.Matrix4(),point=new THREE.Vector3();
  for(let frame=8.4*60;frame<=60*60;frame++){
    const time=frame/60;h.pose(time);h.root.updateMatrixWorld(true);
    const shoulder=arm.shoulder.getWorldPosition(new THREE.Vector3());
    const elbow=arm.elbow.getWorldPosition(new THREE.Vector3());
    const wrist=arm.wrist.getWorldPosition(new THREE.Vector3());
    const upper=elbow.clone().sub(shoulder),forearm=wrist.clone().sub(elbow);
    const hand=new THREE.Vector3(0,-1,0).applyQuaternion(arm.wrist.getWorldQuaternion(new THREE.Quaternion()));
    assert.ok(forearm.angleTo(hand)<80*Math.PI/180,`wrist overbends at ${time}`);
    if(time>=10 && time<=13.2)assert.ok(upper.angleTo(forearm)<=Math.PI/2,`elbow folds beyond 90 degrees during pickup at ${time}`);
    inverse.copy(h.torso.matrixWorld).invert();
    for(const mesh of meshes){
      transform.multiplyMatrices(inverse,mesh.matrixWorld);const positions=mesh.geometry.attributes.position;
      for(let i=0;i<positions.count;i++){
        point.fromBufferAttribute(positions,i).applyMatrix4(transform);
        if(point.y<-.245 || point.y>.265)continue;
        assert.ok(Math.hypot(point.x/.265,point.z/.18)>1,`forearm or hand enters jacket at ${time}`);
      }
    }
  }
});


test('arm rotation eases through wrist limits without acceleration spikes',()=>{
  const h=createHiker(THREE),arm=h.arms.find(a=>a.side===-1),previous=new Map(),velocities=new Map();
  for(let frame=7*120;frame<=60*120;frame++){
    const time=frame/120;h.pose(time);h.root.updateMatrixWorld(true);
    for(const joint of [arm.shoulder,arm.elbow,arm.wrist]){
      const q=joint.getWorldQuaternion(new THREE.Quaternion());
      if(previous.has(joint)){
        const delta=q.clone().multiply(previous.get(joint).clone().invert());
        if(delta.w<0){delta.x*=-1;delta.y*=-1;delta.z*=-1;delta.w*=-1;}
        const length=Math.hypot(delta.x,delta.y,delta.z);
        const velocity=new THREE.Vector3(delta.x,delta.y,delta.z).multiplyScalar(length>1e-9?2*Math.atan2(length,delta.w)/length*120:0);
        if(velocities.has(joint))assert.ok(velocity.distanceTo(velocities.get(joint))*120<30,`arm acceleration spikes at ${time}`);
        velocities.set(joint,velocity);
      }
      previous.set(joint,q);
    }
  }
});

test('animation targets 60 fps while reflections keep their separate lower cadence',()=>{
  for(const refreshRate of [60,120]){
    const s=harness();s.step(100);
    const main=s.mainRenders,reflections=s.reflectionRenders;
    for(let frame=1;frame<=refreshRate;frame++)s.step(100+frame*1000/refreshRate);
    assert.ok(s.mainRenders-main>=59 && s.mainRenders-main<=61,`incorrect render cadence at ${refreshRate} Hz`);
    assert.ok(s.reflectionRenders-reflections>=6 && s.reflectionRenders-reflections<=8,'reflection rate rises with animation rate');
    assert.ok(Math.abs(s.controller.elapsed-1)<.001,'animation clock drifts with refresh rate');
    s.controller.world.dispose();
  }
  const slow=harness();slow.step(100);
  for(let frame=1;frame<=130;frame++)slow.step(100+frame*40);
  const main=slow.mainRenders;
  for(let frame=1;frame<=120;frame++)slow.step(5300+frame*1000/120);
  assert.ok(slow.mainRenders-main>=29 && slow.mainRenders-main<=31,'slow-device fallback must retain a 30 fps cap');
  slow.controller.world.dispose();
});


function pointerEvent(host,overrides={}){
  return {target:host,pointerId:1,button:0,isPrimary:true,pointerType:'mouse',clientX:180,clientY:300,preventDefault(){},...overrides};
}

test('dragging explores a paused scene and release smoothly returns without resuming animation',()=>{
  const s=harness();s.click();const baseline=s.controller.world.camera.position.clone();
  const baselineRotation=s.controller.world.camera.quaternion.clone();
  s.events.pointermove(pointerEvent(s.host,{clientX:340}));s.step(100);
  assert.ok(s.controller.world.camera.position.distanceTo(baseline)<1e-8,'hover alone moves the camera');
  s.events.pointerdown(pointerEvent(s.host));assert.ok(s.captured.has(1));
  s.events.pointermove(pointerEvent(s.host,{clientX:340,clientY:180}));
  const reflections=s.reflectionRenders;
  for(let i=0;i<50;i++)s.step(200+i*1000/60);
  assert.ok(s.controller.world.camera.position.distanceTo(baseline)>3,'drag should visibly orbit the camera');
  assert.ok(s.controller.world.camera.quaternion.angleTo(baselineRotation)>.1);
  assert.ok(s.reflectionRenders>reflections,'reflections must follow a paused camera');
  assert.equal(s.controller.elapsed,0);assert.ok(s.classes.has('is-dragging'));
  s.events.pointerup(pointerEvent(s.host,{clientX:900}));assert.equal(s.captured.size,0);
  assert.ok(s.controller.world.camera.position.distanceTo(baseline)>1,'return must not snap');
  for(let i=0;i<360;i++)s.step(1100+i*1000/60);
  assert.ok(s.controller.world.camera.position.distanceTo(baseline)<.001,'camera did not return to the default view');
  assert.ok(s.controller.world.camera.quaternion.angleTo(baselineRotation)<.001);
  assert.equal(s.controller.elapsed,0);assert.equal(s.frames.size,0);assert.equal(s.host.dataset.sceneState,'paused');
  s.controller.world.dispose();
});

test('drag excludes links and text, ignores secondary pointers, and cancels cleanly',()=>{
  const s=harness();s.click();const baseline=s.controller.world.camera.position.clone();
  for(const target of [{closest:()=>({})},s.host]){
    s.events.pointerdown(pointerEvent(target,{target,button:target===s.host?2:0}));
    assert.equal(s.captured.size,0);
  }
  s.events.pointerdown(pointerEvent(s.host,{isPrimary:false}));assert.equal(s.captured.size,0);
  s.events.pointerdown(pointerEvent(s.host,{pointerType:'touch'}));
  s.events.pointermove(pointerEvent(s.host,{pointerId:2,clientX:390}));
  for(let i=0;i<10;i++)s.step(100+i*20);
  assert.ok(s.controller.world.camera.position.distanceTo(baseline)<1e-8,'second finger changed the view');
  s.events.pointermove(pointerEvent(s.host,{pointerType:'touch',clientX:20}));
  for(let i=0;i<30;i++)s.step(400+i*20);
  assert.ok(s.controller.world.camera.position.distanceTo(baseline)>1);
  s.events.pointercancel(pointerEvent(s.host));
  assert.equal(s.classes.has('is-dragging'),false);assert.equal(s.captured.size,0);
  for(let i=0;i<250;i++)s.step(1100+i*20);
  assert.ok(s.controller.world.camera.position.distanceTo(baseline)<.001);
  s.events.pointerdown(pointerEvent(s.host));s.events.lostpointercapture(pointerEvent(s.host));assert.equal(s.classes.has('is-dragging'),false);
  s.controller.world.dispose();
});

test('reduced motion permits direct exploration and keyboard control without an animated return',()=>{
  const s=harness({reduced:true});const baseline=s.controller.world.camera.position.clone(),elapsed=s.controller.elapsed;
  s.events.pointerdown(pointerEvent(s.host));s.events.pointermove(pointerEvent(s.host,{clientX:350}));
  assert.ok(s.controller.world.camera.position.distanceTo(baseline)>1);
  assert.equal(s.frames.size,0);
  s.events.pointerup(pointerEvent(s.host));assert.ok(s.controller.world.camera.position.distanceTo(baseline)<1e-8);
  s.events.keydown({target:s.host,key:'ArrowLeft',preventDefault(){}});
  assert.ok(s.controller.world.camera.position.distanceTo(baseline)>1);
  s.events.keyup({key:'ArrowLeft'});assert.ok(s.controller.world.camera.position.distanceTo(baseline)<1e-8);
  s.events.keydown({target:s.host,key:'ArrowRight',preventDefault(){}});
  s.events.keydown({target:s.host,key:'Escape',preventDefault(){}});
  assert.ok(s.controller.world.camera.position.distanceTo(baseline)<1e-8);
  assert.equal(s.controller.elapsed,elapsed);assert.equal(s.frames.size,0);
  s.controller.world.dispose();
});

test('camera drag limits keep the view behind the hiker and above the summit',()=>{
  const w=createAlpineWorld(THREE,{compact:true});
  for(const compact of [true,false])for(const time of [0,3,8,16,30,90])for(const x of [-100,100])for(const y of [-100,100]){
    w.worldFraming.compact=compact;w.update(time,{x,y});
    assert.ok(w.camera.position.z>w.hiker.root.position.z+8,'drag reveals the face');
    assert.ok(w.camera.position.y>summitHeight(w.camera.position.x,w.camera.position.z)+1,'drag enters the ground');
    assert.ok(w.camera.quaternion.toArray().every(Number.isFinite));
  }
  w.dispose();
});
