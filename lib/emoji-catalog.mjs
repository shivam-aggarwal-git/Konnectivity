import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const catalog = require('@emoji-mart/data');
const supported = new Set(Object.values(catalog.emojis).flatMap(emoji => emoji.skins.map(skin => skin.native)));
export function supportedEmoji(value) { return typeof value === 'string' && value.length <= 64 && supported.has(value); }
