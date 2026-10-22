import { EmbedCard } from '../components/music/EmbedCard';
import { TrackCredits } from '../components/music/TrackCredits';
import { PageHeader } from '../components/PageHeader';
import { MUSIC_EMBEDS } from '../data/musicEmbeds';
import { TRACKS } from '../data/tracks';

const SECONDS_PER_HOUR = 3600;
const totalHours = (TRACKS.reduce((s, t) => s + t.durationS, 0) / SECONDS_PER_HOUR).toFixed(1);

export default function MusicPage() {
  return (
    <>
      <PageHeader
        title="Georgian music"
        subtitle="Our background soundtrack, and where to hear more modern Georgian music."
      />

      <section aria-labelledby="music-modern">
        <h2 id="music-modern" class="section-title">
          Modern Georgian music
        </h2>
        <p class="credits-intro">
          Hardly any modern Georgian pop, rock or jazz is openly licensed, so it can’t be part of
          our background music. These are the artists’ own official YouTube playlists: tap one to
          play it here (the background music pauses while a player is open).
        </p>
        {MUSIC_EMBEDS.length ? (
          <div class="embed-grid">
            {MUSIC_EMBEDS.map((e) => (
              <EmbedCard key={e.id} embed={e} />
            ))}
          </div>
        ) : (
          <p class="empty-note">Coming soon.</p>
        )}
      </section>

      <section aria-labelledby="music-library">
        <h2 id="music-library" class="section-title">
          Background music
        </h2>
        <p class="credits-intro">
          {TRACKS.length} tracks, about {totalHours} hours, shuffled so nothing repeats until you’ve
          heard them all. Use the ♪ control at the top of every page to pause, skip or change the
          volume. Every track is openly licensed for a non-commercial site like ours and plays
          unmodified from Wikimedia Commons or the Internet Archive.
        </p>
        <TrackCredits />
      </section>
    </>
  );
}
