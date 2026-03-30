import React from 'react';

interface MockDataToggleProps {
    useHook: () => readonly [boolean, React.Dispatch<React.SetStateAction<boolean>>];
    label: string;
}

export const MockDataToggle: React.FC<MockDataToggleProps> = ({ useHook, label }) => {
    const [useMockData, setUseMockData] = useHook();
    const isLocalHost = window.location.href.includes('localhost');

    if (!isLocalHost) return null;

    const toggleMockData = () => {
        setUseMockData(value => !value);
        window.location.reload();
    };

    return (
        <button
            onClick={toggleMockData}
            style={{
                padding: '8px 12px',
                backgroundColor: useMockData ? '#f8d7da' : '#d4edda',
                color: useMockData ? '#721c24' : '#155724',
                border: '1px solid currentColor',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontFamily: 'sans-serif',
                fontSize: '14px',
            }}
        >
            {useMockData ? `Disable ${label}` : `Enable ${label}`}
        </button>
    );
};
