/**
 * The background-music library: every track is openly licensed for streaming
 * on a non-commercial site and played straight from its host, unmodified
 * (required for CC BY-NC-ND). Each item's licence was checked on its page
 * (October 2026). `scripts/analyze-tracks.ts` adds duration and loudness.
 */
export type Era = 'traditional' | 'modern';
export type License =
  | 'PD'
  | 'CC BY 3.0'
  | 'CC BY-SA 4.0'
  | 'FAL 1.3'
  | 'CC BY-NC-ND 2.5'
  | 'CC BY-NC-ND 3.0'
  | 'CC BY-NC-ND 4.0';

export interface TrackSource {
  id: string;
  title: string;
  artist: string;
  era: Era;
  /** Short description for the now-playing panel. */
  style: string;
  /** Direct https MP3 on upload.wikimedia.org or archive.org. */
  src: string;
  license: License;
  licenseUrl: string | null;
  /** The page with the licence and full credits. */
  sourceUrl: string;
  /** Credit line as the licence asks. */
  attribution: string;
}

const COMMONS_PD = null;
const ia = (item: string, file: string) =>
  `https://archive.org/download/${item}/${encodeURIComponent(file)}`;
const iaPage = (item: string) => `https://archive.org/details/${item}`;
const BY_NC_ND_4 = 'https://creativecommons.org/licenses/by-nc-nd/4.0/';
const BY_NC_ND_3 = 'https://creativecommons.org/licenses/by-nc-nd/3.0/';
const BY_NC_ND_3_US = 'https://creativecommons.org/licenses/by-nc-nd/3.0/us/';
const BY_NC_ND_3_PL = 'https://creativecommons.org/licenses/by-nc-nd/3.0/pl/';
const BY_NC_ND_25 = 'https://creativecommons.org/licenses/by-nc-nd/2.5/';
const BY_SA_4 = 'https://creativecommons.org/licenses/by-sa/4.0/';
const BY_3 = 'https://creativecommons.org/licenses/by/3.0/';
const FAL = 'https://artlibre.org/licence/lal/en/';

// Traditional ------------------------------------------------------------

const COMMONS_TRADITIONAL: TrackSource[] = [
  {
    id: 'chakrulo-1957',
    title: 'Chakrulo',
    artist: 'Georgian State Folk Song and Dance Ensemble',
    era: 'traditional',
    style: 'Kakhetian table song · 1957 record',
    src: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/4/47/Chakrulo_%281957%29.ogg/Chakrulo_%281957%29.ogg.mp3',
    license: 'PD',
    licenseUrl: COMMONS_PD,
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Chakrulo_(1957).ogg',
    attribution:
      'Georgian State Folk Song and Dance Ensemble, Aprelevka record 28165 (1957), via Wikimedia Commons',
  },
  {
    id: 'shen-khar-venakhi',
    title: 'Shen khar venakhi (Thou art a vineyard)',
    artist: 'Georgian polyphonic choir',
    era: 'traditional',
    style: 'Medieval polyphonic hymn',
    src: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/5/56/Shen_khar_venakhi1.ogg/Shen_khar_venakhi1.ogg.mp3',
    license: 'PD',
    licenseUrl: COMMONS_PD,
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Shen_khar_venakhi1.ogg',
    attribution: 'Released into the public domain by its owner, via Wikimedia Commons',
  },
  {
    id: 'tavisupleba',
    title: 'Tavisupleba (national anthem)',
    artist: 'Georgian national anthem',
    era: 'traditional',
    style: 'Anthem, vocal',
    src: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/7/7b/Tavisupleba_vocal.ogg/Tavisupleba_vocal.ogg.mp3',
    license: 'PD',
    licenseUrl: COMMONS_PD,
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Tavisupleba_vocal.ogg',
    attribution: 'Public domain, via Wikimedia Commons',
  },
];

