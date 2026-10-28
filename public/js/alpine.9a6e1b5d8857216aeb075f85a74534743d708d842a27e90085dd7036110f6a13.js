/* Real-time alpine environment. All terrain, foliage, water and atmosphere are
 * rendered in 3D; a plain background remains visible until WebGL is ready. */
export const TILE_LENGTH = 720;
export const HIKER_SIT_START = 2;
export const HIKER_SEATED_TIME = 7.8;
export const TEA_PICKUP_TIME = 10;
export const TEA_FIRE_POSITION = Object.freeze({x:4.25,z:-4.7});
const TAU = Math.PI * 2;
const mod = (n, d) => ((n % d) + d) % d;
const mix = (a, b, t) => a + (b - a) * t;
const smooth = t => t * t * (3 - 2 * t);
const AUCKLAND_ZONE = 'Pacific/Auckland';
const aucklandFormatter = new Intl.DateTimeFormat('en-NZ', {
  timeZone: AUCKLAND_ZONE, year:'numeric', month:'2-digit', day:'2-digit',
  hour:'2-digit', minute:'2-digit', hourCycle:'h23', timeZoneName:'short'
});
export function aucklandTime(date = new Date()) {
  const p = Object.fromEntries(aucklandFormatter.formatToParts(date).map(part => [part.type, part.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour)*60+Number(p.minute), zone:p.timeZoneName };
}
export function formatSceneTime(minutes) {
  const value = mod(Math.floor(minutes),1440);
  return `${String(Math.floor(value/60)).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`;
}
export function parseSunTimes(payload, date) {
  const r=payload?.results;
  if(payload?.status!=='OK' || r?.date!==date || r.timezone!==AUCKLAND_ZONE)return null;
  const result={};
  for(const key of ['dawn','sunrise','solar_noon','sunset','dusk']){
    const match=/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(r[key]);
    if(!match || +match[1]>23 || +match[2]>59 || +(match[3]||0)>59)return null;
    result[key]=+match[1]*60 + +match[2] + +(match[3]||0)/60;
  }
  const times=Object.values(result);
  if(times.some((v,i)=>i && v<=times[i-1]))return null;
  return result;
}
// Seasonal estimate only while offline/loading; the control labels it explicitly.
export function estimateSunTimes(date) {
  const local=aucklandTime(date), day=Date.parse(`${local.date}T12:00:00Z`);
  const dayOfYear=(day-Date.UTC(new Date(day).getUTCFullYear(),0,0))/86400000;
  const declination=23.44*Math.PI/180*Math.sin(TAU*(284+dayOfYear)/365);
  const latitude=-36.8485*Math.PI/180;
  const hourAngle=altitude=>Math.acos((Math.sin(altitude*Math.PI/180)-Math.sin(latitude)*Math.sin(declination))/(Math.cos(latitude)*Math.cos(declination)))*720/Math.PI;
  const offset=(Date.parse(`${local.date}T${formatSceneTime(local.minutes)}:00Z`)-Math.floor(date.getTime()/60000)*60000)/60000;
  const b=TAU*(dayOfYear-81)/364;
  const equation=9.87*Math.sin(2*b)-7.53*Math.cos(b)-1.5*Math.sin(b);
  const noon=720-4*174.7633+offset-equation, dayArc=hourAngle(-.833), twilightArc=hourAngle(-6);
  return {dawn:noon-twilightArc,sunrise:noon-dayArc,solar_noon:noon,sunset:noon+dayArc,dusk:noon+twilightArc};
}

// Colors are interpolated in linear space by Three.js; times follow today's sun events.
const DAY_PALETTES = {
  night: {zenith:'#101f3b',horizon:'#354d71',glow:'#7c96b8',water:'#164456',reflection:'#365675',cloud:'#536682',sun:'#b6d0ef',ambient:'#9bb7df',ground:'#555d68',fog:'#324862',power:.08,fill:.42,hemi:.60,key:.42,day:0},
  twilight: {zenith:'#344d89',horizon:'#cf8193',glow:'#ffb49b',water:'#245568',reflection:'#967d9d',cloud:'#a394b4',sun:'#efadc1',ambient:'#91a8de',ground:'#535356',fog:'#7f8ba9',power:.3,fill:.3,hemi:.55,key:.48,day:.12},
  sunrise: {zenith:'#639fd7',horizon:'#f2c5a5',glow:'#f6d29a',water:'#087f98',reflection:'#55b5b6',cloud:'#f6d9ca',sun:'#f5b980',ambient:'#e5dccc',ground:'#625a35',fog:'#b8c9c8',power:1.5,fill:.55,hemi:.8,key:1.0,day:.65},
  day: {zenith:'#168cdb',horizon:'#a8d4ed',glow:'#fff1d2',water:'#007b99',reflection:'#21abb7',cloud:'#ffffff',sun:'#fff0d3',ambient:'#eaf1dc',ground:'#454b2b',fog:'#b9d5d9',power:3.1,fill:.85,hemi:1,key:1.6,day:1},
  golden: {zenith:'#4e91ca',horizon:'#f2c99f',glow:'#f6dfa9',water:'#087b94',reflection:'#64afb0',cloud:'#f6e3c5',sun:'#f5cd8c',ambient:'#ecdfc9',ground:'#5c4d30',fog:'#c0ceca',power:2.4,fill:.65,hemi:.9,key:1.4,day:.9},
  sunset: {zenith:'#687ca8',horizon:'#e99e87',glow:'#f2be83',water:'#276b86',reflection:'#b7848e',cloud:'#eebcb0',sun:'#f39f6c',ambient:'#c9c5cb',ground:'#514b42',fog:'#b0a5b3',power:1.05,fill:.4,hemi:.65,key:.85,day:.45}
};
export function daylightBlend(minutes, sun) {
  const keys=[[0,'night'],[sun.dawn-35,'night'],[sun.dawn,'twilight'],[sun.sunrise,'sunrise'],
    [sun.sunrise+75,'day'],[sun.sunset-100,'day'],[sun.sunset-45,'golden'],
    [sun.sunset,'sunset'],[sun.dusk,'twilight'],[sun.dusk+45,'night'],[1440,'night']];
  const value=mod(minutes,1440);
  const index=keys.findIndex((key,i)=>i>0 && value<=key[0]);
  const a=keys[index-1], b=keys[index];
  return {from:DAY_PALETTES[a[1]],to:DAY_PALETTES[b[1]],blend:smooth((value-a[0])/(b[0]-a[0]))};
}

// Art-directed arcs keep both bodies in the alpine vista. The moon is a
// full-moon night-light, not an astronomical ephemeris or a live lunar phase.
export function celestialState(minutes, sun) {
  const value=mod(minutes,1440), clamp=v=>Math.max(0,Math.min(1,v));
  const dayProgress=clamp((value-sun.sunrise)/(sun.sunset-sun.sunrise));
  const nightLength=1440-sun.sunset+sun.sunrise;
  // Extend the night arc across twilight on either side; switch arcs only at
  // midday, when the moon is invisible, so sunset cannot make it jump sideways.
  const nightElapsed=value>=(sun.sunrise+sun.sunset)/2?value-sun.sunset:value+1440-sun.sunset;
  const nightProgress=clamp(nightElapsed/nightLength);
  const sunVisibility=smooth(clamp((value-sun.sunrise+18)/36))*(1-smooth(clamp((value-sun.sunset+18)/36)));
  const moonVisibility=1-sunVisibility;
  return {
    sunDirection:[mix(-.16,.16,dayProgress),.07+.22*Math.sin(Math.PI*dayProgress),-1],
    moonDirection:[mix(.04,-.23,nightProgress),.10+.19*Math.sin(Math.PI*nightProgress),-1],
    sunVisibility,moonVisibility,moonPower:moonVisibility*(.35+.6*Math.sin(Math.PI*nightProgress))
  };
}

export const TIME_TRAVEL_SECONDS = 90;

export function createDaylightControl(host, onChange, runtime=globalThis) {
  const panel=host.querySelector('.scene-time');
  if(!panel)return null;
  const clock=panel.querySelector('time'), toggle=panel.querySelector('.scene-time-travel');
  const status=panel.querySelector('[data-time-status]');
  const zone=panel.querySelector('[data-time-zone]'), events=panel.querySelector('[data-sun-times]');
  const source=panel.querySelector('[data-sun-status]');
  const now=()=>new (runtime.Date||Date)();
  let selected=null, dateKey='', sun, estimated=true, retryAt=0, disposed=false, request=null, readout='';
  function paint(animated=false){
    if(disposed)return;
    const current=aucklandTime(now()), minutes=selected??current.minutes;
    const display=formatSceneTime(minutes), travelling=selected!==null;
    const nextReadout=`${current.date}|${display}|${travelling}|${estimated}|${sun.sunrise}|${sun.sunset}`;
    if(nextReadout!==readout){
      readout=nextReadout;
      if(clock.textContent!==display){clock.textContent=display;clock.dateTime=display;}
      zone.textContent='Auckland time';
      clock.setAttribute('aria-label',`${display}, Auckland ${current.zone}${travelling?', time travel preview':''}`);
      status.textContent=travelling?'Travelling':'Live';
      toggle.setAttribute('aria-checked',String(travelling));
      panel.dataset.mode=travelling?'travel':'live';
      events.textContent=`↑ ${formatSceneTime(sun.sunrise)}   ↓ ${formatSceneTime(sun.sunset)}`;
      events.setAttribute('aria-label',`Sunrise ${formatSceneTime(sun.sunrise)}, sunset ${formatSceneTime(sun.sunset)}${estimated?', estimated':''}`);
      source.textContent=estimated?'Estimated sun times · ':'Sun times · ';
    }
    onChange(minutes,sun,{animated});
  }
  async function loadSun(date){
    const abort=new AbortController();request?.abort();request=abort;
    const timeout=runtime.setTimeout(()=>abort.abort(),6000);
    try{
      const response=await runtime.fetch(`https://api.sunrisesunset.io/json?lat=-36.8485&lng=174.7633&date=${date}&timezone=Pacific%2FAuckland&time_format=24`,{signal:abort.signal});
      if(!response.ok)throw Error('Sun times unavailable');
      const payload=await response.json(), parsed=parseSunTimes(payload,date);
      if(!parsed)throw Error('Invalid sun times');
      if(disposed || date!==dateKey)return;
      sun=parsed;estimated=false;
      try{runtime.localStorage.setItem('alpine-auckland-sun',JSON.stringify(payload));}catch{}
      paint();
    }catch{/* Keep the labeled seasonal estimate; retry at most once per hour. */}
    finally{runtime.clearTimeout(timeout);if(request===abort)request=null;}
  }
  function refresh(){
    const current=now(), date=aucklandTime(current).date;
    if(date!==dateKey){
      dateKey=date;sun=estimateSunTimes(current);estimated=true;retryAt=0;
      try{const cached=parseSunTimes(JSON.parse(runtime.localStorage.getItem('alpine-auckland-sun')),date);if(cached){sun=cached;estimated=false;}}catch{}
    }
    paint();
    if(estimated && !request && current.getTime()>=retryAt){retryAt=current.getTime()+3600000;void loadSun(date);}
  }
  const toggleTravel=()=>{selected=selected===null?aucklandTime(now()).minutes:null;refresh();};
  const visibility=()=>{if(!runtime.document.hidden)refresh();};
  toggle.addEventListener('click',toggleTravel);
  runtime.document.addEventListener('visibilitychange',visibility);
  refresh();panel.hidden=false;
  const timer=runtime.setInterval(()=>{if(!runtime.document.hidden)refresh();},15000);
  return {
    refresh,
    get travelling(){return !disposed && selected!==null;},
    advance(seconds){
      if(disposed || selected===null || runtime.document.hidden || !Number.isFinite(seconds) || seconds<=0)return;
      selected=mod(selected+seconds*1440/TIME_TRAVEL_SECONDS,1440);paint(true);
    },
    dispose(){disposed=true;request?.abort();runtime.clearInterval(timer);toggle.removeEventListener('click',toggleTravel);runtime.document.removeEventListener('visibilitychange',visibility);}
  };
}

function hash(x, z) {
  const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return n - Math.floor(n);
}
// Periodic noise makes the terrain boundaries meet at every octave.
export function terrainNoise(x, z, frequency = 16) {
  x = x / TILE_LENGTH * frequency;
  z = mod(z, TILE_LENGTH) / TILE_LENGTH * frequency;
  const ix = Math.floor(x), iz = Math.floor(z);
  const u = smooth(x - ix), v = smooth(z - iz);
  return mix(mix(hash(ix, mod(iz, frequency)), hash(ix + 1, mod(iz, frequency)), u),
    mix(hash(ix, mod(iz + 1, frequency)), hash(ix + 1, mod(iz + 1, frequency)), u), v);
}
export function riverCenter(z) {
  return 27 * Math.sin(z / TILE_LENGTH * TAU) + 9 * Math.sin(z / TILE_LENGTH * TAU * 2 + .8);
}
export function terrainHeight(x, z) {
  const shore = Math.max(0, Math.abs(x - riverCenter(z)) - (80 + 16 * Math.sin(z / TILE_LENGTH * TAU + .8)));
  const ridge = 1 - Math.abs(terrainNoise(x, z, 8) * 2 - 1);
  const foothills = (1 - Math.exp(-shore / 32)) * (11 + 19 * terrainNoise(x, z, 16));
  const mountain = Math.max(0, shore - 65) * (.16 + ridge * .34);
  const detail = (terrainNoise(x, z, 32) - .5) * 12 + (terrainNoise(x, z, 64) - .5) * 5;
  return -3 + foothills + mountain + detail * Math.min(1, shore / 35);
}

const noiseGLSL = `
float hash21(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float alpineNoise(vec2 p) {
  vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash21(i),hash21(i+vec2(1.,0.)),f.x),
    mix(hash21(i+vec2(0.,1.)),hash21(i+vec2(1.,1.)),f.x),f.y);
}
float fbm(vec2 p) { return alpineNoise(p)*.55+alpineNoise(p*2.03)*.27+alpineNoise(p*4.07)*.12+alpineNoise(p*8.13)*.06; }
`;

// Tiled, deterministic material microdetail generated on-device: no image download.
export function createSurfaceMaps(T, kind = 'rock') {
  const size=128, heights=new Float32Array(size*size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const weave=(Math.sin(x*Math.PI*.5)*Math.sin(y*Math.PI*.5))*.11;
    const grit=hash(x,y)*.45+hash(Math.floor(x/4),Math.floor(y/4))*.3;
    heights[y*size+x]=kind==='fabric'?.5+weave+hash(x,y)*.035:grit+Math.sin(x*.15+y*.07)*.12;
  }
  const pixels=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const sample=(u,v)=>heights[mod(v,size)*size+mod(u,size)];
    const strength=kind==='fabric'?.55:1.8;
    const n=new T.Vector3((sample(x-1,y)-sample(x+1,y))*strength,(sample(x,y-1)-sample(x,y+1))*strength,1).normalize();
    const i=(y*size+x)*4;pixels[i]=(n.x*.5+.5)*255;pixels[i+1]=(n.y*.5+.5)*255;pixels[i+2]=(n.z*.5+.5)*255;pixels[i+3]=255;
  }
  const normal=new T.DataTexture(pixels,size,size,T.RGBAFormat);
  normal.wrapS=normal.wrapT=T.RepeatWrapping;normal.generateMipmaps=true;
  normal.minFilter=T.LinearMipmapLinearFilter;normal.magFilter=T.LinearFilter;normal.anisotropy=4;normal.needsUpdate=true;
  normal.repeat.set(kind==='fabric'?12:48,kind==='fabric'?12:48);
  return normal;
}

