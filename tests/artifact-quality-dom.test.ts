import test from 'node:test';
import assert from 'node:assert/strict';
import { contrastRatio } from '../lib/artifacts/quality-dom';
test('host contrast measurement uses relative luminance, not channel distance',()=>{
 assert.equal(contrastRatio([0,0,0],[255,255,255]),21);assert.equal(contrastRatio([255,255,255],[0,0,0]),21);assert.equal(contrastRatio([100,100,100],[100,100,100]),1);
 assert.ok(contrastRatio([20,37,43],[199,233,223])>10);assert.ok(contrastRatio([130,130,130],[255,255,255])<4.5);
});
