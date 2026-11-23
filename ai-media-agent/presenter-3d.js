// Isolated 3D presenter adapter. Reuses the GLITCH RUNNER GLB read-only.
// The narrated exporter retains its existing 2D fallback if loading/WebGL fails.
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";
import {GLTFLoader} from "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/loaders/GLTFLoader.js";
const asset="https://raw.githubusercontent.com/doom404official-collab/DOOM404/main/glitch-runner/doom404-mascot-optimized.glb";
const surface=document.createElement("canvas");surface.width=540;surface.height=420;
let renderer,scene,camera,mascot,mixer,head=null,arm=null,ready=false,last=0;
window.doom404Presenter3D={ready:false,render:null,error:null};
try{
 renderer=new THREE.WebGLRenderer({canvas:surface,alpha:true,antialias:true,preserveDrawingBuffer:true,powerPreference:"low-power"});
 renderer.setPixelRatio(1);renderer.setSize(540,420,false);renderer.setClearColor(0x000000,0);
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(32,540/420,.01,100);
 camera.position.set(0,1.3,4.8);camera.lookAt(0,1.05,0);
 scene.add(new THREE.HemisphereLight(0xffffff,0x54101a,2.2));
 const key=new THREE.DirectionalLight(0xffffff,2.6);key.position.set(-2,4,5);scene.add(key);
 const rim=new THREE.DirectionalLight(0xff2447,1.8);rim.position.set(3,2,-2);scene.add(rim);
 new GLTFLoader().load(asset,gltf=>{
   mascot=gltf.scene;scene.add(mascot);
   const bounds=new THREE.Box3().setFromObject(mascot),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
   const scale=2.4/Math.max(size.y,.001);mascot.scale.setScalar(scale);
   mascot.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);
   mascot.rotation.y=0;
   mascot.traverse(obj=>{if(obj.isBone){if(!head&&/head|neck/i.test(obj.name))head=obj;if(!arm&&/rightarm|rightupperarm/i.test(obj.name))arm=obj;}});
   mixer=new THREE.AnimationMixer(mascot);
   const idle=gltf.animations.find(x=>/idle|stand|breath/i.test(x.name));
   if(idle)mixer.clipAction(idle).play();
   // A runner animation is intentionally not used for the studio.
   ready=true;window.doom404Presenter3D.ready=true;
   window.doom404Presenter3D.render=(time,sceneIndex)=>{
     if(!ready)return null;
     const dt=Math.max(0,Math.min(.05,time-last));last=time;
     mixer?.update(dt);
     mascot.rotation.y=Math.sin(time*.55)*.12;
     mascot.position.y=-bounds.min.y*scale;
     if(head)head.rotation.y=Math.sin(time*.8)*.045;
     if(arm)arm.rotation.z=Math.sin(time*1.5)*.045;
     renderer.render(scene,camera);return surface;
   };
 },undefined,error=>{window.doom404Presenter3D.error=String(error?.message||error);});
}catch(e){window.doom404Presenter3D.error=String(e.message||e);}
