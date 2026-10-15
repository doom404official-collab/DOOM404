import test from 'node:test';
import assert from 'node:assert/strict';
import {PublicKey} from '@solana/web3.js';
import {PROGRAMS} from './solanaHolderSnapshot.mjs';
test('canonical Token-2022 program matches on-chain mint owner',()=>{
 assert.equal(PROGRAMS[1],'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');
 assert.equal(new PublicKey(PROGRAMS[1]).toBase58(),PROGRAMS[1]);
});
test('canonical legacy SPL token program is recognized',()=>{
 assert.equal(PROGRAMS[0],'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
});
