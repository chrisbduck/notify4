import mockPointData from './testdata/weather/mockWeatherPointData.json';
import mockGridpointData from './testdata/weather/mockWeatherGridpointData.json';

const NWS_API_BASE_URL = 'https://api.weather.gov';

interface PointResponse {
    properties: {
        forecastGridData: string;
        relativeLocation: {
            properties: {
                city: string;
                state: string;
            };
        };
    };
}

interface GridpointValue {
    validTime: string;
    value: number | null;
}

interface GridpointWeatherValue {
    validTime: string;
    value: Array<{
        coverage: string | null;
        weather: string | null;
        intensity: string | null;
        visibility: {
            unitCode: string;
            value: number | null;
        };
        attributes: string[];
    }>;
}

interface GridpointResponse {
    properties: {
        temperature: {
            uom: string;
            values: GridpointValue[];
        };
        maxTemperature: {
            uom: string;
            values: GridpointValue[];
        };
        minTemperature: {
            uom: string;
            values: GridpointValue[];
        };
        weather: {
            values: GridpointWeatherValue[];
        };
        skyCover: {
            uom: string;
            values: GridpointValue[];
        };
        windSpeed: {
            uom: string;
            values: GridpointValue[];
        };
        windGust: {
            uom: string;
            values: GridpointValue[];
        };
        probabilityOfPrecipitation: {
            uom: string;
            values: GridpointValue[];
        };
    };
}

export interface WeatherData {
    city: string;
    temperature: number;
    temperatureUnit: string;
    shortForecast: string;
    icon: string;
    minTemperature?: number;
    maxTemperature?: number;
    windSpeed?: number;
    windGust?: number;
    averageWindSpeed?: number;
    maxWindSpeed?: number;
    probabilityOfPrecipitation?: number;
    precipitationType?: string;
    precipitationStartTime?: Date;
}

const parseDuration = (duration: string): number => {
    let totalMilliseconds = 0;
    const regex = /P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;
    const matches = duration.match(regex);

    if (matches) {
        const days = parseInt(matches[1] || '0', 10);
        const hours = parseInt(matches[2] || '0', 10);
        const minutes = parseInt(matches[3] || '0', 10);
        const seconds = parseInt(matches[4] || '0', 10);

        totalMilliseconds += days * 24 * 60 * 60 * 1000;
        totalMilliseconds += hours * 60 * 60 * 1000;
        totalMilliseconds += minutes * 60 * 1000;
        totalMilliseconds += seconds * 1000;
    }
    return totalMilliseconds;
};

const convertCelsiusToFahrenheit = (celsius: number): number => {
    return (celsius * 9 / 5) + 32;
};

const getWeatherDetailsAtTime = (
    properties: GridpointResponse['properties'],
    targetTime: Date
): { temperature?: number; shortForecast: string; icon: string } => {
    const getSpecificValue = (values: GridpointValue[]): number | undefined => {
        for (const item of values) {
            const validTimeStart = new Date(item.validTime.split('/')[0]);
            const validTimeEnd = new Date(validTimeStart.getTime() + parseDuration(item.validTime.split('/')[1]));
            if (targetTime >= validTimeStart && targetTime < validTimeEnd) {
                return item.value !== null ? convertCelsiusToFahrenheit(item.value) : undefined;
            }
        }
        return undefined;
    };

    let shortForecast = 'N/A';
    let icon = '';

    const isDay = targetTime.getHours() >= 6 && targetTime.getHours() < 18;

    const weatherAtTime = properties.weather.values.find(item => {
        const validTimeStart = new Date(item.validTime.split('/')[0]);
        const validTimeEnd = new Date(validTimeStart.getTime() + parseDuration(item.validTime.split('/')[1]));
        return targetTime >= validTimeStart && targetTime < validTimeEnd;
    });

    if (weatherAtTime && weatherAtTime.value.length > 0 && weatherAtTime.value[0].weather) {
        shortForecast = weatherAtTime.value[0].weather;
        const forecastLower = shortForecast.toLowerCase();

        if (forecastLower.includes('thunder')) {
            icon = isDay ? 'wi-day-thunderstorm' : 'wi-night-alt-thunderstorm';
        } else if (forecastLower.includes('sleet')) {
            icon = 'wi-sleet';
        } else if (forecastLower.includes('snow')) {
            icon = 'wi-snow';
        } else if (forecastLower.includes('rain')) {
            icon = isDay ? 'wi-day-rain' : 'wi-night-alt-rain';
        } else if (forecastLower.includes('showers')) {
            icon = isDay ? 'wi-day-showers' : 'wi-night-alt-showers';
        } else if (forecastLower.includes('fog') || forecastLower.includes('haze')) {
            icon = isDay ? 'wi-day-haze' : 'wi-fog';
        } else if (forecastLower.includes('cloud')) {
            icon = isDay ? 'wi-day-cloudy' : 'wi-night-alt-cloudy';
        } else if (forecastLower.includes('sunny') || forecastLower.includes('clear')) {
            icon = isDay ? 'wi-day-sunny' : 'wi-night-clear';
        } else {
            icon = 'wi-cloudy';
        }
    } else {
        const skyCoverAtTime = getSpecificValue(properties.skyCover.values);
        if (skyCoverAtTime !== undefined) {
            // Sky cover is a percentage, so we can map it to icons.
            // NWS API sometimes lacks a shortForecast string, so this is a good fallback.
            if (skyCoverAtTime < 25) {
                icon = isDay ? 'wi-day-sunny' : 'wi-night-clear';
                shortForecast = 'Clear';
            } else if (skyCoverAtTime < 50) {
                icon = isDay ? 'wi-day-cloudy' : 'wi-night-alt-cloudy';
                shortForecast = 'Partly Cloudy';
            } else if (skyCoverAtTime < 75) {
                icon = 'wi-cloud';
                shortForecast = 'Mostly Cloudy';
            } else {
                icon = 'wi-cloudy';
                shortForecast = 'Overcast';
            }
        }
    }

    return {
        temperature: getSpecificValue(properties.temperature.values),
        shortForecast,
        icon,
    };
};

