export const FACT_TOPICS = [
  'gudauri',
  'resort',
  'georgia',
  'food',
  'skiing',
  'beginner',
  'words',
] as const;
export type FactTopic = (typeof FACT_TOPICS)[number];

export const TOPIC_LABEL: Record<FactTopic, string> = {
  gudauri: 'Gudauri',
  resort: 'The resort',
  georgia: 'Georgia',
  food: 'Georgian food',
  skiing: 'Skiing',
  beginner: 'Beginner tips',
  words: 'Georgian words',
};

export const TOPIC_EMOJI: Record<FactTopic, string> = {
  gudauri: '🏔️',
  resort: '🚡',
  georgia: '🇬🇪',
  food: '🥟',
  skiing: '⛷️',
  beginner: '🎿',
  words: '🗣️',
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
  topic: Exclude<FactTopic, 'words'>;
}

/** A Georgian word or phrase. `text` still holds a readable sentence for pop-ups and the assistant. */
export interface WordFact extends BaseFact {
  topic: 'words';
  /** Georgian (Mkhedruli) script. */
  word: string;
  /** National (2002) romanization, as on signs in Georgia. */
  transliteration: string;
  meaning: string;
  /** Extra context, e.g. a literal meaning or how to use it. */
  note?: string;
  /** Tip for English speakers on the tricky sounds. */
  pronunciation?: string;
}

/**
 * Discriminated on `topic`. Consumers that only need `title`/`text` work with any fact;
 * word-specific UI narrows with `isWordFact`.
 */
export type Fact = GeneralFact | WordFact;

export const isWordFact = (fact: Fact): fact is WordFact => fact.topic === 'words';
