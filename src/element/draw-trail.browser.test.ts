import { describe, expect, it } from 'vitest';
import type { TrailSegment } from '../core/index';
import { drawTrail } from './draw-trail';

function canvas(): CanvasRenderingContext2D {
  const element = document.createElement('canvas');
  element.width = 120;
  element.height = 40;
  const context = element.getContext('2d');
  if (context === null) throw new Error('No 2D context');
  return context;
}

/** Alpha of a pixel, between 0 and 255. */
function alpha(context: CanvasRenderingContext2D, x: number, y: number): number {
  return context.getImageData(x, y, 1, 1).data[3] ?? 0;
}

function segment(x1: number, x2: number, life: number): TrailSegment {
  return { x1, y1: 20, x2, y2: 20, life };
}

describe('drawTrail', () => {
  it('does not darken the joints between half-faded segments', () => {
    const context = canvas();
    drawTrail(
      context,
      [segment(10, 40, 0.5), segment(40, 70, 0.5), segment(70, 100, 0.5)],
      'rgb(0, 0, 255)',
      12,
    );
    const middle = alpha(context, 25, 20);
    // Where two segments meet, the trail is as transparent as along them.
    expect(Math.abs(alpha(context, 40, 20) - middle)).toBeLessThanOrEqual(2);
    expect(Math.abs(alpha(context, 70, 20) - middle)).toBeLessThanOrEqual(2);
  });

  it('shows the newer segment at a joint, not a mix that is darker than both', () => {
    const context = canvas();
    drawTrail(
      context,
      [segment(10, 50, 0.3), segment(50, 90, 0.8)],
      'rgb(0, 0, 255)',
      12,
    );
    const newer = alpha(context, 70, 20);
    expect(alpha(context, 50, 20)).toBeLessThanOrEqual(newer + 2);
  });

  it('fades towards the tail', () => {
    const context = canvas();
    drawTrail(context, [segment(10, 50, 0.2), segment(50, 90, 1)], 'rgb(0, 0, 255)', 12);
    expect(alpha(context, 30, 20)).toBeLessThan(alpha(context, 70, 20));
  });
});