const KAVSADZE = 'Kavsadze Choir (Tbilisi)';
const KAVSADZE_TRACKS: TrackSource[] = [
  [
    'mikheil-kavadze-netavi-gogo-1914',
    'MikheilKavadze-Netavi-Gogo-1914.mp3',
    'kavsadze-netavi-gogo',
    'Netavi gogo',
  ],
  [
    'mikheil-kavadze-mraval-zhamier-1914',
    'Mikheil Kavadze-Mraval-Zhamier-1914.mp3',
    'kavsadze-mraval-zhamier',
    'Mraval zhamier',
  ],
].map(([item, file, id, title]) => ({
  id: id!,
  title: title!,
  artist: KAVSADZE,
  era: 'traditional',
  style: 'Polyphonic choir · 1914 record',
  src: ia(item!, file!),
  license: 'CC BY-NC-ND 4.0',
  licenseUrl: BY_NC_ND_4,
  sourceUrl: iaPage(item!),
  attribution: `Choir directed by Mikheil Kavsadze (1914), digitised and shared on the Internet Archive under ${'CC BY-NC-ND 4.0'}`,
}));

const SUPRULI_ITEM = 'Supruli_Live_at_the_Golden_Festival_Atrium_Stage_Jan_14_2012_1253-10961';
const SUPRULI_TRACKS: TrackSource[] = [
  ['01', 'Chaghma_Chaqrilo_Venakho', 'Chaghma chaqrilo venakho'],
  ['02', 'Ortameheluri', 'Ortameheluri'],
  ['03', 'Chongurs_Simebi_Gavubi', 'Chongurs simebi gavubi'],
  ['04', 'Dideba_Maghalta_Shina', 'Dideba maghalta shina'],
  ['05', 'Telauri_Chakrulo', 'Telauri chakrulo'],
].map(([n, slug, title]) => ({
  id: `supruli-${slug!.toLowerCase().replace(/_/g, '-')}`,
  title: title!,
  artist: 'Supruli (NYC Georgian choir)',
  era: 'traditional',
  style: 'Polyphonic choir · live, 2012',
  src: ia(SUPRULI_ITEM, `Supruli_-_the_NYC_Georgian_Choir_-_${n}_-_${slug}.mp3`),
  license: 'CC BY-NC-ND 3.0',
  licenseUrl: BY_NC_ND_3_US,
  sourceUrl: iaPage(SUPRULI_ITEM),
  attribution:
    'Supruli – the NYC Georgian Choir, Live at the Golden Festival (2012), CC BY-NC-ND 3.0 US',
}));

/** Published by the Cross Monastery in Sameba (Tsalka) with its Hymnographical Collection volumes. */
const chant =
  (item: string, artist: string, volume: string) => (file: string, title: string, n: string) => ({
    id: `chant-${volume.toLowerCase()}-${n}`,
    title,
    artist,
    era: 'traditional' as const,
    style: `Georgian Orthodox chant · Hymnographical Collection ${volume}`,
    src: ia(item, file),
    license: 'CC BY-NC-ND 4.0' as const,
    licenseUrl: BY_NC_ND_4,
    sourceUrl: iaPage(item),
    attribution: `${artist}, Hymnographical Collection ${volume} (Sameba Cross Monastery, Tsalka), CC BY-NC-ND 4.0`,
  });
