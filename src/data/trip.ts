/**
 * Single source of truth for the trip.
 * All instants are ISO 8601 strings with an explicit UTC offset; never rely on the viewer's zone.
 * Public info only: first names and public flight data.
 */

export const TBC = 'TBC' as const;

export type TravelerId = 'ofek' | 'ron' | 'roy' | 'maya';

export interface Traveler {
  id: TravelerId;
  name: string;
}

export interface Airport {
  iata: 'TLV' | 'TBS';
  name: string;
  city: string;
  /** Human label for the local zone, e.g. "Israel time". */
  zoneLabel: string;
  /** IANA zone used to display local times at this airport. */
  timeZone: string;
}

export interface Baggage {
  carryOnKg?: number;
  checkedKg?: number;
  trolleyKg?: number;
}

export interface FlightLeg {
  flightNo: string;
  carrier: string;
  from: Airport;
  to: Airport;
  departure: string;
  arrival: string | typeof TBC;
  baggage?: Baggage;
  meal?: boolean;
}

export interface Trip {
  name: string;
  resort: string;
  country: string;
  hotel: string;
  /** IANA zone of the destination, used for "Day X of N". */
  destinationTimeZone: string;
  /** First and last calendar day at the destination (YYYY-MM-DD, destination zone). */
  firstDay: string;
  lastDay: string;
  travelers: Traveler[];
  outbound: FlightLeg;
  inbound: FlightLeg;
}

const TLV: Airport = {
  iata: 'TLV',
  name: 'Ben Gurion Airport',
  city: 'Tel Aviv',
  zoneLabel: 'Israel time',
  timeZone: 'Asia/Jerusalem',
};

const TBS: Airport = {
  iata: 'TBS',
  name: 'Tbilisi International Airport',
  city: 'Tbilisi',
  zoneLabel: 'Georgia time',
  timeZone: 'Asia/Tbilisi',
};

/** Same allowance on both tickets. */
const BAGGAGE_PER_TICKET: Baggage = { carryOnKg: 3, checkedKg: 23, trolleyKg: 8 };

export const trip: Trip = {
  name: 'Gudauri 2027',
  resort: 'Gudauri',
  country: 'Georgia',
  hotel: 'Marco Polo Hotel, Gudauri',
  destinationTimeZone: 'Asia/Tbilisi',
  firstDay: '2027-02-24',
  lastDay: '2027-02-28',
  travelers: [
    { id: 'ofek', name: 'Ofek' },
    { id: 'ron', name: 'Ron' },
    { id: 'roy', name: 'Roy' },
    { id: 'maya', name: 'Maya' },
  ],
  outbound: {
    flightNo: 'LY5107',
    carrier: 'El Al',
    from: TLV,
    to: TBS,
    departure: '2027-02-24T05:15:00+02:00',
    arrival: '2027-02-24T09:50:00+04:00',
    baggage: BAGGAGE_PER_TICKET,
    meal: false,
  },
  inbound: {
    flightNo: 'LY5110',
    carrier: 'El Al',
    from: TBS,
    to: TLV,
    departure: '2027-02-28T23:55:00+04:00',
    arrival: '2027-03-01T00:35:00+02:00',
    baggage: BAGGAGE_PER_TICKET,
    meal: false,
  },
};