// Planar reflection using Three.js's reflected-camera / oblique-clip approach.
// Three.js MIT license: static/js/vendor/three.LICENSE.txt.
export function createLakeReflection(T, world) {
  const target=new T.WebGLRenderTarget(world.compact?256:768,world.compact?256:512,{depthBuffer:true});
  const reflectedCamera=new T.PerspectiveCamera();
  const textureMatrix=new T.Matrix4(),up=new T.Vector3(0,1,0),point=new T.Vector3(0,-.15,0);
  const plane=new T.Plane(),clip=new T.Vector4(),q=new T.Vector4();
  world.water.material.uniforms.reflectionMap.value=target.texture;
  world.water.material.uniforms.reflectionMatrix.value=textureMatrix;
  function render(renderer){
    const camera=world.camera;camera.updateMatrixWorld();
    const position=camera.position.clone();position.y=2*point.y-position.y;
    const look=camera.getWorldDirection(new T.Vector3()).add(camera.position);look.y=2*point.y-look.y;
    reflectedCamera.position.copy(position);
    reflectedCamera.up.copy(camera.up).reflect(up);reflectedCamera.lookAt(look);
    reflectedCamera.far=camera.far;reflectedCamera.updateMatrixWorld();
    reflectedCamera.projectionMatrix.copy(camera.projectionMatrix);
    textureMatrix.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1)
      .multiply(reflectedCamera.projectionMatrix).multiply(reflectedCamera.matrixWorldInverse);
    plane.setFromNormalAndCoplanarPoint(up,point).applyMatrix4(reflectedCamera.matrixWorldInverse);
    clip.set(plane.normal.x,plane.normal.y,plane.normal.z,plane.constant);
    const p=reflectedCamera.projectionMatrix.elements;
    q.set((Math.sign(clip.x)+p[8])/p[0],(Math.sign(clip.y)+p[9])/p[5],-1,(1+p[10])/p[14]);
    clip.multiplyScalar(2/clip.dot(q));p[2]=clip.x;p[6]=clip.y;p[10]=clip.z+1-.001;p[14]=clip.w;
    const previous=renderer.getRenderTarget(),shadows=renderer.shadowMap.autoUpdate;
    const waterVisible=world.water.visible;
    try{
      world.water.visible=false;renderer.shadowMap.autoUpdate=false;
      renderer.setRenderTarget(target);renderer.clear();renderer.render(world.scene,reflectedCamera);
      world.water.material.uniforms.hasReflection.value=1;
    }finally{
      world.water.visible=waterVisible;renderer.shadowMap.autoUpdate=shadows;renderer.setRenderTarget(previous);
    }
  }
  return {render,target,camera:reflectedCamera,dispose:()=>target.dispose()};
}

export function summitHeight(x, z) {
  const edge = Math.hypot((x - 7) / 27, (z - 6) / 39) + Math.sin(x*.21+z*.08)*.018;
  const falloff = smooth(Math.max(0, Math.min(1, (edge - .55) / .45)));
  // A worn lip at the end of the path provides a real drop below the seated feet.
  const lipWidth=1-smooth(Math.max(0,Math.min(1,(Math.abs(x-7)-3)/4)));
  const lipDrop=7*smooth(Math.max(0,Math.min(1,(-z-5.45)/1.5)))*lipWidth;
  return 90 - .23 * (z + 5) - .018 * (x - 7) ** 2 - falloff * 62 - lipDrop;
}

