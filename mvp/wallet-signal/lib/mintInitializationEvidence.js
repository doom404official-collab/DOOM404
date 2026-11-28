// SPL Token / Token-2022 initializeMint(0) and initializeMint2(20) decoding.
// These instructions establish mint initialization, not beneficial ownership.
const PROGRAMS = new Set(["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA","TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"]);
const ALPHABET="123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function decodeBase58(input) {
  if (typeof input !== "string" || !input.length) return null;
  const out=[0];
  for (const char of input) {
    const n=ALPHABET.indexOf(char);
    if(n<0) return null;
    let carry=n;
    for(let i=0;i<out.length;i++){const v=out[i]*58+carry;out[i]=v&255;carry=v>>8;}
    while(carry){out.push(carry&255);carry>>=8;}
  }
  for(const char of input){if(char!=="1")break;out.push(0);}
  return Uint8Array.from(out.reverse());
}
export function inspectMintInitialization(instructions,mint) {
  const matches=[];
  for(const ix of instructions || []) {
    if(!PROGRAMS.has(ix.programId) || ix.accounts?.[0]!==mint) continue;
    const parsedType=ix.parsed?.type;
    if(parsedType==="initializeMint" || parsedType==="initializeMint2"){
      if(ix.parsed?.info?.mint===mint) matches.push({programId:ix.programId,kind:parsedType,method:"parsed"});
      continue;
    }
    const bytes=ix.data instanceof Uint8Array ? ix.data : Array.isArray(ix.data) && ix.data.every(n=>Number.isInteger(n)&&n>=0&&n<=255) ? Uint8Array.from(ix.data) : Array.isArray(ix.data) && ix.data[1]==="base64" && typeof ix.data[0]==="string" ? Uint8Array.from(Buffer.from(ix.data[0],"base64")) : decodeBase58(ix.data);
    if(!bytes || bytes.length<35 || (bytes[0]!==0 && bytes[0]!==20)) continue;
    const kind=bytes[0]===0?"initializeMint":"initializeMint2";
    // Layout: opcode(1), decimals(1), mintAuthority(32), COption<Pubkey> freezeAuthority(4 + optional 32).
    const freezeOption=bytes[34] | (bytes[35]<<8) | (bytes[36]<<16) | (bytes[37]<<24);
    if(bytes.length<38 || (freezeOption!==0 && freezeOption!==1)) continue;
    if(bytes.length !== (freezeOption===1?70:38)) continue;
    matches.push({programId:ix.programId,kind,method:"raw_instruction"});
  }
  return matches;
}
