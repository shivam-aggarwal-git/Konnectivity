import assert from 'node:assert/strict';
import {standaloneAsset,checksumFor,releaseHeaders} from './desktop-tools.mjs';
assert.equal(standaloneAsset('darwin','arm64'),'yt-dlp_macos');assert.equal(standaloneAsset('win32','arm64'),'yt-dlp_arm64.exe');assert.equal(standaloneAsset('linux','x64'),'yt-dlp_linux');assert.equal(standaloneAsset('linux','arm64',true),'yt-dlp_musllinux_aarch64');assert.equal(standaloneAsset('other','x64'),null);
const sum='a'.repeat(64);assert.equal(checksumFor(sum+'  yt-dlp_macos\n','yt-dlp_macos'),sum);assert.throws(()=>checksumFor('bad  yt-dlp_macos','yt-dlp_macos'));assert.throws(()=>checksumFor(sum+'  other','yt-dlp_macos'));
assert.deepEqual(releaseHeaders(''),{accept:'application/vnd.github+json'});assert.deepEqual(releaseHeaders('synthetic-fixture-token'),{accept:'application/vnd.github+json',Authorization:'Bearer synthetic-fixture-token'});
console.log('PASS: supported desktop standalone assets and fail-closed checksums');
