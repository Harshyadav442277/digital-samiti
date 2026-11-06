import { readFile,writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
if(process.stdin.isTTY)process.stdin.setRawMode(true);
console.log('Ready for private environment JSON (input hidden).');
const payload=await new Promise(resolve=>{let input='';const finish=()=>{process.stdin.removeAllListeners('data');process.stdin.pause();if(process.stdin.isTTY)process.stdin.setRawMode(false);resolve(input.trim());};process.stdin.on('data',c=>{if(c.toString().includes('\u0003'))process.exit(130);input+=c.toString();if(input.length>20000)process.exit(1);if(/[\r\n]/.test(input))finish();});process.stdin.once('end',finish);});
const input=JSON.parse(payload);let existing='';try{existing=await readFile('.env.local','utf8');}catch{}
const previous=key=>{const line=existing.split(/\r?\n/).find(l=>l.startsWith(key+'='));if(!line)return null;const value=line.slice(key.length+1);try{return JSON.parse(value);}catch{return value;}};
const env={DATABASE_URL:input.databaseUrl,NEON_AUTH_BASE_URL:input.authBaseUrl,NEON_AUTH_COOKIE_SECRET:previous('NEON_AUTH_COOKIE_SECRET')||randomBytes(32).toString('hex'),CRON_SECRET:previous('CRON_SECRET')||randomBytes(32).toString('hex')};
const keep=existing.split(/\r?\n/).filter(l=>!Object.keys(env).some(k=>l.startsWith(k+'='))).join('\n');
await writeFile('.env.local',keep+'\n'+Object.entries(env).map(([k,v])=>`${k}=${JSON.stringify(v)}`).join('\n')+'\n');
for(const [key,value] of Object.entries(env)){const r=spawnSync(process.platform==='win32'?'vercel.cmd':'vercel',['env','add',key,'production','--sensitive','--yes','--force'],{input:value+'\n',encoding:'utf8',shell:process.platform==='win32'});if(r.status!==0){console.error(r.stderr);process.exit(1);}console.log(`${key} configured`);}
