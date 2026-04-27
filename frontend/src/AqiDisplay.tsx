import React, { useCallback, useMemo, useState } from 'react';
import { getAqiDataForLocation, type AqiData } from './aqiService';
import { usePolling } from './hooks/usePolling';
import { CollapsibleContent, ExpandIndicator } from './CollapsibleContent';
import './AqiDisplay.css';

const AQI_CATEGORY_ORDER = [
    'Good',
    'Moderate',
    'Unhealthy for Sensitive Groups',
    'Unhealthy',
    'Very Unhealthy',
    'Hazardous',
] as const;

const getAqiCategory = (aqi: number): string => {
    if (aqi <= 50) return 'Good';
    if (aqi <= 100) return 'Moderate';
    if (aqi <= 150) return 'Unhealthy for Sensitive Groups';
    if (aqi <= 200) return 'Unhealthy';
    if (aqi <= 300) return 'Very Unhealthy';
    return 'Hazardous';
};

const getCategoryRank = (category: string): number => {
    const index = AQI_CATEGORY_ORDER.indexOf(category as (typeof AQI_CATEGORY_ORDER)[number]);
    return index === -1 ? AQI_CATEGORY_ORDER.length : index;
};

const getWorstCategory = (categories: string[]): string => {
    return categories.reduce((worst, current) => {
        if (!worst) {
            return current;
        }

        return getCategoryRank(current) > getCategoryRank(worst) ? current : worst;
    }, '');
};

const formatAqiRange = (values: number[]) => {
    if (values.length === 0) {
        return 'Range unavailable';
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    return `Range: ${min.toFixed(1)}-${max.toFixed(1)}`;
};

const formatLocationSummary = (label: string, data: AqiData | null) => {
    return `${label} ${data ? data.aqi.toFixed(1) : '--'}`;
};

interface AqiDisplayProps {
    mockData: boolean;
    isExpanded: boolean;
    onToggleExpanded: () => void;
}

interface LocationEntry {
    id: string;
    fullName: string;
    shortName: string;
    data: AqiData | null;
}

const AqiDisplay: React.FC<AqiDisplayProps> = ({ mockData, isExpanded, onToggleExpanded }: AqiDisplayProps) => {
    const [nkAqi, setNkAqi] = useState<AqiData | null>(null);
    const [sdAqi, setSdAqi] = useState<AqiData | null>(null);
    const [mtAqi, setMtAqi] = useState<AqiData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchAqiData = useCallback(async () => {
        setIsLoading(true);
        const [nkData, sdData, mtData] = await Promise.all([
            getAqiDataForLocation('north-kirkland', mockData),
            getAqiDataForLocation('seattle-downtown', mockData),
            getAqiDataForLocation('mountlake-terrace', mockData),
        ]);
        setNkAqi(nkData);
        setSdAqi(sdData);
        setMtAqi(mtData);
        setIsLoading(false);
    }, [mockData]);

    usePolling(fetchAqiData, 300000, `aqi-display:${mockData ? 'mock' : 'live'}`);

    const locations = useMemo<LocationEntry[]>(
        () => [
            { id: 'north-kirkland', fullName: 'North Kirkland', shortName: 'Kirkland', data: nkAqi },
            { id: 'seattle-downtown', fullName: 'Seattle Downtown', shortName: 'Seattle', data: sdAqi },
            { id: 'mountlake-terrace', fullName: 'Mountlake Terrace', shortName: 'Mountlake', data: mtAqi },
        ],
        [nkAqi, sdAqi, mtAqi],
    );

    const populatedLocations = locations.filter((location) => location.data !== null);
    const allAqiValues = populatedLocations.map((location) => location.data!.aqi);
    const categories = populatedLocations.map((location) => location.data!.category);
    const averageAqi = allAqiValues.length > 0
        ? allAqiValues.reduce((sum, aqi) => sum + aqi, 0) / allAqiValues.length
        : null;

    const allCategoriesMatch = categories.length > 0 && categories.every((category) => category === categories[0]);
    const summaryCategory = averageAqi === null
        ? (isLoading ? 'Loading' : 'Not Available')
        : allCategoriesMatch
            ? getAqiCategory(averageAqi)
            : getWorstCategory(categories);

    const summaryLocationLine = locations
        .map((location) => formatLocationSummary(location.shortName, location.data))
        .join(' · ');

    const summaryRangeLine = formatAqiRange(allAqiValues);

    return (
        <>
            <button
                type="button"
                className="aqi-combined-card"
                onClick={onToggleExpanded}
                aria-expanded={isExpanded}
                aria-controls="aqi-expanded-drawer"
            >
                <div className="aqi-card-layout">
                    <div className="aqi-header-row">
                        <h3>Air Quality</h3>
                        <ExpandIndicator isExpanded={isExpanded} />
                    </div>

                    <div className="aqi-main-content">
                        {isLoading ? (
                            <p className="aqi-summary-loading">Loading AQI data...</p>
                        ) : averageAqi !== null ? (
                            <>
                                <div className={`aqi-circle aqi-circle-${summaryCategory.toLowerCase().replace(/\s/g, '-')}`}></div>
                                <p className="aqi-value">{averageAqi.toFixed(1)}</p>
                                <p className="aqi-category aqi-category-summary">{summaryCategory}</p>
                                <p className="aqi-summary-line">{summaryLocationLine}</p>
                                <p className="aqi-summary-line aqi-range-line">{summaryRangeLine}</p>
                            </>
                        ) : (
                            <>
                                <p className="aqi-value">--</p>
                                <p className="aqi-category aqi-category-summary">Not Available</p>
                                <p className="aqi-summary-line">{summaryLocationLine}</p>
                            </>
                        )}
                    </div>
                </div>
            </button>

            <CollapsibleContent className="aqi-expanded-drawer" id="aqi-expanded-drawer" isExpanded={isExpanded}>
                <div className="aqi-expanded-grid">
                    {locations.map((location) => (
                        <article className="aqi-station-card" key={location.id}>
                            <div className="aqi-station-header">
                                <span className="aqi-location-name aqi-location-full">{location.fullName}</span>
                                <span className="aqi-location-name aqi-location-short">{location.shortName}</span>
                            </div>

                            {location.data ? (
                                <>
                                    <div className="aqi-station-reading">
                                        <p className="aqi-station-value">{location.data.aqi.toFixed(1)}</p>
                                        <div className="aqi-station-meta">
                                            <span className={`aqi-dot aqi-circle-${location.data.category.toLowerCase().replace(/\s/g, '-')}`}></span>
                                            <span className="aqi-station-category">{location.data.category}</span>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <p className="aqi-station-loading">Unavailable</p>
                            )}
                        </article>
                    ))}
                </div>
            </CollapsibleContent>
        </>
    );
};

export default AqiDisplay;
