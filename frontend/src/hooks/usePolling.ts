import { useEffect, useRef, useCallback } from 'react';

type PollingFunction = () => Promise<void>;
type PollingState = {
    lastFetchTimestamp: number;
    inFlightPromise: Promise<void> | null;
};

const pollingStateByKey = new Map<string, PollingState>();

function getPollingState(key: string): PollingState {
    const existingState = pollingStateByKey.get(key);
    if (existingState) return existingState;

    const nextState: PollingState = { lastFetchTimestamp: 0, inFlightPromise: null };
    pollingStateByKey.set(key, nextState);
    return nextState;
}

export const usePolling = (pollingFunction: PollingFunction, interval: number = 60000, pollingKey: string) => {
    const intervalIdRef = useRef<number | null>(null);
    const refreshQueued = useRef<boolean>(false);

    const executePolling = useCallback(async () => {
        const pollingState = getPollingState(pollingKey);
        if (pollingState.inFlightPromise) return await pollingState.inFlightPromise;

        const now = Date.now();
        if (now - pollingState.lastFetchTimestamp < interval && pollingState.lastFetchTimestamp !== 0) return;

        const inFlightPromise = (async () => {
            await pollingFunction();
            pollingState.lastFetchTimestamp = Date.now();
        })();

        pollingState.inFlightPromise = inFlightPromise;

        try {
            await inFlightPromise;
        } finally {
            if (pollingState.inFlightPromise === inFlightPromise) pollingState.inFlightPromise = null;
        }
    }, [pollingFunction, interval, pollingKey]);

    useEffect(() => {
        executePolling(); // Initial fetch

        const startInterval = () => {
            if (intervalIdRef.current !== null) {
                clearInterval(intervalIdRef.current);
            }
            intervalIdRef.current = setInterval(executePolling, interval) as unknown as number;
        };

        const stopInterval = () => {
            if (intervalIdRef.current !== null) {
                clearInterval(intervalIdRef.current);
                intervalIdRef.current = null;
            }
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                startInterval();
                if (refreshQueued.current) {
                    executePolling();
                    refreshQueued.current = false;
                }
            } else {
                stopInterval();
                refreshQueued.current = true;
            }
        };

        startInterval();

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            stopInterval();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [executePolling, interval, pollingKey]);
};
