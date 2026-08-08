export interface Coordinates {
    latitude: number;
    longitude: number;
}

export interface LocatedStation extends Coordinates {
    id: string;
}

const EARTH_RADIUS_METERS = 6_371_000;

const toRadians = (degrees: number) => degrees * Math.PI / 180;

export const distanceInMeters = (from: Coordinates, to: Coordinates): number => {
    const latitudeDelta = toRadians(to.latitude - from.latitude);
    const longitudeDelta = toRadians(to.longitude - from.longitude);
    const haversine = Math.sin(latitudeDelta / 2) ** 2
        + Math.cos(toRadians(from.latitude)) * Math.cos(toRadians(to.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
    return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
};

export const findClosestStation = <T extends LocatedStation>(location: Coordinates, stations: T[]): T | null => {
    return stations.reduce<T | null>((closest, station) => {
        if (!closest || distanceInMeters(location, station) < distanceInMeters(location, closest)) return station;
        return closest;
    }, null);
};

export const getCurrentDeviceLocation = (): Promise<Coordinates | null> => {
    if (!('geolocation' in navigator)) return Promise.resolve(null);

    return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
            (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
            () => resolve(null),
            { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
        );
    });
};