// An articulated, rear-facing character: clothing, equipment and joints are
// separate meshes, so the standing-to-sitting motion animates in actual 3D.
export function createHiker(T) {
  const root = new T.Group(); root.name = 'summit-hiker'; root.scale.setScalar(3.1);
  const fabricNormal=createSurfaceMaps(T,'fabric');
  const cloth = color => new T.MeshPhysicalMaterial({ color, roughness: .86, normalMap:fabricNormal, normalScale:new T.Vector2(.22,.22), sheen:.16, sheenRoughness:.8 });
  const jacket = cloth('#288f83'), panels = cloth('#11626f'), trousers = cloth('#283b52');
  const pack = cloth('#c5a02e'), pocket = cloth('#9c7920'), webbing = cloth('#303d35');
  const leather = cloth('#75543d'), sole = cloth('#30373c'), skin = cloth('#ab8061');
  const hat = cloth('#b77b49'), metal = new T.MeshStandardMaterial({ color: '#bac9ce', roughness: .35, metalness: .65 });
  const black = cloth('#252f35');
  const sphere = new T.SphereGeometry(1, 28, 20);
  function mesh(geometry, material, parent, position = [0, 0, 0], scale) {
    const m = new T.Mesh(geometry, material); m.position.set(...position);
    if (scale) m.scale.set(...scale);
    m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  }
  function ellipsoid(material, parent, position, scale) { return mesh(sphere, material, parent, position, scale); }
  function tube(points, radius, material, parent) {
    return mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p))), 16, radius, 6, false), material, parent);
  }
  function roundedBox(width, height, depth, radius) {
    const s = new T.Shape(), x = -width / 2, y = -height / 2, r = radius;
    s.moveTo(x + r, y); s.lineTo(x + width - r, y); s.quadraticCurveTo(x + width, y, x + width, y + r);
    s.lineTo(x + width, y + height - r); s.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    s.lineTo(x + r, y + height); s.quadraticCurveTo(x, y + height, x, y + height - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    const geometry = new T.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: .035, bevelSize: .03, bevelSegments: 6, steps: 1, curveSegments: 6 });
    geometry.translate(0, 0, -depth / 2); return geometry;
  }
  // Tailored cross sections replace capsule limbs: tapered cuffs, fuller muscle
  // volumes and small fabric compression folds preserve a human silhouette.
  function garment(length,profile,depth,phase=0){
    const vertices=[],uv=[],indices=[],rings=28,sides=32;
    for(let ring=0;ring<=rings;ring++){
      const t=ring/rings,k=Math.min(profile.length-2,Math.floor(t*(profile.length-1)));
      const u=t*(profile.length-1)-k,r=mix(profile[k],profile[k+1],smooth(u));
      for(let j=0;j<=sides;j++){
        const angle=j/sides*TAU;
        const fold=(Math.sin(t*54+Math.sin(angle*3+phase)*2)*.0015+Math.sin(t*27-angle*4)*.0012)*Math.sin(Math.PI*t);
        vertices.push(Math.cos(angle)*(r+fold),-t*length,Math.sin(angle)*(r*depth+fold));uv.push(j/sides,t);
        if(ring<rings&&j<sides){const n=ring*(sides+1)+j;indices.push(n,n+1,n+sides+1,n+1,n+sides+2,n+sides+1);}
      }
    }
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
    g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
  }
  const body = new T.Group(); root.add(body);
  ellipsoid(trousers, body, [0, .96, 0], [.255, .16, .17]);
  const torso = new T.Group(); torso.position.y = 1.24; body.add(torso);
  const torsoProfile=[[.215,-.245],[.235,-.20],[.225,-.10],[.25,.04],[.265,.16],[.24,.235],[.16,.27]].map(([r,y])=>new T.Vector2(r,y));
  const tailoredTorso=new T.LatheGeometry(torsoProfile,32);tailoredTorso.scale(1,.98,.66);
  const tp=tailoredTorso.attributes.position;
  for(let i=0;i<tp.count;i++){
    const x=tp.getX(i),y=tp.getY(i),z=tp.getZ(i);
    const fold=Math.sin(y*65+x*18)*.004+Math.sin(y*27+z*25)*.003;
    tp.setXYZ(i,x*(1+fold),y,z+fold);
  }
  tailoredTorso.computeVertexNormals();mesh(tailoredTorso,jacket,torso);
  ellipsoid(panels, torso, [0, -.22, 0], [.25, .065, .16]);
  // Jacket collar, back yoke and panel seams.
  mesh(new T.CylinderGeometry(.13, .17, .13, 16), panels, torso, [0, .30, 0]);
  tube([[-.23,.15,.16],[0,.12,.175],[.23,.15,.16]], .008, panels, torso);
  tube([[-.23,.10,.15],[-.23,-.08,.15],[-.20,-.22,.15]], .006, panels, torso);
  tube([[.23,.10,.15],[.23,-.08,.15],[.20,-.22,.15]], .006, panels, torso);
  const head = new T.Group(); head.scale.set(.88,.9,.9); head.position.y = 1.66; body.add(head);
  ellipsoid(skin, head, [0, 0, 0], [.135, .175, .13]);
  // Knit cap covers the head; no eyes, mouth or other facial geometry is created.
  ellipsoid(hat, head, [0, .075, .007], [.149, .154, .145]);
  mesh(new T.CylinderGeometry(.15, .148, .072, 24), hat, head, [0, .015, .005]);
  for (let i = 0; i < 24; i++) {
    const angle = i / 24 * TAU;
    tube([[Math.cos(angle)*.151,-.015,Math.sin(angle)*.151],[Math.cos(angle)*.153,.048,Math.sin(angle)*.153]], .0028, pocket, head);
  }


  const backpack = new T.Group(); backpack.position.set(0, 1.26, .225); backpack.scale.set(.84,.90,.84); body.add(backpack);
  const packBody=roundedBox(.40,.54,.20,.10);
  const bp=packBody.attributes.position;
  for(let i=0;i<bp.count;i++){
    const x=bp.getX(i),y=bp.getY(i),z=bp.getZ(i);
    const bulge=Math.cos(y*4)*Math.cos(x*6)*.025;
    bp.setZ(i,z+(z>0?bulge:-bulge));
  }
  packBody.computeVertexNormals();mesh(packBody,pack,backpack);
  mesh(roundedBox(.34, .25, .06, .035), pocket, backpack, [0, -.09, .145]);
  mesh(roundedBox(.42, .105, .23, .04), pack, backpack, [0, .28, .015]);
  tube([[-.15,-.01,.184],[0,.005,.185],[.15,-.01,.184]], .007, webbing, backpack);
  for (const side of [-1, 1]) {
    mesh(new T.BoxGeometry(.035,.47,.013), webbing, backpack, [side*.14,-.005,.202]);
    mesh(new T.BoxGeometry(.057,.043,.025), metal, backpack, [side*.14,.07,.219]);
    tube([[side*.15,.27,.08],[side*.26,.20,-.13],[side*.24,-.21,-.20],[side*.17,-.29,.03]], .025, webbing, backpack);
    tube([[side*.23,.21,.04],[side*.29,.11,.03],[side*.24,-.02,.04]], .009, webbing, backpack);
  }
  mesh(new T.BoxGeometry(.10,.055,.018), panels, backpack, [0,.16,.132]);
  mesh(new T.CylinderGeometry(.055,.055,.30,12), metal, backpack, [.29,-.02,.055]);
  mesh(new T.CylinderGeometry(.035,.035,.045,10), black, backpack, [.29,.15,.055]);
  mesh(new T.BoxGeometry(.08,.035,.10), webbing, backpack, [.29,-.05,.055]);
  // Rolled sleeping pad with binding straps, visible from the rear.
  const roll = mesh(new T.CylinderGeometry(.085,.085,.57,18), panels, backpack, [0,-.36,.04]); roll.rotation.z = Math.PI / 2;
  for (const side of [-1,1]) {
    const binding = mesh(new T.TorusGeometry(.088,.013,6,18), webbing, backpack, [side*.18,-.36,.04]); binding.rotation.y = Math.PI / 2;
    for (const radius of [.025,.050,.073]) {
      const ring = mesh(new T.TorusGeometry(radius,.004,4,16), webbing, backpack, [side*.288,-.36,.04]); ring.rotation.y = Math.PI / 2;
    }
  }
  const belt = mesh(new T.TorusGeometry(.235,.023,6,24), webbing, body, [0,.99,0]); belt.rotation.x=Math.PI/2; belt.scale.y=.74;
  const legs = [], arms = [];
  for (const side of [-1, 1]) {
    const hip = new T.Group(); hip.position.set(side*.14,.94,0); body.add(hip);
    mesh(garment(.40,[.105,.128,.121,.105,.098],.91,side),trousers,hip);
    tube([[side*.10,-.03,.025],[side*.107,-.20,.02],[side*.09,-.35,.025]], .007, panels, hip);
    const knee = new T.Group(); knee.position.y=-.40; hip.add(knee);
    ellipsoid(trousers,knee,[0,0,-.025],[.11,.105,.115]);
    mesh(garment(.40,[.098,.102,.092,.078,.078],.90,side),trousers,knee);
    const ankle = new T.Group(); ankle.position.y=-.40; knee.add(ankle);
    ellipsoid(leather,ankle,[0,-.035,-.055],[.117,.105,.20]);
    ellipsoid(sole,ankle,[0,-.101,-.057],[.122,.034,.205]);
    mesh(new T.CylinderGeometry(.089,.098,.14,12),leather,ankle,[0,.036,.015]);
    for (let lace=0;lace<4;lace++) tube([[-.065,-.005,-.06-lace*.026],[.065,-.005,-.075-lace*.026]],.006,webbing,ankle);
    for(const edge of [-1,1]){
      tube([[edge*.10,-.04,-.16],[edge*.113,.015,-.05],[edge*.08,.07,.05]],.004,webbing,ankle);
      for(let tread=0;tread<5;tread++)mesh(new T.BoxGeometry(.037,.018,.032),sole,ankle,[edge*.093,-.123,-.17+tread*.057]);
    }
    // Keep boot length and width proportional to the body in the closer shot.
    for(const part of ankle.children){part.scale.x*=.9;part.scale.z*=.82;part.position.x*=.9;part.position.z*=.82;}
    legs.push({hip,knee,ankle,side});
    const shoulder = new T.Group(); shoulder.position.set(side*.30,1.43,0); body.add(shoulder);
    ellipsoid(jacket,shoulder,[0,-.035,0],[.095,.105,.094]);
    mesh(garment(.32,[.09,.098,.089,.077,.075],1,side),jacket,shoulder);
    const elbow = new T.Group(); elbow.position.set(0,-.32,0); shoulder.add(elbow);
    ellipsoid(jacket,elbow,[0,0,0],[.077,.075,.078]);
    mesh(garment(.30,[.075,.078,.070,.061,.058],.96,side),jacket,elbow);
    mesh(new T.CylinderGeometry(.073,.070,.05,12),panels,elbow,[0,-.28,0]);
    const wrist=new T.Group();wrist.position.y=-.34;wrist.scale.setScalar(.86);elbow.add(wrist);
    ellipsoid(skin,wrist,[0,0,0],[.057,.068,.045]);
    const fingers=[];
    for(let finger=0;finger<4;finger++){
      const knuckle=new T.Group();knuckle.position.set((finger-1.5)*.023,-.046,-.004);wrist.add(knuckle);
      mesh(new T.CapsuleGeometry(.010,.020,4,8),skin,knuckle,[0,-.014,0]);
      const tip=new T.Group();tip.position.y=-.030;knuckle.add(tip);
      mesh(new T.CapsuleGeometry(.009,.017,4,8),skin,tip,[0,-.012,0]);fingers.push({knuckle,tip});
    }
    const thumb=new T.Group();thumb.position.set(side*.046,-.010,-.010);wrist.add(thumb);
    mesh(new T.CapsuleGeometry(.014,.032,4,8),skin,thumb,[0,-.020,0]);
    arms.push({shoulder,elbow,wrist,side,fingers,thumb});
  }
  // Rotate the whole upper body around the waist, so shoulders, head and pack
  // follow the torso during the bend instead of moving as disconnected pieces.
  const upperBody=new T.Group();upperBody.position.y=.96;body.add(upperBody);
  for(const node of [torso,head,backpack,...arms.map(a=>a.shoulder)]){
    node.position.y-=.96;upperBody.add(node);
  }
  const scale=3.1,down=new T.Vector3(0,-1,0);
  const footContacts=new Map(),handContacts=new Map();
  const tea={position:new T.Vector3(),quaternion:new T.Quaternion(),grip:new T.Vector3(.59,.18,0),rim:new T.Vector3(0,.36,-.185),mouth:new T.Vector3(),contact:false,phase:'warming'};
  const teaStart=new T.Vector3(TEA_FIRE_POSITION.x,summitHeight(TEA_FIRE_POSITION.x,TEA_FIRE_POSITION.z)+.62,TEA_FIRE_POSITION.z);
  const clamp01=v=>Math.max(0,Math.min(1,v));
  const ease=v=>{const t=clamp01(v);return t*t*t*(t*(t*6-15)+10);};
  const window=(t,start,end)=>ease((t-start)/(end-start));
  // Slightly asymmetric timing: reach decisively, then settle gently into contact.
  const gesture=(t,start,end,bias=0)=>{const u=clamp01((t-start)/(end-start));return ease(u+bias*u*(1-u));};
  // Monotone cubic tracks keep velocity continuous across the authored poses.
  function track(keys,time){
    if(time<=keys[0][0])return keys[0][1];
    if(time>=keys.at(-1)[0])return keys.at(-1)[1];
    let i=0;while(time>keys[i+1][0])i++;
    const [a,va]=keys[i],[b,vb]=keys[i+1],span=b-a,d=(vb-va)/span;
    const slope=k=>{
      if(k===0||k===keys.length-1)return 0;
      const left=(keys[k][1]-keys[k-1][1])/(keys[k][0]-keys[k-1][0]);
      const right=(keys[k+1][1]-keys[k][1])/(keys[k+1][0]-keys[k][0]);
      return left*right<=0?0:2*left*right/(left+right);
    };
    const m0=d===0?0:slope(i),m1=d===0?0:slope(i+1),u=(time-a)/span;
    return (2*u**3-3*u*u+1)*va+(u**3-2*u*u+u)*span*m0+(-2*u**3+3*u*u)*vb+(u**3-u*u)*span*m1;
  }
  function groundedFoot(side,z){
    const x=7+side*.14*scale;
    const pitch=Math.atan((summitHeight(x,z-.08)-summitHeight(x,z+.08))/.16);
    return {position:new T.Vector3(x,summitHeight(x,z)+.14*scale/Math.cos(pitch),z),pitch};
  }
  // The scene opens at the overlook: both boots are already planted.
  const standingFeet=new Map(legs.map(leg=>[leg.side,groundedFoot(leg.side,leg.side===-1?-5.0:-5.1)]));
  function solveLimb(start,middle,end,target,lengthA,lengthB,bend,endOrientation,relaxation=0,wristLimit=Infinity,elbowOutward=0){
    root.updateMatrixWorld(true);
    const local=start.parent.worldToLocal(target.clone()).sub(start.position);
    const distance=Math.max(Math.abs(lengthA-lengthB)+.0001,Math.min(lengthA+lengthB-.00001,local.length()));
    const direction=local.normalize();
    let perpendicular;
    if(bend.x===0){
      // Keep knees in a stable forward bending plane even when a lifted boot
      // passes hip height; projecting a bend hint can flip at that point.
      perpendicular=new T.Vector3(1,0,0).cross(direction).normalize();
    }else{
      perpendicular=bend.clone().addScaledVector(direction,-bend.dot(direction));
      if(perpendicular.lengthSq()<1e-6)perpendicular.set(0,1,0).addScaledVector(direction,-direction.y);
      perpendicular.normalize();
    }
    if(relaxation>0){
      // The cup path keeps the wrist away from a straight-down singularity.
      // The reach opens outward beside the jacket, then settles into a
      // downward bend after the cup clears the body.
      const relaxed=new T.Vector3(Math.sign(bend.x)*mix(.08,.75,elbowOutward),-1,.65*elbowOutward);
      relaxed.addScaledVector(direction,-relaxed.dot(direction)).normalize();
      perpendicular.lerp(relaxed,relaxation).normalize();
    }
    const along=(lengthA*lengthA-lengthB*lengthB+distance*distance)/(2*distance);
    const knee=direction.clone().multiplyScalar(along).addScaledVector(perpendicular,Math.sqrt(Math.max(0,lengthA*lengthA-along*along)));
    start.quaternion.setFromUnitVectors(down,knee.clone().normalize());
    const lower=direction.multiplyScalar(distance).sub(knee).normalize().applyQuaternion(start.quaternion.clone().invert());
    middle.quaternion.setFromUnitVectors(down,lower);
    root.updateMatrixWorld(true);
    const parentWorld=middle.getWorldQuaternion(new T.Quaternion());
    const wristOrientation=endOrientation.clone();
    if(Number.isFinite(wristLimit)){
      const forearm=end.getWorldPosition(new T.Vector3()).sub(middle.getWorldPosition(new T.Vector3())).normalize();
      const handDirection=down.clone().applyQuaternion(wristOrientation);
      const angle=handDirection.angleTo(forearm);
      // Ease into the wrist limit instead of abruptly switching from an
      // unconstrained rotation to a hard stop. The hand keeps its handle target.
      const band=.12;
      const limited=Math.max(0,angle-band*Math.log1p(Math.exp((angle-wristLimit)/band)));
      if(angle>1e-6){
        const correction=new T.Quaternion().setFromUnitVectors(handDirection,forearm);
        correction.slerp(new T.Quaternion(),limited/angle);
        wristOrientation.premultiply(correction);
      }
    }
    end.quaternion.copy(parentWorld.invert().multiply(wristOrientation));
  }
  const hipTrack=[[2,-.035],[2.6,-.04],[3.3,-.20],[4.1,-.52],[4.75,-.74],[5.7,-.80],[5.95,-.809],[6.4,-.80],[7.8,-.80]];
  const leanTrack=[[2,-.07],[2.6,-.10],[3.3,-.56],[4.1,-.43],[4.75,-.08],[5.7,-.035],[7.8,-.035]];
  const bracePoints=new Map(arms.map(arm=>{
    const x=7+arm.side*1.03,z=-4.65+(arm.side===1?.04:0);
    return [arm.side,new T.Vector3(x,summitHeight(x,z)+.13,z)];
  }));
  function pose(time) {
    const seated=time>=HIKER_SEATED_TIME;
    const seatShift=window(time,5,5.9);
    const breath=Math.sin(time*1.35);
    const teaReach=gesture(time,8.4,TEA_PICKUP_TIME,.12);
    // A short grip pause precedes lifting. The first and subsequent drinks use
    // the same authored timing, with long rests between them.
    const lift=gesture(time,10.35,12.6,-.10);
    const sipTime=time<25?time:13.2+mod(time-35,22);
    const raise=gesture(sipTime,13.2,15,.08);
    const lower=gesture(sipTime,17.7,19.3,-.10);
    const atMouth=raise*(1-lower);
    const tilt=window(sipTime,15.05,15.8)*(1-window(sipTime,16.65,17.2));
    const withdraw=window(sipTime,17.3,17.7);
    const reachLean=teaReach*(1-lift);
    root.position.set(7,summitHeight(7,mix(-4.45,-5,seatShift)),mix(-4.45,-5,seatShift));
    root.rotation.set(0,0,0);
    body.position.set(0,track(hipTrack,time),0);
    body.rotation.set(0,0,0);
    upperBody.rotation.set(track(leanTrack,time)+breath*.0025-.012*atMouth,.015*atMouth,.015*reachLean);
    torso.rotation.set(0,0,0);torso.scale.y=1+breath*.004;
    head.position.z=0;
    head.rotation.set(-.025-.12*window(time,2,3.1)*(1-window(time,5.4,6.6)),
      seated?Math.sin((time-HIKER_SEATED_TIME)*.19)*.085:Math.sin(time*.45)*.018,0);
    if(seated){
      head.rotation.x-=reachLean*.10+atMouth*.025-tilt*.035;
      head.rotation.y=head.rotation.y*(1-atMouth)+reachLean*.18;
    }
    // Equipment settles slightly after the body comes to rest.
    backpack.rotation.set(Math.sin(time*2.8)*.012*window(time,2,3)*(1-window(time,6,8)),0,0);
    backpack.position.y=.30+Math.sin(time*1.35-.4)*.0015;

    const footTargets=legs.map(leg=>{
      let foot={...standingFeet.get(leg.side),contact:true};
      const release=leg.side===-1?5.05:5.35;
      if(time>=release){
        const p=clamp01((time-release)/1.05),u=ease(p);
        const end=new T.Vector3(7+leg.side*.14*scale,summitHeight(7,-5)-.26*scale,-5-.4*scale);
        const position=foot.position.clone().lerp(end,u);
        position.y+=Math.sin(Math.PI*p)**2*.74;
        if(seated)position.z+=Math.sin(time*.8+leg.side)*.018;
        foot={position,pitch:mix(foot.pitch,.035,u),contact:false};
      }
      footContacts.set(leg.side,{planted:foot.contact,target:foot.position.clone()});
      return {leg,...foot};
    });
    for(const foot of footTargets){
      const orientation=new T.Quaternion().setFromEuler(new T.Euler(foot.pitch,0,0));
      solveLimb(foot.leg.hip,foot.leg.knee,foot.leg.ankle,foot.position,.4,.4,new T.Vector3(0,0,-1),orientation);
    }
    // Use the actual mouth transform, and rotate about the near rim while
    // drinking. This prevents the cup from drifting through the face as it tips.
    root.updateMatrixWorld(true);
    tea.mouth.copy(head.localToWorld(new T.Vector3(0,-.06,-.13)));
    const rimOffset=new T.Vector3(0,.36,.185).applyAxisAngle(new T.Vector3(1,0,0),tilt*.42);
    const hold=new T.Vector3(5.9,summitHeight(7,-5)+.95+breath*.006,-7.1);
    const lipPosition=tea.mouth.clone().sub(rimOffset);
    lipPosition.z-=withdraw*.16;
    lipPosition.y-=withdraw*.035;
    // Curved approach keeps the cup in front of the chest. The outward return
    // clears the lips before lowering; wrist rotation starts only after contact.
    const curve=(start,c1,c2,end,u)=>start.clone().multiplyScalar((1-u)**3)
      .addScaledVector(c1,3*(1-u)**2*u).addScaledVector(c2,3*(1-u)*u*u).addScaledVector(end,u**3);
    const c1=hold.clone().add(new T.Vector3(-.06,.32,-.22));
    const c2=lipPosition.clone().add(new T.Vector3(-.20,-.30,-.18));
    const sippingPosition=curve(hold,c1,c2,lipPosition,atMouth);
    const pickup=curve(teaStart,teaStart.clone().add(new T.Vector3(-.35,.42,-.35)),
      hold.clone().add(new T.Vector3(-.75,.12,-.15)),hold,lift);
    tea.position.copy(pickup).lerp(sippingPosition,window(time,12.6,13));
    // The handle faces the hiker on the trivet and follows the carrying arm
    // during the lift. The forearm never has to reach across the cup body.
    const carrier=arms.find(arm=>arm.side===-1).shoulder.getWorldPosition(new T.Vector3());
    const towardHiker=carrier.sub(tea.position);
    const carryYaw=mix(.2,Math.atan2(-towardHiker.z,towardHiker.x),window(time,10.35,12.6));
    const yaw=mix(carryYaw,-3.9,atMouth);
    tea.quaternion.setFromEuler(new T.Euler(tilt*.42,yaw,0));
    tea.rim.set(0,.36,.185).applyAxisAngle(new T.Vector3(0,1,0),-yaw);
    tea.contact=raise===1 && lower===0 && withdraw===0;
    tea.phase=time<8.4?'warming':time<TEA_PICKUP_TIME?'reaching':time<10.35?'gripping':time<12.6?'lifting':atMouth>.001?'sipping':'holding';
    for(const arm of arms){
      arm.shoulder.rotation.set(-.025+breath*.004,0,arm.side*.035);
      arm.elbow.rotation.set(.12,0,0);
      arm.wrist.rotation.set(0,0,0);
      root.updateMatrixWorld(true);
      const freeHand=arm.wrist.getWorldPosition(new T.Vector3());
      const reach=window(time,3.5,arm.side===-1?4.75:4.88);
      const release=window(time,6.6,7.6);
      let target=freeHand.clone().lerp(bracePoints.get(arm.side),reach);
      if(release>0){
        root.updateMatrixWorld(true);
        const leg=legs.find(leg=>leg.side===arm.side);
        const knee=leg.knee.getWorldPosition(new T.Vector3());
        knee.y+=.15*scale;knee.z+=.04;
        target.lerp(knee,release);
      }
      if(arm.side===-1 && teaReach>0){
        const grip=tea.grip.clone().applyQuaternion(tea.quaternion).add(tea.position);
        // Approach from outside the handle instead of cutting diagonally
        // through the cup on the way from the knee.
        const c1=target.clone().add(new T.Vector3(-.65,.12,-.05));
        const c2=grip.clone().add(new T.Vector3(-.10,.10,-.20));
        target=curve(target,c1,c2,grip,teaReach);
      }
      // Grip closes at the knuckles and fingertips while the cup still rests
      // on the trivet; the handle stays on the carrying arm’s side.
      const gripAmount=arm.side===-1?window(time,9.86,10.3):0;
      arm.fingers.forEach(({knuckle,tip},index)=>{
        const curl=arm.side===-1?window(time,9.68+index*.055,10.18+index*.04):0;
        const tipCurl=arm.side===-1?window(time,9.74+index*.055,10.22+index*.025):0;
        knuckle.rotation.x=-.10+(1.03-index*.06)*curl;
        tip.rotation.x=-.08+.85*tipCurl;
      });
      arm.thumb.rotation.set(-.12-gripAmount*.52,0,arm.side*(.48-.22*gripAmount));
      const braced=reach===1 && release===0;
      handContacts.set(arm.side,{planted:braced,target:target.clone()});
      const orientation=new T.Quaternion().setFromEuler(new T.Euler(Math.PI/2*reach,0,-arm.side*.10*reach));
      if(arm.side===-1 && teaReach>0){
        const gripOrientation=tea.quaternion.clone().multiply(new T.Quaternion().setFromEuler(new T.Euler(0,0,-Math.PI/2)));
        orientation.slerp(gripOrientation,teaReach);
      }
      const elbowBend=new T.Vector3(arm.side*.7,-.08,.45);
      const relaxation=arm.side===-1?window(time,7.6,8.4):0;
      if(reach>0)solveLimb(arm.shoulder,arm.elbow,arm.wrist,target,.32,.34,elbowBend,orientation,relaxation,arm.side===-1&&teaReach>0?Math.PI*.42:Infinity,arm.side===-1?window(time,7.6,8.4)*(1-window(time,10,10.8)):0);
    }
    root.userData.phase=time<HIKER_SIT_START?'standing':seated?'seated':'sitting-down';
  }
  pose(0);
  return {root,pose,body,upperBody,torso,head,backpack,legs,arms,footContacts,handContacts,tea};
}

