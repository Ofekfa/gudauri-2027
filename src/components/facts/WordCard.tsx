import type { WordFact } from '../../lib/facts/types';
import { speakWithVoice } from '../../lib/speech/synthesis';
import { useVoice } from '../../lib/speech/useVoice';

/** Body of a fact card for a Georgian word: big script, romanization, meaning, tips. */
export function WordCardBody({ fact }: { fact: WordFact }) {
  // Only offered when the device really has a Georgian voice; never faked with another language.
  const georgianVoice = useVoice('ka');
  return (
    <div class="word-card">
      <p class="word-card__word" lang="ka">
        {fact.word}
      </p>
      <p class="word-card__translit">{fact.transliteration}</p>
      <h2 class="fact-card__title word-card__meaning">{fact.meaning}</h2>
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
