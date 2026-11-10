import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { makeHandler } from './server.mjs';

test('real loopback HTTP: owner reuse, mock workflow, cross-site rejection', async () => {
  const server = createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  server.on('request', makeHandler({origin, html:'mock only'}));
  try {
    const home = await fetch(origin);
    assert.equal(home.status, 200);
    const cookie = home.headers.get('set-cookie').split(';')[0];
    const again = await fetch(origin, {headers:{cookie}});
    assert.equal(again.headers.get('set-cookie').split(';')[0],cookie);
    const call = (body, extra={}) => fetch(`${origin}/api`, {method:'POST',headers:{origin,cookie,'content-type':'application/json',...extra},body:JSON.stringify(body)});
    const session = await (await call({action:'create'})).json();
    assert.equal((await call({action:'login',...session})).status,200);
    const download = await call({action:'download',...session,url:'https://media.example.test/stories/demo'});
    assert.match((await download.json()).content,/MOCK ONLY/);
    assert.equal((await call({action:'status',...session},{origin:'https://evil.test'})).status,403);
    assert.equal((await call({action:'close',...session})).status,200);
    assert.equal((await call({action:'status',...session})).status,404);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve=>server.close(resolve));
  }
});