// A small stone-ring fire, a real open enamel mug and animated steam. All props
// use scene time, so pause, replay, offscreen suspension and reduced motion agree.
export function createTeaFire(T) {
  const root=new T.Group();root.name='summit-tea-fire';
  const {x,z}=TEA_FIRE_POSITION;root.position.set(x,summitHeight(x,z),z);
  const stone=new T.MeshStandardMaterial({color:'#6c665e',roughness:1});
  const char=new T.MeshStandardMaterial({color:'#2e2520',roughness:1});
  const ember=new T.MeshStandardMaterial({color:'#692613',emissive:'#ff510d',emissiveIntensity:1.7,roughness:.95});
  const add=(geometry,material,parent,pos)=>{const mesh=new T.Mesh(geometry,material);mesh.position.set(...pos);parent.add(mesh);return mesh;};
  for(let i=0;i<11;i++){
    const a=i/11*TAU,r=.56;
    const rock=add(new T.IcosahedronGeometry(.14,2),stone,root,[Math.cos(a)*r,.10,Math.sin(a)*r]);
    rock.scale.set(1.3,.8,1);rock.rotation.set(i*.7,i*.9,0);rock.receiveShadow=true;
  }
  for(let i=0;i<5;i++){
    const log=add(new T.CylinderGeometry(.065,.09,.78,12),char,root,[0,.14+i*.015,0]);
    log.rotation.set(Math.PI/2,i*.9,i*.7);
    const coal=add(new T.IcosahedronGeometry(.10,1),ember,root,[Math.sin(i*2)*.22,.11,Math.cos(i*2)*.22]);coal.scale.y=.45;
  }
  const flameClock={value:0};
  const flameMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,toneMapped:false,
    uniforms:{uTime:flameClock},
    vertexShader:`varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`${noiseGLSL}
      varying vec2 vUv; uniform float uTime;
      void main(){
        float y=vUv.y; float n=fbm(vec2(vUv.x*5.,y*4.-uTime*2.7));
        float sway=sin(y*8.-uTime*3.5)*y*.12;
        float width=(1.-y)*.42;
        float body=1.-smoothstep(width*.25,width,abs(vUv.x-.5+sway)+(n-.5)*.16);
        float alpha=body*(1.-smoothstep(.55,.98,y+n*.12))*smoothstep(0.,.08,y)*.74;
        vec3 color=mix(vec3(1.,.58,.10),vec3(1.,.12,.015),smoothstep(.10,.8,y));
        gl_FragColor=vec4(color,alpha);
        #include <colorspace_fragment>
      }`});
  for(let i=0;i<3;i++){const flame=add(new T.PlaneGeometry(.69,.60),flameMaterial,root,[0,.37,0]);flame.rotation.y=i*Math.PI/3;}
  // A low steel trivet keeps the mug above the coals, with a visible side handle.
  const steel=new T.MeshStandardMaterial({color:'#444c4e',metalness:.75,roughness:.52});
  for(const side of [-1,1])add(new T.CylinderGeometry(.018,.018,.48,8),steel,root,[side*.24,.36,0]);
  for(let i=-2;i<=2;i++){
    const bar=add(new T.CylinderGeometry(.012,.012,.55,8),steel,root,[0,.61,i*.075]);bar.rotation.z=Math.PI/2;
  }
  const mug=new T.Group();mug.name='camp-tea-mug';
  const enamel=new T.MeshPhysicalMaterial({color:'#d8e0d8',roughness:.3,metalness:.25,clearcoat:.55});
  const rim=new T.MeshStandardMaterial({color:'#3a4a4b',roughness:.32,metalness:.65});
  const wall=new T.CylinderGeometry(.19,.17,.36,36,1,true);
  const mugWall=enamel.clone();mugWall.side=T.DoubleSide;
  add(wall,mugWall,mug,[0,.18,0]);
  add(new T.CylinderGeometry(.169,.169,.025,32),enamel,mug,[0,.013,0]);
  const lip=add(new T.TorusGeometry(.185,.015,8,40),rim,mug,[0,.36,0]);lip.rotation.x=Math.PI/2;
  const tea=add(new T.CircleGeometry(.174,36),new T.MeshPhysicalMaterial({color:'#6c3511',roughness:.18,metalness:.15,clearcoat:1,side:T.DoubleSide}),mug,[0,.27,0]);tea.rotation.x=-Math.PI/2;
  const handle=add(new T.TorusGeometry(.125,.025,12,40),enamel,mug,[.27,.18,0]);handle.name='tea-mug-handle';
  const light=new T.PointLight('#ff8d3c',2.1,5,2);light.position.set(0,.48,0);root.add(light);
  const steam=new T.Group();steam.name='tea-steam';
  const steamMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,toneMapped:false,uniforms:{uTime:flameClock},
    vertexShader:`attribute float aSeed; uniform float uTime; varying float vAlpha;
      void main(){float age=fract(aSeed+uTime*.21);vec3 p=position;
      p.x+=sin(age*7.+aSeed*19.)*.08+age*.17;p.y+=age*.85;p.z+=cos(age*5.+aSeed*12.)*.06;
      vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp((1.+age)*90./-mv.z,1.,16.);
      vAlpha=sin(age*3.14159)*.24;}`,
    fragmentShader:`varying float vAlpha;void main(){float d=length(gl_PointCoord-.5);gl_FragColor=vec4(.94,.96,1.,(1.-smoothstep(.08,.5,d))*vAlpha);}`});
  const steamGeometry=new T.BufferGeometry(),positions=[],seeds=[];
  for(let i=0;i<18;i++){positions.push(Math.sin(i*2.4)*.065,0,Math.cos(i*2.4)*.065);seeds.push(i/18);}
  steamGeometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));steamGeometry.setAttribute('aSeed',new T.Float32BufferAttribute(seeds,1));
  const vapor=new T.Points(steamGeometry,steamMaterial);vapor.frustumCulled=false;steam.add(vapor);
  function update(time,state){
    flameClock.value=time;light.intensity=2.1+Math.sin(time*11)*.22+Math.sin(time*17.3)*.13;
    mug.position.copy(state.position);mug.quaternion.copy(state.quaternion);mug.userData.phase=state.phase;
    tea.quaternion.copy(mug.quaternion).invert().multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),-Math.PI/2));
    steam.position.set(0,.38,0).applyQuaternion(mug.quaternion).add(mug.position);
  }
  return {root,mug,steam,light,update};
}

export function createFineFoliage(T) {
  const size=128,data=new Uint8Array(size*size*4);
  const distanceToLine=(x,y,ax,ay,bx,by)=>{
    const dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy)));
    return Math.hypot(x-ax-t*dx,y-ay-t*dy);
  };
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=x/size*2-1,v=y/size;
    let d=Math.abs(u)*.7;
    if(v<.06||v>.98)d=1;
    for(let n=0;n<16;n++)for(const side of [-1,1]){
      const h=.08+n*.052,len=(1-h)*.8+.06;
      d=Math.min(d,distanceToLine(u,v,0,h,side*len,h+.18));
    }
    const a=1-smooth(Math.max(0,Math.min(1,(d-.008)/.014)));
    const i=(y*size+x)*4,variation=hash(x,y)*25;
    data[i]=118+variation;data[i+1]=167+variation;data[i+2]=98+variation;data[i+3]=Math.round(a*255);
  }
  const texture=new T.DataTexture(data,size,size,T.RGBAFormat);texture.colorSpace=T.SRGBColorSpace;
  texture.generateMipmaps=true;texture.minFilter=T.LinearMipmapLinearFilter;texture.magFilter=T.LinearFilter;texture.needsUpdate=true;
  const positions=[],uvs=[],normals=[];
  function card(center,right,up,width,height){
    const points=[[-.5,0],[.5,0],[-.5,1],[.5,1]];
    const n=new T.Vector3().crossVectors(right,up).normalize();
    for(const index of [0,1,2,2,1,3]){
      const [u,v]=points[index];const p=center.clone().addScaledVector(right,u*width).addScaledVector(up,v*height);
      positions.push(p.x,p.y,p.z);uvs.push(u+.5,v);normals.push(n.x,n.y,n.z);
    }
  }
  for(let tier=0;tier<9;tier++){
    const height=.8+tier*.57,radius=1.8*Math.pow(1-tier/10,.8),branches=9;
    for(let branch=0;branch<branches;branch++){
      const a=branch/branches*TAU+tier*1.83,radial=new T.Vector3(Math.cos(a),0,Math.sin(a));
      const center=radial.clone().multiplyScalar(radius*.55);center.y=height;
      const tangent=new T.Vector3(-Math.sin(a),0,Math.cos(a));
      const up=new T.Vector3(radial.x*.72,.72,radial.z*.72).normalize();
      card(center,tangent,up,radius*1.3,1.2);
      card(center,radial,new T.Vector3(0,1,0),radius,1.0);
    }
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));
  return {geometry,texture};
}

export function createAlpineWorld(T, { compact = false } = {}) {
  const scene = new T.Scene();
  scene.background = new T.Color('#a8d4ed');
  scene.fog = new T.FogExp2('#b9d5d9', .00055);
  const camera = new T.PerspectiveCamera(compact ? 58 : 46, 1, .5, 4200);
  const clock = { value: 0 };
  const worldFraming = { compact };
  const travelUniform = { value: 0 };
  const hemisphere = new T.HemisphereLight('#eaf1dc', '#454b2b', 1.0);
  scene.add(hemisphere);
  const sunlight = new T.DirectionalLight('#fff0d3', 3.1);
  sunlight.position.set(-300, 300, -450);
  sunlight.name='sunlight';scene.add(sunlight);
  const moonlight = new T.DirectionalLight('#bdd7ff',0);
  moonlight.name='moonlight';scene.add(moonlight);
  const celestialUniforms={
    sunDirection:{value:new T.Vector3(0,.29,-1).normalize()},
    moonDirection:{value:new T.Vector3(.04,.29,-1).normalize()},
    sunVisibility:{value:1},moonVisibility:{value:0},moonColor:{value:new T.Color('#bdd7ff')}
  };
  sunlight.position.copy(celestialUniforms.sunDirection.value).multiplyScalar(600);
  const fill = new T.DirectionalLight('#cce9ff', .85);
  fill.position.set(50, 110, 160);
  scene.add(fill);

  // Procedural sun, cratered moon and sky share directions with physical lights and lake glints.
  const sky = new T.Mesh(new T.SphereGeometry(3500, 32, 16), new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false, toneMapped: false,
    uniforms: { ...celestialUniforms, daylight:{value:1}, uTime: clock, zenith: { value: new T.Color('#168cdb') }, horizon: { value: new T.Color('#a8d4ed') }, glow: { value: new T.Color('#fff1d2') } },
    vertexShader: `varying vec3 vDirection; void main(){ vDirection=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `${noiseGLSL}
      varying vec3 vDirection; uniform float uTime,daylight,sunVisibility,moonVisibility;
      uniform vec3 zenith,horizon,glow,sunDirection,moonDirection,moonColor;
      float crater(vec2 uv,vec2 center,float radius){
        float distanceToCenter=length(uv-center)/radius;
        return -.20*(1.-smoothstep(.35,.83,distanceToCenter))
          +.13*exp(-pow((distanceToCenter-.92)*12.,2.));
      }
      void main(){
        vec3 d=normalize(vDirection); float h=max(d.y,0.);
        vec3 color=mix(horizon,zenith,smoothstep(.03,.65,h));
        float proximity=max(dot(d,sunDirection),0.);
        color=mix(color,glow,pow(proximity,24.)*.45*sunVisibility);
        float sunDisc=smoothstep(.99972,.99983,proximity);
        color+=glow*(pow(proximity,750.)*.45+sunDisc*2.2)*sunVisibility;
        float moonProximity=max(dot(d,moonDirection),0.);
        color+=moonColor*pow(moonProximity,240.)*.11*moonVisibility;
        vec3 moonRight=normalize(cross(moonDirection,vec3(0.,1.,0.)));
        vec3 moonUp=normalize(cross(moonRight,moonDirection));
        vec2 moonUV=vec2(dot(d,moonRight),dot(d,moonUp))/.027;
        float moonRadius=length(moonUV);
        float moonDisc=(1.-smoothstep(.96,1.,moonRadius))*step(0.,dot(d,moonDirection))*moonVisibility;
        if(moonDisc>0.){
          float maria=smoothstep(.34,.68,fbm(moonUV*3.1+vec2(12.,27.)));
          float relief=crater(moonUV,vec2(.30,-.34),.18)+crater(moonUV,vec2(-.37,.18),.23)+crater(moonUV,vec2(.10,.48),.12);
          float grain=fbm(moonUV*38.)*.10;
          float limb=.55+.45*sqrt(max(0.,1.-moonRadius*moonRadius));
          vec3 surface=moonColor*(.72+grain-maria*.25+relief)*limb;
          color=mix(color,surface,moonDisc);
        }
        float clouds=fbm(d.xz/max(.1,d.y)*vec2(2.2,7.)+vec2(uTime*.006,0.));
        color=mix(color,glow*.75,smoothstep(.54,.78,clouds)*smoothstep(.08,.3,h)*.36);
        vec2 starUV=vec2(atan(d.x,d.z),asin(d.y))*650.;
        vec2 starCell=floor(starUV);
        float star=step(.997,hash21(starCell))*(1.-smoothstep(.03,.23,length(fract(starUV)-.5)));
        color+=vec3(.55,.68,1.)*star*(1.-smoothstep(0.,.35,daylight))*smoothstep(.05,.3,h)*(1.-moonDisc);
        gl_FragColor=vec4(color,1.);
        #include <colorspace_fragment>
      }`
  }));
  sky.name = 'daylight-sky'; scene.add(sky);

  // Smooth, densely tessellated land with procedural scree, grass and snow.
  const rockNormal=createSurfaceMaps(T,'rock');
  const groundMaterial = new T.MeshStandardMaterial({ color: '#ffffff', roughness: .94, normalMap:rockNormal, normalScale:new T.Vector2(.40,.40) });
  groundMaterial.onBeforeCompile = shader => {
    shader.vertexShader = 'varying vec3 vTerrain; varying vec3 vTerrainNormal;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvTerrain=position; vTerrainNormal=normal;');
    shader.fragmentShader = noiseGLSL + '\nvarying vec3 vTerrain; varying vec3 vTerrainNormal;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      float macro=fbm(vTerrain.xz*.032);
      float grain=fbm(vTerrain.xz*.75+vTerrain.y*.16);
      float slope=1.-max(normalize(vTerrainNormal).y,0.);
      vec3 grass=mix(vec3(.018,.075,.022),vec3(.25,.46,.018),macro);
      vec3 rock=mix(vec3(.17,.19,.22),vec3(.34,.35,.32),grain);
      float strata=sin(vTerrain.y*.86+fbm(vTerrain.xz*.08)*13.);
      float fissure=1.-smoothstep(.025,.09,abs(sin(vTerrain.y*1.7+fbm(vTerrain.xz*.16)*8.)));
      float mineral=fbm(vTerrain.xz*3.3+vTerrain.y*.4);
      rock*=.84+.13*strata+.12*mineral;
      rock=mix(rock,rock*.55,fissure*.35);
      vec3 land=mix(grass,rock,smoothstep(.23,.58,slope));
      land=mix(land,rock,smoothstep(55.,110.,vTerrain.y)*.75);
      land*=.88+.24*grain;
      float snow=smoothstep(118.,155.,vTerrain.y+macro*37.-slope*48.);
      vec3 snowColor=mix(vec3(.54,.67,.81),vec3(.95,.97,1.),grain*.5+.5);
      land=mix(land,snowColor,snow);
      land=mix(vec3(.42,.34,.21),land,smoothstep(-.3,3.5,vTerrain.y));
      diffuseColor.rgb*=land;
    `);
  };
  const ground = new T.PlaneGeometry(1120, TILE_LENGTH, compact ? 100 : 180, compact ? 88 : 144);
  ground.rotateX(-Math.PI / 2); ground.translate(0, 0, -TILE_LENGTH / 2);
  for (let i = 0; i < ground.attributes.position.count; i++) {
    const p = ground.attributes.position;
    p.setY(i, terrainHeight(p.getX(i), p.getZ(i)));
  }
  // Analytic finite differences give matching normals at repeated tile seams.
  const gp = ground.attributes.position, gn = ground.attributes.normal;
  for (let i = 0; i < gp.count; i++) {
    const x = gp.getX(i), z = gp.getZ(i);
    const normal = new T.Vector3(terrainHeight(x - .5, z) - terrainHeight(x + .5, z), 1,
      terrainHeight(x, z - .5) - terrainHeight(x, z + .5)).normalize();
    gn.setXYZ(i, normal.x, normal.y, normal.z);
  }

  let seed = 1639;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const dummy = new T.Object3D();
  const trees = [], stones = [], grasses = [];
  for (let i = 0; i < (compact ? 2600 : 5200); i++) {
    const x = (random() - .5) * 660, z = -random() * TILE_LENGTH;
    const y = terrainHeight(x, z);
    if (y < 1.2 || y > 100) continue;
    const slope = Math.abs(terrainHeight(x + 2, z) - y) + Math.abs(terrainHeight(x, z + 2) - y);
    const item = { x, y, z, size: .7 + random() * 1.3, angle: random() * TAU };
    if (i % 7 === 0 && y < 54 && slope < 3.8) trees.push(item);
    else if (i % 9 === 0) stones.push(item);
    else if (y < 55 && slope < 5) grasses.push(item);
  }
  function instances(geometry, material, items, transform) {
    const mesh = new T.InstancedMesh(geometry, material, items.length);
    items.forEach((p, i) => {
      dummy.position.set(p.x, p.y, p.z); dummy.scale.setScalar(p.size); dummy.rotation.set(0, p.angle, 0);
      transform(dummy, p, i); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  }
  // Fine branch cutouts give trees a porous silhouette and visible needle detail.
  const fineFoliage=createFineFoliage(T),needles=fineFoliage.geometry;
  const trunkGeometry = new T.CylinderGeometry(.13,.27,6,10);
  const foliageMaterial = new T.MeshStandardMaterial({color:'#648b35',map:fineFoliage.texture,alphaTest:.42,side:T.DoubleSide,roughness:.94});
  foliageMaterial.onBeforeCompile = shader => {
    shader.uniforms.uTime = clock;
    shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      transformed.x+=sin(uTime*1.1+instanceMatrix[3].x*.17+instanceMatrix[3].z*.12)*.025*max(position.y,0.);`);
  };
  const trunkMaterial = new T.MeshStandardMaterial({ color: '#53413c', roughness: 1 });
  const stoneGeometry = new T.IcosahedronGeometry(1, compact ? 2 : 3);
  const stoneVertices=stoneGeometry.attributes.position;
  for(let i=0;i<stoneVertices.count;i++){
    const x=stoneVertices.getX(i),y=stoneVertices.getY(i),z=stoneVertices.getZ(i);
    const split=.86+.12*Math.sin(x*7+z*3)*Math.cos(y*9-z*4)+.05*Math.sin(z*17+x*11);
    stoneVertices.setXYZ(i,x*split,y*split,z*split);
  }
  stoneGeometry.computeVertexNormals();
  const stoneMaterial = new T.MeshStandardMaterial({ color: '#8a8c88', roughness: .96, normalMap:rockNormal, normalScale:new T.Vector2(.7,.7) });
  const grassGeometry = new T.BufferGeometry();
  const blades = [];
  for(let i=0;i<7;i++){
    const a=i/7*TAU,dx=Math.cos(a),dz=Math.sin(a),h=.65+(i%3)*.28;
    const point=(t,side)=>[dx*t*t*.42-dz*side*.045*(1-t),h*t,dz*t*t*.42+dx*side*.045*(1-t)];
    for(let segment=0;segment<3;segment++){
      const lo=segment/3,hi=(segment+1)/3;
      for(const p of [point(lo,-1),point(lo,1),point(hi,-1),point(hi,-1),point(lo,1),point(hi,1)])blades.push(...p);
    }
  }
  grassGeometry.setAttribute('position', new T.Float32BufferAttribute(blades, 3));
  grassGeometry.computeVertexNormals();
  const grassMaterial = new T.MeshStandardMaterial({ color: '#9fbc32', roughness: 1, side: T.DoubleSide });
  grassMaterial.onBeforeCompile = shader => {
    shader.uniforms.uTime = clock;
    shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      transformed.x+=sin(uTime*1.7+instanceMatrix[3].x*.22+instanceMatrix[3].z*.1)*position.y*.23;
      transformed.z+=cos(uTime*1.2+instanceMatrix[3].x*.3)*position.y*.14;`);
  };
  const crownItems = trees;
  const chunks = [];
  for (let i = 0; i < 3; i++) {
    const chunk = new T.Group(); chunk.name = 'terrain-section';
    chunk.add(new T.Mesh(ground, groundMaterial));
    chunk.add(instances(trunkGeometry, trunkMaterial, trees, (d, p) => { d.position.y += p.size * 2.8; }));
    chunk.add(instances(needles,foliageMaterial,crownItems,()=>{}));
    chunk.add(instances(stoneGeometry, stoneMaterial, stones, (d, p, j) => {
      d.position.y += p.size * .25; d.scale.set(p.size * 1.4, p.size * .7, p.size); d.rotation.z = j * .73;
    }));
    chunk.add(instances(grassGeometry, grassMaterial, grasses, () => {}));
    chunk.position.z = 160 - i * TILE_LENGTH;
    chunks.push(chunk); scene.add(chunk);
  }

  // A distant craggy massif uses overlapping ridges, erosion noise and the same
  // snow/rock shading as the nearby terrain; it is geometry rather than an image.
  const massif = new T.PlaneGeometry(2100, 850, compact ? 160 : 320, compact ? 80 : 160);
  massif.rotateX(-Math.PI / 2); massif.translate(0, 0, -1050);
  const mp = massif.attributes.position;
  for (let i = 0; i < mp.count; i++) {
    const x=mp.getX(i),z=mp.getZ(i);
    const warp=terrainNoise(x,z,8)*45;
    const spine=-1010+Math.sin(x*.008)*48+Math.sin(x*.021)*22;
    const profile=150+85*Math.sin(x*.008+.8)+150*Math.exp(-(((x-85)/210)**2));
    const cross=Math.abs(z-spine+warp);
    const main=Math.max(55,profile)*Math.exp(-Math.pow(cross/155,1.45));
    const back=(160+terrainNoise(x,0,8)*100)*Math.exp(-Math.pow(Math.abs(z+1260+Math.sin(x*.012)*40)/125,1.5));
    const ridge=1-Math.abs(terrainNoise(x+warp,z,32)*2-1);
    const erosion=(terrainNoise(x,z,64)-.5)*22+(terrainNoise(x,z,128)-.5)*11+(terrainNoise(x,z,256)-.5)*4;
    const h=Math.max(main,back)*(.76+ridge*.24);
    mp.setY(i,h+erosion*Math.min(1,h/25)-5);
  }
  massif.computeVertexNormals();
  const mountains = new T.Mesh(massif, groundMaterial); mountains.name = 'snowy-massif'; scene.add(mountains);

  // Animated wave normals, moving reflection bands and sunlight glints on the lake.
  const waterMaterial = new T.ShaderMaterial({
    uniforms: { ...celestialUniforms, daylight:{value:1}, reflectionMap:{value:null}, reflectionMatrix:{value:new T.Matrix4()},hasReflection:{value:0},uTime: clock, uTravel: travelUniform, waterColor: { value: new T.Color('#007b99') }, skyColor: { value: new T.Color('#21abb7') }, sunColor: { value: new T.Color('#fff0c1') }, fogColor: { value: scene.fog.color }, fogDensity: { value: scene.fog.density } },
    vertexShader: `uniform mat4 reflectionMatrix; varying vec4 vReflection; varying vec3 vWorld; void main(){ vec4 world=modelMatrix*vec4(position,1.); vWorld=world.xyz; vReflection=reflectionMatrix*world; gl_Position=projectionMatrix*viewMatrix*world; }`,
    fragmentShader: `${noiseGLSL}
      varying vec4 vReflection; uniform sampler2D reflectionMap; uniform float hasReflection; varying vec3 vWorld; uniform float uTime,uTravel,fogDensity,daylight,sunVisibility,moonVisibility; uniform vec3 waterColor,skyColor,sunColor,fogColor,sunDirection,moonDirection,moonColor;
      void main(){
        vec2 p=vec2(vWorld.x,vWorld.z-uTravel);
        float t=uTime;
        vec2 wave=vec2(sin(p.x*.15+p.y*.07+t*.9)+sin(p.x*.41-p.y*.19+t*1.4)*.32,
          cos(p.y*.23+t*.7)+sin(p.x*.26+p.y*.34-t*1.1)*.35)*.026;
        vec3 normal=normalize(vec3(wave.x,1.,wave.y));
        vec3 eye=normalize(cameraPosition-vWorld);
        float fresnel=pow(1.-max(dot(eye,normal),0.),3.);
        vec3 reflected=mix(waterColor*.85,skyColor,smoothstep(.02,.42,reflect(-eye,normal).y));
        float mountainBand=(1.-smoothstep(0.,.07,reflect(-eye,normal).y))*(.3+.2*fbm(vec2(p.x*.015,0.)));
        reflected*=1.-mountainBand;
        vec2 reflectionUV=vReflection.xy/vReflection.w+wave*.021;
        vec3 realReflection=texture2D(reflectionMap,clamp(reflectionUV,.001,.999)).rgb;
        reflected=mix(reflected,realReflection,hasReflection*.9);
        vec3 color=mix(waterColor,reflected,.38+fresnel*.53);
        float glint=pow(max(dot(reflect(-sunDirection,normal),eye),0.),150.);
        float moonGlint=pow(max(dot(reflect(-moonDirection,normal),eye),0.),85.);
        color+=sunColor*glint*1.5*sunVisibility;
        color+=moonColor*moonGlint*.65*moonVisibility;
        float ripple=pow(max(sin(p.y*.6+sin(p.x*.13+t)*2.+t*.8),0.),24.);
        color+=skyColor*ripple*.055;
        float fog=1.-exp(-pow(length(cameraPosition-vWorld)*fogDensity,2.));
        color=mix(color,fogColor,fog);
        gl_FragColor=vec4(color,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const water = new T.Mesh(new T.PlaneGeometry(5000, 5500), waterMaterial);
  water.rotation.x = -Math.PI / 2; water.position.set(0, -.15, -1600); water.name = 'animated-lake'; scene.add(water);

  // Soft volumetric-looking cloud banks, generated locally into a tiny alpha texture.
  const texSize = 96, pixels = new Uint8Array(texSize * texSize * 4);
  for (let y = 0; y < texSize; y++) for (let x = 0; x < texSize; x++) {
    const u = x / texSize * 2 - 1, v = y / texSize * 2 - 1;
    const density = Math.max(0, 1 - u * u - v * v) ** 2;
    const noise = .4 + .6 * terrainNoise(x * 15, y * 15, 32);
    const index = (y * texSize + x) * 4;
    pixels[index] = 255; pixels[index + 1] = 255; pixels[index + 2] = 255;
    pixels[index + 3] = Math.round(density * noise * 170);
  }
  const cloudTexture = new T.DataTexture(pixels, texSize, texSize, T.RGBAFormat);
  cloudTexture.needsUpdate = true;
  cloudTexture.magFilter = T.LinearFilter; cloudTexture.minFilter = T.LinearFilter;
  const cloudMaterial = new T.MeshBasicMaterial({ map: cloudTexture, transparent: true, depthWrite: false, color: '#ffffff', fog: true });
  const cloudGeometry = new T.PlaneGeometry(1, 1);
  const clouds = [];
  for (let i = 0; i < 30; i++) {
    const cloud = new T.Mesh(cloudGeometry, cloudMaterial);
    cloud.position.set((random() - .5) * 2200, 130 + random() * 140, -450 - random() * 1300);
    cloud.scale.set(200 + random() * 240, 35 + random() * 60, 1);
    cloud.userData.startX = cloud.position.x;
    scene.add(cloud); clouds.push(cloud);
  }

  // A small flock crosses the valley, with independently articulated wings.
  const birdMaterial = new T.MeshBasicMaterial({ color: '#34334a', side: T.DoubleSide });
  const birds = [];
  for (let i = 0; i < 7; i++) {
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute([0,0,.5,-1.8,0,-.25,0,0,-.3, 0,0,.5,0,0,-.3,1.8,0,-.25], 3));
    const bird = new T.Mesh(geometry, birdMaterial);
    scene.add(bird); birds.push(bird);
  }
  const particlePositions = [];
  for (let i = 0; i < (compact ? 90 : 200); i++) particlePositions.push((random() - .5) * 220, 4 + random() * 36, random() * 500 - 380);
  const particleGeometry = new T.BufferGeometry();
  particleGeometry.setAttribute('position', new T.Float32BufferAttribute(particlePositions, 3));
  const particles = new T.Points(particleGeometry, new T.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: clock, uTravel: travelUniform },
    vertexShader: `uniform float uTime,uTravel; varying float vAlpha;
      void main(){vec3 p=position; p.z=mod(p.z+uTravel+380.,500.)-380.; p.y+=sin(uTime*.3+p.x)*1.5;
      vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
      gl_PointSize=clamp(110./max(1.,-mv.z),1.,3.);vAlpha=.2+.2*sin(uTime+position.z);}`,
    fragmentShader: `varying float vAlpha; void main(){float d=length(gl_PointCoord-.5);gl_FragColor=vec4(1.,.8,.6,(1.-smoothstep(.1,.5,d))*vAlpha);}`
  }));
  particles.name = 'airborne-particles'; scene.add(particles);

  // A foreground summit with a worn path, loose rock and alpine wildflowers.
  const summitGeometry = new T.PlaneGeometry(50, 68, 80, 100);
  summitGeometry.rotateX(-Math.PI / 2); summitGeometry.translate(7, 0, 6);
  const sp = summitGeometry.attributes.position;
  for (let i = 0; i < sp.count; i++) {
    const x=sp.getX(i), z=sp.getZ(i);
    const campBlend=smooth(Math.max(0,Math.min(1,(Math.hypot(x-TEA_FIRE_POSITION.x,z-TEA_FIRE_POSITION.z)-.8)/.6)));
    const trail=Math.abs(x-7)<2 ? 0 : Math.sin(x*2.4+z)*Math.cos(z*1.7)*.28*campBlend;
    sp.setY(i,summitHeight(x,z)+trail);
  }
  summitGeometry.computeVertexNormals();
  const summitMaterial=groundMaterial.clone();
  summitMaterial.onBeforeCompile=shader=>{
    groundMaterial.onBeforeCompile(shader);
    shader.fragmentShader=shader.fragmentShader.replace('diffuseColor.rgb*=land;',
      'land=mix(land,vec3(.36,.34,.27)*(.85+grain*.25),(1.-smoothstep(1.,2.5,abs(vTerrain.x-7.)))*.7); diffuseColor.rgb*=land;');
  };
  const summit=new T.Mesh(summitGeometry,summitMaterial); summit.name='summit-overlook'; summit.receiveShadow=true; scene.add(summit);
  const summitGrass=[], summitStones=[], flowers=[];
  for(let i=0;i<300;i++){
    const x=-10+random()*37,z=-18+random()*48;
    if(Math.abs(x-7)<2.2 || summitHeight(x,z)<70)continue;
    const p={x,y:summitHeight(x,z),z,size:.35+random()*.8,angle:random()*TAU};
    if(i%6===0)summitStones.push(p);
    else {summitGrass.push(p);if(i%5===0)flowers.push({...p,y:p.y+.4});}
  }
  scene.add(instances(grassGeometry,grassMaterial,summitGrass,()=>{}));
  scene.add(instances(stoneGeometry,stoneMaterial,summitStones,(d,p)=>{d.scale.set(p.size*1.2,p.size*.6,p.size);d.position.y+=p.size*.15;}));
  const flowerMaterial=new T.MeshStandardMaterial({color:'#fff6ce',roughness:.8});
  const petals=flowers.flatMap(p=>Array.from({length:5},(_,i)=>({...p,x:p.x+Math.cos(i/5*TAU)*.10,z:p.z+Math.sin(i/5*TAU)*.10,angle:i/5*TAU})));
  scene.add(instances(new T.SphereGeometry(.085,10,6),flowerMaterial,petals,d=>{d.scale.set(.75,.20,1.2);}));
  scene.add(instances(new T.SphereGeometry(.043,8,6),new T.MeshStandardMaterial({color:'#e0bb40',roughness:.9}),flowers,d=>{d.position.y+=.018;d.scale.y=.5;}));
  const hiker=createHiker(T);scene.add(hiker.root);
  const teaFire=createTeaFire(T);scene.add(teaFire.root,teaFire.mug,teaFire.steam);
  const characterLight=new T.DirectionalLight('#ffedc9',1.6);
  characterLight.position.set(-22,118,-25);characterLight.target.position.set(7,91,-5);
  characterLight.castShadow=!compact;
  characterLight.shadow.mapSize.set(compact?512:2048,compact?512:2048);
  Object.assign(characterLight.shadow.camera,{left:-9,right:9,top:12,bottom:-12,near:.5,far:100});
  characterLight.shadow.camera.updateProjectionMatrix();
  characterLight.shadow.radius=2;
  characterLight.shadow.bias=-.0006;characterLight.shadow.normalBias=.03;
  scene.add(characterLight,characterLight.target);
  // Broad, shadow-free moon bounce on the camera-facing side of the hiker.
  // Local falloff lifts the jacket, backpack and nearby rock without washing out the valley.
  const nightBounce=new T.PointLight('#c8ddf4',0,34,2);
  nightBounce.name='hiker-night-bounce';nightBounce.position.set(12,101,5);
  scene.add(nightBounce);

  function update(time, pointer = { x: 0, y: 0 }) {
    const travel = 0;
    clock.value = time; travelUniform.value = travel;
    hiker.pose(time);teaFire.update(time,hiker.tea);
    // A restrained rear dolly approaches the shoulder, holds through the sit and first drink,
    // then cranes up and pans across the lake. Dragging stays within the rear view.
    const portrait=worldFraming.compact;
    const approach=smooth(Math.min(time/3,1));
    const reveal=smooth(Math.max(0,Math.min((time-20)/10,1)));
    const drift=Math.sin(Math.max(0,time-30)*.065)*.22;
    camera.position.set(
      (portrait?4.5:mix(-1,-.8,approach))-reveal*(portrait?.4:2.2)+drift,
      mix(portrait?98:97,portrait?96.3:95,approach)+reveal*(portrait?2.7:1.8),
      mix(portrait?24:21,portrait?15.5:11,approach)+reveal*7);
    const lookTarget=new T.Vector3(portrait?4.8:mix(-1,-26,reveal),portrait?103:mix(92,98,reveal),mix(-45,-270,reveal));
    // Bounded orbit keeps the camera behind the hiker and above the summit.
    // Rotate the look target too, keeping the composition coherent.
    const pivot=hiker.root.position.clone();pivot.y+=1.8;
    const orbit=new T.Quaternion().setFromEuler(new T.Euler(
      Math.max(-.12,Math.min(.12,pointer.y)),Math.max(-.48,Math.min(.48,pointer.x)),0,'YXZ'));
    camera.position.sub(pivot).applyQuaternion(orbit).add(pivot);
    lookTarget.sub(pivot).applyQuaternion(orbit).add(pivot);
    camera.lookAt(lookTarget);
    clouds.forEach((cloud, i) => {
      cloud.position.x = mod(cloud.userData.startX + 1300 + time * (1.5 + i % 3), 2600) - 1300;
    });
    birds.forEach((bird, i) => {
      const phase = time * .045 + i * .06;
      bird.position.set(80 + Math.sin(phase) * 125 + i * 4, 68 + Math.sin(time * .25 + i) * 3 + i * 1.6, -230 + Math.cos(phase) * 90 - i * 8);
      bird.rotation.y = -phase;
      const position = bird.geometry.attributes.position;
      const flap = Math.sin(time * 3.6 + i * .8) * .85;
      position.setY(1, flap); position.setY(5, flap); position.needsUpdate = true;
    });
  }
  const daylightColor=new T.Color();
  function setDaylight(minutes,sun) {
    const {from,to,blend}=daylightBlend(minutes,sun);
    const bodies=celestialState(minutes,sun);
    celestialUniforms.sunDirection.value.fromArray(bodies.sunDirection).normalize();
    celestialUniforms.moonDirection.value.fromArray(bodies.moonDirection).normalize();
    celestialUniforms.sunVisibility.value=bodies.sunVisibility;
    celestialUniforms.moonVisibility.value=bodies.moonVisibility;
    sunlight.position.copy(celestialUniforms.sunDirection.value).multiplyScalar(600);
    moonlight.position.copy(celestialUniforms.moonDirection.value).multiplyScalar(600);
    moonlight.intensity=bodies.moonPower;
    const color=(target,key)=>target.set(from[key]).lerp(daylightColor.set(to[key]),blend);
    const number=key=>mix(from[key],to[key],blend);
    for(const key of ['zenith','horizon','glow'])color(sky.material.uniforms[key].value,key);
    sky.material.uniforms.daylight.value=number('day');
    color(scene.background,'horizon');color(scene.fog.color,'fog');
    color(waterMaterial.uniforms.waterColor.value,'water');color(waterMaterial.uniforms.skyColor.value,'reflection');
    color(waterMaterial.uniforms.sunColor.value,'sun');waterMaterial.uniforms.daylight.value=number('day');
    color(cloudMaterial.color,'cloud');color(sunlight.color,'sun');sunlight.intensity=number('power')*bodies.sunVisibility;
    color(hemisphere.color,'ambient');color(hemisphere.groundColor,'ground');hemisphere.intensity=number('hemi');
    color(fill.color,'ambient');fill.intensity=number('fill');
    color(characterLight.color,'sun');characterLight.color.lerp(celestialUniforms.moonColor.value,bodies.moonVisibility);
    characterLight.intensity=number('key')+.45*bodies.moonPower;
    nightBounce.intensity=95*(1-smooth(Math.min(1,number('day')/.65)));
    // Reuse the existing foreground shadow map for moonlit clothing and cliff detail.
    const keyDirection=celestialUniforms.sunDirection.value.clone().lerp(celestialUniforms.moonDirection.value,bodies.moonVisibility).normalize();
    characterLight.position.copy(characterLight.target.position).addScaledVector(keyDirection,45);
  }
  function dispose() {
    const geometries = new Set(), materials = new Set(), textures=new Set();
    scene.traverse(object => { if (object.geometry) geometries.add(object.geometry); if (object.material) materials.add(object.material); });
    geometries.forEach(g => g.dispose()); materials.forEach(m => {if(m.normalMap)textures.add(m.normalMap);if(m.map)textures.add(m.map);m.dispose();});textures.forEach(t=>t.dispose()); cloudTexture.dispose();
  }
  update(0);
  return { scene, camera, update, setDaylight, dispose, chunks, clock, water, clouds, birds, compact, hiker, summit, worldFraming, teaFire };
}

