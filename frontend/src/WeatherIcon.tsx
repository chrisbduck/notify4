import React from 'react';
import {
    WiDaySunny,
    WiDayCloudy,
    WiDayRain,
    WiDayShowers,
    WiDayHaze,
    WiDayThunderstorm,
    WiNightClear,
    WiNightAltCloudy,
    WiNightAltRain,
    WiNightAltShowers,
    WiNightAltThunderstorm,
    WiCloud,
    WiCloudy,
    WiRain,
    WiShowers,
    WiThunderstorm,
    WiFog,
    WiSnow,
    WiSleet,
    WiNa
} from 'react-icons/wi';

const iconMap: { [key: string]: React.ElementType } = {
    'wi-day-sunny': WiDaySunny,
    'wi-day-cloudy': WiDayCloudy,
    'wi-day-rain': WiDayRain,
    'wi-day-showers': WiDayShowers,
    'wi-day-haze': WiDayHaze,
    'wi-day-thunderstorm': WiDayThunderstorm,
    'wi-night-clear': WiNightClear,
    'wi-night-alt-cloudy': WiNightAltCloudy,
    'wi-night-alt-rain': WiNightAltRain,
    'wi-night-alt-showers': WiNightAltShowers,
    'wi-night-alt-thunderstorm': WiNightAltThunderstorm,
    'wi-cloud': WiCloud,
    'wi-cloudy': WiCloudy,
    'wi-rain': WiRain,
    'wi-showers': WiShowers,
    'wi-thunderstorm': WiThunderstorm,
    'wi-fog': WiFog,
    'wi-snow': WiSnow,
    'wi-sleet': WiSleet,
};

const colorMap: { [key: string]: string } = {
    'sunny': '#FFD700', // Gold
    'clear': '#E0E0E0', // Light Gray for night
    'rain': '#5CACEE',  // SteelBlue2
    'showers': '#5CACEE',// SteelBlue2
    'thunder': '#972EFF',// Bright Purple
    'snow': '#B0E2FF',  // LightSkyBlue1
    'sleet': '#B0E2FF', // LightSkyBlue1
    'cloud': '#B0C4DE', // LightSteelBlue
    'haze': '#F0E68C',  // Khaki
    'fog': '#B0C4DE',   // LightSteelBlue
};

const getColorForIcon = (iconName: string): string | undefined => {
    if (iconName.includes('day') && (iconName.includes('sunny') || iconName.includes('clear'))) {
        return colorMap['sunny'];
    }
    for (const key in colorMap) {
        if (iconName.includes(key)) return colorMap[key];
    }
};

export const WeatherIcon: React.FC<{ iconName: string; className?: string }> = ({ iconName, className }) => {
    const IconComponent = iconMap[iconName] || WiNa;
    const color = getColorForIcon(iconName);
    return <IconComponent className={className} style={{ color }} />;
};