// Manual, loopback-only development. Reuses the existing local payment mode;
// it never mounts NICE approval routes or reads/writes an operational wallet DB.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import dotenv from 'dotenv';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const frontend=path.resolve(process.env.AI_LOCAL_FRONTEND_ROOT||repo);
const output=path.resolve(process.env.AI_LOCAL_STORAGE||path.join(repo,'output/local-ai'));
const apiPort=Number(process.env.AI_LOCAL_API_PORT||8797),webPort=Number(process.env.AI_LOCAL_WEB_PORT||4341);
if(![apiPort,webPort].every(n=>Number.isInteger(n)&&n>=1024&&n<65536))throw Error('Invalid local ports');
await fs.mkdir(output,{recursive:true});
const isolatedEnv=path.join(output,'empty.env');await fs.writeFile(isolatedEnv,'# No credentials stored here.\n');
const source=process.env.AI_LOCAL_ENV?dotenv.parse(await fs.readFile(process.env.AI_LOCAL_ENV)):{};
const key=process.env.OPENAI_API_KEY||source.OPENAI_API_KEY;
if(!key)throw Error('Configure an OpenAI key in the existing private environment');
const children=[];
const stop=()=>{for(const c of children)c.kill();};
process.on('SIGINT',stop);process.on('SIGTERM',stop);
const api=spawn(process.execPath,['src/server.js'],{cwd:path.join(repo,'node-api'),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,DOTENV_CONFIG_PATH:isolatedEnv,OPENAI_API_KEY:key,NODE_ENV:'development',HOST:'127.0.0.1',PORT:String(apiPort),EXTERNAL_AI_ENABLED:'true',IMAGE_PROVIDER:'openai_image',ID_PHOTO_ENABLED:'true',LOCAL_AI_DEVELOPMENT:'true',PAYMENT_MODE:'mock',POLAR_ACCESS_TOKEN:'',RESEND_API_KEY:'',CREDITS_ENABLED:'false',CREDITS_DB_PATH:'',CREDITS_STORAGE:'sqlite',PLAY_WORKER_ENABLED:'false',MANYTOOL_STORAGE_DIR:output}});
children.push(api);
// Deliberately do not mirror raw provider logs into the console.
api.stdout.on('data',data=>{if(String(data).includes('listening'))console.log(`AI API: http://127.0.0.1:${apiPort}`);});
api.stderr.on('data',()=>{});
let ready=false;
for(let n=0;n<100;n++){if(api.exitCode!==null)break;try{ready=(await fetch(`http://127.0.0.1:${apiPort}/health`)).ok;}catch{}if(ready)break;await new Promise(r=>setTimeout(r,100));}
if(!ready){stop();throw Error('Local API failed to start');}
const env={...process.env,PUBLIC_NODE_API_BASE:`http://127.0.0.1:${apiPort}`,PUBLIC_LOCAL_AI_TESTING:'true',PUBLIC_LOCAL_PAYMENT_REVIEW:'true',PUBLIC_CREDITS_ENABLED:'false'};
const web=process.platform==='win32'
 ?spawn('cmd.exe',['/d','/s','/c',`npm run dev -- --host 127.0.0.1 --port ${webPort}`],{cwd:frontend,env,windowsHide:true,stdio:['ignore','pipe','pipe']})
 :spawn('npm',['run','dev','--','--host','127.0.0.1','--port',String(webPort)],{cwd:frontend,env,stdio:['ignore','pipe','pipe']});
children.push(web);web.stdout.on('data',()=>{});web.stderr.on('data',()=>{});
console.log(`Profile: http://127.0.0.1:${webPort}/ai-headshot/`);
console.log(`Other AI tools: http://127.0.0.1:${webPort}/`);
console.log('Local development only; actual API usage is billed by OpenAI. No NICE charge or email delivery.');
for(const child of children)child.on('error',()=>{stop();process.exitCode=1;});
