// DOOM404 News Studio V6: isolated, reusable 3D broadcast set.
// The existing V4 presenter and 2D fallback are intentionally untouched.
import * as THREE from "three";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
const asset="https://raw.githubusercontent.com/doom404official-collab/DOOM404/main/glitch-runner/doom404-mascot-optimized.glb";
const api={ready:false,error:null,render:null};window.doom404StudioV6=api;
const surface=document.createElement("canvas");surface.width=540;surface.height=420;
try{
 const renderer=new THREE.WebGLRenderer({canvas:surface,antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:"low-power"});
 renderer.setPixelRatio(1);renderer.setSize(540,420,false);renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.setClearColor(0x08070d,1);
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x08070d);
 const camera=new THREE.PerspectiveCamera(34,540/420,.05,100);camera.position.set(0,1.78,5.15);camera.lookAt(0,1.52,0);
 const mat=(color,metalness=0,roughness=.5,emissive=0)=>new THREE.MeshStandardMaterial({color,metalness,roughness,emissive});
 const black=mat(0x10121b,.45,.27),panel=mat(0x17131d,.35,.43),red=mat(0xd91e35,.4,.35,0x4e0811),glow=mat(0xff3151,.2,.32,0xb8172c),floor=mat(0x151018,.5,.3);
 function box(x,y,z,w,h,d,m){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);scene.add(o);return o}
 box(0,-.09,0,12,.15,9,floor);
 box(0,2.55,-1.65,8,4,.2,black);
 for(let k=-3;k<=3;k++){box(k*.68,2.6,-1.5,.025,3.2,.08,red)}
 box(0,3.42,-1.43,6,.055,.1,glow);
 box(0,.55,-1.35,5.6,.035,.1,glow);
 const screen=box(0,2.15,-1.38,2.7,1.25,.12,panel);const displayCanvas=document.createElement("canvas");displayCanvas.width=512;displayCanvas.height=256;const dc=displayCanvas.getContext("2d");dc.fillStyle="#12131e";dc.fillRect(0,0,512,256);dc.fillStyle="#e6384e";dc.font="bold 36px sans-serif";dc.fillText("RISK INTELLIGENCE",30,80);dc.fillStyle="#b6b8c7";dc.font="26px sans-serif";dc.fillText("ON-CHAIN EVIDENCE",30,136);dc.fillStyle="#ff354d";dc.fillRect(30,165,420,5);const displayTexture=new THREE.CanvasTexture(displayCanvas);const display=new THREE.Mesh(new THREE.PlaneGeometry(2.58,1.15),new THREE.MeshBasicMaterial({map:displayTexture}));display.position.set(0,2.15,-1.295);scene.add(display);
 const edge=box(0,2.83,-1.32,2.8,.035,.12,glow);
 box(-2.3,1.95,-1.3,.4,1.6,.15,black);box(2.3,1.95,-1.3,.4,1.6,.15,black);
 // Curved anchor desk built from a smooth arc: visible thickness, black front, illuminated rim.
 const arc=new THREE.Shape();arc.moveTo(-1.85,-.24);arc.quadraticCurveTo(0,-.58,1.85,-.24);arc.lineTo(1.75,.18);arc.quadraticCurveTo(0,-.12,-1.75,.18);arc.closePath();
 const deskGeom=new THREE.ExtrudeGeometry(arc,{depth:.58,bevelEnabled:true,bevelThickness:.055,bevelSize:.045,bevelSegments:2,steps:1,curveSegments:30});
 deskGeom.rotateX(-Math.PI/2);
 const desk=new THREE.Mesh(deskGeom,black);desk.position.set(0,.76,1.35);scene.add(desk);
 const front=box(0,.52,1.71,3.3,.58,.12,panel);
 const stripe=box(0,.82,1.79,3.35,.035,.13,glow);
 const logoCanvas=document.createElement("canvas");logoCanvas.width=512;logoCanvas.height=128;const l=logoCanvas.getContext("2d");l.fillStyle="#15111a";l.fillRect(0,0,512,128);l.fillStyle="#ff435a";l.font="bold 45px sans-serif";l.textAlign="center";l.fillText("DOOM404",256,57);l.fillStyle="#ded2d7";l.font="21px sans-serif";l.fillText("RISK INTELLIGENCE",256,96);
 const logoTexture=new THREE.CanvasTexture(logoCanvas);const logo=new THREE.Mesh(new THREE.PlaneGeometry(1.95,.49),new THREE.MeshBasicMaterial({map:logoTexture,transparent:true}));logo.position.set(0,.52,1.785);scene.add(logo);
 const ambient=new THREE.HemisphereLight(0xffffff,0x410b1a,2);scene.add(ambient);
 const key=new THREE.DirectionalLight(0xffffff,3);key.position.set(-2,5,5);scene.add(key);
 const rim=new THREE.DirectionalLight(0xff1d45,2);rim.position.set(2,3,-2);scene.add(rim);
 let mascot=null,head=null,arm=null,headBase=0,armBase=0,baseY=0;
 new GLTFLoader().load(asset,gltf=>{
   mascot=gltf.scene;scene.add(mascot);
   const bounds=new THREE.Box3().setFromObject(mascot),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
   const scale=2.85/Math.max(.001,size.y);mascot.scale.setScalar(scale);
   baseY=-bounds.min.y*scale;mascot.position.set(-center.x*scale,baseY,-center.z*scale-.12);
   mascot.traverse(o=>{if(o.isBone){if(!head&&/head|neck/i.test(o.name))head=o;if(!arm&&/rightarm|rightupperarm/i.test(o.name))arm=o;}});
   headBase=head?.rotation.y||0;armBase=arm?.rotation.z||0;
   api.ready=true;
   api.render=(t,sceneIndex)=>{
     mascot.rotation.y=Math.sin(t*.45)*.045;
     mascot.position.y=baseY;
     if(head)head.rotation.y=headBase+Math.sin(t*.7)*.035;
     if(arm)arm.rotation.z=armBase+Math.sin(t*1.15)*.035;
     renderer.render(scene,camera);return surface;
   };
 },undefined,e=>{api.error=String(e?.message||e)});
}catch(e){api.error=String(e.message||e)}
