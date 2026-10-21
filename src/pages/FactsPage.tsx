import { useEffect, useRef, useState } from 'preact/hooks';
import { PageHeader } from '../components/PageHeader';
import { FACTS } from '../data/facts';
import { detectSwipe, keyToDirection, wrapIndex, type SwipeDirection } from '../lib/facts/carousel';
import { factSettings } from '../lib/facts/settings';
import {
  FACT_TOPICS,
  isWordFact,
  TOPIC_EMOJI,
  TOPIC_LABEL,
  type FactTopic,
} from '../lib/facts/types';
import { WordCardBody } from '../components/facts/WordCard';

type TopicFilter = FactTopic | 'all';

const sourceHost = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

/** Arrow keys shouldn't hijack typing or native controls that use them. */
const isTypingTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

export default function FactsPage() {
  const [topic, setTopic] = useState<TopicFilter>('all');
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<SwipeDirection>('next');
  const [muted, setMuted] = useState(factSettings.isMuted());
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => factSettings.subscribe(setMuted), []);

  const facts = topic === 'all' ? FACTS : FACTS.filter((f) => f.topic === topic);
  const current = wrapIndex(index, facts.length);
  const fact = facts[current]!;
  const countFor = (t: FactTopic) => FACTS.filter((f) => f.topic === t).length;

  const go = (dir: SwipeDirection) => {
    setDirection(dir);
    setIndex((i) => wrapIndex(i + (dir === 'next' ? 1 : -1), facts.length));
  };

  const goRandom = () => {
    if (facts.length < 2) return;
    // Any index except the current one.
    const offset = 1 + Math.floor(Math.random() * (facts.length - 1));
    setDirection('next');
    setIndex((i) => wrapIndex(i + offset, facts.length));
  };

  // Latest `go` for the document-level key listener.
  const goRef = useRef(go);
  goRef.current = go;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || isTypingTarget(event.target)) return;
      const dir = keyToDirection(event.key);
      if (!dir) return;
      event.preventDefault();
      goRef.current(dir);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const selectTopic = (t: TopicFilter) => {
    setTopic(t);
    setIndex(0);
  };

  return (
    <>
      <PageHeader
        title="Fun facts"
        subtitle={`${FACTS.length} things worth knowing about Gudauri, Georgia, its food, skiing and a few Georgian words.`}
      />

      <div class="facts-toolbar">
        <div class="filters__group" role="group" aria-label="Filter by topic">
          <button
            type="button"
            class="chip-button"
            aria-pressed={topic === 'all'}
            onClick={() => selectTopic('all')}
          >
            All ({FACTS.length})
          </button>
          {FACT_TOPICS.map((t) => (
            <button
              key={t}
              type="button"
              class="chip-button"
              aria-pressed={topic === t}
              onClick={() => selectTopic(t)}
            >
              <span aria-hidden="true">{TOPIC_EMOJI[t]}</span> {TOPIC_LABEL[t]} ({countFor(t)})
            </button>
          ))}
        </div>
      </div>

      <section class="fact-viewer" aria-roledescription="carousel" aria-label="Fun facts">
        <div
          class="fact-viewer__stage"
          onPointerDown={(e) => {
            pointerStart.current = { x: e.clientX, y: e.clientY };
          }}
          onPointerUp={(e) => {
            const start = pointerStart.current;
            pointerStart.current = null;
            if (!start) return;
            const dir = detectSwipe(e.clientX - start.x, e.clientY - start.y);
            if (dir) go(dir);
          }}
          onPointerCancel={() => {
            pointerStart.current = null;
          }}
        >
          <article
            key={`${topic}-${fact.id}`}
            class={`card fact-card fact-card--${direction}`}
            aria-roledescription="slide"
            aria-label={`Fact ${current + 1} of ${facts.length}`}
            aria-live="polite"
          >
            <p class="fact-card__topic">
              <span aria-hidden="true">{TOPIC_EMOJI[fact.topic]}</span> {TOPIC_LABEL[fact.topic]}
            </p>
            {isWordFact(fact) ? (
              <WordCardBody fact={fact} />
            ) : (
              <>
                <h2 class="fact-card__title">{fact.title}</h2>
                <p class="fact-card__text">{fact.text}</p>
              </>
            )}
            <a
              class="fact-card__source"
              href={fact.source}
              target="_blank"
              rel="noopener noreferrer"
            >
              Source: {sourceHost(fact.source)}
            </a>
          </article>
        </div>

        <div class="fact-viewer__nav">
          <button
            type="button"
            class="button"
            onClick={() => go('previous')}
            aria-label="Previous fact"
          >
            ← <span class="fact-viewer__nav-label">Previous</span>
          </button>
          <span class="fact-viewer__count">
            {current + 1} / {facts.length}
          </span>
          <button
            type="button"
            class="button button--primary"
            onClick={() => go('next')}
            aria-label="Next fact"
          >
            <span class="fact-viewer__nav-label">Next</span> →
          </button>
        </div>
        <p class="fact-viewer__hint">
          Swipe the card or use the ← → keys.{' '}
          <button type="button" class="link-button" onClick={goRandom}>
            🎲 Surprise me
          </button>
        </p>
      </section>

      <section class="card facts-settings" aria-label="Pop-up settings">
        <div>
          <p class="facts-settings__title" id="facts-popups-label">
            Fun-fact pop-ups
          </p>
          <p class="facts-settings__hint">
            {muted
              ? 'Muted. Facts stay here on this page.'
              : 'A small fact pops up now and then (at most about once a minute).'}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          class="switch"
          aria-checked={!muted}
          aria-labelledby="facts-popups-label"
          onClick={() => factSettings.setMuted(!muted)}
        >
          <span class="switch__thumb" aria-hidden="true" />
          <span class="switch__text" aria-hidden="true">
            {muted ? 'Off' : 'On'}
          </span>
        </button>
      </section>
    </>
  );
}
