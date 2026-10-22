/**
 * Weather zones on the mountain. Elevations were checked with the Open-Meteo
 * Elevation API against OpenStreetMap lift stations (October 2026).
 */
export type ZoneId = 'base' | 'mid' | 'top';

export interface Webcam {
  provider: 'youtube';
  /** YouTube video/stream id. Live streams get new ids after restarts, so re-check now and then. */
  id: string;
  label: string;
  /** Last time we confirmed it exists and allows embedding. */
  checkedOn: string;
}

export interface Zone {
  id: ZoneId;
  name: string;
  /** Where this is, in skier terms. */
  place: string;
  lat: number;
  lon: number;
  elevationM: number;
  webcam?: Webcam;
  /** Shown when there is no webcam for the zone. */
  webcamNote?: string;
}

export const ZONES: Zone[] = [
  {
    id: 'base',
    name: 'Village',
    place: 'Marco Polo Hotel and the Pirveli lift',
    lat: 42.4613,
    lon: 44.4842,
    elevationM: 2000,
    webcamNote:
      'There’s no public webcam at the hotel. The nearest live cam is Soliko, on the slopes above.',
  },
  {
    id: 'mid',
    name: 'Mid-mountain',
    place: 'Top of the Goodaura gondola (Shino and Soliko lifts arrive here)',
    lat: 42.4924,
    lon: 44.4943,
    elevationM: 2700,
    webcam: {
      provider: 'youtube',
      id: 'vBVWcSjPAZM',
      label: 'Soliko (Vitamin Cafe)',
      checkedOn: '2026-10-22',
    },
  },
  {
    id: 'top',
    name: 'Top',
    place: 'Top of the Kudebi chairlift',
    lat: 42.497,
    lon: 44.5075,
    elevationM: 2950,
    webcam: {
      provider: 'youtube',
      id: 'aCHJ-r15RLM',
      label: 'Kudebi (Vitamin Cafe)',
      checkedOn: '2026-10-22',
    },
  },
];
