export type BufferedRange = [start: number, end: number];

export function readBuffered(media: HTMLMediaElement): BufferedRange[] {
  const ranges = media.buffered;
  return Array.from({ length: ranges.length }, (_, index) => [ranges.start(index), ranges.end(index)]);
}

export function hasStartupBuffer(ranges: BufferedRange[], position: number, duration: number) {
  if (!Number.isFinite(duration) || duration <= 0) return false;
  const needed = Math.min(duration, position + 1.5);
  return ranges.some(([start, end]) => start <= position + .05 && end >= needed - .05);
}
