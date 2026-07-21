export type SprayHint = {
  label: string;
  tone: 'good' | 'caution' | 'bad';
};

export function sprayingHintFromForecast(
  maxPop24h: number,
  windMps: number,
  humidityPct: number
): SprayHint {
  if (maxPop24h >= 0.55) {
    return { label: 'Rain likely — delay spraying', tone: 'bad' };
  }
  if (maxPop24h >= 0.35) {
    return { label: 'Showers possible — plan a short spray window', tone: 'caution' };
  }
  if (windMps > 8) {
    return { label: 'Windy — drift risk, avoid fine sprays', tone: 'caution' };
  }
  if (humidityPct > 88) {
    return { label: 'Very humid — slower drying', tone: 'caution' };
  }
  return { label: 'Good window for spraying today', tone: 'good' };
}
