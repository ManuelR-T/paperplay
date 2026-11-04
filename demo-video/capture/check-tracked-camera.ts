import assert from 'node:assert/strict';
import {trackedRegion,pointerAt,type ClipMeta} from '../src/clip';
const a={x:100,y:100,width:600,height:480},b={...a,y:40};
const clip={name:'test',fps:30,slowMotion:3,duration:9,viewport:{width:1920,height:1080},scale:1,events:[{type:'move',t:0,x:10,y:20},{type:'camera',t:0,x:0,y:0,region:a},{type:'camera',t:6,x:0,y:0,region:b}]} as ClipMeta;
assert.deepEqual(trackedRegion(clip,0,a),a);
assert.equal(trackedRegion(clip,1,a).y,70);
assert.deepEqual(trackedRegion(clip,3,a),b);
assert.deepEqual(pointerAt(clip,1),{x:10,y:20});
// A landmark moving 60px up in the take stays at exactly the same screen position.
const anchorStart=250,anchorEnd=190;
assert.equal(anchorStart-trackedRegion(clip,0,a).y,anchorEnd-trackedRegion(clip,2,a).y);
console.log('Camera compensates landmark drift; slow-motion timing and cursor stay correct.');
