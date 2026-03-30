import React, { useEffect, useState, useRef } from 'react';
import { getAqiDataForLocation, type AqiData } from './aqiService';
import AqiCard from './AqiCard';
import './AqiDisplay.css';

// Helper function to determine AQI category based on AQI value
const getAqiCategory = (aqi: number): string => {
    if (aqi <= 50) return 'Good';
    if (aqi <= 100) return 'Moderate';
    if (aqi <= 150) return 'Unhealthy for Sensitive Groups';
    if (aqi <= 200) return 'Unhealthy';
    if (aqi <= 300) return 'Very Unhealthy';
    return 'Hazardous';
};

interface AqiDisplayProps {
    mockData: boolean;
}

const AqiDisplay: React.FC<AqiDisplayProps> = ({ mockData }: AqiDisplayProps) => {
    const [nkAqi, setNkAqi] = useState<AqiData | null>(null);
    const [sdAqi, setSdAqi] = useState<AqiData | null>(null);
    const [mtAqi, setMtAqi] = useState<AqiData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isExpanded, setIsExpanded] = useState(false);
    const effectRan = useRef(false);

    useEffect(() => {
        if (effectRan.current) return;
        const fetchAqiData = async () => {
            setIsLoading(true);
            const [nkData, sdData, mtData] = await Promise.all([
                getAqiDataForLocation("north-kirkland", mockData),
                getAqiDataForLocation("seattle-downtown", mockData),
                getAqiDataForLocation("mountlake-terrace", mockData)
            ]);
            setNkAqi(nkData);
            setSdAqi(sdData);
            setMtAqi(mtData);
            setIsLoading(false);
        };

        fetchAqiData();
        const interval = setInterval(fetchAqiData, 300000); // Refresh every 5 minutes
        effectRan.current = true;

        return () => clearInterval(interval);
    }, [mockData]);

    const allAqiValues = [nkAqi?.aqi, sdAqi?.aqi, mtAqi?.aqi].filter(
        (aqi): aqi is number => aqi !== null && aqi !== undefined
    );

    const averageAqi = allAqiValues.length > 0
        ? allAqiValues.reduce((sum, aqi) => sum + aqi, 0) / allAqiValues.length
        : null;

    const averageAqiCategory = averageAqi !== null ? getAqiCategory(averageAqi) : (isLoading ? 'Loading' : 'Not Available');

    const toggleExpanded = () => {
        setIsExpanded(!isExpanded);
    };

    const combinedAqiContents = isLoading ? (
        <p>Loading AQI data...</p>
    ) : averageAqi !== null ? (
        <div className="aqi-details-container">
            <div className={`aqi-circle aqi-circle-${averageAqiCategory.toLowerCase().replace(/\s/g, '-')}`}></div>
            <p className="aqi-value">{averageAqi.toFixed(1)}</p>
            <p className="aqi-category">{averageAqiCategory}</p>
        </div>
    ) : (
        <div className="aqi-details-container">
            <p className="aqi-value">--</p>
            <p className="aqi-category">Not Available</p>
        </div>
    );

    return (
        <div className="aqi-display-container">
            <button className="aqi-combined-card" onClick={toggleExpanded}>
                <div className="aqi-card-layout">
                    <div className="aqi-header-row">
                        <h3>Air Quality</h3>
                        <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                        </span>
                    </div>
                    <div className="aqi-content-row">
                        <div className="aqi-header-left-spacer"></div> {/* Empty spacer */}
                        <div className="aqi-main-content">
                            {combinedAqiContents}
                        </div>
                        <div className="aqi-right-spacer"></div> {/* Empty spacer for symmetry */}
                    </div>
                </div>
            </button>
            {isExpanded && (
                <div className="aqi-expanded-details">
                    <AqiCard locationName="North Kirkland" aqiData={nkAqi} />
                    <AqiCard locationName="Seattle Downtown" aqiData={sdAqi} />
                    <AqiCard locationName="Mountlake Terrace" aqiData={mtAqi} />
                </div>
            )}
        </div>
    );
};

export default AqiDisplay;