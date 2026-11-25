(()=>{'use strict';
// Drive capture from the active audio renderer rather than background-tab RAF.
// It schedules canvas frames; it never changes the narration samples.
async function start(ac,onFrame,track){
 if(!ac.audioWorklet||typeof AudioWorkletNode==='undefined'||typeof track?.requestFrame!=='function')throw Error('CAPTURE_CLOCK_UNAVAILABLE');
 const code=`class Doom404CaptureClock extends AudioWorkletProcessor {constructor(){super();this.frames=0;}process(inputs,outputs){this.frames+=128;if(this.frames>=sampleRate/24){this.frames-=sampleRate/24;this.port.postMessage(1);}return true;}}registerProcessor('doom404-capture-clock',Doom404CaptureClock);`;
 const url=URL.createObjectURL(new Blob([code],{type:'application/javascript'}));try{await ac.audioWorklet.addModule(url)}finally{URL.revokeObjectURL(url)}
 const node=new AudioWorkletNode(ac,'doom404-capture-clock'),gain=ac.createGain();gain.gain.value=0;node.connect(gain);gain.connect(ac.destination);let stopped=false;
 node.port.onmessage=()=>{if(stopped)return;onFrame();if(!stopped)try{track.requestFrame()}catch{}};
 return ()=>{if(stopped)return;stopped=true;node.port.onmessage=null;node.port.close();node.disconnect();gain.disconnect();};
}
window.doom404CaptureClock={start};
})();
