import test from 'node:test';import assert from 'node:assert/strict';import {outputSize,normalizedRect} from '../src/lib/image-batch/policy.ts';
test('size keeps ratio without enlargement',()=>{assert.deepEqual(outputSize(2400,1200,1200,1200),{width:1200,height:600});assert.deepEqual(outputSize(50,30,100,100),{width:50,height:30});});
test('invalid size rejected',()=>assert.throws(()=>outputSize(0,5,10,10)));
test('reverse drag normalized',()=>assert.deepEqual(normalizedRect(.8,.7,.2,.1),{x:.2,y:.1,w:.6000000000000001,h:.6}));
