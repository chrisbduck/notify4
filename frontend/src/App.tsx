import { useEffect, useState, useCallback, useRef } from 'react';
import './App.css';
import WeatherCardDisplay from './WeatherCardDisplay';
import AlertSummaryCard from './AlertSummaryCard';
import AqiDisplay from './AqiDisplay';
import { CarCommuteCard, CarCommuteDetailsSection, useCarCommuteData } from './CarCommuteDisplay';
import { fetchAndProcessAlerts } from './alertService';
import { type AlertModel } from './model';
import { usePolling } from './hooks/usePolling';
import { TransitAlertsSection } from './TransitAlertsSection';
import { getSeattleWeather, isBefore2PM, type WeatherData } from './weatherService';
import { WeatherDetailsSection } from './WeatherDetailsSection';
import { useShouldUseMockAQIData, useShouldUseMockTransitData, useShouldUseMockWeatherData } from './mockData';
import { MockDataToggle } from './MockDataToggle';

interface EndpointResult {
    status: 'idle' | 'loading' | 'success' | 'error';
    label: string;
    successText?: string;
    body?: unknown;
    error?: string;
}

interface EndpointCallOptions {
    method?: 'GET' | 'POST';
    payload?: unknown;
    getSuccessText?: (body: unknown) => string;
}

const ADMIN_PANEL_STORAGE_KEY = 'notify4AdminPanelExpanded';

function getStringPropertyOrDefault(obj: unknown, propName: string, defaultValue: string): string {
    if (typeof obj === 'object' && obj !== null && propName in obj && typeof obj[propName as keyof typeof obj] === 'string') {
        return obj[propName as keyof typeof obj] as string;
    }
    return defaultValue;
}

