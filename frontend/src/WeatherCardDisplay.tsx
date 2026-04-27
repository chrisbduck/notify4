import React from 'react';
import { formatForecastText, formatPrecipitationType, getWindDescription, type WeatherData } from './weatherService';
import './WeatherCardDisplay.css';
import { WeatherIcon } from './WeatherIcon';
import { ExpandIndicator } from './CollapsibleContent';

interface WeatherDetailsProps {
    icon: string;
    temperature: number;
    temperatureUnit: string;
    shortForecast: string;
}

const WeatherDetails: React.FC<WeatherDetailsProps> = ({ icon, temperature, temperatureUnit, shortForecast }) => (
    <div className="weather-details">
        <WeatherIcon iconName={icon} className="weather-icon" />
        <p className="weather-temperature">{temperature}°{temperatureUnit}</p>
        <p className="weather-forecast">{formatForecastText(shortForecast)}</p>
    </div>
);

function MinMaxTemperatureDisplay({ minTemperature, maxTemperature, temperatureUnit }: { minTemperature?: number; maxTemperature?: number; temperatureUnit?: string }) {
    if (minTemperature === undefined || temperatureUnit === undefined) return null;
    return <p className="weather-supporting-text">Min/Max: {minTemperature}°{temperatureUnit} / {maxTemperature}°{temperatureUnit}</p>;
}

function WindAlertBanner({ maxWindSpeed }: { maxWindSpeed?: number }) {
    if (maxWindSpeed === undefined || maxWindSpeed < 31) return null;

    const description = getWindDescription(maxWindSpeed);
    return (
        <div className="weather-alert-banner" role="status" aria-live="polite">
            <span className="weather-alert-label">Wind Alert</span>
            <span className="weather-alert-text">{description} gusts up to {maxWindSpeed.toFixed(1)} mph</span>
        </div>
    );
}

function WindDisplay({ averageWindSpeed, maxWindSpeed }: { averageWindSpeed?: number; maxWindSpeed?: number }) {
    if (averageWindSpeed === undefined || maxWindSpeed === undefined) return null;
    if (maxWindSpeed < 20) return null; // don't display anything for light winds
    const description = getWindDescription(maxWindSpeed);
    return <p className="weather-supporting-text">{description}: {averageWindSpeed.toFixed(1)} / {maxWindSpeed.toFixed(1)} mph</p>;
}

function PrecipitationDisplay({ probabilityOfPrecipitation, precipitationType, precipitationStartTime }: { probabilityOfPrecipitation?: number; precipitationType?: string; precipitationStartTime?: Date }) {
    if (probabilityOfPrecipitation === undefined || probabilityOfPrecipitation <= 0) return null;
    const startTimeString = precipitationStartTime ? ` (~${precipitationStartTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })})` : '';
    return <p className="weather-supporting-text">{formatPrecipitationType(precipitationType)}: {probabilityOfPrecipitation}%{startTimeString}</p>;
}

interface WeatherCardProps {
    city: string;
    currentWeather: WeatherData | null;
    forecast4pm: WeatherData | null;
    isExpanded: boolean;
    onToggleExpanded: () => void;
}

const WeatherCard: React.FC<WeatherCardProps> = ({ city, currentWeather, forecast4pm, isExpanded, onToggleExpanded }) => {
    if (!currentWeather) {
        return (
            <button type="button" className="weather-card" onClick={onToggleExpanded} aria-expanded={isExpanded} aria-controls="weather-details-drawer">
                <div className="weather-card-header-row">
                    <h3 className="weather-title">{city}</h3>
                    <ExpandIndicator isExpanded={isExpanded} />
                </div>
                <p>Loading weather...</p>
            </button>
        );
    }

    return (
        <button type="button" className="weather-card" onClick={onToggleExpanded} aria-expanded={isExpanded} aria-controls="weather-details-drawer">
            <div className="weather-card-header-row">
                <h3 className="weather-title">{city}</h3>
                <ExpandIndicator isExpanded={isExpanded} />
            </div>
            <WindAlertBanner maxWindSpeed={currentWeather.maxWindSpeed} />
            <div className="weather-details-container">
                <div className="weather-details-column weather-details-column-current">
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
        </button>
    );
};

interface WeatherCardDisplayProps {
    currentWeather: WeatherData | null;
    forecast4pm: WeatherData | null;
    isExpanded: boolean;
    onToggleExpanded: () => void;
}

const WeatherCardDisplay: React.FC<WeatherCardDisplayProps> = ({ currentWeather, forecast4pm, isExpanded, onToggleExpanded }) => {
    return (
        <div className="weather-display-container">
            <WeatherCard
                city="Seattle, WA"
                currentWeather={currentWeather}
                forecast4pm={forecast4pm}
                isExpanded={isExpanded}
                onToggleExpanded={onToggleExpanded}
            />
        </div>
    );
};

export default WeatherCardDisplay;
