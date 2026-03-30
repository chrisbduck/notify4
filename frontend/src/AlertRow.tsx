import React, { useState } from 'react';
import './AlertRow.css';
import { FaExclamationTriangle, FaInfoCircle, FaChevronDown, FaChevronUp } from 'react-icons/fa';
import { TbAlertOctagonFilled } from 'react-icons/tb';
import { Severity, type AlertModel } from './model';

const renderSeverityIcon = (severity?: Severity) => {
  switch (severity) {
    case Severity.SEVERE:
      return <TbAlertOctagonFilled className="alert-icon severe-icon" />;
    case Severity.WARNING:
      return <FaExclamationTriangle className="alert-icon warning-icon" />;
    case Severity.INFO:
    default:
      return <FaInfoCircle className="alert-icon info-icon" />;
  }
};

const getSeverityClass = (severity?: Severity) => {
  switch (severity) {
    case Severity.WARNING:
      return 'severity-warning';
    case Severity.SEVERE:
      return 'severity-severe';
    case Severity.INFO:
    default:
      return 'severity-info';
  }
};

const AlertRow: React.FC<{ alert: AlertModel }> = ({ alert }) => {
  const [isCollapsed, setIsCollapsed] = useState(true);

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div className={`alert-item ${isCollapsed ? 'collapsed' : ''} ${getSeverityClass(alert.severity_level)}`}>
      <div className="alert-header-row" onClick={toggleCollapse}>
        {renderSeverityIcon(alert.severity_level)}
        <h2>{alert.header_text.translation[0]?.text}</h2>
        <button className="collapse-button">
          {isCollapsed ? <FaChevronDown /> : <FaChevronUp />}
        </button>
      </div>
      <>
        <div className="alert-description-row">
          <p>{alert.description_text?.translation[0]?.text}</p>
        </div>
        <div className="alert-footer-row">
          <p><strong>Effect:</strong> {alert.effect} ({alert.effect_detail?.translation[0]?.text})</p>
          <p><strong>Cause:</strong> {alert.cause} ({alert.cause_detail?.translation[0]?.text})</p>
          <p><strong>Severity:</strong> {alert.severity_level}</p>
          {alert.url?.translation[0]?.text && (
            <p>
              <a href={alert.url.translation[0].text} target="_blank" rel="noopener noreferrer">
                More Info
              </a>
            </p>
          )}
        </div>
      </>
    </div>
  );
};

export default AlertRow;
