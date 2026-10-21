/** Pinned public Pump.fun IDL candidate; NOT proof this schema applied at slot 442809233.
 * Source: pump-fun/pump-public-docs idl/pump.json @ 3c6721a67c0b206b39130b454c8ba22a83ce972e.
 */
export const PUMP_GLOBAL_SCHEMA_COMMIT='3c6721a67c0b206b39130b454c8ba22a83ce972e';
export const PUMP_GLOBAL_SCHEMA_FIELDS=[
 ['initialized','bool'],['authority','pubkey'],['fee_recipient','pubkey'],
 ['initial_virtual_token_reserves','u64'],['initial_virtual_sol_reserves','u64'],
 ['initial_real_token_reserves','u64'],['token_total_supply','u64'],['fee_basis_points','u64'],
 ['withdraw_authority','pubkey'],['enable_migrate','bool'],['pool_migration_fee','u64'],
 ['creator_fee_basis_points','u64'],['fee_recipients',{array:['pubkey',7]}],
 ['set_creator_authority','pubkey'],['admin_set_creator_authority','pubkey'],
 ['create_v2_enabled','bool'],['whitelist_pda','pubkey'],['reserved_fee_recipient','pubkey'],
 ['mayhem_mode_enabled','bool'],['reserved_fee_recipients',{array:['pubkey',7]}],
 ['is_cashback_enabled','bool'],['buyback_fee_recipients',{array:['pubkey',8]}],
 ['buyback_basis_points','u64'],['initial_virtual_quote_reserves','u64'],
 ['whitelisted_quote_mints',{array:['pubkey',1]}]
];
export function expectedPinnedGlobalBytes(){const width=t=>t==='bool'?1:t==='u64'?8:t==='pubkey'?32:typeof t==='object'&&Array.isArray(t.array)?width(t.array[0])*t.array[1]:NaN;return 8+PUMP_GLOBAL_SCHEMA_FIELDS.reduce((sum,[,type])=>sum+width(type),0);}
