import type { WordFact } from '../lib/facts/types';

/**
 * Basic Georgian words, checked against Wiktionary (October 2026). Romanization
 * follows Georgia's national system; an apostrophe marks the "popped" (ejective)
 * consonants k', p', t', ts', ch', q', which are often written without it.
 */
const WIKTIONARY = 'https://en.wiktionary.org/wiki/';
const source = (page: string) => WIKTIONARY + encodeURIComponent(page.replace(/ /g, '_'));

const TIP = {
  kh: '“kh” is the rasping sound in Scottish “loch”.',
  gh: '“gh” is a soft gargle, like a French “r”.',
  ejective: 'The apostrophe means a short, popped sound with no puff of air.',
  q: '“q’” is a “k” made deep in the throat with a little catch.',
} as const;

interface WordInput {
  id: string;
  word: string;
  transliteration: string;
  meaning: string;
  /** Wiktionary page title, if it differs from `word`. */
  page?: string;
  note?: string;
  pronunciation?: string;
}

function word({
  id,
  word,
  transliteration,
  meaning,
  page,
  note,
  pronunciation,
}: WordInput): WordFact {
  const sentence = `“${word}” (${transliteration}) means “${meaning}”.${note ? ` ${note}` : ''}`;
  return {
    id: `word-${id}`,
    topic: 'words',
    title: `“${meaning[0]!.toUpperCase()}${meaning.slice(1)}” in Georgian`,
    text: sentence,
    source: source(page ?? word),
    word,
    transliteration,
    meaning,
    ...(note ? { note } : {}),
    ...(pronunciation ? { pronunciation } : {}),
  };
}

export const WORDS: WordFact[] = [
  // Greetings
  word({
    id: 'hello',
    word: 'გამარჯობა',
    transliteration: 'gamarjoba',
    meaning: 'hello',
    note: 'It comes from the word for victory.',
  }),
  word({
    id: 'hello-reply',
    word: 'გაგიმარჯოს',
    transliteration: 'gagimarjos',
    meaning: 'hello (in reply)',
    note: 'The usual answer to “gamarjoba”.',
  }),
  word({
    id: 'good-morning',
    word: 'დილა მშვიდობისა',
    transliteration: 'dila mshvidobisa',
    meaning: 'good morning',
  }),
  word({
    id: 'goodbye',
    word: 'ნახვამდის',
    transliteration: 'nakhvamdis',
    meaning: 'goodbye',
    pronunciation: TIP.kh,
  }),
  // Thanks and manners
  word({ id: 'thanks', word: 'მადლობა', transliteration: 'madloba', meaning: 'thank you' }),
  word({
    id: 'thanks-a-lot',
    word: 'დიდი მადლობა',
    transliteration: 'didi madloba',
    meaning: 'thank you very much',
  }),
  word({
    id: 'please',
    word: 'თუ შეიძლება',
    transliteration: 'tu sheidzleba',
    meaning: 'please',
    note: 'Literally “if it is possible”; add it to any request.',
  }),
  word({
    id: 'please-formal',
    word: 'გთხოვთ',
    transliteration: 'gtkhovt',
    meaning: 'please (formal)',
    note: 'Literally “I ask you”.',
    pronunciation: TIP.kh,
  }),
  word({ id: 'sorry', word: 'ბოდიში', transliteration: 'bodishi', meaning: 'sorry / excuse me' }),
  // Yes and no
  word({
    id: 'yes',
    word: 'დიახ',
    transliteration: 'diakh',
    meaning: 'yes (polite)',
    pronunciation: TIP.kh,
  }),
  word({
    id: 'yes-casual',
    word: 'კი',
    transliteration: 'k’i',
    meaning: 'yes (casual)',
    pronunciation: TIP.ejective,
  }),
  word({ id: 'no', word: 'არა', transliteration: 'ara', meaning: 'no' }),
  // At the table and in shops
  word({
    id: 'cheers',
    word: 'გაუმარჯოს',
    transliteration: 'gaumarjos',
    meaning: 'cheers!',
    note: 'Literally “to victory”, heard at every supra.',
  }),
  word({
    id: 'how-much',
    word: 'რა ღირს?',
    transliteration: 'ra ghirs?',
    meaning: 'how much is it?',
    page: 'ღირს',
    pronunciation: TIP.gh,
  }),
  word({
    id: 'bill',
    word: 'ანგარიში',
    transliteration: 'angarishi',
    meaning: 'the bill',
    note: 'Literally “account”. Ask with “angarishi, tu sheidzleba”.',
  }),
  word({
    id: 'water',
    word: 'წყალი',
    transliteration: 'ts’q’ali',
    meaning: 'water',
    pronunciation: `${TIP.ejective} ${TIP.q}`,
  }),
  word({
    id: 'wine',
    word: 'ღვინო',
    transliteration: 'ghvino',
    meaning: 'wine',
    pronunciation: TIP.gh,
  }),
  word({
    id: 'bread',
    word: 'პური',
    transliteration: 'p’uri',
    meaning: 'bread',
    pronunciation: TIP.ejective,
  }),
  word({
    id: 'delicious',
    word: 'გემრიელია',
    transliteration: 'gemrielia',
    meaning: 'it’s delicious',
    page: 'გემრიელი',
    note: 'From “gemrieli” (delicious); a great thing to tell your host.',
  }),
  // Emergencies
  word({
    id: 'help',
    word: 'მიშველეთ!',
    transliteration: 'mishvelet!',
    meaning: 'help!',
    page: 'მიშველეთ',
  }),
  // Numbers
  word({ id: 'one', word: 'ერთი', transliteration: 'erti', meaning: 'one' }),
  word({ id: 'two', word: 'ორი', transliteration: 'ori', meaning: 'two' }),
  word({ id: 'three', word: 'სამი', transliteration: 'sami', meaning: 'three' }),
  word({
    id: 'four',
    word: 'ოთხი',
    transliteration: 'otkhi',
    meaning: 'four',
    pronunciation: TIP.kh,
  }),
  word({
    id: 'five',
    word: 'ხუთი',
    transliteration: 'khuti',
    meaning: 'five',
    pronunciation: TIP.kh,
  }),
  // Mountain words
  word({ id: 'snow', word: 'თოვლი', transliteration: 'tovli', meaning: 'snow' }),
  word({ id: 'mountain', word: 'მთა', transliteration: 'mta', meaning: 'mountain' }),
];
