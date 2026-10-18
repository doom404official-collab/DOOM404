// Pump AMM pool account layout v1. Decodes vault references only.
// Vault existence, token mints, reserves and withdrawal controls require independent RPC checks.
import { PublicKey } from "@solana/web3.js";
const PROGRAM="pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA";
const DISCRIMINATOR=Buffer.from([241,154,109,4,17,177,109,188]);
export function decodePumpAmmPoolState(data, ownerProgram) {
 if(ownerProgram!==PROGRAM||!Buffer.isBuffer(data)||data.length<243)return null;
 if(!data.subarray(0,8).equals(DISCRIMINATOR))return null;
 const key=offset=>new PublicKey(data.subarray(offset,offset+32)).toBase58();
 return {
  protocol:"pump_amm",
  poolBump:data.readUInt8(8),
  index:data.readUInt16LE(9),
  creator:key(11),
  baseMint:key(43),
  quoteMint:key(75),
  lpMint:key(107),
  poolBaseTokenAccount:key(139),
  poolQuoteTokenAccount:key(171),
  lpSupply:data.readBigUInt64LE(203).toString(),
  coinCreator:key(211),
  protocolVerified:false,
  reservesVerified:false,
  lpSecurityVerified:false,
  warning:"Uncorroborated decoded account fields; never score without independent vault and mint verification"
 };
}
