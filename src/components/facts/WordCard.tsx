import type { WordFact } from '../../lib/facts/types';
import { speakWithVoice } from '../../lib/speech/synthesis';
import { useVoice } from '../../lib/speech/useVoice';

/** Body of a fact card for a Georgian word: big script, romanization, meaning, tips. */
export function WordCardBody({ fact, headingLevel = 2 }: { fact: WordFact; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 3 ? 'h3' : 'h2';
  // Only offered when the device really has a Georgian voice; never faked with another language.
  const georgianVoice = useVoice('ka');
  return (
    <div class="word-card">
      <p class="word-card__word" lang="ka">
        {fact.word}
      </p>
      <p class="word-card__translit">{fact.transliteration}</p>
      <Heading class="fact-card__title word-card__meaning">{fact.meaning}</Heading>
      {fact.note && <p class="word-card__note">{fact.note}</p>}
      {fact.pronunciation && (
        <p class="word-card__tip">
          <span aria-hidden="true">👄 </span>
          {fact.pronunciation}
        </p>
      )}
      {georgianVoice && (
        <button
          type="button"
          class="button word-card__speak"
          onClick={() => speakWithVoice(fact.word, georgianVoice)}
        >
          🔊 Hear it
        </button>
      )}
    </div>
  );
}
