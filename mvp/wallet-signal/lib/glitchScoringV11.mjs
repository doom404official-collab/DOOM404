export const version = "1.1";
export const attributes = [
 {id:"token_security",name:"Token Security",weight:25,components:{transfer_fee_schedule:25,fee_configuration_authority:25,mint_authority:25,freeze_authority:25}},
 {id:"holder_intelligence",name:"Holder Intelligence",weight:25,components:{top20_holder_concentration:35,connected_wallet_network:35,creator_team_exposure:20,holder_breadth_independence:10}},
 {id:"creator_intelligence",name:"Creator Intelligence",weight:25,components:{creator_identification:20,creator_holdings:20,creator_selling:30,previous_launches:30}},
 {id:"liquidity_quality_safety",name:"Liquidity Quality & Safety",weight:25,components:{available_liquidity:25,liquidity_market_cap_ratio:20,lp_security:25,liquidity_concentration:10,trading_impact:10,liquidity_stability:10}}
];
export function consolidate(results={}) {
 const checks=attributes.map(a=>({id:a.id,weight:a.weight,...(results[a.id]||{})}));
 const complete=checks.every(c=>c.complete===true&&c.calibrated===true&&typeof c.score==="number"&&Number.isFinite(c.score)&&c.score>=0&&c.score<=100);
 return {version,checks,score:complete?Math.round(checks.reduce((s,c)=>s+c.weight*c.score/100,0)*100)/100:null,status:complete?"complete":"incomplete"};
}
