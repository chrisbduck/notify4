import type { AlertModel, FeedMessage, InformedEntity } from './model';
import { downgradeSeverity, Severity, sortBySeverity } from './model';
import mockAlertsData from './testdata/transit/mockAlerts.json';

const ROUTE_ID = "100479"; // the 1 Line

const isLocalHost: boolean = window.location.href.includes('localhost');

// Control constant for enabling severity override for testing
const ENABLE_SEVERITY_OVERRIDE_FOR_TESTING = isLocalHost && false;

const _overrideAlertSeveritiesForTesting = (alertsToModify: AlertModel[]): AlertModel[] => {
    const severityLevels = [Severity.INFO, Severity.WARNING, Severity.SEVERE, Severity.UNKNOWN_SEVERITY];
    return alertsToModify.map((alert, index) => ({
        ...alert,
        severity_level: severityLevels[index % severityLevels.length],
    }));
};

function _rangeOverlapsToday(startSeconds?: number, endSeconds?: number): boolean {
    // Normalize inputs
    if (startSeconds === undefined) startSeconds = 0;
    if (endSeconds === undefined) endSeconds = Number.MAX_SAFE_INTEGER;
    const rangeStart = Math.min(startSeconds, endSeconds);
    const rangeEnd = Math.max(startSeconds, endSeconds);

    // Start of today (local time)
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);

    const todayStartSeconds = Math.floor(startOfToday.getTime() / 1000);
    const todayEndSeconds = Math.floor(startOfTomorrow.getTime() / 1000);

    // Overlap check
    return rangeEnd >= todayStartSeconds && rangeStart < todayEndSeconds;
}

function _hasRangeOverlappingToday(alert: AlertModel): boolean {
    const activePeriods = alert.active_period || [];
    return activePeriods.some((period) => _rangeOverlapsToday(period.start, period.end));
}

function _hasEffectDetail(alert: AlertModel, detailText: string): boolean {
    return alert.effect_detail?.translation.some((translation) => translation.text === detailText) || false;
}

function _adjustAlertSeverities(alerts: AlertModel[]): AlertModel[] {
    return alerts.map((alert) => {
        // Most severities are too high, so we generally want to downgrade
        let downgrade = false;

        // If there is an "OTHER_EFFECT" with detail "ANNOUNCEMENT", downgrade the severity - the warnings generally
        // aren't important
        if (alert.effect === "OTHER_EFFECT" && _hasEffectDetail(alert, "ANNOUNCEMENT")) downgrade = true;

        // If the time range doesn't overlap today, downgrade the severity
        if (!_hasRangeOverlappingToday(alert)) downgrade = true;

        const adjustedSeverity = downgrade ? downgradeSeverity(alert.severity_level) : alert.severity_level;
        return { ...alert, severity_level: adjustedSeverity };
    });
}

function processAlerts(alerts: AlertModel[]): AlertModel[] {
    const processedAlerts = ENABLE_SEVERITY_OVERRIDE_FOR_TESTING ? _overrideAlertSeveritiesForTesting(alerts)
        : _adjustAlertSeverities(alerts);
    return sortBySeverity(processedAlerts);
}

export async function fetchAndProcessAlerts(useMockData: boolean): Promise<AlertModel[]> {
    if (useMockData) {
        console.log("Using mock alert data");
        const feedMessage = mockAlertsData as unknown as FeedMessage;
        const filteredAlerts = _getFilteredAlerts(feedMessage, ROUTE_ID);
        return processAlerts(filteredAlerts);
    }

    const alerts_url = "https://s3.amazonaws.com/st-service-alerts-prod/alerts_pb.json";

    try {
        const response = await fetch(alerts_url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const feedMessage: FeedMessage = await response.json();
        const filteredAlerts = _getFilteredAlerts(feedMessage, ROUTE_ID);
        return processAlerts(filteredAlerts);
    } catch (error) {
        console.error("Error fetching alerts:", error);
        return [];
    }
}

function _includesImportantRoute(entities: InformedEntity[], route_id: string): boolean {
    return entities.some((entity: { route_id?: string }) => entity.route_id === route_id);
}

function _getFilteredAlerts(feedMessage: FeedMessage, route_id: string): AlertModel[] {
    const entities = feedMessage.entity || [];
    const filtered_results: AlertModel[] = [];
    for (const entity of entities) {
        const alert: AlertModel | undefined = entity.alert;
        if (!alert) continue;

        // Ignore accessibility issues like elevator issues
        const effect = alert.effect;
        if (effect === "ACCESSIBILITY_ISSUE") continue;

        // Ignore special events and scheduled maintenance
        const causeDetailText = alert.cause_detail?.translation?.[0]?.text;
        if (causeDetailText === "SPECIAL_EVENT" || causeDetailText === "SCHEDULED_MAINTENANCE") continue;

        // Ignore unimportant routes
        const informedEntities = alert.informed_entity || [];
        if (!_includesImportantRoute(informedEntities, route_id)) continue;

        // Include it
        filtered_results.push(alert);
    }
    return filtered_results;
}

function _convertUpperCaseToTitleCase(text: string): string {
    return text.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
}

export function getAlertSummaryText(alert: AlertModel): string {
    // Get from translation text or effect (both are often not great descriptions)
    let text = alert.effect_detail?.translation[0]?.text || alert.effect || "";

    // If upper case, make it title case for better readability
    if (text === text.toUpperCase()) text = _convertUpperCaseToTitleCase(text);

    // Make it clear if the alert isn't for today
    if (!_hasRangeOverlappingToday(alert)) text += " (future)";

    return text || "(no details available)";
}
