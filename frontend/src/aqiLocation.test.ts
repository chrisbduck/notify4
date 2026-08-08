import { afterEach, describe, expect, it, vi } from 'vitest';
import { findClosestStation, getCurrentDeviceLocation, type Coordinates } from './aqiLocation';

const stations = [
    { id: 'north-kirkland', latitude: 47.71437, longitude: -122.19851 },
    { id: 'seattle-downtown', latitude: 47.60481, longitude: -122.34049 },
    { id: 'mountlake-terrace', latitude: 47.79584, longitude: -122.293365 },
];

describe('findClosestStation', () => {
    it.each([
        ['north-kirkland', stations[0]],
        ['seattle-downtown', stations[1]],
        ['mountlake-terrace', stations[2]],
    ])('selects %s for a location at that station', (expectedId, location) => {
        expect(findClosestStation(location, stations)?.id).toBe(expectedId);
    });

    it('keeps the first station when two stations are the same distance away', () => {
        const location: Coordinates = { latitude: 0, longitude: 0 };
        const equidistantStations = [
            { id: 'east', latitude: 0, longitude: 1 },
            { id: 'west', latitude: 0, longitude: -1 },
        ];
        expect(findClosestStation(location, equidistantStations)?.id).toBe('east');
    });
});

describe('getCurrentDeviceLocation', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('returns null when geolocation is unsupported', async () => {
        vi.stubGlobal('navigator', {});
        await expect(getCurrentDeviceLocation()).resolves.toBeNull();
    });

    it('returns null when location access fails', async () => {
        vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: (_success: PositionCallback, failure: PositionErrorCallback) => failure({} as GeolocationPositionError) } });
        await expect(getCurrentDeviceLocation()).resolves.toBeNull();
    });
});
