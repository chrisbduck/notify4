import { useCallback, useEffect, useRef, useState } from 'react';
import { FaCheckCircle, FaExclamationTriangle, FaInfoCircle } from 'react-icons/fa';
import { TbAlertOctagonFilled } from 'react-icons/tb';
import { CollapsibleContent, ExpandIndicator } from './CollapsibleContent';
import { usePolling } from './hooks/usePolling';
import { getCarCommuteData, type CorridorAlert, type CorridorTravelTime } from './carCommuteService';
import './CarCommuteDisplay.css';
import { getCommuteTolls, getTollDirection, getTollDisplay, getTollNote, TOLL_ROUTES, type CommuteTolls } from './tollService';

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

    const fetchCommuteData = useCallback(async (useMockData: boolean, includeLowerPriorityAlerts: boolean) => {
        setIsLoading(true);
        setError(null);
        try {
            setCorridors(await getCarCommuteData(useMockData, includeLowerPriorityAlerts));
        } catch (fetchError) {
            setCorridors([]);
            setError('Drive data unavailable.');
        }
        setIsLoading(false);
    }, []);

    return { corridors, isLoading, error, fetchCommuteData };
}

export function usePolledCarCommuteData(useMockData: boolean, includeLowerPriorityAlerts: boolean) {
    const { corridors, isLoading, error, fetchCommuteData } = useCarCommuteData();
    const [tollResult, setTollResult] = useState<{ mock: boolean; data: CommuteTolls | null } | null>(null);
    const tollRequest = useRef(0);
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const tick = () => setNow(Date.now());
        const timer = window.setInterval(tick, 15000);
        document.addEventListener('visibilitychange', tick);
        return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', tick); };
    }, []);
    const fetchTolls = useCallback(async () => {
        const request = ++tollRequest.current;
        let data: CommuteTolls | null = null;
        try { data = await getCommuteTolls(useMockData); }
        catch { /* A toll outage must not clear corridor status. */ }
        if (request === tollRequest.current) setTollResult({ mock: useMockData, data });
    }, [useMockData]);
    const pollingFunction = useCallback(() => fetchCommuteData(useMockData, includeLowerPriorityAlerts), [fetchCommuteData, includeLowerPriorityAlerts, useMockData]);

    usePolling(pollingFunction, 300000, `car-commute:${useMockData ? 'mock' : 'live'}:${includeLowerPriorityAlerts ? 'all-alerts' : 'high-alerts'}`);
    usePolling(fetchTolls, 60000, `commute-tolls:${useMockData ? 'mock' : 'live'}`);

    const tollsLoading = !tollResult || tollResult.mock !== useMockData;
    return { corridors, isLoading, error, tolls: tollsLoading ? null : tollResult.data, tollsLoading, now };
}

type TollProps = { tolls: CommuteTolls | null; now: number; isMock: boolean };

