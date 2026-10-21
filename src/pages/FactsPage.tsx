import { useEffect, useMemo, useState } from 'preact/hooks';
import { PageHeader } from '../components/PageHeader';
import { FACTS } from '../data/facts';
import { createShuffleBag } from '../lib/facts/rotation';
import { factSettings } from '../lib/facts/settings';
import { FACT_TOPICS, TOPIC_EMOJI, TOPIC_LABEL, type FactTopic } from '../lib/facts/types';
import { toasts } from '../lib/toast/toastStore';

type TopicFilter = FactTopic | 'all';

const sourceHost = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

export default function FactsPage() {
  const [topic, setTopic] = useState<TopicFilter>('all');
  const [muted, setMuted] = useState(factSettings.isMuted());
  const bag = useMemo(() => createShuffleBag(FACTS), []);
  useEffect(() => factSettings.subscribe(setMuted), []);

  const visible = topic === 'all' ? FACTS : FACTS.filter((f) => f.topic === topic);
  const countFor = (t: FactTopic) => FACTS.filter((f) => f.topic === t).length;

  const surprise = () => {
    const fact = bag.next();
    toasts.show({
      emoji: TOPIC_EMOJI[fact.topic],
      title: fact.title,
      message: fact.text,
      durationMs: 10_000,
    });
  };

  return (
    <>
      <PageHeader
        title="Fun facts"
        subtitle={`${FACTS.length} things worth knowing about Gudauri, Georgia, its food and skiing.`}
      />

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

      <div class="facts-toolbar">
        <div class="filters__group" role="group" aria-label="Filter by topic">
          <button
            type="button"
            class="chip-button"
            aria-pressed={topic === 'all'}
            onClick={() => setTopic('all')}
          >
            All ({FACTS.length})
          </button>
          {FACT_TOPICS.map((t) => (
            <button
              key={t}
              type="button"
              class="chip-button"
              aria-pressed={topic === t}
              onClick={() => setTopic(t)}
            >
              <span aria-hidden="true">{TOPIC_EMOJI[t]}</span> {TOPIC_LABEL[t]} ({countFor(t)})
            </button>
          ))}
        </div>
        <button type="button" class="button" onClick={surprise}>
          🎲 Surprise me
        </button>
      </div>

      <ul class="fact-list">
        {visible.map((fact) => (
          <li key={fact.id} class="card fact-card">
            <p class="fact-card__topic">
              <span aria-hidden="true">{TOPIC_EMOJI[fact.topic]}</span> {TOPIC_LABEL[fact.topic]}
            </p>
            <h2 class="fact-card__title">{fact.title}</h2>
            <p class="fact-card__text">{fact.text}</p>
            <a
              class="fact-card__source"
              href={fact.source}
              target="_blank"
              rel="noopener noreferrer"
            >
              Source: {sourceHost(fact.source)}
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}