const chantIV = chant('18._20250715', 'Choir of Malkhaz Erkvanidze', 'IV');
const chantII = chant('01._20240901', 'Anchiskhati Church Choir', 'II');
const CHANT_TRACKS: TrackSource[] = [
  chantIV('01. უფალო-ღაღადყავსა, ხმა ა გუერდი.mp3', 'Lord, I have cried (first plagal tone)', '01'),
  chantIV(
    '02. უფალო-ღაღადყავსა (ჭრელი), ხმა ა გუერდი.mp3',
    'Lord, I have cried, ornamented (first plagal tone)',
    '02',
  ),
  chantIV('04. სუფევს ღმერთი, ხმა ა გუერდი.mp3', 'God reigns (first plagal tone)', '04'),
  chantIV(
    '05. მოვედით და აღვიდეთ მთასა, ხმა ა გუერდი.mp3',
    'Come, let us go up the mountain',
    '05',
  ),
  chantIV('06. საშინელი და უფროსად დიდებული, ხმა ა გუერდი.mp3', 'Awesome and most glorious', '06'),
  chantIV('08. გიხაროდენ, რომელნი ჰმსთავრობთ, ხმა ა გუერდი.mp3', 'Rejoice, you who lead', '08'),
  chantIV(
    '09. უფალო-ღაღადყავსა, ხმა ბ გუერდი.mp3',
    'Lord, I have cried (second plagal tone)',
    '09',
  ),
  chantIV(
    '10. უფალო-ღაღადყავსა (ჭრელი), ხმა ბ გუერდი.mp3',
    'Lord, I have cried, ornamented (second plagal tone)',
    '10',
  ),
  chantIV('15. მძლე-ექმენ შენ, ქრისტე, ხმა ბ გუერდი.mp3', 'You conquered, O Christ', '15'),
  chantIV('18. დასაბამად ქმნნა ღმერთმან, ხმა ბ გუერდი.mp3', 'In the beginning God created', '18'),
  chantII(
    '02 ჭრელი უფალო-ღაღადყავსა, ხმა ა.mp3',
    'Lord, I have cried, ornamented (first tone)',
    '02',
  ),
  chantII('05 ძლ. ეჰა, დიდებული, ხმა ა.mp3', 'O glorious one (first tone)', '05'),
  chantII(
    '07 ჭრელი უფალო-ღაღაყავსა, ხმა ბ.mp3',
    'Lord, I have cried, ornamented (second tone)',
    '07',
  ),
  chantII('11 ძლ. მამისაგან შობილმან, ხმა ბ.mp3', 'Begotten of the Father (second tone)', '11'),
  chantII('12 ძლ. რომელმანცა სიბრძნით, ხმა ბ.mp3', 'You who in wisdom (second tone)', '12'),
  chantII('16 ძლ. სასოწარკუეთილმან, ხმა ბ.mp3', 'In despair (second tone)', '16'),
];

// Modern -----------------------------------------------------------------

const GLONTI_ITEM = 'StreetRisenWire';
const GLONTI_TRACKS: TrackSource[] = [
  ['01', 'Street Risen Wire'],
  ['02', 'Fellow Named Derek'],
  ['03', 'ca 23'],
  ['04', 'Spy @'],
  ['05', 'Music for Friend'],
].map(([n, title]) => ({
  id: `glonti-${n}`,
  title: title!,
  artist: 'Rezo Glonti',
  era: 'modern',
  style: 'Experimental electronica · Batumi',
  src: ia(GLONTI_ITEM, `atdl067_rezo_glonti_${n}.mp3`),
  license: 'CC BY-NC-ND 3.0',
  licenseUrl: BY_NC_ND_3_PL,
  sourceUrl: iaPage(GLONTI_ITEM),
  attribution: 'Rezo Glonti, Street Risen Wire (Audiotong netlabel), CC BY-NC-ND 3.0 PL',
}));

const JAPARIDZE_TRACKS: TrackSource[] = [
  ['01', 'traginew', 'Traginew'],
  ['02', 'cut', 'Cut'],
  ['03', 'fireworks', 'Fireworks'],
  ['04', 'lexington', 'Lexington'],
].map(([n, slug, title]) => ({
  id: `japaridze-${slug}`,
  title: title!,
  artist: 'Nika Japaridze',
  era: 'modern',
  style: 'Minimal techno',
  src: ia('rest026', `rest026-${n}-nika_japaridze_-_${slug}.mp3`),
  license: 'CC BY-NC-ND 2.5',
  licenseUrl: BY_NC_ND_25,
  sourceUrl: iaPage('rest026'),
  attribution: 'Nika Japaridze, Traginew EP (Rest netlabel), CC BY-NC-ND 2.5',
}));

const SHVANGIRADZE_ITEM = 'Vkrsnl038MirandaShvangiradzeTalkToMeEp';
const SHVANGIRADZE_TRACKS: TrackSource[] = [
  ['1RainyThoughts.mp3', 'Rainy Thoughts'],
  ['2TalkToMe.mp3', 'Talk to Me'],
  ['3ReadyForTheTrip.mp3', 'Ready for the Trip'],
  ['4Daisi.mp3', 'Daisi'],
].map(([file, title]) => ({
  id: `shvangiradze-${title!.toLowerCase().replace(/ /g, '-')}`,
  title: title!,
  artist: 'Miranda Shvangiradze',
  era: 'modern',
  style: 'Piano and electronica',
  src: ia(SHVANGIRADZE_ITEM, file!),
  license: 'CC BY-NC-ND 3.0',
  licenseUrl: BY_NC_ND_3,
  sourceUrl: iaPage(SHVANGIRADZE_ITEM),
  attribution: 'Miranda Shvangiradze, Talk to Me EP (VKRS netlabel), CC BY-NC-ND 3.0',
}));

