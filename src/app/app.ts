import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';

type WeatherKind = 'clear' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'thunder';
type IconKind = WeatherKind | 'clear-night';
type Period = 'night' | 'dawn' | 'day' | 'dusk';

interface WeatherData {
  temperature: number;
  windspeed: number;
  description: string;
  kind: WeatherKind;
}

interface ForecastDay {
  date: string;
  displayDate: string;
  temperature_max: number;
  temperature_min: number;
  description: string;
  kind: WeatherKind;
}

interface Place {
  name: string;
  region: string;
  lat: number;
  lon: number;
}

const LOCATION: Place = {
  name: 'Schruns',
  region: 'Vorarlberg, Austria',
  lat: 47.21,
  lon: 12.15,
};

/** WMO weather codes as returned by Open-Meteo. */
const WEATHER_CODES: Record<number, { description: string; kind: WeatherKind }> = {
  0: { description: 'Clear sky', kind: 'clear' },
  1: { description: 'Mainly clear', kind: 'clear' },
  2: { description: 'Partly cloudy', kind: 'cloudy' },
  3: { description: 'Overcast', kind: 'cloudy' },
  45: { description: 'Fog', kind: 'fog' },
  48: { description: 'Rime fog', kind: 'fog' },
  51: { description: 'Light drizzle', kind: 'rain' },
  53: { description: 'Drizzle', kind: 'rain' },
  55: { description: 'Dense drizzle', kind: 'rain' },
  56: { description: 'Freezing drizzle', kind: 'rain' },
  57: { description: 'Dense freezing drizzle', kind: 'rain' },
  61: { description: 'Light rain', kind: 'rain' },
  63: { description: 'Rain', kind: 'rain' },
  65: { description: 'Heavy rain', kind: 'rain' },
  66: { description: 'Freezing rain', kind: 'rain' },
  67: { description: 'Heavy freezing rain', kind: 'rain' },
  71: { description: 'Light snow', kind: 'snow' },
  73: { description: 'Snow', kind: 'snow' },
  75: { description: 'Heavy snow', kind: 'snow' },
  77: { description: 'Snow grains', kind: 'snow' },
  80: { description: 'Light showers', kind: 'rain' },
  81: { description: 'Showers', kind: 'rain' },
  82: { description: 'Violent showers', kind: 'rain' },
  85: { description: 'Snow showers', kind: 'snow' },
  86: { description: 'Heavy snow showers', kind: 'snow' },
  95: { description: 'Thunderstorm', kind: 'thunder' },
  96: { description: 'Thunderstorm with hail', kind: 'thunder' },
  99: { description: 'Thunderstorm with heavy hail', kind: 'thunder' },
};

