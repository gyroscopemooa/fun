import test from 'node:test';import assert from 'node:assert/strict';
import {createNicepayToolAdapters} from './nicepay-tool-adapters.js';
test('actual saju adapter disabled by default and maps validated fields to implementation',async()=>{
 assert.deepEqual(createNicepayToolAdapters(),{});let input;
 const a=createNicepayToolAdapters({enabled:true,analyzeSaju:async value=>{input=value;return {analysis:'fixture'};}}).ai_manseryeok;
 const validated=await a.validate({birthDate:'2000-02-29',name:' Test ',ignored:'not forwarded'});
 assert.deepEqual(await a.execute(validated),{analysis:'fixture'});assert.equal(input.name,'Test');assert.equal(input.ignored,undefined);
 for(const change of [{birthDate:'2001-02-29'},{birthDate:'../../'},{birthTime:'25:00'},{locale:'bad'},{timeUnknown:'true'}])await assert.rejects(a.validate({birthDate:'2000-01-01',...change}));
});
