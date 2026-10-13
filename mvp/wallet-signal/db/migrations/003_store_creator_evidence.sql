-- Atomic promotion of matching on-chain creator evidence.
-- A conflict never overwrites an existing verified creator.
create or replace function public.store_creator_evidence(
  p_mint text, p_creator text, p_signature text, p_program_id text,
  p_decoder_version text, p_fee_payer text default null,
  p_creator_is_signer boolean default null, p_instruction_hash text default null
) returns text language plpgsql security invoker set search_path = public as $$
declare current_record public.token_creator_attributions%rowtype;
begin
  if p_mint !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or p_creator !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or p_signature !~ '^[1-9A-HJ-NP-Za-km-z]{64,88}$'
    or p_program_id !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or p_decoder_version is null or length(p_decoder_version) > 120
    then raise exception 'INVALID_CREATOR_EVIDENCE'; end if;
  select * into current_record from public.token_creator_attributions
    where mint = p_mint for update;
  if not found then raise exception 'ATTRIBUTION_NOT_FOUND'; end if;
  if current_record.indexed_creator is distinct from p_creator or
    (current_record.verified_creator is not null and current_record.verified_creator <> p_creator)
    then
      update public.token_creator_attributions set status='CONFLICT', updated_at=now() where mint=p_mint;
      return 'CONFLICT';
  end if;
  insert into public.onchain_transaction_evidence
    (signature,mint,program_id,decoded_creator,fee_payer,creator_is_signer,
     decoder_version,instruction_hash,verification_status)
    values (p_signature,p_mint,p_program_id,p_creator,p_fee_payer,p_creator_is_signer,
            p_decoder_version,p_instruction_hash,'DECODED_MATCH')
    on conflict (signature) do nothing;
  update public.token_creator_attributions set
    verified_creator=p_creator,creation_signature=p_signature,program_id=p_program_id,
    decoder_version=p_decoder_version,verification_method='helius_onchain_decoder',
    status='ONCHAIN_MATCH_PENDING_INDEPENDENT_REVIEW',
    last_checked_at=now(),updated_at=now()
    where mint=p_mint;
  return 'ONCHAIN_MATCH_PENDING_INDEPENDENT_REVIEW';
end $$;
revoke all on function public.store_creator_evidence(text,text,text,text,text,text,boolean,text) from public, anon, authenticated;
grant execute on function public.store_creator_evidence(text,text,text,text,text,text,boolean,text) to service_role;
