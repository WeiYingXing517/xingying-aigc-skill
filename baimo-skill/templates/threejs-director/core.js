export const clone = v => JSON.parse(JSON.stringify(v));
export const uid = () => globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
export const cameraDefault = () => ({position:[7,5,9],target:[0,1,0],fov:45,aspect:16/9});
export function emptyProject(){return {schemaVersion:1,name:'未命名白模',mode:'scene',units:'m',revision:0,source:{},assumptions:[],sceneObjects:[],working:{actors:[],camera:cameraDefault()},shots:[]};}
const vector=(v,n)=>Array.isArray(v)&&v.length===n&&v.every(Number.isFinite);
export function validate(p){
  if(!p||p.schemaVersion!==1||!['scene','storyboard'].includes(p.mode)||p.units!=='m')throw Error('工程版本、模式或单位无效');
  if(typeof p.name!=='string'||!Array.isArray(p.sceneObjects)||!Array.isArray(p.shots)||!p.working)throw Error('工程字段缺失');
  let count=0; const all=[];
  function objects(items,actors){
    if(!Array.isArray(items))throw Error('对象集合无效');
    const ids=new Set(); for(const o of items){count++;if(count>10000)throw Error('对象过多');
      if(!o||typeof o.id!=='string'||ids.has(o.id)||typeof o.name!=='string')throw Error('对象ID/名称无效或重复');ids.add(o.id);
      if(!(actors?['person']:['box','cylinder','plane']).includes(o.kind))throw Error('对象类型无效');
      if(!vector(o.position,3)||!vector(o.rotation,3)||!vector(o.size,3)||o.size.some(x=>x<=0||x>10000))throw Error('对象变换无效');
      if(actors&& !['standing','seated','crouching'].includes(o.pose))throw Error('人物姿态无效');
      if(o.joints&&Object.values(o.joints).some(x=>!Number.isFinite(x)||Math.abs(x)>360))throw Error('关节角度无效');
      if(o.color&&!/^#[0-9a-f]{6}$/i.test(o.color))throw Error('颜色需为#RRGGBB');
    } all.push(...items.map(o=>o.id));
  }
  function camera(c){if(!c||!vector(c.position,3)||!vector(c.target,3)||!Number.isFinite(c.fov)||c.fov<5||c.fov>150||!Number.isFinite(c.aspect)||c.aspect<.1||c.aspect>10||c.position.every((v,i)=>Math.abs(v-c.target[i])<1e-8))throw Error('相机参数无效');}
  objects(p.sceneObjects,false);objects(p.working.actors,true);camera(p.working.camera);
  if(new Set([...p.sceneObjects,...p.working.actors].map(o=>o.id)).size!==p.sceneObjects.length+p.working.actors.length)throw Error('场景与人物ID冲突');
  const shots=new Set();for(const s of p.shots){if(!s||typeof s.id!=='string'||shots.has(s.id)||typeof s.name!=='string')throw Error('镜头ID/名称无效');shots.add(s.id);objects(s.sceneObjects,false);objects(s.actors,true);if(new Set([...s.sceneObjects,...s.actors].map(o=>o.id)).size!==s.sceneObjects.length+s.actors.length)throw Error('镜头对象ID冲突');camera(s.camera);if(s.frameType&&!['normal','black'].includes(s.frameType))throw Error('首帧类型无效');}
  if(p.mode==='scene'&&(p.working.actors.length||p.shots.length))throw Error('含人物或镜头的工程须使用分镜模式');
  return p;
}
export function newObject(kind){return {id:uid(),name:kind==='person'?'人物':kind==='box'?'盒体':kind==='plane'?'地面':'圆柱',kind,position:[0,0,0],rotation:[0,0,0],size:kind==='person'?[1,1.75,1]:kind==='plane'?[8,.05,8]:[1,1,1],color:'#dededb',...(kind==='person'?{pose:'standing',joints:{leftArm:0,rightArm:0,leftLeg:0,rightLeg:0}}:{})};}
export function makeShot(p,name){return {id:uid(),name,sourceShot:'',sourceVersion:'',status:'draft',frameType:'normal',sceneObjects:clone(p.sceneObjects),actors:clone(p.working.actors),camera:clone(p.working.camera)};}
export function restoreShot(p,id){const s=p.shots.find(s=>s.id===id);if(!s)throw Error('镜头不存在');p.sceneObjects=clone(s.sceneObjects);p.working={actors:clone(s.actors),camera:clone(s.camera)};return s;}
export function saveShot(p,id){const s=p.shots.find(s=>s.id===id);if(!s)throw Error('镜头不存在');Object.assign(s,{sceneObjects:clone(p.sceneObjects),actors:clone(p.working.actors),camera:clone(p.working.camera),status:'manual',updatedAt:new Date().toISOString()});return s;}
