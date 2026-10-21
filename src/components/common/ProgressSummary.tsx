const PERCENT = 100;

interface ProgressSummaryProps {
  /** Heading id, so the section can be labelled by it. */
  id: string;
  title: string;
  done: number;
  total: number;
  /** Word after the count, e.g. "packed" → "3/10 packed". */
  doneLabel: string;
  /** Optional highlighted badge, e.g. "2 to buy". */
  badge?: string;
  /** Full sentence for screen readers, e.g. "Maya: 3 of 10 items packed". */
  ariaLabel: string;
}

export function ProgressSummary({
  id,
  title,
  done,
  total,
  doneLabel,
  badge,
  ariaLabel,
}: ProgressSummaryProps) {
  const percent = total ? Math.round((done / total) * PERCENT) : 0;
  return (
    <section class="pack-summary" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      <p class="pack-summary__numbers">
        <strong>
          {done}/{total}
        </strong>{' '}
        {doneLabel}
        {badge && <span class="pack-summary__buy">{badge}</span>}
      </p>
      <progress class="pack-progress" max={PERCENT} value={percent} aria-label={ariaLabel} />
    </section>
  );
}
