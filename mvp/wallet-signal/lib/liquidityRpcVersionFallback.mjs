import {Connection} from "@solana/web3.js";
export async function retrieveLiquidityTransaction(signature,{primaryConnection,alternateUrl=process.env.GLITCH_LIQUIDITY_HISTORY_RPC_URL||process.env.HELIUS_RPC_URL,primaryUrl=process.env.SOLANA_RPC_URL,connectionFactory=url=>new Connection(url,"confirmed")}={}){
 if(!primaryConnection)throw Error("PRIMARY_RPC_REQUIRED");
 const options={maxSupportedTransactionVersion:0,commitment:"confirmed"};
 try{return {transaction:await primaryConnection.getTransaction(signature,options),provider:"primary",fallbackUsed:false};}
 catch(error){
  if(error?.code!==-32015||!alternateUrl)return {transaction:null,provider:"primary",fallbackUsed:false,error};
  if(!/^https:\/\//i.test(alternateUrl))return {transaction:null,provider:"primary",fallbackUsed:false,error:new Error("INVALID_HISTORY_RPC_URL")};
  if(primaryUrl&&alternateUrl===primaryUrl)return {transaction:null,provider:"primary",fallbackUsed:false,error,fallbackSkipped:"SAME_RPC_ENDPOINT"};
  try{return {transaction:await connectionFactory(alternateUrl).getTransaction(signature,options),provider:"helius_or_configured_alternate",fallbackUsed:true};}
  catch(fallbackError){return {transaction:null,provider:"helius_or_configured_alternate",fallbackUsed:true,error:fallbackError};}
 }
}