export const formatPrecipitationType = (type: string | undefined): string => {
    if (!type) return 'precipitation';
    switch (type.toLowerCase()) {
        case 'rain_showers':
            return 'rain showers';
        case 'light_rain':
            return 'light rain';
        case 'heavy_rain':
            return 'heavy rain';
        case 'snow':
            return 'snow';
        case 'sleet':
            return 'sleet';
        case 'freezing_rain':
            return 'freezing rain';
        default:
            return type.replace(/_/g, ' ');
    }
};

export function getWindDescription(maxSpeed: number): string {
    if (maxSpeed < 1) return 'Calm';
    if (maxSpeed <= 3) return 'Light air';
    if (maxSpeed <= 7) return 'Light breeze';
    if (maxSpeed <= 12) return 'Gentle breeze';
    if (maxSpeed <= 18) return 'Moderate breeze';
    if (maxSpeed <= 24) return 'Fresh breeze';
    if (maxSpeed <= 31) return 'Strong breeze';
    if (maxSpeed <= 38) return 'Near gale';
    if (maxSpeed <= 46) return 'Gale';
    if (maxSpeed <= 54) return 'Strong gale';
    if (maxSpeed <= 63) return 'Storm';
    if (maxSpeed <= 72) return 'Violent storm';
    return 'Hurricane';
}

const testMultipleColumns = false; // for debugging

export const isBefore2PM = (date?: Date): boolean => {
    if (testMultipleColumns) return true;

    if (!date) date = new Date();   // default to now

    const twoPM = new Date(date);
    twoPM.setHours(14, 0, 0, 0); // 2 PM local time
    return date.getTime() < twoPM.getTime();
};

async function _fetchData(latitude: number, longitude: number, useMockData: boolean): Promise<{ pointData: PointResponse, gridpointData: GridpointResponse }> {
    if (useMockData) {
        return { pointData: mockPointData as PointResponse, gridpointData: mockGridpointData as GridpointResponse };
    }

    const pointResponse = await fetch(`${NWS_API_BASE_URL}/points/${latitude},${longitude}`,
        { headers: { 'Accept': 'application/json', 'User-Agent': 'notify-me (chrisbduck@github.com)' } });
    if (!pointResponse.ok) {
        throw new Error(`HTTP error! status: ${pointResponse.status}`);
    }
    const pointData: PointResponse = await pointResponse.json();
    const forecastGridUrl = pointData.properties.forecastGridData;

    const gridpointResponse = await fetch(forecastGridUrl,
        { headers: { 'Accept': 'application/json', 'User-Agent': 'notify-me (chrisbduck@github.com)' } });
    if (!gridpointResponse.ok) {
        throw new Error(`HTTP error! status: ${gridpointResponse.status}`);
    }
    const gridpointData: GridpointResponse = await gridpointResponse.json();
    return { pointData, gridpointData };
}

