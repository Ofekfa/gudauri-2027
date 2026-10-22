/**
 * The dish page opened from the list, so going back can return focus to its
 * card. Session memory only: a fresh visit starts at the top.
 */
let lastViewed: string | null = null;

export const rememberDish = (id: string) => {
  lastViewed = id;
};

/** Returns the remembered dish once, then forgets it. */
export const takeLastViewedDish = (): string | null => {
  const id = lastViewed;
  lastViewed = null;
  return id;
};
