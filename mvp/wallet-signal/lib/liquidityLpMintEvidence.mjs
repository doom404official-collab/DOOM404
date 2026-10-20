import {PublicKey} from "@solana/web3.js";
const CLASSIC="TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022="TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
export function inspectLpMintAccount(account,expectedMintAddress,reportedSupply) {
 const unknown={mintAccountVerified:false,lpBurnVerified:false,lpLockVerified:false,withdrawalRightsVerified:false};
 if(!account)return {...unknown,reason:"lp_mint_account_missing"};
 const owner=account.owner?.toBase58?.();
 if(owner!==CLASSIC&&owner!==TOKEN_2022)return {...unknown,reason:"unsupported_lp_mint_program",observedOwnerProgram:owner??null};
 const data=account.data;
 if(!Buffer.isBuffer(data)||data.length<82)return {...unknown,reason:"invalid_lp_mint_layout"};
 const option=data.readUInt32LE(0),freezeOption=data.readUInt32LE(46);
 if(![0,1].includes(option)||![0,1].includes(freezeOption)||data.readUInt8(45)!==1)return {...unknown,reason:"invalid_lp_mint_state"};
 const supply=data.readBigUInt64LE(36).toString();
 const mintAuthority=option===1?new PublicKey(data.subarray(4,36)).toBase58():null;
 const freezeAuthority=freezeOption===1?new PublicKey(data.subarray(50,82)).toBase58():null;
 const supplyMatches=null; // Pump AMM lp_supply is a protocol-defined accounting quantity; direct equality is not a safety invariant.
 return {...unknown,mintAccountVerified:true,lpMint:expectedMintAddress,tokenProgram:owner,rawSupply:supply,poolReportedRawSupply:String(reportedSupply??""),supplyMatchesPool:supplyMatches, supplyComparisonStatus:"not_directly_comparable", poolSupplyDefinition:"Pump AMM reported circulating supply excluding burns and lock-ups",mintAuthority,freezeAuthority,reason:"LP holder custody, burns, locks and withdrawal rights not established"};
}
