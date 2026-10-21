export const FACT_TOPICS = ['gudauri', 'resort', 'georgia', 'food', 'skiing', 'beginner'] as const;
export type FactTopic = (typeof FACT_TOPICS)[number];

export const TOPIC_LABEL: Record<FactTopic, string> = {
  gudauri: 'Gudauri',
  resort: 'The resort',
  georgia: 'Georgia',
  food: 'Georgian food',
  skiing: 'Skiing',
  beginner: 'Beginner tips',
};

export const TOPIC_EMOJI: Record<FactTopic, string> = {
  gudauri: '🏔️',
  resort: '🚡',
  georgia: '🇬🇪',
  food: '🥟',
  skiing: '⛷️',
  beginner: '🎿',
};

/** Fields every fact has. `text` is always a readable sentence, so pop-ups and the assistant can use any fact. */
export interface BaseFact {
  id: string;
  /** Short headline for the pop-up. */
  title: string;
  /** Written in our own words. */
  text: string;
  /** Where we checked it (https). */
  source: string;
}

/** A plain fact: no structured fields beyond the base. */
export interface GeneralFact extends BaseFact {
  topic: FactTopic;
}

/**
 * Discriminated on `topic`. Topic-specific shapes (Georgian words in Phase 8.1)
 * join this union; consumers that only need `title`/`text` keep working unchanged.
 */
export type Fact = GeneralFact;
