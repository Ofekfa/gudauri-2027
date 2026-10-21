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

export interface Fact {
  id: string;
  topic: FactTopic;
  /** Short headline for the pop-up. */
  title: string;
  /** Written in our own words. */
  text: string;
  /** Where we checked it. */
  source: string;
}
