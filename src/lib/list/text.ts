/** Collapses whitespace, trims and caps the length of user-entered text. */
export function normalizeText(text: string, maxLength: number): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}