function AdminTestingPanel({
    shouldUseMockTransitData,
    shouldUseMockWeatherData,
    shouldUseMockAQIData,
    onToggleTransitMock,
    onToggleWeatherMock,
    onToggleAqiMock,
}: {
    shouldUseMockTransitData: boolean;
    shouldUseMockWeatherData: boolean;
    shouldUseMockAQIData: boolean;
    onToggleTransitMock: () => void;
    onToggleWeatherMock: () => void;
    onToggleAqiMock: () => void;
}) {
    const downloadAlertsMessageRef = useRef<HTMLTextAreaElement | null>(null);
    const [isExpanded, setIsExpanded] = useState<boolean>(() => {
        return localStorage.getItem(ADMIN_PANEL_STORAGE_KEY) === 'true';
    });
    const [results, setResults] = useState<Record<string, EndpointResult>>({
        test1: { status: 'idle', label: 'Test endpoint' },
        downloadAlerts: { status: 'idle', label: 'Save alerts for future inspection' },
        health: { status: 'idle', label: 'Health check' },
        wsdotCatalog: { status: 'idle', label: 'WSDOT travel-time catalog' },
    });
    const [downloadAlertsMessage, setDownloadAlertsMessage] = useState('');

    const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    useEffect(() => {
        localStorage.setItem(ADMIN_PANEL_STORAGE_KEY, String(isExpanded));
    }, [isExpanded]);

    useEffect(() => {
        const textarea = downloadAlertsMessageRef.current;
        if (!textarea) return;

        if (!downloadAlertsMessage.trim()) {
            textarea.style.height = '';
            return;
        }

        textarea.style.height = '0px';
        textarea.style.height = `${textarea.scrollHeight}px`;
    }, [downloadAlertsMessage]);

    const callEndpoint = async (
        key: string,
        label: string,
        path: string,
        options: EndpointCallOptions = {},
    ) => {
        setResults((current) => ({ ...current, [key]: { status: 'loading', label } }));

        try {
            const response = await fetch(path, {
                method: options.method ?? 'GET',
                headers: options.payload ? { 'Content-Type': 'application/json' } : undefined,
                body: options.payload ? JSON.stringify(options.payload) : undefined,
            });
            const contentType = response.headers.get('content-type') ?? '';
            const body = contentType.includes('application/json') ? await response.json() : await response.text();

            if (!response.ok) {
                throw new Error(typeof body === 'string' ? body : `HTTP error ${response.status}`);
            }

            setResults((current) => ({
                ...current,
                [key]: { status: 'success', label, body, successText: options.getSuccessText?.(body) },
            }));
        } catch (error) {
            setResults((current) => ({
                ...current,
                [key]: { status: 'error', label, error: error instanceof Error ? error.message : String(error) },
            }));
        }
    };

    return (
        <section className="admin-panel">
            <button
                className="admin-panel-toggle"
                onClick={() => setIsExpanded((expanded) => !expanded)}
                aria-expanded={isExpanded}
                aria-controls="admin-panel-body"
            >
                <span>Admin / Testing</span>
                <span className={`admin-panel-chevron ${isExpanded ? 'expanded' : ''}`}>▾</span>
            </button>

            {isExpanded && (
                <div className="admin-panel-body" id="admin-panel-body">
                    <div className="admin-actions">
                        <div className="admin-action-buttons">
                            {isLocalHost && (
                                <button onClick={() => callEndpoint('test1', 'Test endpoint', '/api/test1')}>
                                    Run `test1`
                                </button>
                            )}
                            <button
                                onClick={() =>
                                    callEndpoint('health', 'Health check', '/api/health', {
                                        getSuccessText: (body) => {
                                            return getStringPropertyOrDefault(body, 'status', 'Health check succeeded.');
                                        },
                                    })
                                }
                            >
                                Run health check
                            </button>
                            <button onClick={() => callEndpoint('wsdotCatalog', 'WSDOT travel-time catalog', '/api/wsdot/travel-times/catalog')}>
                                Run WSDOT catalog
                            </button>
                        </div>
                        <div className="admin-action-group">
                            <label className="admin-input-label" htmlFor="download-alerts-message">
                                Save alerts for future inspection
                            </label>
                            <div className="admin-action-input-row">
                                <div className="admin-textarea-wrap">
                                    <textarea
                                        ref={downloadAlertsMessageRef}
                                        id="download-alerts-message"
                                        value={downloadAlertsMessage}
                                        onChange={(event) => setDownloadAlertsMessage(event.target.value)}
                                        aria-label="Optional note about why these alerts matter"
                                        rows={1}
                                    />
                                    {!downloadAlertsMessage && (
                                        <span className="admin-textarea-placeholder">
                                            Optional note about why these alerts matter
                                        </span>
                                    )}
                                </div>
                                <button
                                    onClick={() =>
                                        callEndpoint(
                                            'downloadAlerts',
                                            'Save alerts for future inspection',
                                            '/api/download-alerts',
                                            {
                                                method: 'POST',
                                                payload: { message: downloadAlertsMessage.trim() || undefined },
                                                getSuccessText: (body) => {
                                                    return getStringPropertyOrDefault(body, 'message', 'Alerts saved for future inspection.');
                                                },
                                            },
                                        )
                                    }
                                >
                                    Save alerts
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="admin-results">
                        {Object.entries(results)
                            .filter(([key]) => isLocalHost || key !== 'test1')
                            .map(([key, result]) => (
                                <div className="admin-result-card" key={key}>
                                    <div className="admin-result-header">
                                        <h3>{result.label}</h3>
                                        <span className={`status-pill status-${result.status}`}>{result.status}</span>
                                    </div>
                                    {result.status === 'idle' && <p>Run this action to inspect the current response.</p>}
                                    {result.status === 'loading' && <p>Request in progress...</p>}
                                    {result.status === 'error' && <p className="admin-error">{result.error}</p>}
                                    {result.status === 'success' && (
                                        result.successText ? (
                                            <p className="admin-success-text">{result.successText}</p>
                                        ) : (
                                            <pre>{JSON.stringify(result.body, null, 2)}</pre>
                                        )
                                    )}
                                </div>
                            ))}
                    </div>

                    {isLocalHost && (
                        <div className="admin-mocks">
                            <div className="admin-mocks-header">
                                <h3>Local Mock Data</h3>
                                <p>These toggles are only available on localhost.</p>
                            </div>
                            <div className="mock-toggle-row">
                                <MockDataToggle
                                    enabled={shouldUseMockTransitData}
                                    onToggle={onToggleTransitMock}
                                    label="Mock Transit Data"
                                />
                                <MockDataToggle
                                    enabled={shouldUseMockWeatherData}
                                    onToggle={onToggleWeatherMock}
                                    label="Mock Weather Data"
                                />
                                <MockDataToggle
                                    enabled={shouldUseMockAQIData}
                                    onToggle={onToggleAqiMock}
                                    label="Mock AQI Data"
                                />
                            </div>
                            <div className="mock-state-summary">
                                <span>Transit: {shouldUseMockTransitData ? 'mock' : 'live'}</span>
                                <span>Weather: {shouldUseMockWeatherData ? 'mock' : 'live'}</span>
                                <span>AQI: {shouldUseMockAQIData ? 'mock' : 'live'}</span>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}

function App() {
    const [alerts, setAlerts] = useState<AlertModel[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [lastFetched, setLastFetched] = useState<string | null>(null);
    const [shouldUseMockTransitData, setShouldUseMockTransitData] = useShouldUseMockTransitData();
    const [shouldUseMockWeatherData, setShouldUseMockWeatherData] = useShouldUseMockWeatherData();
    const [shouldUseMockAQIData, setShouldUseMockAQIData] = useShouldUseMockAQIData();
    const [isWeatherDetailsExpanded, setIsWeatherDetailsExpanded] = useState(false);
    const [isAqiDetailsExpanded, setIsAqiDetailsExpanded] = useState(false);
    const [isCarCommuteDetailsExpanded, setIsCarCommuteDetailsExpanded] = useState(false);
    const { corridors: carCommuteCorridors, isLoading: isCarCommuteLoading } = useCarCommuteData();

    const [seattleWeather, setSeattleWeather] = useState<WeatherData | null>(null);
    const [seattleWeather4pm, setSeattleWeather4pm] = useState<WeatherData | null>(null);

    const fetchSeattleWeather = useCallback(async () => {
        setSeattleWeather(await getSeattleWeather(shouldUseMockWeatherData));
        if (isBefore2PM()) {
            const fourPM = new Date();
            fourPM.setHours(16, 0, 0, 0);
            setSeattleWeather4pm(await getSeattleWeather(shouldUseMockWeatherData, fourPM));
            return;
        }
        setSeattleWeather4pm(null);
    }, [shouldUseMockWeatherData]);

    usePolling(fetchSeattleWeather, 300000, `seattle-weather:${shouldUseMockWeatherData ? 'mock' : 'live'}`);

    const fetchAlerts = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const nextAlerts: AlertModel[] = await fetchAndProcessAlerts(shouldUseMockTransitData);
            setAlerts(nextAlerts);
            setLastFetched(new Date().toLocaleTimeString());
        } catch (fetchError) {
            setError('Failed to fetch alerts.');
            console.error('Error fetching alerts:', fetchError);
        } finally {
            setLoading(false);
        }
    }, [shouldUseMockTransitData]);

    usePolling(fetchAlerts, 60000, `alerts:${shouldUseMockTransitData ? 'mock' : 'live'}`);

    return (
        <div className="app-shell">
            <header className="app-header">
                <div className="app-header-copy">
                    <p className="eyebrow">Notify4</p>
                    <h1>Alerts for Chris</h1>
                </div>
            </header>

            <div className="status-bar" aria-live="polite">
                {loading ? (
                    <p className="status-pill-text">Refreshing alerts...</p>
                ) : lastFetched ? (
                    <p className="status-pill-text">Updated {lastFetched}</p>
                ) : null}
            </div>

            <section className="main-content-cards">
                <AlertSummaryCard loading={loading} alerts={alerts} />
                <CarCommuteCard corridors={carCommuteCorridors} isLoading={isCarCommuteLoading} isExpanded={isCarCommuteDetailsExpanded} onToggleExpanded={() => setIsCarCommuteDetailsExpanded((expanded) => !expanded)} />
                <WeatherCardDisplay currentWeather={seattleWeather} forecast4pm={seattleWeather4pm} isExpanded={isWeatherDetailsExpanded} onToggleExpanded={() => setIsWeatherDetailsExpanded((expanded) => !expanded)} />
                <AqiDisplay mockData={shouldUseMockAQIData} isExpanded={isAqiDetailsExpanded} onToggleExpanded={() => setIsAqiDetailsExpanded((expanded) => !expanded)} />
            </section>

            <main className="dashboard-sections">
                {error && <p className="page-error">{error}</p>}
                <CarCommuteDetailsSection corridors={carCommuteCorridors} isExpanded={isCarCommuteDetailsExpanded} />
                <WeatherDetailsSection currentWeather={seattleWeather} forecast4pm={seattleWeather4pm} isExpanded={isWeatherDetailsExpanded} />
                <TransitAlertsSection loading={loading} alerts={alerts} />
            </main>

            <AdminTestingPanel
                shouldUseMockTransitData={shouldUseMockTransitData}
                shouldUseMockWeatherData={shouldUseMockWeatherData}
                shouldUseMockAQIData={shouldUseMockAQIData}
                onToggleTransitMock={() => setShouldUseMockTransitData((value) => !value)}
                onToggleWeatherMock={() => setShouldUseMockWeatherData((value) => !value)}
                onToggleAqiMock={() => setShouldUseMockAQIData((value) => !value)}
            />
        </div>
    );
}

export default App;
