import type { Era, Track } from '../../data/tracks';
import { TRACKS } from '../../data/tracks';

const ERA_LABEL: Record<Era, string> = { traditional: 'Traditional', modern: 'Modern' };
const EXTERNAL = { target: '_blank', rel: 'noopener noreferrer' } as const;
const SECONDS_PER_MINUTE = 60;

const minutes = (s: number) =>
  `${Math.floor(s / SECONDS_PER_MINUTE)}:${String(Math.round(s % SECONDS_PER_MINUTE)).padStart(2, '0')}`;

function TrackLine({ track }: { track: Track }) {
  return (
    <li>
      <span class="track-credits__title">{track.title}</span> · {track.artist}{' '}
      <span class="track-credits__meta">
        ({track.style}, {minutes(track.durationS)}) —{' '}
        {track.licenseUrl ? (
          <a href={track.licenseUrl} {...EXTERNAL}>
            {track.license}
          </a>
        ) : (
          'public domain'
        )}
        ,{' '}
        <a href={track.sourceUrl} {...EXTERNAL}>
          source
        </a>
      </span>
    </li>
  );
}

/** Every background track with the credit its licence asks for, grouped by era. */
export function TrackCredits({ headingLevel = 3 }: { headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <>
      {(['traditional', 'modern'] as const).map((era) => {
        const tracks = TRACKS.filter((t) => t.era === era);
        return (
          <section key={era} aria-labelledby={`tracks-${era}`}>
            <Heading id={`tracks-${era}`} class="track-credits__heading">
              {ERA_LABEL[era]} ({tracks.length})
            </Heading>
            <ul class="credits-list track-credits">
              {tracks.map((t) => (
                <TrackLine key={t.id} track={t} />
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}
