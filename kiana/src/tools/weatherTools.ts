/**
 * Weather Tools for Kiana Agent
 *
 * Provides weather-related tools that can be injected into the Kiana agent.
 * Uses AI SDK v6's generative UI pattern where tool output drives client-side UI rendering.
 *
 * Example usage:
 * ```typescript
 * import { createWeatherTools } from '@byted/kiana/tools/weatherTools';
 *
 * const weatherTools = createWeatherTools(process.env.OPENWEATHERMAP_API_KEY);
 * const agent = await createKianaAgent(memtools, {
 *   instruction: 'What is the weather in London?',
 *   arkConfig: { ... },
 *   additionalTools: weatherTools,
 * });
 * ```
 *
 * The getWeather tool returns structured weather data that the client renders
 * as a beautiful UI component using AI SDK v6's DataUIPart pattern.
 */

import { tool } from 'ai';
import { z } from 'zod';

/**
 * Weather data interface - used for generative UI
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

/**
 * Get current weather for a city using OpenWeatherMap API
 * Returns structured weather data for rendering as generative UI on the client
 */
const createGetWeatherTool = (apiKey: string) =>
  tool({
    description:
      'Get current weather information for a specific city. Returns weather data that will be displayed as an interactive UI component.',
    inputSchema: z.object({
      city: z
        .string()
        .describe(
          'The city name to get weather for (e.g., "London", "New York", "Tokyo", "Paris")'
        ),
    }),
    outputSchema: z.object({
      city: z.string().describe('City name'),
      temperature: z.number().describe('Temperature in Celsius'),
      feelsLike: z.number().describe('Feels like temperature in Celsius'),
      humidity: z.number().describe('Humidity percentage (0-100)'),
      windSpeed: z.number().describe('Wind speed in meters per second'),
      description: z
        .string()
        .describe('Weather condition (e.g., "Sunny", "Rainy", "Cloudy")'),
      icon: z.string().describe('OpenWeatherMap icon code'),
    }),
    execute: async ({ city }: { city: string }): Promise<WeatherData> => {
      if (!apiKey) {
        throw new Error(
          'Missing OPENWEATHERMAP_API_KEY. Please set it in environment variables.'
        );
      }

      try {
        const response = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
            city
          )}&units=metric&appid=${apiKey}`
        );

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`City not found: ${city}`);
          }
          throw new Error(`Weather API error: ${response.statusText}`);
        }

        const data = await response.json();

        // Return structured weather data that will drive UI rendering on client
        const weatherData: WeatherData = {
          city: data.name,
          temperature: Math.round(data.main.temp),
          feelsLike: Math.round(data.main.feels_like),
          humidity: data.main.humidity,
          windSpeed: Math.round(data.wind.speed * 10) / 10,
          description: data.weather[0].main,
          icon: data.weather[0].icon,
        };

        return weatherData;
      } catch (error) {
        console.error('[WeatherTool] Error fetching weather:', error);
        throw new Error(
          `Failed to fetch weather for ${city}: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        );
      }
    },
  });

/**
 * Display weather tool - client-side UI rendering
 * This tool is called by the LLM after getWeather to trigger UI display
 */
const createDisplayWeatherTool = () =>
  tool({
    description:
      'Display weather information as a beautiful interactive UI component. Call this after getWeather to show the fetched weather data to the user.',
    inputSchema: z.object({
      city: z.string().describe('City name'),
      temperature: z.number().describe('Temperature in Celsius'),
      feelsLike: z.number().describe('Feels like temperature in Celsius'),
      humidity: z.number().describe('Humidity percentage'),
      windSpeed: z.number().describe('Wind speed in m/s'),
      description: z.string().describe('Weather condition description'),
      icon: z.string().describe('Weather icon code'),
    }),
    outputSchema: z.object({
      displayed: z.boolean(),
      message: z.string(),
    }),
    execute: async (weatherData: WeatherData) => {
      return {
        displayed: true,
        message: `Weather information for ${weatherData.city} is now being displayed as an interactive UI component.`,
      };
    },
  });

/**
 * Create weather tools for injection into Kiana agent
 *
 * The returned tools use AI SDK v6's generative UI pattern:
 * - getWeather: Fetches weather data from OpenWeatherMap API
 * - displayWeather: Displays the weather data as a beautiful interactive UI component
 *
 * When Kiana is asked about weather:
 * 1. It calls getWeather to fetch real weather data
 * 2. It then calls displayWeather to render the data as interactive UI
 * 3. The client detects the displayWeather tool call and renders WeatherDisplay component
 *
 * @param openweatherApiKey - OpenWeatherMap API key (from OPENWEATHERMAP_API_KEY env var)
 * @returns Record of tools ready to be injected via additionalTools option
 *
 * @example
 * ```typescript
 * const weatherTools = createWeatherTools(process.env.OPENWEATHERMAP_API_KEY);
 * const agent = await createKianaAgent(memtools, {
 *   instruction: 'Tell me the weather in London',
 *   arkConfig: arkConfig,
 *   additionalTools: weatherTools,
 * });
 * ```
 */
export const createWeatherTools = (
  openweatherApiKey?: string
): Record<string, any> => {
  const tools: Record<string, any> = {
    displayWeather: createDisplayWeatherTool(),
  };

  // Only add getWeather if API key is provided
  if (openweatherApiKey) {
    tools.getWeather = createGetWeatherTool(openweatherApiKey);
  }

  return tools;
};
