import React, { useCallback, useMemo, useState } from 'react';
import { CollapsibleContent, ExpandIndicator } from './CollapsibleContent';
import { usePolling } from './hooks/usePolling';
import { getCarCommuteData, type CorridorTravelTime } from './carCommuteService';
import './CarCommuteDisplay.css';

function getStatus(corridor: CorridorTravelTime): 'normal' | 'slow' | 'heavy' | 'unavailable' {
    if (corridor.currentMinutes === null || corridor.averageMinutes === null || corridor.delayMinutes === null) return 'unavailable';
    if (corridor.delayMinutes <= 2) return 'normal';
    if (corridor.delayMinutes <= 7) return 'slow';
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

function formatUpdatedAt(updatedAt?: string | null) {
    if (!updatedAt) return 'Update unavailable';
    const parsed = new Date(updatedAt);
    if (Number.isNaN(parsed.getTime())) return 'Update unavailable';
    return `Updated ${parsed.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}

function getWorstStatus(corridors: CorridorTravelTime[]) {
    const statusRank = { unavailable: 0, normal: 1, slow: 2, heavy: 3 };
    return corridors.reduce<'normal' | 'slow' | 'heavy' | 'unavailable'>((worst, corridor) => {
        const current = getStatus(corridor);
        return statusRank[current] > statusRank[worst] ? current : worst;
    }, corridors.length ? 'normal' : 'unavailable');
}

function getSummaryText(status: ReturnType<typeof getWorstStatus>) {
    switch (status) {
        case 'heavy':
            return 'Heavy traffic on at least one corridor';
        case 'slow':
            return 'Some slowdown showing';
        case 'normal':
            return 'Corridors look typical';
        default:
            return 'Travel times unavailable';
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
    const worstStatus = useMemo(() => getWorstStatus(corridors), [corridors]);
    const lastUpdated = useMemo(() => {
        const updatedTimes = corridors
            .map((corridor) => corridor.updatedAt)
            .filter((value): value is string => Boolean(value))
            .map((value) => new Date(value))
            .filter((date) => !Number.isNaN(date.getTime()));
        if (updatedTimes.length === 0) return null;
        return new Date(Math.max(...updatedTimes.map((date) => date.getTime()))).toISOString();
    }, [corridors]);

    return (
        <button type="button" className="car-commute-card" onClick={onToggleExpanded} aria-expanded={isExpanded} aria-controls="car-commute-expanded-drawer">
            <div className="car-commute-header-row">
                <h3>Drive</h3>
                <ExpandIndicator isExpanded={isExpanded} />
            </div>

            <p className={`car-commute-summary car-commute-summary-${worstStatus}`}>
                {isLoading ? 'Loading travel times...' : getSummaryText(worstStatus)}
            </p>

            <div className="car-commute-list">
                {(corridors.length ? corridors : ['520', 'I-90', '405', 'I-5'].map((label) => ({ id: null, label, currentMinutes: null, averageMinutes: null, delayMinutes: null, distanceMiles: null }))).map((corridor) => {
                    const status = getStatus(corridor);
                    return (
                        <div className={`car-commute-row car-commute-row-${status}`} key={corridor.label}>
                            <span className="car-commute-label">{corridor.label.replace('SR-', '').replace('I-', '')}</span>
                            <span className="car-commute-time">{formatMinutes(corridor.currentMinutes)}</span>
                            <span className="car-commute-delay">{formatDelay(corridor.delayMinutes)}</span>
                        </div>
                    );
                })}
            </div>

            <p className="car-commute-updated">{formatUpdatedAt(lastUpdated)}</p>
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
                                <span className={`car-commute-status car-commute-status-${status}`}>{status}</span>
                            </div>
                            <p className="car-commute-route-name">{corridor.name || corridor.description || 'WSDOT route not selected'}</p>
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
                            <p className="car-commute-detail-updated">{formatUpdatedAt(corridor.updatedAt)}</p>
                        </article>
                    );
                })}
                {!corridors.length && <p className="car-commute-empty">Travel times are unavailable.</p>}
            </div>
        </CollapsibleContent>
    );
}
