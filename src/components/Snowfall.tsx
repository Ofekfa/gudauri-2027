/** Gentle decorative snowfall. Pure CSS animation (transform only); off for reduced motion. */

const FLAKE_COUNT = 28;
const MIN_SIZE_PX = 3;
const SIZE_RANGE_PX = 5;
const MIN_DURATION_S = 9;
const DURATION_RANGE_S = 10;
const MAX_DRIFT_PX = 60;

/** Small deterministic PRNG so the layout is stable between renders. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = mulberry32(2027);
const FLAKES = Array.from({ length: FLAKE_COUNT }, () => {
  const duration = MIN_DURATION_S + random() * DURATION_RANGE_S;
  return {
    left: `${random() * 100}%`,
    size: `${MIN_SIZE_PX + random() * SIZE_RANGE_PX}px`,
    duration: `${duration}s`,
    // Negative delay: flakes are already mid-fall on first paint.
    delay: `${-random() * duration}s`,
    drift: `${(random() * 2 - 1) * MAX_DRIFT_PX}px`,
    opacity: 0.5 + random() * 0.5,
  };
});

export function Snowfall() {
  return (
    <div class="snowfall" aria-hidden="true">
      {FLAKES.map((f, i) => (
        <span
          key={i}
          style={{
            left: f.left,
            width: f.size,
            height: f.size,
            opacity: f.opacity,
            animationDuration: f.duration,
            animationDelay: f.delay,
            '--drift': f.drift,
          }}
        />
      ))}
    </div>
  );
}
