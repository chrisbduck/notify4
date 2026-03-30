import React from 'react';
import { formatPrecipitationType, getWindDescription, type WeatherData } from './weatherService';
import './WeatherCardDisplay.css';
import { WeatherIcon } from './WeatherIcon';

interface WeatherDetailsProps {
    icon: string;
    temperature: number;
    temperatureUnit: string;
    shortForecast: string;
}

const WeatherDetails: React.FC<WeatherDetailsProps> = ({ icon, temperature, temperatureUnit, shortForecast }) => (
    <div className="weather-details">
        <WeatherIcon iconName={icon} className="weather-icon" />
        <p>{temperature}°{temperatureUnit}</p>
        <p>{shortForecast}</p>
    </div>
);

function MinMaxTemperatureDisplay({ minTemperature, maxTemperature, temperatureUnit }: { minTemperature?: number; maxTemperature?: number; temperatureUnit?: string }) {
    if (minTemperature === undefined || temperatureUnit === undefined) return null;
    return <p>Min/Max: {minTemperature}°{temperatureUnit} / {maxTemperature}°{temperatureUnit}</p>;
}

function WindDisplay({ averageWindSpeed, maxWindSpeed }: { averageWindSpeed?: number; maxWindSpeed?: number }) {
    if (averageWindSpeed === undefined || maxWindSpeed === undefined) return null;
    if (maxWindSpeed < 20) return null; // don't display anything for light winds
    const description = getWindDescription(maxWindSpeed);
    return <p>{description}: {averageWindSpeed.toFixed(1)} / {maxWindSpeed.toFixed(1)} mph</p>;
}

function PrecipitationDisplay({ probabilityOfPrecipitation, precipitationType, precipitationStartTime }: { probabilityOfPrecipitation?: number; precipitationType?: string; precipitationStartTime?: Date }) {
    if (probabilityOfPrecipitation === undefined || probabilityOfPrecipitation <= 0) return null;
    const startTimeString = precipitationStartTime ? ` (~${precipitationStartTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })})` : '';
    return <p>{formatPrecipitationType(precipitationType)}: {probabilityOfPrecipitation}%{startTimeString}</p>;
}

interface WeatherCardProps {
    city: string;
    currentWeather: WeatherData | null;
    forecast4pm: WeatherData | null;
}

const WeatherCard: React.FC<WeatherCardProps> = ({ city, currentWeather, forecast4pm }) => {
    if (!currentWeather) {
        return (
            <div className="weather-card">
                <h3 className="weather-title">{city}</h3>
                <p>Loading weather...</p>
            </div>
        );
    }

    return (
        <div className="weather-card">
            <h3 className="weather-title">{city}</h3>
            <div className="weather-details-container">
                <div className="weather-details-column">
                    <h4>Now</h4>
                    <WeatherDetails
                        icon={currentWeather.icon}
                        temperature={currentWeather.temperature}
                        temperatureUnit={currentWeather.temperatureUnit}
                        shortForecast={currentWeather.shortForecast}
                    />
                </div>
                {forecast4pm && (
                    <div className="weather-details-column">
                        <h4>4 PM</h4>
                        <WeatherDetails
                            icon={forecast4pm.icon}
                            temperature={forecast4pm.temperature}
                            temperatureUnit={forecast4pm.temperatureUnit}
                            shortForecast={forecast4pm.shortForecast}
                        />
                    </div>
                )}
            </div>
            <MinMaxTemperatureDisplay minTemperature={currentWeather.minTemperature} maxTemperature={currentWeather.maxTemperature} temperatureUnit={currentWeather.temperatureUnit} />
            <WindDisplay averageWindSpeed={currentWeather.averageWindSpeed} maxWindSpeed={currentWeather.maxWindSpeed} />
            <PrecipitationDisplay precipitationStartTime={currentWeather.precipitationStartTime} precipitationType={currentWeather.precipitationType} probabilityOfPrecipitation={currentWeather.probabilityOfPrecipitation} />
        </div>
    );
};

interface WeatherCardDisplayProps {
    currentWeather: WeatherData | null;
    forecast4pm: WeatherData | null;
}

const WeatherCardDisplay: React.FC<WeatherCardDisplayProps> = ({ currentWeather, forecast4pm }) => {
    return (
        <div className="weather-display-container">
            <WeatherCard
                city="Seattle, WA"
                currentWeather={currentWeather}
                forecast4pm={forecast4pm}
            />
        </div>
    );
};

export default WeatherCardDisplay;