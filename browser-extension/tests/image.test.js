import test from 'node:test';
import assert from 'node:assert/strict';
import {imageOptions} from '../image-tools.js';
test('image options maintain aspect ratio and allowed types',()=>{assert.deepEqual(imageOptions(1200,800,600,'image/webp',0.8),{width:600,height:400,mime:'image/webp',quality:0.8});});
test('image limits reject upscaling, huge pixels and invalid options',()=>{
  for(const args of [[100,100,200,'image/png',1],[10000,10000,100,'image/jpeg',.8],[100,100,0,'image/png',1],[100,100,50,'image/gif',1],[100,100,50,'image/jpeg',2]])assert.throws(()=>imageOptions(...args));
});
