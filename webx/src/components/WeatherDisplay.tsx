/**
 * Weather Display Component
 *
 * Renders weather data as a beautiful, interactive UI component.
 * Used as generative UI when Kiana agent's getWeather tool returns weather data.
 */

export interface WeatherData {
  city: string;
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  description: string;
  icon: string;
}

function getWeatherEmoji(iconCode: string): string {
  const emojiMap: Record<string, string> = {
    '01d': '☀️',
    '01n': '🌙',
    '02d': '⛅',
    '02n': '🌤️',
    '03d': '☁️',
    '03n': '☁️',
    '04d': '☁️',
    '04n': '☁️',
    '09d': '🌧️',
    '09n': '🌧️',
    '10d': '🌦️',
    '10n': '🌧️',
    '11d': '⛈️',
    '11n': '⛈️',
    '13d': '❄️',
    '13n': '❄️',
    '50d': '🌫️',
    '50n': '🌫️',
  };
  return emojiMap[iconCode] || '🌤️';
}

export function WeatherDisplay({ weather }: { weather: WeatherData }) {
  const emoji = getWeatherEmoji(weather.icon);

  return (
    <div className="my-4 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 p-6 text-white shadow-lg">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-2xl font-bold">{weather.city}</h3>
        <div className="text-5xl">{emoji}</div>
      </div>

      <div className="mb-4 border-b border-blue-300 pb-4">
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold">{weather.temperature}°C</span>
          <span className="text-sm opacity-90">
            Feels like {weather.feelsLike}°C
          </span>
        </div>
        <p className="mt-2 text-lg capitalize text-blue-100">{weather.description}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded bg-blue-500 bg-opacity-50 p-3">
          <p className="text-xs opacity-75">Humidity</p>
          <p className="text-xl font-semibold">{weather.humidity}%</p>
        </div>
        <div className="rounded bg-blue-500 bg-opacity-50 p-3">
          <p className="text-xs opacity-75">Wind Speed</p>
          <p className="text-xl font-semibold">{weather.windSpeed} m/s</p>
        </div>
      </div>
    </div>
  );
}