const COMMONS_MODERN: TrackSource[] = [
  {
    id: 'khitarishvili-strudel',
    title: 'Theme from “Strudel”',
    artist: 'Mindia Khitarishvili',
    era: 'modern',
    style: 'Theatre music',
    src: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/0/04/%D0%9C%D0%B8%D0%BD%D0%B4%D0%B8%D1%8F_%D0%A5%D0%B8%D1%82%D0%B0%D1%80%D0%B8%D1%88%D0%B2%D0%B8%D0%BB%D0%B8_%D0%A2%D0%B5%D0%BC%D0%B0_%D0%B8%D0%B7_%D1%81%D0%BF%D0%B5%D0%BA%D1%82%D0%B0%D0%BA%D0%BB%D1%8F_%D1%88%D1%82%D1%80%D1%83%D0%B4%D0%B5%D0%BB%D1%8C.wav/%D0%9C%D0%B8%D0%BD%D0%B4%D0%B8%D1%8F_%D0%A5%D0%B8%D1%82%D0%B0%D1%80%D0%B8%D1%88%D0%B2%D0%B8%D0%BB%D0%B8_%D0%A2%D0%B5%D0%BC%D0%B0_%D0%B8%D0%B7_%D1%81%D0%BF%D0%B5%D0%BA%D1%82%D0%B0%D0%BA%D0%BB%D1%8F_%D1%88%D1%82%D1%80%D1%83%D0%B4%D0%B5%D0%BB%D1%8C.wav.mp3',
    license: 'CC BY-SA 4.0',
    licenseUrl: BY_SA_4,
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:%D0%9C%D0%B8%D0%BD%D0%B4%D0%B8%D1%8F_%D0%A5%D0%B8%D1%82%D0%B0%D1%80%D0%B8%D1%88%D0%B2%D0%B8%D0%BB%D0%B8_%D0%A2%D0%B5%D0%BC%D0%B0_%D0%B8%D0%B7_%D1%81%D0%BF%D0%B5%D0%BA%D1%82%D0%B0%D0%BA%D0%BB%D1%8F_%D1%88%D1%82%D1%80%D1%83%D0%B4%D0%B5%D0%BB%D1%8C.wav',
    attribution: 'Mindia Khitarishvili (Mindia72), CC BY-SA 4.0, via Wikimedia Commons',
  },
  {
    id: 'sergotel-duduk',
    title: 'April (duduk improvisation)',
    artist: 'SERGO.TEL',
    era: 'modern',
    style: 'Duduk improvisation',
    src: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/c/cc/SERGO.TEL_-_April_-_duduk-improvisation2.ogg/SERGO.TEL_-_April_-_duduk-improvisation2.ogg.mp3',
    license: 'CC BY 3.0',
    licenseUrl: BY_3,
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:SERGO.TEL_-_April_-_duduk-improvisation2.ogg',
    attribution: 'SERGO.TEL, CC BY 3.0, via Wikimedia Commons',
  },
];

const commons = (path: string) =>
  `https://upload.wikimedia.org/wikipedia/commons/transcoded/${path}`;
