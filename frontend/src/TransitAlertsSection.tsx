import AlertRow from "./AlertRow";
import type { AlertModel } from "./model";

export function TransitAlertsSection({ loading, alerts }: { loading: boolean; alerts: AlertModel[] }) {
    if (loading) return null;

    return (
        <section className="transit-alerts-section">
            {alerts.length === 0 ? (
                <p>No active alerts.</p>
            ) : (
                <>
                    <h2>Sound Transit Alerts</h2>
                    <div className="alerts-list">
                        {alerts.map((alert, index) => (
                            <AlertRow key={alert.header_text.translation[0]?.text || index} alert={alert} />
                        ))}
                    </div>
                </>
            )}
        </section>
    );
}
