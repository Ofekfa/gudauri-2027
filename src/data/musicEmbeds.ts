/**
 * Official YouTube playlists/videos of modern Georgian music, shown on the
 * Music page as tap-to-load embeds (never as background audio). Each was
 * checked via YouTube oEmbed to be embeddable and uploaded by the artist's
 * official channel or label.
 */
export interface MusicEmbed {
  kind: 'playlist' | 'video';
  id: string;
  artist: string;
  genre: string;
  title: string;
  channel: string;
  checkedOn: string;
}

const CHECKED = '2026-10-22';

export const MUSIC_EMBEDS: MusicEmbed[] = [
  {
    kind: 'playlist',
    id: 'PLQRd6wfe8colHM73ioltqA-risc_V6XF1',
    artist: 'Mgzavrebi',
    genre: 'Indie folk-pop',
    title: 'Official music videos',
    channel: 'MGZAVREBI',
    checkedOn: CHECKED,
  },
  {
    kind: 'playlist',
    id: 'PL1afY_zBaujH204s5KKyRfWyvoRLV1Lyp',
    artist: 'Trio Mandili',
    genre: 'Folk-pop',
    title: 'The best',
    channel: 'Trio Mandili',
    checkedOn: CHECKED,
  },
  {
    kind: 'playlist',
    id: 'PLB13C99909FAA3EE9',
    artist: 'Nino Katamadze & Insight',
    genre: 'Ethno-jazz and soul',
    title: 'Live at Tbilisi Opera Theatre',
    channel: 'Nino Katamadze',
    checkedOn: CHECKED,
  },
  {
    kind: 'playlist',
    id: 'PLF07306C92C9A82C6',
    artist: 'The Shin',
    genre: 'Jazz-rock fusion',
    title: 'Core',
    channel: 'The SHIN',
    checkedOn: CHECKED,
  },
  {
    kind: 'video',
    id: 'TuCZMdfBqm4',
    artist: 'Ethno-Jazz Band Iriao',
    genre: 'Ethno-jazz with polyphony',
    title: 'For You (Eurovision 2018)',
    channel: 'Eurovision Song Contest',
    checkedOn: CHECKED,
  },
  {
    kind: 'video',
    id: 'bZ-lgjRaEz4',
    artist: 'Gacha Bakradze',
    genre: 'Electronic',
    title: 'Restless',
    channel: 'Anjunadeep',
    checkedOn: CHECKED,
  },
];
