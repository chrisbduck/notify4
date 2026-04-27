import { apiFetch } from './apiFetch';

export interface RoadwayLocation {
    description?: string | null;
    direction?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    milepost?: number | null;
    roadName?: string | null;
}

export interface CorridorTravelTime {
    id: number | null;
    label: string;
    name?: string | null;
    currentMinutes: number | null;
    averageMinutes: number | null;
    delayMinutes: number | null;
    distanceMiles: number | null;
    description?: string | null;
    updatedAt?: string | null;
    start?: RoadwayLocation | null;
    end?: RoadwayLocation | null;
}

interface TravelTimesResponse {
    corridors: CorridorTravelTime[];
}

const useMockCarCommute = false;

const MOCK_CORRIDORS: CorridorTravelTime[] = [
    {
        id: 520,
        label: 'SR-520',
        name: 'SR 520 corridor sample',
        currentMinutes: 18,
        averageMinutes: 12,
        delayMinutes: 6,
        distanceMiles: 7.4,
        description: 'Mock SR-520 bridge and Seattle approach corridor.',
        updatedAt: new Date().toISOString(),
    },
    {
        id: 90,
        label: 'I-90',
        name: 'I-90 corridor sample',
        currentMinutes: 24,
        averageMinutes: 21,
        delayMinutes: 3,
        distanceMiles: 10.8,
        description: 'Mock I-90 bridge and Seattle approach corridor.',
        updatedAt: new Date().toISOString(),
    },
    {
        id: 405,
        label: 'I-405',
        name: 'I-405 corridor sample',
        currentMinutes: 16,
        averageMinutes: 16,
        delayMinutes: 0,
        distanceMiles: 8.2,
        description: 'Mock I-405 connector corridor near Bellevue/Kirkland.',
        updatedAt: new Date().toISOString(),
    },
    {
        id: 5,
        label: 'I-5 Downtown',
        name: 'I-5 downtown sample',
        currentMinutes: 13,
        averageMinutes: 4,
        delayMinutes: 9,
        distanceMiles: 3.1,
        description: 'Mock I-5 downtown Seattle segment.',
        updatedAt: new Date().toISOString(),
    },
];

const isLocalHost = () => window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

export async function getCarCommuteData(): Promise<CorridorTravelTime[]> {
    if (useMockCarCommute) {
        return MOCK_CORRIDORS;
    }

    try {
        const response = await apiFetch('/wsdot/travel-times');
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }

        const body: TravelTimesResponse = await response.json();
        return body.corridors;
    } catch (error) {
        if (isLocalHost()) {
            return MOCK_CORRIDORS;
        }
        console.error('Error fetching WSDOT travel times:', error);
        return [];
    }
}