const fetchWeatherData = async (latitude: number, longitude: number, useMockData: boolean, targetTime: Date = new Date()): Promise<WeatherData | null> => {
    try {
        const { pointData, gridpointData } = await _fetchData(latitude, longitude, useMockData);

        const city = pointData.properties.relativeLocation.properties.city;
        const properties = gridpointData.properties;
        const today = targetTime.toISOString().split('T')[0];

        const { temperature, shortForecast, icon } = getWeatherDetailsAtTime(properties, targetTime);

        const getSpecificValue = (values: GridpointValue[]): number | undefined => {
            for (const item of values) {
                const [timeStr, durationStr] = item.validTime.split('/');
                const validTimeStart = new Date(timeStr);
                const validTimeEnd = new Date(validTimeStart.getTime() + parseDuration(durationStr));
                if (targetTime >= validTimeStart && targetTime < validTimeEnd) {
                    return item.value !== null ? item.value : undefined;
                }
            }
            return undefined;
        };

        const getDailyMinMax = (values: GridpointValue[], type: 'min' | 'max'): number | undefined => {
            let dailyValue: number | undefined;
            for (const item of values) {
                const [timeStr] = item.validTime.split('/');
                const validTimeStart = new Date(timeStr);
                if (validTimeStart.toISOString().startsWith(today)) {
                    const fahrenheitValue = item.value !== null ? convertCelsiusToFahrenheit(item.value) : undefined;
                    if (fahrenheitValue !== undefined) {
                        if (dailyValue === undefined) {
                            dailyValue = fahrenheitValue;
                        } else if (type === 'min') {
                            dailyValue = Math.min(dailyValue, fahrenheitValue);
                        } else {
                            dailyValue = Math.max(dailyValue, fahrenheitValue);
                        }
                    }
                }
            }
            return dailyValue;
        };

        const minTemperature = getDailyMinMax(properties.minTemperature.values, 'min');
        const maxTemperature = getDailyMinMax(properties.maxTemperature.values, 'max');

        let averageWindSpeed: number | undefined;
        let maxWindSpeed: number | undefined;
        let totalWindSpeed = 0;
        let windSpeedCount = 0;

        for (const item of properties.windSpeed.values) {
            const [timeStr] = item.validTime.split('/');
            const validTimeStart = new Date(timeStr);
            if (validTimeStart.toISOString().startsWith(today) && item.value !== null) {
                totalWindSpeed += item.value;
                windSpeedCount++;
                if (maxWindSpeed === undefined || item.value > maxWindSpeed) {
                    maxWindSpeed = item.value;
                }
            }
        }
        if (windSpeedCount > 0) {
            averageWindSpeed = totalWindSpeed / windSpeedCount;
        }

        const windSpeed = getSpecificValue(properties.windSpeed.values);
        const windGust = getSpecificValue(properties.windGust.values);
        const probabilityOfPrecipitation = getSpecificValue(properties.probabilityOfPrecipitation.values);

        let precipitationType: string | undefined = undefined;
        let precipitationStartTime: Date | undefined = undefined;

        for (const item of properties.probabilityOfPrecipitation.values) {
            const [timeStr] = item.validTime.split('/');
            const validTimeStart = new Date(timeStr);

            if (validTimeStart.toISOString().startsWith(today) && item.value && item.value > 0) {
                const weatherAtPrecipitationTime = properties.weather.values.find(weatherItem => {
                    const [weatherTimeStr, weatherDurationStr] = weatherItem.validTime.split('/');
                    const weatherValidTimeStart = new Date(weatherTimeStr);
                    const weatherValidTimeEnd = new Date(weatherValidTimeStart.getTime() + parseDuration(weatherDurationStr));
                    return validTimeStart >= weatherValidTimeStart && validTimeStart < weatherValidTimeEnd;
                });

                if (weatherAtPrecipitationTime && weatherAtPrecipitationTime.value.length > 0 && weatherAtPrecipitationTime.value[0].weather) {
                    precipitationType = weatherAtPrecipitationTime.value[0].weather;
                    precipitationStartTime = validTimeStart;
                    break;
                }
            }
        }

        return {
            city: city,
            temperature: temperature !== undefined ? temperature : 0,
            temperatureUnit: 'F',
            shortForecast: shortForecast,
            icon: icon,
            minTemperature: minTemperature,
            maxTemperature: maxTemperature,
            windSpeed: windSpeed,
            windGust: windGust,
            averageWindSpeed: averageWindSpeed,
            maxWindSpeed: maxWindSpeed,
            probabilityOfPrecipitation: probabilityOfPrecipitation,
            precipitationType: precipitationType,
            precipitationStartTime: precipitationStartTime,
        };
    } catch (error) {
        console.error('Error fetching weather data:', error);
        return null;
    }
};
export const getKirklandWeather = (useMockData: boolean, targetTime?: Date) => fetchWeatherData(47.6763, -122.2063, useMockData, targetTime);
export const getSeattleWeather = (useMockData: boolean, targetTime?: Date) => fetchWeatherData(47.6062, -122.3321, useMockData, targetTime);