const LATSABIDZE = 'Giorgi Latsabidze (piano)';
const LATSABIDZE_TRACKS: TrackSource[] = [
  {
    id: 'latsabidze-debussy-brouillards',
    title: 'Debussy: Brouillards (Préludes, Book 2)',
    file: 'a/ab/Debussy-_Preludes%2C_Book_2-_I._Brouillards.oga',
    page: 'Debussy-_Preludes,_Book_2-_I._Brouillards.oga',
    license: 'FAL 1.3',
  },
  {
    id: 'latsabidze-debussy-feuilles-mortes',
    title: 'Debussy: Feuilles mortes (Préludes, Book 2)',
    file: 'b/b4/Debussy-_Preludes%2C_Book_2-_II._Feuilles_Mortes.oga',
    page: 'Debussy-_Preludes,_Book_2-_II._Feuilles_Mortes.oga',
    license: 'FAL 1.3',
  },
  {
    id: 'latsabidze-debussy-ondine',
    title: 'Debussy: Ondine (Préludes, Book 2)',
    file: '3/39/Debussy-_Pr%C3%A9ludes%2C_Book_2-_VIII._Ondine.oga',
    page: 'Debussy-_Pr%C3%A9ludes,_Book_2-_VIII._Ondine.oga',
    license: 'FAL 1.3',
  },
  {
    id: 'latsabidze-schumann-kreisleriana',
    title: 'Schumann: Kreisleriana, Op. 16 No. 1',
    file: '1/1a/Robert_Schumann_Kreisleriana_Op._16_N1_Giorgi_Latsabidze.ogg',
    page: 'Robert_Schumann_Kreisleriana_Op._16_N1_Giorgi_Latsabidze.ogg',
    license: 'PD',
  },
  {
    id: 'latsabidze-chopin-prelude-15',
    title: 'Chopin: Prelude in D-flat major, Op. 28 No. 15',
    file: 'd/d8/Chopin_Prelude_Op_28_N_15_Giorgi_Latsabidze_performs.ogg',
    page: 'Chopin_Prelude_Op_28_N_15_Giorgi_Latsabidze_performs.ogg',
    license: 'PD',
  },
  {
    id: 'latsabidze-debussy-rameau',
    title: 'Debussy: Hommage à Rameau (Images I)',
    file: '7/74/Hommage_%C3%A0_Rameau_%28Tribute_to_Rameau%29%2C_Images_I.ogg',
    page: 'Hommage_%C3%A0_Rameau_(Tribute_to_Rameau),_Images_I.ogg',
    license: 'CC BY-SA 4.0',
  },
  {
    id: 'latsabidze-ravel-ondine',
    title: 'Ravel: Ondine (Gaspard de la nuit)',
    file: '2/21/Ravel_Ondine_Audio_Latso.ogg',
    page: 'Ravel_Ondine_Audio_Latso.ogg',
    license: 'CC BY-SA 4.0',
  },
  {
    id: 'latsos-duo-brahms',
    title: 'Brahms: Hungarian Dance No. 7 (piano four hands)',
    file: '3/3d/The_Latsos_Piano_Duo_performs_Brahms_Hungarian_Dance_in_A_major_%28version_for_piano_four_hands%29.ogg',
    page: 'The_Latsos_Piano_Duo_performs_Brahms_Hungarian_Dance_in_A_major_(version_for_piano_four_hands).ogg',
    license: 'CC BY-SA 4.0',
    artist: 'The Latsos Piano Duo',
  },
].map(({ id, title, file, page, license, artist }) => {
  const name = file.split('/').pop()!;
  const licenseUrl = license === 'PD' ? null : license === 'FAL 1.3' ? FAL : BY_SA_4;
  return {
    id,
    title,
    artist: artist ?? LATSABIDZE,
    era: 'modern' as const,
    style: 'Classical piano by a Georgian pianist',
    src: commons(`${file}/${name}.mp3`),
    license: license as License,
    licenseUrl,
    sourceUrl: `https://commons.wikimedia.org/wiki/File:${page}`,
    attribution: `${artist ?? 'Giorgi Latsabidze'}, ${license === 'PD' ? 'public domain' : license}, via Wikimedia Commons`,
  };
});

export const TRACK_SOURCES: TrackSource[] = [
  ...COMMONS_TRADITIONAL,
  ...KAVSADZE_TRACKS,
  ...SUPRULI_TRACKS,
  ...CHANT_TRACKS,
  ...GLONTI_TRACKS,
  ...JAPARIDZE_TRACKS,
  ...SHVANGIRADZE_TRACKS,
  ...COMMONS_MODERN,
  ...LATSABIDZE_TRACKS,
];
