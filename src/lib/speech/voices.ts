/** Finding a text-to-speech voice for a language, without ever faking one. */

export interface VoiceLike {
  lang: string;
  name: string;
  localService?: boolean;
}

/** First voice whose BCP-47 tag starts with `langPrefix` (e.g. "ka"); local voices first. */
export function findVoice<V extends VoiceLike>(voices: readonly V[], langPrefix: string): V | null {
  const prefix = langPrefix.toLowerCase();
  const matches = voices.filter((v) => {
    const lang = v.lang.toLowerCase().replace('_', '-');
    return lang === prefix || lang.startsWith(`${prefix}-`);
  });
  return matches.find((v) => v.localService) ?? matches[0] ?? null;
}
