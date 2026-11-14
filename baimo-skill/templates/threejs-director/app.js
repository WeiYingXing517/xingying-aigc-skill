import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {TransformControls} from 'three/addons/controls/TransformControls.js';
import {clone,uid,cameraDefault,emptyProject,validate,newObject,makeShot,restoreShot,saveShot} from './core.js';
const $=id=>document.getElementById(id), rad=THREE.MathUtils.degToRad, deg=THREE.MathUtils.radToDeg;
let project=emptyProject(),selected=null,activeShot=null,dirty=false,shotDirty=false,piloting=false,updating=false,history=[],future=[],refURL=null;
const storageKey=`whitebox-v1:${location.pathname}`, nodes=new Map();
const scene=new THREE.Scene();scene.background=new THREE.Color('#d0d4d6');
scene.add(new THREE.HemisphereLight(0xffffff,0x777b82,2));const light=new THREE.DirectionalLight(0xffffff,2.3);light.position.set(5,10,7);scene.add(light);
const content=new THREE.Group(),helpers=new THREE.Group();scene.add(content,helpers);
const grid=new THREE.GridHelper(30,30,0x6b7c86,0xa4afb6);helpers.add(grid);
const observer=new THREE.PerspectiveCamera(45,1,.02,2000);observer.position.set(10,8,12);
const shotCam=new THREE.PerspectiveCamera(45,16/9,.02,2000);
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;
const previewRenderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});previewRenderer.setPixelRatio(Math.min(devicePixelRatio,2));previewRenderer.outputColorSpace=THREE.SRGBColorSpace;
$('observe').append(renderer.domElement);$('preview').append(previewRenderer.domElement);
const orbit=new OrbitControls(observer,renderer.domElement);orbit.target.set(0,1,0);orbit.update();
const pilot=new OrbitControls(shotCam,previewRenderer.domElement);pilot.enabled=false;pilot.enableDamping=false;
const gizmo=new TransformControls(observer,renderer.domElement);const gizmoHelper=gizmo.getHelper();helpers.add(gizmoHelper);
const cameraHelper=new THREE.CameraHelper(shotCam);helpers.add(cameraHelper);
function msg(t){$('message').textContent=t;}
function safe(fn){return (...args)=>{try{return fn(...args);}catch(e){msg(`错误：${e.message}`);console.error(e);}};}
function mark(){dirty=true;shotDirty=!!activeShot;project.revision=(project.revision||0)+1;try{localStorage.setItem(storageKey,JSON.stringify(project));}catch{}$('state').textContent='有未保存修改；请保存工程';}
function push(){history.push({project:clone(project),activeShot});if(history.length>60)history.shift();future=[];}
function edit(fn){const before=clone(project);push();try{fn();validate(project);if(JSON.stringify(project)===JSON.stringify(before)){history.pop();rebuild();return;}mark();rebuild();}catch(e){project=before;history.pop();rebuild();msg(`修改未采用：${e.message}`);}}
function current(){return [...project.sceneObjects,...project.working.actors].find(o=>o.id===selected);}
function material(o){return new THREE.MeshStandardMaterial({color:o.color||'#dededb',roughness:.85});}
function person(o){
  const root=new THREE.Group(),m=material(o); const seated=o.pose==='seated',crouch=o.pose==='crouching';const hip=seated?.53:crouch?.58:.91;
  const box=(size,pos,parent=root)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),m);mesh.position.set(...pos);parent.add(mesh);return mesh;};
  box([.32,.2,.22],[0,hip,0]);box([.4,.48,.23],[0,hip+.31,0]);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.14,16,12),m);head.scale.y=1.15;head.position.set(0,hip+.75,0);root.add(head);
  box([.06,.06,.07],[0,hip+.74,.145]);
  for(const side of [-1,1]){
    const arm=new THREE.Group();arm.position.set(side*.27,hip+.49,0);root.add(arm);
    arm.rotation.x=rad(o.joints?.[side<0?'rightArm':'leftArm']||0);box([.1,.52,.1],[0,-.24,0],arm);box([.11,.12,.11],[0,-.55,0],arm);
    const leg=new THREE.Group();leg.position.set(side*.1,hip-.1,0);root.add(leg);
    leg.rotation.x=(seated?-Math.PI/2:crouch?-.9:0)+rad(o.joints?.[side<0?'rightLeg':'leftLeg']||0);
    box([.13,.4,.14],[0,-.2,0],leg);const knee=new THREE.Group();knee.position.y=-.4;knee.rotation.x=seated?Math.PI/2:crouch?1.6:0;leg.add(knee);box([.12,.4,.13],[0,-.2,0],knee);box([.14,.08,.26],[0,-.4,.06],knee);
  }
  // 地面为脚部基准；坐姿髋部约0.53m，需按椅高调整。
  const scale=o.size[1]/1.82;root.scale.set(scale*o.size[0],scale,scale*o.size[2]);return root;
}
function build(o){let n;if(o.kind==='person')n=person(o);else{const g=o.kind==='cylinder'?new THREE.CylinderGeometry(o.size[0]/2,o.size[0]/2,o.size[1],24):new THREE.BoxGeometry(...o.size);n=new THREE.Mesh(g,material(o));}
  n.position.fromArray(o.position);n.rotation.set(...o.rotation.map(rad));n.userData.objectId=o.id;return n;
}
function disposeContent(){gizmo.detach();content.traverse(n=>{if(n.geometry)n.geometry.dispose();if(n.material){for(const m of Array.isArray(n.material)?n.material:[n.material])m.dispose();}});content.clear();nodes.clear();}
function syncCamera(){const c=project.working.camera;shotCam.position.fromArray(c.position);shotCam.fov=c.fov;shotCam.aspect=c.aspect;shotCam.lookAt(new THREE.Vector3(...c.target));shotCam.updateProjectionMatrix();pilot.target.fromArray(c.target);pilot.update();cameraHelper.update();}
function rebuild(){updating=true;disposeContent();for(const o of [...project.sceneObjects,...project.working.actors]){const n=build(o);nodes.set(o.id,n);content.add(n);}if(!nodes.has(selected))selected=null;
  syncCamera();fillUI();if(selected)gizmo.attach(nodes.get(selected));updating=false;resize();}