@Component({
  imports: [],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App implements OnInit, OnDestroy {
  protected readonly location = signal<Place>(LOCATION);

  weatherData = signal<WeatherData | null>(null);
  forecastDays = signal<ForecastDay[]>([]);
  loading = signal<boolean>(true);

  /** Ticks so the clock and the darkness of the sky stay current. */
  private now = signal(new Date());
  private utcOffset = signal<number | null>(null);

  private ticker?: ReturnType<typeof setInterval>;

  /** Latest fetch request; guards against out-of-order responses. */
  private requestSeq = 0;

  ngOnInit(): void {
    this.ticker = setInterval(() => this.now.set(new Date()), 30_000);
    void this.loadWeather();
    this.locateVisitor();
  }

  ngOnDestroy(): void {
    clearInterval(this.ticker);
  }

  async loadWeather(): Promise<void> {
    const id = ++this.requestSeq;
    this.loading.set(true);
    const place = this.location();
    // forecast_days=3 gives us 3 days of daily forecast (same day + next 2 days)
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${place.lat}` +
      `&longitude=${place.lon}&current_weather=true&daily=temperature_2m_max,temperature_2m_min,weathercode&windspeed_unit=kmh&timezone=auto`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }
      const data = await response.json();
      if (id !== this.requestSeq) return; // superseded by a newer request
      const current = data.current_weather ?? {};
      const code = WEATHER_CODES[current.weathercode as number];

      this.utcOffset.set(
        typeof data.utc_offset_seconds === 'number' ? data.utc_offset_seconds : null,
      );
      this.weatherData.set({
        temperature: Math.round(Number(current.temperature)),
        windspeed: Math.round(Number(current.windspeed)),
        description: code?.description ?? 'Unknown conditions',
        kind: code?.kind ?? 'cloudy',
      });

      // daily forecast for 3 days (including today)
      const daily = data.daily ?? {};
      const weatherCodes = daily.weathercode ?? [];
      const maxTemps = daily.temperature_2m_max ?? [];
      const minTemps = daily.temperature_2m_min ?? [];

      const dailyTimes = daily.time;
      const forecast = (Array.isArray(weatherCodes) &&
        Array.isArray(maxTemps) &&
        Array.isArray(minTemps) &&
        weatherCodes.length > 0 &&
        maxTemps.length >= 3 &&
        minTemps.length >= 3)
        ? weatherCodes.slice(0, 3).map((codeNum, i) => {
            const code = WEATHER_CODES[codeNum as number];
            // Relative date display: Today, Tomorrow Mon, In 2 days Tue, etc.
            const displayDate = this.getDisplayDate(i, dailyTimes);
            return {
              date: daily.time[i],
              displayDate: displayDate,
              temperature_max: Math.round(Number(maxTemps[i])),
              temperature_min: Math.round(Number(minTemps[i])),
              description: code?.description ?? 'Unknown',
              kind: code?.kind ?? 'cloudy',
            };
          })
        : [];

      this.forecastDays.set(forecast);
    } catch (err) {
      console.error('Failed to load weather:', err);
      this.weatherData.set(null);
      this.forecastDays.set([]);
    } finally {
      if (id === this.requestSeq) {
        this.loading.set(false);
      }
    }
  }


  /** Follow the visitor's coordinates when geolocation is available. */
  private locateVisitor(): void {
    navigator.geolocation?.getCurrentPosition(
      ({ coords }) => {
        this.location.set({
          name: 'Your location',
          region: this.formatCoords(coords.latitude, coords.longitude),
          lat: coords.latitude,
          lon: coords.longitude,
        });
        void this.loadWeather();
      },
      (err) => console.debug('Geolocation unavailable:', err.message),
      { timeout: 10_000, maximumAge: 5 * 60_000 },
    );
  }

  private formatCoords(lat: number, lon: number): string {
    const fmt = (value: number, positive: string, negative: string) =>
      `${Math.abs(value).toFixed(2)}\u00b0 ${value >= 0 ? positive : negative}`;
    return `${fmt(lat, 'N', 'S')}, ${fmt(lon, 'E', 'W')}`;
  }

  /** Minutes since midnight in the location's timezone (falls back to local time). */
  private readonly localMinutes = computed(() => {
    const now = this.now();
    const offset = this.utcOffset();
    if (offset === null) {
      return now.getHours() * 60 + now.getMinutes();
    }
    const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    return (utcMinutes + offset / 60 + 1440) % 1440;
  });

  /** 0 (deep night) … 24 (end of night) in the location's timezone. */
  private readonly hour = computed(() => this.localMinutes() / 60);

  readonly clock = computed(() => {
    const total = Math.round(this.localMinutes());
    const hours = Math.floor(total / 60) % 24;
    const minutes = total % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  });

  readonly period = computed<Period>(() => {
    const hour = this.hour();
    if (hour < 5 || hour >= 21) return 'night';
    if (hour < 8) return 'dawn';
    if (hour < 18) return 'day';
    return 'dusk';
  });

  /** Opacity of the night veil, following the sun between 06:00 and 20:00. */
  readonly darkness = computed(() => {
    const daylight = Math.max(0, Math.sin(((this.hour() - 6) / 14) * Math.PI));
    return Math.round(0.78 * (1 - daylight) * 100) / 100;
  });

  /** Rotation angles for the sun's rays. */
  protected readonly rayAngles = [0, 45, 90, 135, 180, 225, 270, 315];

  /** Relative day label, e.g. "Today", "Tomorrow Mon", "In 2 days Tue". */
  private getDisplayDate(index: number, times: string[]): string {
    if (index === 0) return 'Today';

    // times format: "YYYY-MM-DD"
    const [year, month, day] = (times[index] ?? times[0] ?? '').split('-').map(Number);
    if (!year || !month || !day) return index === 1 ? 'Tomorrow' : '';
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weekday = weekDays[new Date(year, month - 1, day).getDay()];

    if (index === 1) return `Tomorrow ${weekday}`;
    return `In ${index} days ${weekday}`;
  }

  readonly theme = computed(
    () => `sky ${this.weatherData()?.kind ?? 'cloudy'} ${this.period()}`,
  );

  readonly icon = computed<IconKind>(() => {
    const weather = this.weatherData();
    if (!weather) return 'cloudy';
    const period = this.period();
    if (weather.kind === 'clear' && (period === 'night' || period === 'dusk')) {
      return 'clear-night';
    }
    return weather.kind;
  });
}
