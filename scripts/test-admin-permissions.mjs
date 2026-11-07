import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';import path from 'node:path';
const dir=mkdtempSync(path.join(tmpdir(),'kn-admin-config-'));process.env.DATA_DIR=dir;
const {updateCallSettings,callSettingsStatus}=await import('../lib/call-settings.mjs');
try{await assert.rejects(updateCallSettings({BAD_KEY:'x'}));await assert.rejects(updateCallSettings({CALL_TURN_URL:'https://invalid'}));await assert.rejects(updateCallSettings({CALL_RELAY_ONLY:'true'}));
const result=await updateCallSettings({CALL_TURN_URL:'turn:relay.example.com:3478',CALL_TURN_SECRET:'fixture-secret',CALL_RELAY_ONLY:'true'});assert.equal(result.CALL_TURN_SECRET,true);assert.ok(!JSON.stringify(result).includes('fixture-secret'));assert.equal(process.env.CALL_TURN_SECRET,'fixture-secret');assert.equal(JSON.parse(readFileSync(path.join(dir,'call-settings.json'))).CALL_TURN_SECRET,'fixture-secret');assert.equal(callSettingsStatus().CALL_RELAY_ONLY,'true');
await updateCallSettings({CALL_RELAY_ONLY:'false',CALL_TURN_SECRET:''});assert.equal(callSettingsStatus().CALL_TURN_SECRET,false);console.log('PASS: admin relay configuration validates fields, persists privately, activates without restart, and redacts secrets.');}finally{rmSync(dir,{recursive:true,force:true});}
