import { useEffect, useRef, useCallback } from 'react';

type PollingFunction = () => Promise<void>;

export const usePolling = (pollingFunction: PollingFunction, interval: number = 60000) => {
    const lastFetchTimestamp = useRef<number>(0);
    const intervalIdRef = useRef<number | null>(null);
    const refreshQueued = useRef<boolean>(false);

    const executePolling = useCallback(async () => {
        const now = Date.now();
        if (now - lastFetchTimestamp.current < interval && lastFetchTimestamp.current !== 0) return;
        await pollingFunction();
        lastFetchTimestamp.current = now;
    }, [pollingFunction, interval]);

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
    }, [executePolling, interval]);
};