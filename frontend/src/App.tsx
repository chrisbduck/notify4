import { useEffect, useState, useCallback } from 'react';
import './App.css';
import WeatherCardDisplay from './WeatherCardDisplay';
import AlertSummaryCard from './AlertSummaryCard';
import AqiDisplay from './AqiDisplay';
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
    body?: unknown;
    error?: string;
}

const ADMIN_PANEL_STORAGE_KEY = 'notify4AdminPanelExpanded';

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
    const [isExpanded, setIsExpanded] = useState<boolean>(() => {
        return localStorage.getItem(ADMIN_PANEL_STORAGE_KEY) === 'true';
    });
    const [results, setResults] = useState<Record<string, EndpointResult>>({
        test1: { status: 'idle', label: 'Test endpoint' },
        downloadAlerts: { status: 'idle', label: 'Download alerts' },
        health: { status: 'idle', label: 'Health check' },
    });

    const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    useEffect(() => {
        localStorage.setItem(ADMIN_PANEL_STORAGE_KEY, String(isExpanded));
    }, [isExpanded]);

    const callEndpoint = async (key: string, label: string, path: string) => {
        setResults((current) => ({
            ...current,
            [key]: { status: 'loading', label },
        }));

        try {
            const response = await fetch(path);
            const contentType = response.headers.get('content-type') ?? '';
            const body = contentType.includes('application/json') ? await response.json() : await response.text();

            if (!response.ok) {
                throw new Error(typeof body === 'string' ? body : `HTTP error ${response.status}`);
            }

            setResults((current) => ({
                ...current,
                [key]: { status: 'success', label, body },
            }));
        } catch (error) {
            setResults((current) => ({
                ...current,
                [key]: {
                    status: 'error',
                    label,
                    error: error instanceof Error ? error.message : String(error),
                },
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
                        <button onClick={() => callEndpoint('test1', 'Test endpoint', '/api/test1')}>
                            Run `test1`
                        </button>
                        <button onClick={() => callEndpoint('downloadAlerts', 'Download alerts', '/api/download-alerts')}>
                            Run `download-alerts`
                        </button>
                        <button onClick={() => callEndpoint('health', 'Health check', '/api/health')}>
                            Run health check
                        </button>
                    </div>

                    <div className="admin-results">
                        {Object.entries(results).map(([key, result]) => (
                            <div className="admin-result-card" key={key}>
                                <div className="admin-result-header">
                                    <h3>{result.label}</h3>
                                    <span className={`status-pill status-${result.status}`}>{result.status}</span>
                                </div>
                                {result.status === 'idle' && <p>Run this action to inspect the current response.</p>}
                                {result.status === 'loading' && <p>Request in progress...</p>}
                                {result.status === 'error' && <p className="admin-error">{result.error}</p>}
                                {result.status === 'success' && (
                                    <pre>{JSON.stringify(result.body, null, 2)}</pre>
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

    usePolling(fetchSeattleWeather, 300000);

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

    usePolling(fetchAlerts, 60000);

    return (
        <div className="app-shell">
            <header className="app-header">
                <div>
                    <p className="eyebrow">Notify4</p>
                    <h1>Alerts for Chris</h1>
                    <p className="header-copy">
                        Daily transit, weather, and air quality checks with a built-in admin/testing panel.
                    </p>
                </div>
                <div className="header-meta">
                    {loading ? <p>Loading alerts...</p> : lastFetched && <p>Last updated: {lastFetched}</p>}
                </div>
            </header>

            <AdminTestingPanel
                shouldUseMockTransitData={shouldUseMockTransitData}
                shouldUseMockWeatherData={shouldUseMockWeatherData}
                shouldUseMockAQIData={shouldUseMockAQIData}
                onToggleTransitMock={() => setShouldUseMockTransitData((value) => !value)}
                onToggleWeatherMock={() => setShouldUseMockWeatherData((value) => !value)}
                onToggleAqiMock={() => setShouldUseMockAQIData((value) => !value)}
            />

            <section className="main-content-cards">
                <AlertSummaryCard loading={loading} alerts={alerts} />
                <WeatherCardDisplay currentWeather={seattleWeather} forecast4pm={seattleWeather4pm} />
                <AqiDisplay mockData={shouldUseMockAQIData} />
            </section>

            <main className="dashboard-sections">
                {error && <p className="page-error">{error}</p>}
                <WeatherDetailsSection currentWeather={seattleWeather} forecast4pm={seattleWeather4pm} />
                <TransitAlertsSection loading={loading} alerts={alerts} />
            </main>
        </div>
    );
}

export default App;
