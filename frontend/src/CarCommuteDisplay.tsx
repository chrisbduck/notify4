import React, { useCallback, useState } from 'react';
import { FaCheckCircle, FaExclamationTriangle, FaInfoCircle } from 'react-icons/fa';
import { TbAlertOctagonFilled } from 'react-icons/tb';
import { CollapsibleContent, ExpandIndicator } from './CollapsibleContent';
import { usePolling } from './hooks/usePolling';
import { getCarCommuteData, type CorridorAlert, type CorridorTravelTime } from './carCommuteService';
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

function formatCompactStatus(status: CorridorStatus) {
    return status === 'average' ? 'Avg' : formatStatus(status);
}

function formatCardLabel(label: string) {
    if (label === 'SR-520') return '520';
    if (label === 'I-90') return '90';
    if (label === 'I-405') return '405';
    if (label === 'I-5 Downtown') return 'I-5';
    return label;
}

function formatAlertPriority(priority?: string | null) {
    if (!priority) return 'Unknown';
    return priority.charAt(0).toUpperCase() + priority.slice(1).toLowerCase();
}

function getAlertSeverity(alert: CorridorAlert) {
    const category = (alert.category ?? '').toLowerCase();
    const priority = (alert.priority ?? '').toLowerCase();
    if (priority === 'highest') return 'high';
    if (priority === 'high' || priority === 'medium' || category.includes('collision') || category.includes('closure') || category.includes('disabled')) return 'medium';
    return 'low';
}

function getWorstAlertSeverity(alerts: CorridorAlert[]) {
    if (alerts.some((alert) => getAlertSeverity(alert) === 'high')) return 'high';
    if (alerts.some((alert) => getAlertSeverity(alert) === 'medium')) return 'medium';
    if (alerts.length > 0) return 'low';
    return null;
}

function AlertSeverityIcon({ alerts }: { alerts: CorridorAlert[] }) {
    const severity = getWorstAlertSeverity(alerts);
    if (!severity) return <FaCheckCircle className="car-commute-alert-icon car-commute-alert-icon-clear" aria-label="No highway alerts" />;
    if (severity === 'high') return <TbAlertOctagonFilled className="car-commute-alert-icon car-commute-alert-icon-high" aria-label="High severity highway alert" />;
    if (severity === 'medium') return <FaExclamationTriangle className="car-commute-alert-icon car-commute-alert-icon-medium" aria-label="Medium severity highway alert" />;
    return <FaInfoCircle className="car-commute-alert-icon car-commute-alert-icon-low" aria-label="Low severity highway alert" />;
}

function getPlaceholderCorridors(): CorridorTravelTime[] {
    return ['520', '90', '405', 'I-5'].map((label) => ({ id: null, label, currentMinutes: null, averageMinutes: null, delayMinutes: null, distanceMiles: null, alerts: [] }));
}

export function useCarCommuteData() {
    const [corridors, setCorridors] = useState<CorridorTravelTime[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchCommuteData = useCallback(async (useMockData: boolean) => {
        setIsLoading(true);
        setError(null);
        try {
            setCorridors(await getCarCommuteData(useMockData));
        } catch (fetchError) {
            setCorridors([]);
            setError('Drive data unavailable.');
        }
        setIsLoading(false);
    }, []);

    return { corridors, isLoading, error, fetchCommuteData };
}

export function usePolledCarCommuteData(useMockData: boolean) {
    const { corridors, isLoading, error, fetchCommuteData } = useCarCommuteData();
    const pollingFunction = useCallback(() => fetchCommuteData(useMockData), [fetchCommuteData, useMockData]);

    usePolling(pollingFunction, 300000, `car-commute:${useMockData ? 'mock' : 'live'}`);

    return { corridors, isLoading, error };
}

export function CarCommuteCard({ corridors, isLoading, error, isExpanded, onToggleExpanded }: { corridors: CorridorTravelTime[]; isLoading: boolean; error: string | null; isExpanded: boolean; onToggleExpanded: () => void }) {
    return (
        <button type="button" className="car-commute-card" onClick={onToggleExpanded} aria-expanded={isExpanded} aria-controls="car-commute-expanded-drawer">
            <div className="car-commute-header-row">
                <h3>Drive</h3>
                <ExpandIndicator isExpanded={isExpanded} />
            </div>

            {isLoading && <p className="car-commute-summary">Loading travel times...</p>}
            {error && <p className="car-commute-error">{error}</p>}

            <div className="car-commute-list">
                {(corridors.length ? corridors : getPlaceholderCorridors()).map((corridor) => {
                    const status = getStatus(corridor);
                    return (
                        <div className={`car-commute-row car-commute-row-${status}`} key={corridor.label}>
                            <span className="car-commute-label">{formatCardLabel(corridor.label)}</span>
                            <span className="car-commute-status-word">{formatCompactStatus(status)}</span>
                            <AlertSeverityIcon alerts={corridor.alerts} />
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
                            <section className="car-commute-alerts-section">
                                <h4>Alerts</h4>
                                {corridor.alertsUnavailable ? (
                                    <p className="car-commute-alert-empty">Alerts unavailable</p>
                                ) : corridor.alerts.length === 0 ? (
                                    <p className="car-commute-alert-empty">No active alerts</p>
                                ) : (
                                    <div className="car-commute-alert-list">
                                        {corridor.alerts.map((alert) => {
                                            const severity = getAlertSeverity(alert);
                                            return (
                                                <article className={`car-commute-alert car-commute-alert-${severity}`} key={alert.id ?? `${alert.category}-${alert.headline}`}>
                                                    <div className="car-commute-alert-meta">
                                                        <span>{alert.category || 'Alert'}</span>
                                                        <span>{formatAlertPriority(alert.priority)}</span>
                                                    </div>
                                                    <p>{alert.headline || 'No headline available'}</p>
                                                </article>
                                            );
                                        })}
                                    </div>
                                )}
                            </section>
                        </article>
                    );
                })}
                {!corridors.length && <p className="car-commute-empty">Travel times are unavailable.</p>}
            </div>
        </CollapsibleContent>
    );
}
