import { type ReactNode, useEffect, useId, useState } from 'react';

export function PersistedPanel({ title, storageKey, children }: { title: string; storageKey: string; children: ReactNode }) {
    const bodyId = useId();
    const [isExpanded, setIsExpanded] = useState<boolean>(() => {
        return localStorage.getItem(storageKey) === 'true';
    });

    useEffect(() => {
        localStorage.setItem(storageKey, String(isExpanded));
    }, [isExpanded, storageKey]);

    return (
        <section className="app-panel">
            <button
                className="app-panel-toggle"
                onClick={() => setIsExpanded((expanded) => !expanded)}
                aria-expanded={isExpanded}
                aria-controls={bodyId}
            >
                <span>{title}</span>
                <span className={`app-panel-chevron ${isExpanded ? 'expanded' : ''}`}>▾</span>
            </button>

            {isExpanded && (
                <div className="app-panel-body" id={bodyId}>
                    {children}
                </div>
            )}
        </section>
    );
}