function fillUI(){
  $('projectName').value=project.name;$('mode').value=project.mode;$('assumptions').value=(project.assumptions||[]).join('\n');
  $('objects').replaceChildren(...[...project.sceneObjects,...project.working.actors].map(o=>{const op=new Option(`${o.kind==='person'?'人':'物'} · ${o.name}`,o.id);op.selected=o.id===selected;return op;}));
  const o=current();$('objectName').value=o?.name||'';$('objectName').disabled=!o;
  for(const field of ['position','rotation','size'])for(let i=0;i<3;i++){const el=$(`o-${field}-${i}`);el.value=o?.[field][i]??0;el.disabled=!o;}
  $('pose').value=o?.pose||'standing';$('pose').disabled=o?.kind!=='person';for(const key of jointKeys){$(`j-${key}`).value=o?.joints?.[key]||0;$(`j-${key}`).disabled=o?.kind!=='person';}
  for(const f of ['position','target'])for(let i=0;i<3;i++)$(`c-${f}-${i}`).value=Number(project.working.camera[f][i].toFixed(4));
  $('fov').value=project.working.camera.fov;$('ratio').value=Number(project.working.camera.aspect.toFixed(6));const a=String(project.working.camera.aspect);$('aspect').value=[...$('aspect').options].some(x=>x.value===a)?a:'custom';
  $('shots').replaceChildren(...project.shots.map(s=>{const op=new Option(`${s.name}${s.status==='manual'?' · 已编辑':''}`,s.id);op.selected=s.id===activeShot;return op;}));if(!activeShot)$('shots').selectedIndex=-1;
  const shot=project.shots.find(s=>s.id===activeShot);for(const f of ['shotName','sourceShot','sourceVersion','frameType']){$(f).disabled=!shot;$(f).value=shot?.[f==='shotName'?'name':f]||(f==='frameType'?'normal':'');}
  $('addPerson').disabled=project.mode==='scene';for(const id of ['newShot','copyShot','saveShot','restoreShot','deleteShot'])$(id).disabled=project.mode==='scene'||(id!=='newShot'&&!shot);
  $('undo').disabled=!history.length;$('redo').disabled=!future.length;
}
function triple(container,prefix,field,title,fn){const row=document.createElement('div');row.className='triple';const label=document.createElement('span');label.textContent=title;row.append(label);for(let i=0;i<3;i++){const el=document.createElement('input');el.type='number';el.step='.1';el.id=`${prefix}-${field}-${i}`;el.setAttribute('aria-label',`${title}${'XYZ'[i]}`);el.onchange=safe(()=>fn(i,Number(el.value)));row.append(el);}$(container).append(row);}
for(const [f,title] of [['position','位置'],['rotation','旋转'],['size','尺寸']])triple('transformFields','o',f,title,(i,v)=>{if(!current())return;if(!Number.isFinite(v)||(f==='size'&&v<=0))throw Error('请输入有效数值');edit(()=>current()[f][i]=v);});
for(const [f,title] of [['position','机位'],['target','朝向']])triple('cameraFields','c',f,title,(i,v)=>{const c=clone(project.working.camera);c[f][i]=v;const next=clone(project);next.working.camera=c;validate(next);edit(()=>project.working.camera=c);});
for(const [id,title] of [['fov','垂直视角°'],['ratio','宽高比']]){const label=document.createElement('label');label.textContent=title;const el=document.createElement('input');el.type='number';el.id=id;el.step=id==='ratio'?'.01':'1';label.append(el);$('cameraFields').append(label);el.onchange=safe(()=>{const next=clone(project);next.working.camera[id==='ratio'?'aspect':'fov']=Number(el.value);validate(next);edit(()=>project=next);});}
const jointKeys=['leftArm','rightArm','leftLeg','rightLeg'];for(const [i,key] of jointKeys.entries()){const label=document.createElement('label');label.textContent=['左臂°','右臂°','左腿°','右腿°'][i];const el=document.createElement('input');el.id=`j-${key}`;el.type='number';el.step='5';el.onchange=safe(()=>{const v=Number(el.value);if(!Number.isFinite(v)||Math.abs(v)>360)throw Error('角度范围±360°');edit(()=>{const o=current();o.joints||={};o.joints[key]=v;});});label.append(el);$('joints').append(label);}
function resize(){const a=$('observe');renderer.setSize(Math.max(a.clientWidth,1),Math.max(a.clientHeight,1));observer.aspect=a.clientWidth/Math.max(a.clientHeight,1);observer.updateProjectionMatrix();const b=$('preview'),aspect=project.working.camera.aspect;let w=b.clientWidth,h=w/aspect;if(h>b.clientHeight){h=b.clientHeight;w=h*aspect;}previewRenderer.setSize(Math.max(w,1),Math.max(h,1));}
new ResizeObserver(resize).observe($('stage'));window.addEventListener('resize',resize);
function draw(){requestAnimationFrame(draw);orbit.update();cameraHelper.update();helpers.visible=$('grid').checked;gizmoHelper.visible=!!selected;renderer.render(scene,observer);const was=helpers.visible;helpers.visible=false;const black=project.shots.find(s=>s.id===activeShot)?.frameType==='black';const bg=scene.background,cv=content.visible;if(black){scene.background=new THREE.Color('black');content.visible=false;}previewRenderer.render(scene,shotCam);scene.background=bg;content.visible=cv;helpers.visible=was;}
const ray=new THREE.Raycaster(),mouse=new THREE.Vector2();let down=null;
renderer.domElement.addEventListener('pointerdown',e=>down=[e.clientX,e.clientY]);renderer.domElement.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>4||gizmo.dragging)return;const r=renderer.domElement.getBoundingClientRect();mouse.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(mouse,observer);const hit=ray.intersectObjects(content.children,true)[0];if(hit){let n=hit.object;while(n&&!n.userData.objectId)n=n.parent;selected=n?.userData.objectId||null;}else selected=null;rebuild();});
gizmo.addEventListener('dragging-changed',e=>{orbit.enabled=!e.value;if(e.value)push();else{const o=current(),n=nodes.get(selected);if(o&&n){o.position=n.position.toArray();o.rotation=[deg(n.rotation.x),deg(n.rotation.y),deg(n.rotation.z)];if(o.kind==='person'){const sy=Math.max(.01,n.scale.y);o.size=[Math.max(.01,n.scale.x)/sy,1.82*sy,Math.max(.01,n.scale.z)/sy];}else o.size=o.size.map((v,i)=>v*Math.max(.01,n.scale.toArray()[i]));mark();rebuild();}}});
for(const el of document.querySelectorAll('[data-tool]'))el.onclick=()=>gizmo.setMode(el.dataset.tool);
for(const el of document.querySelectorAll('[data-add]'))el.onclick=safe(()=>{const k=el.dataset.add;if(k==='person'&&project.mode!=='storyboard')throw Error('场景模式不添加人物');edit(()=>{const o=newObject(k);if(k==='box'||k==='cylinder')o.position[1]=o.size[1]/2;(k==='person'?project.working.actors:project.sceneObjects).push(o);selected=o.id;});});
$('objects').onchange=()=>{selected=$('objects').value;rebuild();};
$('objectName').onchange=()=>edit(()=>current().name=$('objectName').value);
$('pose').onchange=()=>edit(()=>current().pose=$('pose').value);
$('copyObject').onclick=()=>{if(!current())return;edit(()=>{const o=clone(current());o.id=uid();o.name+='副本';o.position[0]+=.5;(o.kind==='person'?project.working.actors:project.sceneObjects).push(o);selected=o.id;});};
$('deleteObject').onclick=()=>{if(current())edit(()=>{project.sceneObjects=project.sceneObjects.filter(o=>o.id!==selected);project.working.actors=project.working.actors.filter(o=>o.id!==selected);selected=null;});};
$('projectName').onchange=()=>edit(()=>project.name=$('projectName').value);
$('assumptions').onchange=()=>edit(()=>project.assumptions=$('assumptions').value.split('\n').filter(Boolean));
$('mode').onchange=()=>{const m=$('mode').value;if(m==='scene'&&(project.shots.length||project.working.actors.length)){msg('当前含人物或镜头；请新建独立场景工程，避免切换时丢失分镜。');fillUI();return;}edit(()=>project.mode=m);};
$('aspect').onchange=safe(()=>{if($('aspect').value!=='custom')edit(()=>project.working.camera.aspect=Number($('aspect').value));});
$('resetObserve').onclick=()=>{observer.position.set(10,8,12);orbit.target.set(0,1,0);orbit.update();};
$('fromObserve').onclick=()=>edit(()=>{project.working.camera.position=observer.position.toArray();project.working.camera.target=orbit.target.toArray();project.working.camera.fov=observer.fov;});
$('pilot').onclick=()=>{piloting=!piloting;pilot.enabled=piloting;$('pilot').textContent=`操作拍摄机：${piloting?'开启':'关闭'}`;};
pilot.addEventListener('start',()=>{if(piloting)push();});pilot.addEventListener('change',()=>{if(!piloting||updating)return;project.working.camera.position=shotCam.position.toArray();project.working.camera.target=pilot.target.toArray();mark();});pilot.addEventListener('end',()=>{if(piloting){updating=true;fillUI();updating=false;}});
function allowSwitch(){return !shotDirty||confirm('当前镜头有未保存修改。切换会恢复目标镜头的完整状态，继续吗？');}
function selectShot(id,ask=true){if(ask&&!allowSwitch()){fillUI();return false;}restoreShot(project,id);activeShot=id;selected=null;shotDirty=false;dirty=true;rebuild();msg('已恢复镜头的摄影机、人物和物件状态');return true;}
$('newShot').onclick=()=>{const name=prompt('镜头名称',`分镜${project.shots.length+1}`);if(!name)return;push();const s=makeShot(project,name);project.shots.push(s);activeShot=s.id;mark();shotDirty=false;rebuild();};
$('saveShot').onclick=()=>{if(!activeShot)return;push();saveShot(project,activeShot);mark();shotDirty=false;rebuild();msg('镜头状态已保存到工作工程；请保存JSON文件持久保留');};
$('restoreShot').onclick=()=>{if(activeShot){push();selectShot(activeShot);}};
$('shots').onchange=()=>selectShot($('shots').value);
$('copyShot').onclick=()=>{const s=project.shots.find(s=>s.id===activeShot);if(!s||!allowSwitch())return;push();const c=clone(s);c.id=uid();c.name+='副本';project.shots.push(c);restoreShot(project,c.id);activeShot=c.id;mark();shotDirty=false;rebuild();};
$('deleteShot').onclick=()=>{if(!activeShot||!confirm('删除当前已保存镜头？工作画面仍保留。'))return;edit(()=>{project.shots=project.shots.filter(s=>s.id!==activeShot);activeShot=null;});};
for(const f of ['shotName','sourceShot','sourceVersion','frameType'])$(f).onchange=()=>edit(()=>{const s=project.shots.find(s=>s.id===activeShot);if(s)s[f==='shotName'?'name':f]=$(f).value;});
$('undo').onclick=()=>{if(!history.length)return;future.push({project:clone(project),activeShot});const h=history.pop();project=h.project;activeShot=h.activeShot;mark();rebuild();};
$('redo').onclick=()=>{if(!future.length)return;history.push({project:clone(project),activeShot});const h=future.pop();project=h.project;activeShot=h.activeShot;mark();rebuild();};
function download(data,name){const a=document.createElement('a');a.href=data;a.download=name;a.click();}
function filename(s){return s.replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').slice(0,100)||'whitebox';}
$('save').onclick=safe(()=>{validate(project);const blob=new Blob([JSON.stringify(project,null,2)],{type:'application/json'});const u=URL.createObjectURL(blob);download(u,`${filename(project.name)}.json`);setTimeout(()=>URL.revokeObjectURL(u),10000);dirty=false;$('state').textContent='已请求下载工程；请确认文件保存完成';});
function loadProject(p){validate(p);project=clone(p);selected=null;activeShot=null;history=[];future=[];dirty=false;shotDirty=false;rebuild();$('state').textContent='工程已载入';}
$('load').onclick=()=>{if(dirty&&!confirm('载入工程会替换当前工作副本，继续吗？'))return;$('file').click();};
$('file').onchange=safe(async()=>{const f=$('file').files[0];if(!f)return;try{const p=JSON.parse(await f.text());loadProject(p);msg('已载入工程');}catch(e){msg(`载入失败，当前工程保留：${e.message}`);}finally{$('file').value='';}});
$('draft').onclick=safe(()=>{const s=localStorage.getItem(storageKey);if(!s)throw Error('没有浏览器草稿');if(confirm('恢复本路径下的浏览器草稿？会替换当前工作副本。'))loadProject(JSON.parse(s));});
$('reference').onclick=()=>$('imageFile').click();$('imageFile').onchange=()=>{const f=$('imageFile').files[0];if(!f)return;if(refURL)URL.revokeObjectURL(refURL);refURL=URL.createObjectURL(f);$('refImage').src=refURL;$('refImage').hidden=false;msg('参考图仅本地查看；请另存原图，工程不嵌入图像');};
let exportRenderer;
function renderPNG(width=Number($('width').value),black=project.shots.find(s=>s.id===activeShot)?.frameType==='black'){
  if(!Number.isInteger(width)||width<64||width>4096)throw Error('宽度范围64—4096');const height=Math.round(width/project.working.camera.aspect);if(height>8192)throw Error('输出高度超过8192');
  exportRenderer||=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});exportRenderer.setPixelRatio(1);exportRenderer.outputColorSpace=THREE.SRGBColorSpace;exportRenderer.setSize(width,height,false);
  const visible=helpers.visible,bg=scene.background,cv=content.visible;helpers.visible=false;try{if(black){scene.background=new THREE.Color('black');content.visible=false;}const c=shotCam.clone();c.aspect=width/height;c.updateProjectionMatrix();exportRenderer.render(scene,c);return exportRenderer.domElement.toDataURL('image/png');}finally{helpers.visible=visible;scene.background=bg;content.visible=cv;}
}
$('export').onclick=safe(()=>{download(renderPNG(),`${filename(project.name)}_${filename(project.shots.find(s=>s.id===activeShot)?.name||'场景预览')}_start.png`);msg('已请求导出当前预览PNG；未保存修改也会体现在此图中');});
$('exportAll').onclick=safe(async()=>{if(!project.shots.length)throw Error('没有已保存镜头');const before=clone(project),id=activeShot,sd=shotDirty;try{for(const s of before.shots){restoreShot(project,s.id);activeShot=s.id;rebuild();download(renderPNG(),`${filename(s.name)}_${s.id.slice(0,6)}_start.png`);await new Promise(r=>setTimeout(r,250));}msg('已发起各镜头PNG下载，请检查浏览器是否拦截多文件');}finally{project=before;activeShot=id;shotDirty=sd;rebuild();}});
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
window.directorAPI={getProject:()=>clone(project),loadProject,switchShot:id=>selectShot(id,false),saveShot:()=>{saveShot(project,activeShot);mark();shotDirty=false;rebuild();},renderPNG,width:()=>previewRenderer.domElement.width,getActiveShot:()=>activeShot};
async function init(){try{const r=await fetch('./project.json',{cache:'no-store'});if(r.ok)loadProject(await r.json());else rebuild();msg('就绪：场景模式只搭场景；分镜模式可加入人物与保存机位。');}catch(e){rebuild();msg(`默认工程未载入：${e.message}；可手动载入JSON`);}draw();}
init();

