import { useState } from "react";

const MOCK_TRANSIT_DATA_KEY = 'useMockTransitAlerts';
const MOCK_WEATHER_DATA_KEY = 'useMockWeatherAlerts';
const MOCK_AQI_DATA_KEY = 'useMockAQIAlerts';

export function useMockData(key: string) {
    const [value, setValue] = useState<boolean>(() => {
        return localStorage.getItem(key) === 'true';
    });

    const setAndSave = (newValue: boolean | ((prev: boolean) => boolean)) => {
        setValue((currentValue) => {
            const nextValue = typeof newValue === 'function' ? newValue(currentValue) : newValue;
            localStorage.setItem(key, String(nextValue));
            return nextValue;
        });
    };

    return [value, setAndSave] as const;
}

export function useShouldUseMockTransitData() {
    return useMockData(MOCK_TRANSIT_DATA_KEY);
}

export function useShouldUseMockWeatherData() {
    return useMockData(MOCK_WEATHER_DATA_KEY);
}

export function useShouldUseMockAQIData() {
    return useMockData(MOCK_AQI_DATA_KEY);
}
