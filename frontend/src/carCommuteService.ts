import { apiFetch } from './apiFetch';

export interface RoadwayLocation {
    description?: string | null;
    direction?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    milepost?: number | null;
    roadName?: string | null;
}

export interface CorridorAlert {
    id: number | string | null;
    corridorLabel: string;
    category?: string | null;
    priority?: string | null;
    headline?: string | null;
    description?: string | null;
    status?: string | null;
    updatedAt?: string | null;
    start?: RoadwayLocation | null;
    end?: RoadwayLocation | null;
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
    alerts: CorridorAlert[];
    alertsUnavailable?: boolean;
}

interface TravelTimesResponse {
    corridors: CorridorTravelTime[];
}

interface HighwayAlertsResponse {
    alerts: CorridorAlert[];
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
        alerts: [
            {
                id: 5201,
                corridorLabel: 'SR-520',
                category: 'Collision',
                priority: 'High',
                headline: 'Blocking right lane near Montlake Blvd.',
                status: 'Open',
                updatedAt: new Date().toISOString(),
            },
        ],
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
        alerts: [],
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
        alerts: [],
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
        alerts: [
            {
                id: 501,
                corridorLabel: 'I-5 Downtown',
                category: 'Disabled Vehicle',
                priority: 'Medium',
                headline: 'Vehicle on shoulder near Mercer St.',
                status: 'Open',
                updatedAt: new Date().toISOString(),
            },
            {
                id: 502,
                corridorLabel: 'I-5 Downtown',
                category: 'Maintenance',
                priority: 'Low',
                headline: 'Short-term lane restriction near downtown Seattle.',
                status: 'Open',
                updatedAt: new Date().toISOString(),
            },
        ],
    },
];

const isLocalHost = () => window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

function withEmptyAlerts(corridors: CorridorTravelTime[]): CorridorTravelTime[] {
    return corridors.map((corridor) => ({ ...corridor, alerts: corridor.alerts ?? [] }));
}

function mergeAlertsIntoCorridors(corridors: CorridorTravelTime[], alerts: CorridorAlert[], alertsUnavailable = false): CorridorTravelTime[] {
    return corridors.map((corridor) => ({
        ...corridor,
        alerts: alerts.filter((alert) => alert.corridorLabel === corridor.label),
        alertsUnavailable,
    }));
}

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
        const corridors = withEmptyAlerts(body.corridors);

        try {
            const alertsResponse = await apiFetch('/wsdot/highway-alerts');
            if (!alertsResponse.ok) {
                throw new Error(`HTTP error ${alertsResponse.status}`);
            }
            const alertsBody: HighwayAlertsResponse = await alertsResponse.json();
            return mergeAlertsIntoCorridors(corridors, alertsBody.alerts ?? []);
        } catch (error) {
            console.error('Error fetching WSDOT highway alerts:', error);
            return mergeAlertsIntoCorridors(corridors, [], true);
        }
    } catch (error) {
        if (isLocalHost()) {
            return MOCK_CORRIDORS;
        }
        console.error('Error fetching WSDOT travel times:', error);
        return [];
    }
}
