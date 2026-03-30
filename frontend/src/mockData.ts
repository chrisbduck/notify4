import { useState } from "react";

const MOCK_TRANSIT_DATA_KEY = 'useMockTransitAlerts';
const MOCK_WEATHER_DATA_KEY = 'useMockWeatherAlerts';
const MOCK_AQI_DATA_KEY = 'useMockAQIAlerts';

export function useMockData(key: string) {
    const [value, setValue] = useState<boolean>(() => {
        return localStorage.getItem(key) === 'true';
    });

    const setAndSave = (newValue: boolean | ((prev: boolean) => boolean)) => {
        const nextValue = typeof newValue === 'function' ? newValue(value) : newValue;
        localStorage.setItem(key, String(nextValue));
        setValue(nextValue);
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
