/**
 * Which Wikimedia Commons file illustrates each dish. Pinned by name and
 * checked by eye: Commons categories contain mislabeled photos. Dishes not
 * listed (e.g. penovani) use the illustrated placeholder.
 */
export interface DishImageSource {
  id: string;
  /** Commons file name without "File:". */
  file: string;
  /** Describes the photo for screen readers. Never says "in Georgia" unless it was taken there. */
  alt: string;
}

export const DISH_IMAGE_SOURCES: DishImageSource[] = [
  {
    id: 'pkhali',
    file: 'Pkhali 3.jpg',
    alt: 'A plate of green spinach pkhali',
  },
  {
    id: 'badrijani-nigvzit',
    file: 'Eggplant rolls.jpg',
    alt: 'Fried aubergine slices rolled around walnut paste',
  },
  {
    id: 'jonjoli',
    file: 'Jonjoli bladdernut flower pickles.jpg',
    alt: 'A dish of pickled bladdernut flower stems',
  },
  { id: 'ajapsandali', file: 'Ajapsandali.jpg', alt: 'A bowl of ajapsandali vegetable stew' },
  { id: 'satsivi', file: 'Satsivi (2).jpg', alt: 'Poultry pieces in a thick pale walnut sauce' },
  {
    id: 'kharcho',
    file: 'Kharcho soup of beef with walnuts and rice, Georgian cuisine (2).jpg',
    alt: 'A bowl of kharcho soup topped with walnuts and coriander',
  },
  { id: 'chikhirtma', file: 'Chikhirtma.jpg', alt: 'A bowl of chikhirtma, a pale chicken soup' },
  {
    id: 'khachapuri-imeruli',
    file: 'Old Tbilisi, Georgian khachapuri, Georgia.jpg',
    alt: 'A round cheese-filled khachapuri cut into wedges',
  },
  {
    id: 'khachapuri-adjaruli',
    file: 'Batumi - Khachapuri amb ou.jpg',
    alt: 'A boat-shaped adjaruli khachapuri with an egg yolk in the melted cheese, in Batumi',
  },
  {
    id: 'khachapuri-megruli',
    file: 'Megruli Chatschapuri.jpg',
    alt: 'Megruli khachapuri with a golden cheese crust on top',
  },
  {
    id: 'lobiani',
    file: 'Lobiani, Restaurant Aragvi.jpg',
    alt: 'A bean-filled lobiani flatbread cut into pieces',
  },
  { id: 'kubdari', file: 'Kubdari meat pastry.jpg', alt: 'A round kubdari meat pie, sliced open' },
  {
    id: 'shoti',
    file: 'Shoti bread in Moscow 01.jpg',
    alt: 'A baker beside a round tone oven, with shoti loaves on the rack',
  },
  { id: 'mchadi', file: 'Mchadi 2.jpg', alt: 'Small flat mchadi cornbreads' },
  { id: 'khinkali', file: 'Khinkali at Dmanisi.jpg', alt: 'A plate of pleated khinkali dumplings' },
  { id: 'mtsvadi', file: 'Mtsvadi (1).jpg', alt: 'Grilled mtsvadi with tomato and onion slices' },
  {
    id: 'shkmeruli',
    file: 'Chkmeruli.jpg',
    alt: 'Fried chicken in a creamy garlic sauce in a clay dish',
  },
  { id: 'ojakhuri', file: 'Оджахури.jpg', alt: 'Fried pork and potatoes served in a clay pan' },
  { id: 'chakapuli', file: 'Chakapuli.jpg', alt: 'A green chakapuli stew with tarragon' },
  { id: 'chashushuli', file: 'Chashushuli 01.jpg', alt: 'A red, spicy chashushuli beef stew' },
  {
    id: 'lobio',
    file: 'Lobio in clay pots covered with mchadi.jpg',
    alt: 'Lobio bean stew in clay pots, served with mchadi cornbread',
  },
  { id: 'kupati', file: 'Kupati (კუპატი).JPG', alt: 'Kupati sausages in a pan with a dark sauce' },
  {
    id: 'elarji',
    file: 'Elarji - cornmeal and sulguni cheese.jpg',
    alt: 'Stretchy elarji made of cornmeal and sulguni cheese',
  },
  {
    id: 'gebzhalia',
    file: 'Gebzhalia with matsoni.jpg',
    alt: 'Rolls of gebzhalia cheese in a white matsoni sauce',
  },
  {
    id: 'tkemali',
    file: 'Red and brown tkemali.jpg',
    alt: 'Bottles of red and brown tkemali plum sauce',
  },
  { id: 'ajika', file: 'Green ajika.jpg', alt: 'A bowl of green ajika with a green chilli' },
  { id: 'sulguni', file: 'Sulguni slice.JPG', alt: 'A slice of white sulguni cheese' },
  {
    id: 'churchkhela',
    file: 'Churchkhela store in Tbilisi, May, 2018.jpg',
    alt: 'Strings of churchkhela hanging at a stall in Tbilisi',
  },
  { id: 'pelamushi', file: 'Pelamoushi.jpg', alt: 'A dark red pelamushi grape pudding' },
  {
    id: 'gozinaki',
    file: 'Gozinaki with walnuts.jpg',
    alt: 'Diamond-shaped pieces of gozinaki walnut and honey brittle',
  },
  {
    id: 'tklapi',
    file: 'Various flavors of Tklapi from Dezerter Bazaar (Tbilisi, Georgia).jpg',
    alt: 'Rolled sheets of tklapi fruit leather at Dezerter Bazaar in Tbilisi',
  },
  {
    id: 'chacha',
    file: 'Chacha in Mtskheta.jpg',
    alt: 'Bottles of chacha and other drinks at a roadside stall in Mtskheta',
  },
  {
    id: 'lagidze-waters',
    file: 'Tbilisi, Lagidze lemonade, Georgia.jpg',
    alt: 'Glasses of Lagidze lemonade in Tbilisi',
  },
  { id: 'tarkhuna', file: 'Tarkhuna 05.jpg', alt: 'Bright green tarkhuna tarragon soda' },
];
