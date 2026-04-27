import React, { useCallback, useState } from 'react';
import { CollapsibleContent, ExpandIndicator } from './CollapsibleContent';
import { usePolling } from './hooks/usePolling';
import { getCarCommuteData, type CorridorTravelTime } from './carCommuteService';
import './CarCommuteDisplay.css';

type CorridorStatus = 'fast' | 'average' | 'slow' | 'heavy' | 'unavailable';

function getStatus(corridor: CorridorTravelTime): CorridorStatus {
    if (corridor.currentMinutes === null || corridor.averageMinutes === null || corridor.delayMinutes === null) return 'unavailable';
    if (corridor.averageMinutes <= 0) return 'unavailable';

    const ratio = corridor.currentMinutes / corridor.averageMinutes;
    if (ratio <= 0.85) return 'fast';
    if (ratio <= 1.15) return 'average';
    if (ratio <= 1.5) return 'slow';
    return 'heavy';
}

function formatMinutes(minutes: number | null) {
    return minutes === null ? '--' : `${minutes} min`;
}

function formatDelay(delayMinutes: number | null) {
    if (delayMinutes === null) return '';
    if (delayMinutes <= 0) return '(on avg)';
    return `(+${delayMinutes})`;
}

function formatStatus(status: CorridorStatus) {
    switch (status) {
        case 'fast':
            return 'Fast';
        case 'average':
            return 'Average';
        case 'slow':
            return 'Slow';
        case 'heavy':
            return 'Very slow';
        default:
            return 'Unavailable';
    }
}

export function useCarCommuteData() {
    const [corridors, setCorridors] = useState<CorridorTravelTime[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchCommuteData = useCallback(async () => {
        setIsLoading(true);
        setCorridors(await getCarCommuteData());
        setIsLoading(false);
    }, []);

    usePolling(fetchCommuteData, 300000, 'car-commute');

    return { corridors, isLoading };
}

export function CarCommuteCard({ corridors, isLoading, isExpanded, onToggleExpanded }: { corridors: CorridorTravelTime[]; isLoading: boolean; isExpanded: boolean; onToggleExpanded: () => void }) {
    return (
        <button type="button" className="car-commute-card" onClick={onToggleExpanded} aria-expanded={isExpanded} aria-controls="car-commute-expanded-drawer">
            <div className="car-commute-header-row">
                <h3>Drive</h3>
                <ExpandIndicator isExpanded={isExpanded} />
            </div>

            {isLoading && <p className="car-commute-summary">Loading travel times...</p>}

            <div className="car-commute-list">
                {(corridors.length ? corridors : ['520', 'I-90', '405', 'I-5'].map((label) => ({ id: null, label, currentMinutes: null, averageMinutes: null, delayMinutes: null, distanceMiles: null }))).map((corridor) => {
                    const status = getStatus(corridor);
                    return (
                        <div className={`car-commute-row car-commute-row-${status}`} key={corridor.label}>
                            <span className="car-commute-label">{corridor.label.replace('SR-', '').replace('I-', '')}</span>
                            <span className="car-commute-status-word">{formatStatus(status)}</span>
                        </div>
                    );
                })}
            </div>
        </button>
    );
}

export function CarCommuteDetailsSection({ corridors, isExpanded }: { corridors: CorridorTravelTime[]; isExpanded: boolean }) {
    return (
        <CollapsibleContent className="car-commute-expanded-drawer" id="car-commute-expanded-drawer" isExpanded={isExpanded}>
            <h2>Drive Corridor Health</h2>
            <div className="car-commute-detail-grid">
                {corridors.map((corridor) => {
                    const status = getStatus(corridor);
                    return (
                        <article className={`car-commute-detail-card car-commute-detail-card-${status}`} key={corridor.label}>
                            <div className="car-commute-detail-header">
                                <h3>{corridor.label}</h3>
                                <span className={`car-commute-status car-commute-status-${status}`}>{formatStatus(status)}</span>
                            </div>
                            <dl className="car-commute-detail-list">
                                <div>
                                    <dt>Current</dt>
                                    <dd>{formatMinutes(corridor.currentMinutes)}</dd>
                                </div>
                                <div>
                                    <dt>Average</dt>
                                    <dd>{formatMinutes(corridor.averageMinutes)}</dd>
                                </div>
                                <div>
                                    <dt>Delay</dt>
                                    <dd>{corridor.delayMinutes === null ? '--' : `${corridor.delayMinutes} min`}</dd>
                                </div>
                                <div>
                                    <dt>Distance</dt>
                                    <dd>{corridor.distanceMiles === null ? '--' : `${Number(corridor.distanceMiles).toFixed(1)} mi`}</dd>
                                </div>
                            </dl>
                        </article>
                    );
                })}
                {!corridors.length && <p className="car-commute-empty">Travel times are unavailable.</p>}
            </div>
        </CollapsibleContent>
    );
}
