import { type ReactNode, useEffect, useRef, useState } from 'react';
import { isLocalHost } from './localEnvironment';
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

export function AdminTestingPanel({
    shouldUseMockTransitData,
    shouldUseMockWeatherData,
    shouldUseMockAQIData,
    shouldUseMockCarCommuteData,
    onToggleTransitMock,
    onToggleWeatherMock,
    onToggleAqiMock,
    onToggleCarCommuteMock,
}: {
    shouldUseMockTransitData: boolean;
    shouldUseMockWeatherData: boolean;
    shouldUseMockAQIData: boolean;
    shouldUseMockCarCommuteData: boolean;
    onToggleTransitMock: () => void;
    onToggleWeatherMock: () => void;
    onToggleAqiMock: () => void;
    onToggleCarCommuteMock: () => void;
}) {
    const downloadTransitAlertsMessageRef = useRef<HTMLTextAreaElement | null>(null);
    const downloadHighwayAlertsMessageRef = useRef<HTMLTextAreaElement | null>(null);
    const [isExpanded, setIsExpanded] = useState<boolean>(() => {
        return localStorage.getItem(ADMIN_PANEL_STORAGE_KEY) === 'true';
    });
    const [results, setResults] = useState<Record<string, EndpointResult>>({
        test1: { status: 'idle', label: 'Test endpoint' },
        downloadAlerts: { status: 'idle', label: 'Save transit alerts for future inspection' },
        downloadHighwayAlerts: { status: 'idle', label: 'Save highway alerts for future inspection' },
        health: { status: 'idle', label: 'Health check' },
        wsdotCatalog: { status: 'idle', label: 'WSDOT travel-time catalog' },
        wsdotHighwayAlerts: { status: 'idle', label: 'WSDOT highway alerts' },
    });
    const [downloadTransitAlertsMessage, setDownloadTransitAlertsMessage] = useState('');
    const [downloadHighwayAlertsMessage, setDownloadHighwayAlertsMessage] = useState('');

    const isLocal = isLocalHost();

    useEffect(() => {
        localStorage.setItem(ADMIN_PANEL_STORAGE_KEY, String(isExpanded));
    }, [isExpanded]);

    useEffect(() => {
        const textarea = downloadTransitAlertsMessageRef.current;
        if (!textarea) return;

        if (!downloadTransitAlertsMessage.trim()) {
            textarea.style.height = '';
            return;
        }

        textarea.style.height = '0px';
        textarea.style.height = `${textarea.scrollHeight}px`;
    }, [downloadTransitAlertsMessage]);

    useEffect(() => {
        const textarea = downloadHighwayAlertsMessageRef.current;
        if (!textarea) return;

        if (!downloadHighwayAlertsMessage.trim()) {
            textarea.style.height = '';
            return;
        }

        textarea.style.height = '0px';
        textarea.style.height = `${textarea.scrollHeight}px`;
    }, [downloadHighwayAlertsMessage]);

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

    const renderEndpointStatus = (key: string) => {
        const result = results[key];
        return <span className={`status-pill status-${result.status}`}>{result.status}</span>;
    };

    const renderEndpointOutput = (key: string) => {
        const result = results[key];
        if (result.status === 'idle') return null;

        return (
            <div className="admin-result-output">
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
        );
    };

    const renderActionCard = (key: string, controls: ReactNode) => {
        return (
            <div className="admin-action-card">
                <div className="admin-action-header">
                    <h3>{results[key].label}</h3>
                    {renderEndpointStatus(key)}
                </div>
                <div className="admin-action-control">{controls}</div>
                {renderEndpointOutput(key)}
            </div>
        );
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
                        {isLocal && (
                            renderActionCard(
                                'test1',
                                <>
                                    <button onClick={() => callEndpoint('test1', 'Test endpoint', '/api/test1')}>
                                        Run `test1`
                                    </button>
                                </>,
                            )
                        )}
                        {renderActionCard(
                            'health',
                            <>
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
                            </>,
                        )}
                        {renderActionCard(
                            'wsdotCatalog',
                            <>
                                <button onClick={() => callEndpoint('wsdotCatalog', 'WSDOT travel-time catalog', '/api/wsdot/travel-times/catalog')}>
                                    Run WSDOT catalog
                                </button>
                            </>,
                        )}
                        {renderActionCard(
                            'wsdotHighwayAlerts',
                            <>
                                <button onClick={() => callEndpoint('wsdotHighwayAlerts', 'WSDOT highway alerts', '/api/wsdot/highway-alerts')}>
                                    Run WSDOT highway alerts
                                </button>
                            </>,
                        )}
                        {renderActionCard(
                            'downloadAlerts',
                            <>
                                <button
                                    onClick={() =>
                                        callEndpoint(
                                            'downloadAlerts',
                                            'Save transit alerts for future inspection',
                                            '/api/download-alerts',
                                            {
                                                method: 'POST',
                                                payload: { message: downloadTransitAlertsMessage.trim() || undefined },
                                                getSuccessText: (body) => {
                                                    return getStringPropertyOrDefault(body, 'message', 'Alerts saved for future inspection.');
                                                },
                                            },
                                        )
                                    }
                                >
                                    Save transit alerts
                                </button>
                                <div className="admin-action-input-row">
                                    <div className="admin-textarea-wrap">
                                        <textarea
                                            ref={downloadTransitAlertsMessageRef}
                                            id="download-transit-alerts-message"
                                            value={downloadTransitAlertsMessage}
                                            onChange={(event) => setDownloadTransitAlertsMessage(event.target.value)}
                                            aria-label="Optional note about why these transit alerts matter"
                                            rows={1}
                                        />
                                        {!downloadTransitAlertsMessage && (
                                            <span className="admin-textarea-placeholder">
                                                Optional note about why these alerts matter
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </>,
                        )}
                        {renderActionCard(
                            'downloadHighwayAlerts',
                            <>
                                <button
                                    onClick={() =>
                                        callEndpoint(
                                            'downloadHighwayAlerts',
                                            'Save highway alerts for future inspection',
                                            '/api/wsdot/highway-alerts/log',
                                            {
                                                method: 'POST',
                                                payload: { message: downloadHighwayAlertsMessage.trim() || undefined },
                                                getSuccessText: (body) => {
                                                    return getStringPropertyOrDefault(body, 'message', 'Highway alerts saved for future inspection.');
                                                },
                                            },
                                        )
                                    }
                                >
                                    Save highway alerts
                                </button>
                                <div className="admin-action-input-row">
                                    <div className="admin-textarea-wrap">
                                        <textarea
                                            ref={downloadHighwayAlertsMessageRef}
                                            id="download-highway-alerts-message"
                                            value={downloadHighwayAlertsMessage}
                                            onChange={(event) => setDownloadHighwayAlertsMessage(event.target.value)}
                                            aria-label="Optional note about why these highway alerts matter"
                                            rows={1}
                                        />
                                        {!downloadHighwayAlertsMessage && (
                                            <span className="admin-textarea-placeholder">
                                                Optional note about why these alerts matter
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </>,
                        )}
                    </div>

                    {isLocal && (
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
                                <MockDataToggle
                                    enabled={shouldUseMockCarCommuteData}
                                    onToggle={onToggleCarCommuteMock}
                                    label="Mock Drive Data"
                                />
                            </div>
                            <div className="mock-state-summary">
                                <span>Transit: {shouldUseMockTransitData ? 'mock' : 'live'}</span>
                                <span>Weather: {shouldUseMockWeatherData ? 'mock' : 'live'}</span>
                                <span>AQI: {shouldUseMockAQIData ? 'mock' : 'live'}</span>
                                <span>Drive: {shouldUseMockCarCommuteData ? 'mock' : 'live'}</span>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}
