import {spawnSync} from 'node:child_process';
// Vercel: exit 0 skips, exit 1 builds. A missing comparison base always builds.
const candidate=process.env.VERCEL_GIT_PREVIOUS_SHA;
const base=/^[0-9a-f]{40}$/.test(candidate??'')?candidate:'HEAD^';
const available=spawnSync('git',['rev-parse','--verify',base],{stdio:'ignore'});
if(available.status!==0)process.exit(1);
const diff=spawnSync('git',['diff','--quiet',base,'HEAD','--',':(top)mvp/wallet-signal'],{stdio:'ignore'});
process.exit(diff.status===0?0:1);