export function startAlpineRenderer(T, host, motion, runtime = globalThis) {
  const canvas = host.querySelector('canvas');
  const button = host.querySelector('.scene-toggle');
  const page = runtime.document;
  let renderer, world, reflection;
  const fallback = () => { host.classList.remove('is-ready'); host.dataset.sceneState = 'fallback';host.tabIndex=-1;host.classList.remove('is-dragging'); button.hidden = true; const replay=host.querySelector('.scene-replay'); if(replay)replay.hidden=true; };
  try {
    renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
    const compact = host.clientWidth < 700;
    renderer.setPixelRatio(Math.min(runtime.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = !compact;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    world = createAlpineWorld(T, { compact });
    reflection=createLakeReflection(T,world);
  } catch {
    reflection?.dispose();world?.dispose(); renderer?.dispose(); fallback(); return;
  }
  let paused = motion.matches || Boolean(runtime.navigator?.connection?.saveData);
  let visible = true, contextLost = false, failed = false, elapsed = paused ? HIKER_SEATED_TIME : 0, last = 0, frame = 0;
  let slowFrames = 0, reducedResolution = false, reflectionTime=-Infinity, frameInterval=1000/60, accumulated=0;
  const pointer = { x: 0, y: 0 }, targetPointer = { x: 0, y: 0 }, viewVelocity={x:0,y:0};
  let drag=null,renderClock=0,daylight=null;const heldKeys=new Set();
  const viewBusy=()=>drag!==null || heldKeys.size>0 || Math.abs(pointer.x)+Math.abs(pointer.y)+Math.abs(viewVelocity.x)+Math.abs(viewVelocity.y)>1e-4;
  function wakeView(){if(!frame && visible && !page.hidden && !contextLost && !failed){last=0;frame=runtime.requestAnimationFrame(tick);}}
  function finishDrag(immediate=false){
    const id=drag?.id;drag=null;heldKeys.clear();
    targetPointer.x=targetPointer.y=0;
    host.classList.remove('is-dragging');
    if(id!==undefined && host.hasPointerCapture?.(id))host.releasePointerCapture(id);
    if(immediate || motion.matches){pointer.x=pointer.y=viewVelocity.x=viewVelocity.y=0;}
    if(motion.matches && !page.hidden && visible){reflectionTime=-Infinity;render();}
    else if(viewBusy())wakeView();
  }
  function advanceView(dt){
    if(motion.matches)return;
    const frequency=drag||heldKeys.size?16:4.8,decay=Math.exp(-frequency*dt);
    for(const axis of ['x','y']){
      const offset=pointer[axis]-targetPointer[axis],term=(viewVelocity[axis]+frequency*offset)*dt;
      pointer[axis]=targetPointer[axis]+(offset+term)*decay;
      viewVelocity[axis]=(viewVelocity[axis]-frequency*term)*decay;
      const limit=axis==='x'?.48:.12;
      if(Math.abs(pointer[axis])>limit){pointer[axis]=Math.sign(pointer[axis])*limit;viewVelocity[axis]=0;}
    }
    if(!drag && !heldKeys.size && !viewBusy())pointer.x=pointer.y=viewVelocity.x=viewVelocity.y=0;
  }
  renderer.debug.onShaderError=()=>{failed=true;runtime.cancelAnimationFrame(frame);fallback();};
  function render() {
    if (contextLost || failed) return;
    try {
      world.update(elapsed, pointer);
      if(renderClock-reflectionTime>=(world.compact?1/7.5:1/10)){reflection.render(renderer);reflectionTime=renderClock;}
      renderer.render(world.scene, world.camera);
    } catch {
      failed = true; runtime.cancelAnimationFrame(frame); fallback();
    }
  }
  function resize() {
    if (contextLost || failed) return;
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    world.camera.aspect = width / height;
    world.worldFraming.compact = width < 700;
    world.camera.fov = width < 700 ? 58 : 46;
    world.camera.updateProjectionMatrix(); reflectionTime=-Infinity;render();
  }
  function tick(now) {
    frame = 0;
    if ((paused && !viewBusy() && !daylight?.travelling) || !visible || page.hidden || contextLost || failed) { last = 0; return; }
    if (!last) last = now;
    const delta = now - last;last=now;
    const dt=Math.min(delta/1000,.1);
    if(!paused)elapsed+=dt;renderClock+=dt;accumulated+=delta;advanceView(dt);daylight?.advance(dt);
    if (accumulated>=frameInterval-.5) {
      accumulated=Math.max(0,accumulated-frameInterval);
      if(accumulated>=frameInterval)accumulated%=frameInterval;
      render();
      // Prioritize fluid hand movement; reflection updates retain their lower
      // cadence. Reduce resolution, then cap at 30 fps only on slower devices.
      slowFrames = delta > 28 ? slowFrames + 1 : Math.max(0, slowFrames - 1);
      if (slowFrames > 45 && !reducedResolution) {
        renderer.setPixelRatio(.85); reducedResolution = true; resize();
      }else if(slowFrames>90 && reducedResolution){frameInterval=1000/30;slowFrames=0;}
    }
    if (!failed && (!paused || viewBusy() || daylight?.travelling)) frame = runtime.requestAnimationFrame(tick);
  }
  function sync() {
    runtime.cancelAnimationFrame(frame); frame = 0; last = 0; accumulated=0;
    if (contextLost || failed) return;
    const running = !paused && visible && !page.hidden;
    host.dataset.sceneState = paused ? 'paused' : running ? 'playing' : 'suspended';
    button.querySelector('.scene-toggle-text').textContent = paused ? 'Play motion' : 'Pause motion';
    button.querySelector('.scene-toggle-icon').textContent = paused ? '▷' : 'Ⅱ';
    button.setAttribute('aria-label', paused ? 'Play background animation' : 'Pause background animation');
    if ((running || (visible && !page.hidden && (viewBusy() || daylight?.travelling))) && !failed) frame = runtime.requestAnimationFrame(tick);
  }
  button.addEventListener('click', () => { paused = !paused; sync(); });
  const replay=host.querySelector('.scene-replay');
  replay?.addEventListener('click',()=>{finishDrag(true);elapsed=0;reflectionTime=-Infinity;paused=false;render();sync();});
  motion.addEventListener('change', () => { paused = motion.matches;finishDrag(true);if(paused){elapsed=Math.max(elapsed,HIKER_SEATED_TIME);render();}sync(); });
  page.addEventListener('visibilitychange',()=>{if(page.hidden)finishDrag(true);sync();});
  host.addEventListener('pointerdown',event=>{
    if(failed || contextLost || drag || event.isPrimary===false || event.button!==0)return;
    if(event.target?.closest?.('a,button,input,textarea,select,[contenteditable],.hero-copy,.hero-bottom p,.scene-time'))return;
    Object.assign(targetPointer,pointer);viewVelocity.x=viewVelocity.y=0;
    drag={id:event.pointerId,x:event.clientX,y:event.clientY};
    host.setPointerCapture?.(event.pointerId);host.classList.add('is-dragging');
    if(event.pointerType!=='touch'){event.preventDefault();host.focus?.({preventScroll:true});}
    if(!motion.matches)wakeView();
  });
  host.addEventListener('pointermove',event=>{
    if(!drag || drag.id!==event.pointerId)return;
    const bounds=host.getBoundingClientRect();
    targetPointer.x=Math.max(-.48,Math.min(.48,targetPointer.x-(event.clientX-drag.x)/Math.max(1,bounds.width)*.95));
    targetPointer.y=Math.max(-.12,Math.min(.12,targetPointer.y+(event.clientY-drag.y)/Math.max(1,bounds.height)*.35));
    drag.x=event.clientX;drag.y=event.clientY;
    if(motion.matches){Object.assign(pointer,targetPointer);reflectionTime=-Infinity;render();}
  });
  for(const type of ['pointerup','pointercancel','lostpointercapture'])host.addEventListener(type,event=>{if(drag?.id===event.pointerId)finishDrag();});
  host.addEventListener('keydown',event=>{
    if(event.target!==host || failed || contextLost)return;
    if(event.key==='Escape'){event.preventDefault();finishDrag();return;}
    const directions={ArrowLeft:[.08,0],ArrowRight:[-.08,0],ArrowUp:[0,-.03],ArrowDown:[0,.03]};
    if(!directions[event.key])return;
    event.preventDefault();
    if(!heldKeys.size){Object.assign(targetPointer,pointer);viewVelocity.x=viewVelocity.y=0;}
    heldKeys.add(event.key);
    targetPointer.x=Math.max(-.48,Math.min(.48,targetPointer.x+directions[event.key][0]));
    targetPointer.y=Math.max(-.12,Math.min(.12,targetPointer.y+directions[event.key][1]));
    if(motion.matches){Object.assign(pointer,targetPointer);reflectionTime=-Infinity;render();}else wakeView();
  });
  host.addEventListener('keyup',event=>{if(heldKeys.delete(event.key) && !heldKeys.size)finishDrag();});
  host.addEventListener('blur',()=>finishDrag());
  runtime.addEventListener?.('blur',()=>finishDrag());
  new runtime.IntersectionObserver(entries => { visible = entries[0].isIntersecting;if(!visible)finishDrag(true);sync(); }).observe(host);
  new runtime.ResizeObserver(resize).observe(host);
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault(); contextLost = true;finishDrag(true); runtime.cancelAnimationFrame(frame); fallback();
  });
  canvas.addEventListener('webglcontextrestored', () => {
    contextLost = false; resize();
    if (!failed) { host.classList.add('is-ready');host.tabIndex=0; button.hidden = false; if(replay)replay.hidden=false; sync(); }
  });
  daylight=createDaylightControl(host,(minutes,sun,{animated})=>{
    world.setDaylight(minutes,sun);
    if(!animated){reflectionTime=-Infinity;if(visible && !page.hidden)render();sync();}
  },runtime);
  resize();
  if (!failed) { host.classList.add('is-ready');host.tabIndex=0; button.hidden = false; if(replay)replay.hidden=false; sync(); }
  return { world, renderer, reflection, daylight, get elapsed() { return elapsed; } };
}

if (typeof document !== 'undefined') {
  const host = document.querySelector('[data-alpine-scene]');
  if (host) {
    import(host.dataset.engine).then(T => startAlpineRenderer(T, host, matchMedia('(prefers-reduced-motion: reduce)'))).catch(() => {
      host.dataset.sceneState = 'fallback';
    });
  }
}
