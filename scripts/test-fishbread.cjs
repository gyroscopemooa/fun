const { chromium } = require('@playwright/test');
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
 const browser = await chromium.launch({channel:'msedge',headless:true});
 try {
 const page = await browser.newPage();
 await page.route('http://fishbread.test/', route => route.fulfill({body:'<html><body></body></html>',contentType:'text/html'}));
 await page.goto('http://fishbread.test/');
 const source=fs.readFileSync('src/pages/maps/fishbread.astro','utf8');
 const html=source.slice(source.indexOf('<main'),source.indexOf('  <link'));
 await page.setContent(html);
 await page.evaluate(() => {
  document.getElementById('spot-region').innerHTML='<option value=""></option><option>울산</option><option>서울</option>';
  window.alert=()=>{};
  window.records=[{id:'one',name:'노점',region:'울산',flavor:'팥',detail:'보람병원 맞은편',lat:35.54,lng:129.33,up_count:2,down_count:0}];
  window.saved=[];
  const query=table=>{
   const result={data:table==='fishbread_reports'?window.records:[],error:null};
   const q={select:()=>q,eq:()=>q,order:()=>q,limit:()=>q,in:()=>q,then:(resolve)=>Promise.resolve(result).then(resolve),insert:async data=>{window.saved.push(data);return {error:null}}};return q;
  };
  window.mockClient={from:query,auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>{}},rpc:async()=>({data:[{applied:true,up_count:3,down_count:0}]})};
  const chain=()=>({addTo(){return this},bindPopup(){return this},bindTooltip(){return this},on(){return this},setLatLng(){return this},remove(){}});
  window.mapCalls=[];
  window.mapEvents={};
  window.L={map:()=>({setView(p,z){window.mapCalls.push([p,z]);return this},on(e,cb){window.mapEvents[e]=cb},getCenter:()=>({lat:35.54,lng:129.33})}),tileLayer:chain,layerGroup:()=>({...chain(),clearLayers(){}}),marker:chain};
 });
 let script=source.slice(source.indexOf('    const loadSupabaseCreateClient'),source.indexOf('  </script>',source.indexOf('    const loadSupabaseCreateClient')));
 script=script.replace('const createClient = await loadSupabaseCreateClient();','const createClient = () => window.mockClient;');
 await page.evaluate(`(async()=>{const supabaseUrl='https://example.test',supabaseAnonKey='test',adminEmails='';${script}})()`);
 await page.waitForFunction(()=>document.getElementById('vendor-list').textContent.includes('보람병원'));
 const before=await page.evaluate(()=>mapCalls.length);
 await page.evaluate(()=>mapEvents.click({latlng:{lat:35.54,lng:129.33}}));
 assert.equal(await page.evaluate(()=>mapCalls.length),before,'selection must not recenter');
 assert.equal(await page.inputValue('#spot-region'),'울산');
 await page.locator('[data-flavor="피자"]').click();
 assert.match(await page.locator('#vendor-list').innerText(),/제보가 없습니다/);
 await page.locator('[data-flavor=""]').click();
 await page.locator('#vendor-search').fill('보람병원');
 assert.match(await page.locator('#vendor-list').innerText(),/보람병원/);
 await page.locator('[data-region="서울"]').click();
 assert.equal(await page.inputValue('#spot-region'),'울산','browse region must not change report region');
 await page.locator('#spot-detail').fill('보람병원 맞은편');
 await page.locator('#spot-add').click();
 await page.waitForFunction(()=>saved.length===1);
 assert.equal(await page.evaluate(()=>saved[0].name),'붕어빵 노점');
 assert.equal(await page.evaluate(()=>saved[0].region),'울산');
 await page.waitForFunction(()=>document.getElementById('spot-latlng').value==='');
 assert.equal(await page.locator('#spot-add').isDisabled(),true);
 console.log('PASS: stable map selection, flavor/detail search, independent region, optional name persistence payload, selection reset');
 } finally {await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
