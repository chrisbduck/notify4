import { useState, useCallback } from 'react';
import './App.css';
import { AdminTestingPanel } from './AdminTestingPanel';
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
