const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const src=fs.readFileSync(require('path').join(__dirname,'../hud-v8.js'),'utf8');
const body=src.match(/function captionPage\(caption,progress\)\{(.*?)\}\nfunction paint/s)[1];const page=new Function('caption','progress',body);
test('long caption pages retain every word in order and final page at completion',()=>{const words=Array.from({length:99},(_,i)=>'word'+i),caption=words.join(' '),pages=[0,.25,.5,.75].map(p=>page(caption,p));assert.deepEqual(pages.join(' ').split(' '),words);assert.equal(page(caption,1),pages.at(-1));assert.ok(pages.every(x=>x.split(' ').length<=28))});
