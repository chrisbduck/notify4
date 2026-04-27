import React from 'react';
import { isLocalHost } from './localEnvironment';

interface MockDataToggleProps {
    enabled: boolean;
    onToggle: () => void;
    label: string;
}

export const MockDataToggle: React.FC<MockDataToggleProps> = ({ enabled, onToggle, label }) => {
    if (!isLocalHost()) return null;

    return (
        <button
            onClick={onToggle}
            style={{
                padding: '8px 12px',
                backgroundColor: enabled ? '#f8d7da' : '#d4edda',
                color: enabled ? '#721c24' : '#155724',
                border: '1px solid currentColor',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontFamily: 'sans-serif',
                fontSize: '14px',
            }}
        >
            {enabled ? `Disable ${label}` : `Enable ${label}`}
        </button>
    );
};
