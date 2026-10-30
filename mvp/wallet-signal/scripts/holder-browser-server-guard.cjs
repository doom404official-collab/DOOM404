// Test-server preload only. Listening/serving local assets is allowed; outbound
// sockets/fetch and every server API handler are blocked before execution.
const net=require('node:net');
const http=require('node:http');
net.Socket.prototype.connect=function(){throw Error('OFFLINE_SERVER_OUTBOUND_BLOCKED');};
global.fetch=async()=>{throw Error('OFFLINE_SERVER_FETCH_BLOCKED');};
const emit=http.Server.prototype.emit;
http.Server.prototype.emit=function(event,...args){
 if(event==='request'&&args[0]?.url?.split('?')[0].startsWith('/api/')){
  console.error('OFFLINE_SERVER_API_BLOCKED');args[1].writeHead(503,{'Content-Type':'application/json'});args[1].end('{"error":"Offline browser tests must mock every API request"}');return true;
 }
 return emit.call(this,event,...args);
};