export function CarCommuteCard({ corridors, isLoading, error, isExpanded, onToggleExpanded, tolls, tollsLoading, now, isMock }: TollProps & { corridors: CorridorTravelTime[]; isLoading: boolean; error: string | null; isExpanded: boolean; onToggleExpanded: () => void; tollsLoading: boolean }) {
    const direction = getTollDirection(new Date(now));
    const tollDisplay = getTollDisplay(tolls?.[direction], now, !isMock);
    const tollNote = tollsLoading && tollDisplay !== 'Free' ? 'Checking rate…' : getTollNote(tolls?.[direction], now, !isMock);
    const rows = corridors.length ? corridors : getPlaceholderCorridors();
    const primary = rows.find((corridor) => formatCardLabel(corridor.label) === '405') ?? getPlaceholderCorridors()[2];
    const renderStatus = (corridor: CorridorTravelTime) => (
        <div className={`car-commute-row car-commute-row-${getStatus(corridor)}`} key={corridor.label}>
            <span className="car-commute-label">{formatCardLabel(corridor.label)}</span>
            <span className="car-commute-status-word">{getStatus(corridor) === 'unavailable' ? '—' : formatCompactStatus(getStatus(corridor))}</span>
            {corridor.alertsUnavailable || !corridors.length ? <FaInfoCircle className="car-commute-alert-icon" aria-label="Alerts unavailable" /> : <AlertSeverityIcon alerts={corridor.alerts} />}
        </div>
    );
    return (
        <button type="button" className="car-commute-card" onClick={onToggleExpanded} aria-expanded={isExpanded} aria-controls="car-commute-expanded-drawer">
            <div className="car-commute-header-row">
                <h3>Drive</h3>
                <ExpandIndicator isExpanded={isExpanded} />
            </div>

            <div className="commute-toll" aria-live="polite">
                <span className="commute-toll-heading">I-405 {direction === 'northbound' ? 'NB' : 'SB'} toll{isMock ? ' · Demo' : ''}</span>
                <strong className="commute-toll-price">{tollDisplay}</strong>
                {tollNote && <span className="commute-toll-note">{tollNote}</span>}
                <span className="commute-toll-route">{TOLL_ROUTES[direction]}</span>
            </div>
            <div className="car-commute-primary" title={error ?? (isLoading ? 'Refreshing road status' : 'I-405 corridor status')}>{renderStatus(primary)}</div>
            <div className="car-commute-secondary">{rows.filter((corridor) => formatCardLabel(corridor.label) !== '405').map(renderStatus)}</div>
        </button>
    );
}

export function CarCommuteDetailsSection({ corridors, isExpanded, tolls, now, isMock }: TollProps & { corridors: CorridorTravelTime[]; isExpanded: boolean }) {
    return (
        <CollapsibleContent className="car-commute-expanded-drawer" id="car-commute-expanded-drawer" isExpanded={isExpanded}>
            <h2>Drive Corridor Health</h2>
            <section className="commute-toll-details">
                <h3>I-405 express toll lanes{isMock ? ' · Demo prices' : ''}</h3>
                <div className="commute-toll-directions">
                    {(['southbound', 'northbound'] as const).map((direction) => (
                        <div key={direction}>
                            <span>{direction === 'southbound' ? 'Morning · Southbound' : 'Afternoon · Northbound'}</span>
                            <strong>{getTollDisplay(tolls?.[direction], now, !isMock)}</strong>
                            {getTollNote(tolls?.[direction], now, !isMock) && <small>{getTollNote(tolls?.[direction], now, !isMock)}</small>}
                            <span>{TOLL_ROUTES[direction]}</span>
                            {tolls?.[direction].message && <small>Last reported sign: {tolls[direction].message}</small>}
                            {tolls?.[direction].updatedAt && <small>Updated {new Date(tolls[direction].updatedAt!).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}</small>}
                        </div>
                    ))}
                </div>
                <p>Current Good To Go! pass prices, refreshed every minute. Weekends and nights (8 p.m.–5 a.m. Pacific) show Free using the published schedule, even if the feed is delayed. During tolling hours, rates over five minutes old are hidden until refreshed. The card switches from southbound to northbound at noon Pacific. These are current rates, not a forecast; the entry sign determines your toll.</p>
                <p>Northbound assumes the Bellevue mainline entry near NE 4th St and uses the SR 522 destination zone for NE 128th / NE 160th St, beyond the NE 124th zone. Southbound assumes entry from NE 160th St, using the NE 145th toll board to Bellevue / NE 6th St. The NE 6th direct-access entry may have a different rate.</p>
                <p>Fresh closed and HOV-only messages override the free-hours schedule. Eligible carpools need a Flex Pass in HOV mode during tolling hours. <a href="https://wsdot.wa.gov/travel/roads-bridges/toll-roads-bridges-tunnels/i-405-express-toll-lanes" target="_blank" rel="noreferrer">WSDOT toll and access rules</a></p>
            </section>
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
