import type { TravelerId } from './trip';

export type HairStyle = 'short' | 'long' | 'bun' | 'wavy';

/** Visual traits for each traveler's avatar. Colors are hand-picked to read well at small sizes. */
export interface CharacterLook {
  skin: string;
  skinShade: string;
  hair: string;
  hairShade: string;
  hairStyle: HairStyle;
  eyes: string;
  /** Signature color for jacket, sticker background and UI accents. */
  jacket: string;
  jacketShade: string;
  lashes: boolean;
  freckles: boolean;
  /** Short description for assistive tech. */
  description: string;
}

const FAIR_SKIN = { skin: '#f7d9c4', skinShade: '#e5b597' };

export const CHARACTERS: Record<TravelerId, CharacterLook> = {
  ofek: {
    ...FAIR_SKIN,
    hair: '#e2c07a',
    hairShade: '#b8924a',
    hairStyle: 'short',
    eyes: '#4f9fe0',
    jacket: '#2f6fde',
    jacketShade: '#1f4fa8',
    lashes: false,
    freckles: false,
    description: 'Fair skin, short light hair and light blue eyes',
  },
  ron: {
    ...FAIR_SKIN,
    hair: '#1e1a1d',
    hairShade: '#000000',
    hairStyle: 'long',
    eyes: '#6b4226',
    jacket: '#b0264f',
    jacketShade: '#7d1838',
    lashes: true,
    freckles: false,
    description: 'Fair skin and long black hair',
  },
  roy: {
    skin: '#d6a07a',
    skinShade: '#b9805a',
    hair: '#221e20',
    hairShade: '#000000',
    hairStyle: 'bun',
    eyes: '#4a2f1d',
    jacket: '#23936a',
    jacketShade: '#16664a',
    lashes: false,
    freckles: false,
    description: 'Slightly darker skin and black hair tied in a bun',
  },
  maya: {
    ...FAIR_SKIN,
    hair: '#d4622b',
    hairShade: '#a8461a',
    hairStyle: 'wavy',
    eyes: '#5b8c3a',
    jacket: '#7b4fd6',
    jacketShade: '#5533a3',
    lashes: true,
    freckles: true,
    description: 'Fair skin with freckles and long wavy ginger hair',
  },
};
