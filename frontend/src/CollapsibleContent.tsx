import { useEffect, useState, type ReactNode } from 'react';
import './CollapsibleContent.css';

const COLLAPSE_ANIMATION_MS = 280;

export function ExpandIndicator({ isExpanded }: { isExpanded: boolean }) {
    return (
        <span className={`expand-indicator ${isExpanded ? 'expanded' : ''}`} aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
        </span>
    );
}

export function CollapsibleContent({ id, isExpanded, className = '', children }: { id: string; isExpanded: boolean; className?: string; children: ReactNode }) {
    const [shouldRender, setShouldRender] = useState(isExpanded);
    const [isShown, setIsShown] = useState(isExpanded);

    useEffect(() => {
        if (isExpanded) {
            setShouldRender(true);
            const animationFrame = window.requestAnimationFrame(() => setIsShown(true));
            return () => window.cancelAnimationFrame(animationFrame);
        }

        setIsShown(false);
        if (!shouldRender) {
            return;
        }

        const timeout = window.setTimeout(() => setShouldRender(false), COLLAPSE_ANIMATION_MS);
        return () => window.clearTimeout(timeout);
    }, [isExpanded, shouldRender]);

    if (!shouldRender) return null;

    return (
        <section className={`collapsible-content ${isShown ? 'expanded' : ''} ${className}`} id={id} aria-hidden={!isExpanded}>
            <div className="collapsible-content-inner">
                {children}
            </div>
        </section>
    );
}
