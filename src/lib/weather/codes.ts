/** WMO weather interpretation codes (as used by Open-Meteo) → label + emoji. */
const TABLE: [codes: number[], label: string, emoji: string][] = [
  [[0], 'Clear', '☀️'],
  [[1], 'Mostly clear', '🌤️'],
  [[2], 'Partly cloudy', '⛅'],
  [[3], 'Overcast', '☁️'],
  [[45, 48], 'Fog', '🌫️'],
  [[51, 53, 55, 56, 57], 'Drizzle', '🌦️'],
  [[61, 63, 65, 66, 67, 80, 81, 82], 'Rain', '🌧️'],
  [[71, 73, 75, 77, 85, 86], 'Snow', '🌨️'],
  [[95, 96, 99], 'Thunderstorm', '⛈️'],
];

export function describeWeather(code: number): { label: string; emoji: string } {
  const row = TABLE.find(([codes]) => codes.includes(code));
  return row ? { label: row[1], emoji: row[2] } : { label: 'Unknown', emoji: '❔' };
}

/** Heavy-snow codes get a stronger label. */
export function snowIntensity(code: number): 'light' | 'moderate' | 'heavy' | null {
  if ([71, 85].includes(code)) return 'light';
  if ([73].includes(code)) return 'moderate';
  if ([75, 86].includes(code)) return 'heavy';
  return null;
}
