import { apiFetch } from './apiFetch';
import mockNorthKirklandData from './testdata/aqi/mockNorthKirkland.json';
import mockMountlakeTerraceData from './testdata/aqi/mockMountlakeTerrace.json';
import mockSeattleData from './testdata/aqi/mockSeattleDowntown.json';

interface AqiApiResponse {
    sensor: string;
    sensor_index: number;
    pm_field: string;
    pm25: number;
    aqi: number;
    category: string;
    last_seen: number;
    fetched_at: number;
}

export interface AqiData {
    aqi: number;
    category: string;
}

async function _fetchData(locationKey: string, mockData: boolean): Promise<AqiApiResponse> {
    if (mockData) {
        if (locationKey === 'north-kirkland') {
            return mockNorthKirklandData as AqiApiResponse;
        } else if (locationKey === 'mountlake-terrace') {
            return mockMountlakeTerraceData as AqiApiResponse;
        } else {
            return mockSeattleData as AqiApiResponse;
        }
    }

    const response = await apiFetch(`aqi?sensor=${locationKey}`);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
}

export const getAqiDataForLocation = async (locationKey: string, mockData: boolean): Promise<AqiData | null> => {
    try {
        const data: AqiApiResponse = await _fetchData(locationKey, mockData);

        return {
            aqi: data.aqi,
            category: data.category,
        };
    } catch (error) {
        console.error(`Error fetching AQI data for ${locationKey}:`, error);
        return null;
    }
};
