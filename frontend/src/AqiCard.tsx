import React from 'react';
import { type AqiData } from './aqiService';
import './AqiDisplay.css'; // AqiDisplay.css contains the styling for AqiCard

interface AqiCardProps {
    locationName: string;
    aqiData: AqiData | null;
}

const AqiCard: React.FC<AqiCardProps> = ({ locationName, aqiData }) => {
    const contents = aqiData ? (
        <div className="aqi-details-container">
            <div className={`aqi-circle aqi-circle-${aqiData.category.toLowerCase().replace(/\s/g, '-')}`}></div>
            <p className="aqi-value">{aqiData.aqi.toFixed(1)}</p>
            <p className="aqi-category">{aqiData.category}</p>
        </div>
    ) : <p>Loading AQI data...</p>;

    return (
        <div className="aqi-card">
            <h3>{locationName}</h3>
            {contents}
        </div>
    );
};

export default AqiCard;