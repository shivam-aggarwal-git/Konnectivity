import sharp from 'sharp';

export function isSvg(buffer) {
  return /^(?:\uFEFF)?\s*(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg(?:\s|>)/i.test(buffer.toString('utf8', 0, Math.min(buffer.length, 4096)));
}

/** SVG input is rasterized; active vector content is never served to browsers. */
export async function rasterizeSvg(buffer) {
  const text = buffer.toString('utf8');
  if (!isSvg(buffer) || /<!DOCTYPE|<!ENTITY|<\s*(?:script|foreignObject|iframe|image|use|style)\b|\bon\w+\s*=|\b(?:href|src)\s*=|url\s*\(|@import/i.test(text)) {
    throw new Error('Choose a self-contained SVG without scripts or external resources.');
  }
  return sharp(buffer, { limitInputPixels: 16_777_216, density: 96 })
    .resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })
    .png().toBuffer();
}
