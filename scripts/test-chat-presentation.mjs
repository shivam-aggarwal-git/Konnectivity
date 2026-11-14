import assert from 'node:assert/strict';
import {chatTextParts} from '../lib/chat-text.mjs';
import {emojiPlacement} from '../lib/emoji-placement.mjs';
const text='Track here: https://example.com/track/123.\nHello <svg> javascript:alert(1)';
const parts=chatTextParts(text);assert.equal(parts.map(p=>p.text).join(''),text);assert.equal(parts.filter(p=>p.href).length,1);assert.equal(parts.find(p=>p.href).href,'https://example.com/track/123');
for(const width of [280,390,800]){const box={left:width>400?100:16,top:100,width:width-32,height:550};const p=emojiPlacement({right:width-20,top:400},box,{width,height:844});assert.ok(p.left>=0&&p.left+p.width<=box.width);assert.ok(p.top>=0&&p.top+p.maxHeight<=box.height);}
console.log('PASS: safe clickable URLs, punctuation preserved, wrapped text and dialog-contained emoji positioning');
