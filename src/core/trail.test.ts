import { describe, expect, it } from 'vitest';
import { parseTrailMode, shouldDrawTrail, Trail } from './trail';

describe('parseTrailMode', () => {
  it('accepts the three modes and defaults to touch', () => {
    expect(parseTrailMode('always')).toBe('always');
    expect(parseTrailMode('none')).toBe('none');
    expect(parseTrailMode('touch')).toBe('touch');
    expect(parseTrailMode(null)).toBe('touch');
    expect(parseTrailMode('sometimes')).toBe('touch');
  });
});

describe('shouldDrawTrail', () => {
  it('draws for touch and pen by default, not for the mouse', () => {
    expect(shouldDrawTrail('touch', 'touch', false)).toBe(true);
    expect(shouldDrawTrail('touch', 'pen', false)).toBe(true);
    expect(shouldDrawTrail('touch', 'mouse', false)).toBe(false);
  });

  it('draws for every pointer with always, and for none with none', () => {
    expect(shouldDrawTrail('always', 'mouse', false)).toBe(true);
    expect(shouldDrawTrail('none', 'touch', false)).toBe(false);
  });

  it('never draws when reduced motion is requested', () => {
    expect(shouldDrawTrail('always', 'touch', true)).toBe(false);
  });
});

describe('Trail', () => {
  it('joins consecutive points into segments, fading with age', () => {
    const trail = new Trail(400);
    trail.startStroke();
    trail.add(0, 0, 0);
    trail.add(10, 0, 100);
    trail.add(20, 0, 200);
    const segments = trail.segments(200);
    expect(segments.map((segment) => [segment.x1, segment.x2])).toEqual([
      [0, 10],
      [10, 20],
    ]);
    // The newest segment is fully alive, the older one has faded by a quarter.
    expect(segments.map((segment) => segment.life)).toEqual([0.75, 1]);
  });

  it('disappears from the tail after the duration', () => {
    const trail = new Trail(400);
    trail.startStroke();
    trail.add(0, 0, 0);
    trail.add(10, 0, 100);
    trail.add(20, 0, 200);
    expect(trail.segments(550).map((segment) => segment.x2)).toEqual([20]);
    expect(trail.isVisible(599)).toBe(true);
    expect(trail.isVisible(600)).toBe(false);
  });

  it('does not join separate strokes', () => {
    const trail = new Trail(400);
    trail.startStroke();
    trail.add(0, 0, 0);
    trail.add(10, 0, 10);
    trail.startStroke();
    trail.add(100, 100, 20);
    trail.add(110, 100, 30);
    expect(trail.segments(30).map((segment) => [segment.x1, segment.x2])).toEqual([
      [0, 10],
      [100, 110],
    ]);
  });

  it('skips points that did not move', () => {
    const trail = new Trail(400);
    trail.startStroke();
    trail.add(0, 0, 0);
    trail.add(0.2, 0.1, 10);
    trail.add(5, 0, 20);
    expect(trail.segments(20)).toHaveLength(1);
  });

  it('forgets faded points, and can be cleared', () => {
    const trail = new Trail(100);
    trail.startStroke();
    for (let time = 0; time <= 1000; time += 10) trail.add(time, 0, time);
    expect(trail.segments(1000).length).toBeLessThanOrEqual(10);
    trail.clear();
    expect(trail.isVisible(1000)).toBe(false);
  });
});
