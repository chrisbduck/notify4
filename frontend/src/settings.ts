import { useState } from 'react';

const SHOW_LOWER_PRIORITY_DRIVE_ALERTS_KEY = 'showLowerPriorityDriveAlerts';

export function useShouldShowLowerPriorityDriveAlerts() {
    const [value, setValue] = useState<boolean>(() => {
        return localStorage.getItem(SHOW_LOWER_PRIORITY_DRIVE_ALERTS_KEY) === 'true';
    });

    const setAndSave = (newValue: boolean | ((prev: boolean) => boolean)) => {
        setValue((currentValue) => {
            const nextValue = typeof newValue === 'function' ? newValue(currentValue) : newValue;
            localStorage.setItem(SHOW_LOWER_PRIORITY_DRIVE_ALERTS_KEY, String(nextValue));
            return nextValue;
        });
    };

    return [value, setAndSave] as const;
}
