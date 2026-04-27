import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import './CollapsibleContent.css';

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
    const innerRef = useRef<HTMLDivElement | null>(null);
    const [contentHeight, setContentHeight] = useState(0);

    useLayoutEffect(() => {
        const inner = innerRef.current;
        if (!inner) return;

        const updateHeight = () => setContentHeight(inner.scrollHeight);
        updateHeight();

        const resizeObserver = new ResizeObserver(updateHeight);
        resizeObserver.observe(inner);
        return () => resizeObserver.disconnect();
    }, [children]);

    const heightStyle = { '--collapsible-height': `${contentHeight}px` } as CSSProperties;

    return (
        <section className={`collapsible-content ${isExpanded ? 'expanded' : ''} ${className}`} id={id} aria-hidden={!isExpanded} style={heightStyle}>
            <div className="collapsible-content-inner" ref={innerRef}>
                {children}
            </div>
        </section>
    );
}
