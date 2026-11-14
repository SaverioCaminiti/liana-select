/**
 * The trail drawn behind the pointer during a gesture.
 *
 * Pure geometry and timing, with no drawing: the element feeds it pointer
 * positions with their time, and draws the segments it returns. Each segment
 * fades out over `duration` milliseconds after the pointer passed there.
 */

/** When the trail is drawn: for touch and pen only, for every pointer, or never. */
export type TrailMode = 'touch' | 'always' | 'none';

export const TRAIL_MODES: readonly TrailMode[] = ['touch', 'always', 'none'];

/** The mode for an attribute value; anything unknown means the default, `touch`. */
export function parseTrailMode(value: string | null | undefined): TrailMode {
  return TRAIL_MODES.find((mode) => mode === value) ?? 'touch';
}

/**
 * Whether to draw a trail for a pointer of this type. The trail is decoration:
 * when the user asks for reduced motion, there is none.
 */
export function shouldDrawTrail(
  mode: TrailMode,
  pointerType: string,
  reducedMotion: boolean,
): boolean {
  if (reducedMotion || mode === 'none') return false;
  return mode === 'always' || pointerType !== 'mouse';
}

interface TrailPoint {
  readonly x: number;
  readonly y: number;
  /** Time the pointer was here, in milliseconds. */
  readonly time: number;
  /** Points of different strokes are never joined. */
  readonly stroke: number;
}

/** A piece of the trail between two consecutive points of a stroke. */
export interface TrailSegment {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  /** 1 where the pointer has just been, down to 0 when the segment disappears. */
  readonly life: number;
}

export class Trail {
  #points: TrailPoint[] = [];
  #stroke = 0;

  /** How long a segment takes to fade out, in milliseconds. */
  duration: number;

  constructor(duration = 400) {
    this.duration = duration;
  }

  /** Starts a new stroke, not joined to the previous one: a new press. */
  startStroke(): void {
    this.#stroke += 1;
  }

  /** Adds where the pointer is now. Points closer than half a pixel are skipped. */
  add(x: number, y: number, time: number): void {
    const last = this.#points.at(-1);
    if (
      last?.stroke === this.#stroke &&
      Math.abs(last.x - x) < 0.5 &&
      Math.abs(last.y - y) < 0.5
    ) {
      return;
    }
    this.#points.push({ x, y, time, stroke: this.#stroke });
  }

  /**
   * The segments still visible at `now`, oldest first. A segment fades with the
   * age of its newer end, so the trail shrinks from the tail towards the pointer.
   * Points that can no longer be part of a visible segment are forgotten.
   */
  segments(now: number): TrailSegment[] {
    this.#prune(now);
    const segments: TrailSegment[] = [];
    for (let index = 1; index < this.#points.length; index++) {
      const from = this.#points[index - 1];
      const to = this.#points[index];
      if (to === undefined || from?.stroke !== to.stroke) continue;
      const life = 1 - (now - to.time) / this.duration;
      if (life <= 0) continue;
      segments.push({
        x1: from.x,
        y1: from.y,
        x2: to.x,
        y2: to.y,
        life: Math.min(1, life),
      });
    }
    return segments;
  }

  /** Whether anything is still visible at `now`. */
  isVisible(now: number): boolean {
    return this.segments(now).length > 0;
  }

  clear(): void {
    this.#points = [];
  }

  /** Drops the points whose following point has already faded out. */
  #prune(now: number): void {
    let first = 0;
    while (first < this.#points.length - 1) {
      const next = this.#points[first + 1];
      if (next === undefined || now - next.time < this.duration) break;
      first += 1;
    }
    if (first > 0) this.#points = this.#points.slice(first);
  }
}
