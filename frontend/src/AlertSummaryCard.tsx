import { FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';
import { TbAlertOctagonFilled } from "react-icons/tb";
import { Severity, type AlertModel } from './model';
import './WeatherCardDisplay.css'; // Reusing the card styling
import { getAlertSummaryText } from './alertService';

function AlertSummaryCard({ loading, alerts }: { loading: boolean, alerts: AlertModel[] }) {
    if (loading) {
        return (
            <div className="weather-card"> {/* Reusing weather-card styling */}
                <h3>Transit Alerts</h3>
                <p>Loading alerts...</p>
            </div>
        );
    }

    const severeAlert = alerts.find(alert => alert.severity_level === Severity.SEVERE);
    const warningAlert = alerts.find(alert => alert.severity_level === Severity.WARNING);

    return (
        <div className="weather-card"> {/* Reusing weather-card styling */}
            <h3>Transit Alerts</h3>
            <div className="alert-summary-content">
                {severeAlert ? (
                    <>
                        <TbAlertOctagonFilled className="alert-summary-icon severe-icon" />
                        <p>{getAlertSummaryText(severeAlert)}</p>
                    </>
                ) : warningAlert ? (
                    <>
                        <FaExclamationTriangle className="alert-summary-icon warning-icon" />
                        <p>{getAlertSummaryText(warningAlert)}</p>
                    </>
                ) : (
                    <>
                        <FaCheckCircle className="alert-summary-icon success-icon" />
                        <p>No major problems</p>
                    </>
                )}
            </div>
        </div>
    );
};

export default AlertSummaryCard;