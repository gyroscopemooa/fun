import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {BrowserSessionManager,ChromiumFixture} from './browser.mjs';
import {makeHandler} from './server.mjs';
const manager=new BrowserSessionManager({factory:()=>ChromiumFixture.open(chromium,process.env.POC_CHROMIUM_EXECUTABLE)});
const html=await readFile(new URL('./browser.html',import.meta.url),'utf8');
const server=createServer(makeHandler({manager,origin:'http://127.0.0.1:8790',html,scriptFile:'./browser-app.js'}));
server.requestTimeout=20_000;server.headersTimeout=5000;
const timer=setInterval(()=>manager.sweep().catch(()=>{}),1000).unref();
let stopping=false;
async function stop(){if(stopping)return;stopping=true;clearInterval(timer);server.close();server.closeAllConnections();try{await manager.shutdown();}catch{console.error('Browser teardown incomplete; supervisor cleanup required.');process.exitCode=1;}}
process.on('SIGINT',()=>void stop());process.on('SIGTERM',()=>void stop());
server.listen(8790,'127.0.0.1',()=>console.log('REAL BROWSER, LOCAL FIXTURE ONLY: http://127.0.0.1:8790'));
