import type { TrailSegment } from '../core/index';

/**
 * Draws the segments of a trail, oldest first, like a comet: thinner and more
 * transparent towards the tail. `width` is the width at the pointer.
 *
 * Consecutive segments overlap where they meet, at their round ends. Painting a
 * semi-transparent colour twice there would leave a darker dot at every joint.
 * So, before each segment is painted, the area it covers is erased: where two
 * segments overlap, only the newer one shows, and the trail stays as smooth as
 * if it were a single line.
 */
export function drawTrail(
  context: CanvasRenderingContext2D,
  segments: readonly TrailSegment[],
  color: string,
  width: number,
): void {
  context.save();
  context.lineCap = 'round';
  context.strokeStyle = color;
  for (const segment of segments) {
    context.lineWidth = width * (0.25 + 0.75 * segment.life);
    context.beginPath();
    context.moveTo(segment.x1, segment.y1);
    context.lineTo(segment.x2, segment.y2);

    // Erase what is already there, then paint this segment on the clean area.
    context.globalCompositeOperation = 'destination-out';
    context.globalAlpha = 1;
    context.stroke();
    context.globalCompositeOperation = 'source-over';
    context.globalAlpha = segment.life;
    context.stroke();
  }
  context.restore();
}
