// ----- Enums / constants -----

export const Severity = {
    UNKNOWN_SEVERITY: "UNKNOWN_SEVERITY",
    INFO: "INFO",
    WARNING: "WARNING",
    SEVERE: "SEVERE",
} as const;
export type Severity = (typeof Severity)[keyof typeof Severity];

export const Effect = {
    NO_SERVICE: "NO_SERVICE",
    REDUCED_SERVICE: "REDUCED_SERVICE",
    SIGNIFICANT_DELAYS: "SIGNIFICANT_DELAYS",
    DETOUR: "DETOUR",
    ADDITIONAL_SERVICE: "ADDITIONAL_SERVICE",
    MODIFIED_SERVICE: "MODIFIED_SERVICE",
    OTHER_EFFECT: "OTHER_EFFECT",
    STOP_MOVED: "STOP_MOVED",
    ACCESSIBILITY_ISSUE: "ACCESSIBILITY_ISSUE",
    UNKNOWN_EFFECT: "UNKNOWN_EFFECT",
} as const;
export type Effect = (typeof Effect)[keyof typeof Effect];

export const Cause = {
    UNKNOWN_CAUSE: "UNKNOWN_CAUSE",
    OTHER_CAUSE: "OTHER_CAUSE",
    TECHNICAL_PROBLEM: "TECHNICAL_PROBLEM",
    STRIKE: "STRIKE",
    DEMONSTRATION: "DEMONSTRATION",
    ACCIDENT: "ACCIDENT",
    HOLIDAY: "HOLIDAY",
    WEATHER: "WEATHER",
    MAINTENANCE: "MAINTENANCE",
    CONSTRUCTION: "CONSTRUCTION",
    POLICE_ACTIVITY: "POLICE_ACTIVITY",
    MEDICAL_EMERGENCY: "MEDICAL_EMERGENCY",
} as const;
export type Cause = (typeof Cause)[keyof typeof Cause];

// GTFS route_type (partial list that covers Sound Transit feeds)
export const RouteType = {
    TRAM: 0,
    SUBWAY: 1,
    RAIL: 2,
    BUS: 3,
    FERRY: 4,
    CABLE_TRAM: 5,
    AERIAL_LIFT: 6,
    FUNICULAR: 7,
    TROLLEYBUS: 11,
    MONORAIL: 12,
} as const;
export type RouteType = (typeof RouteType)[keyof typeof RouteType];

export type Timestamp = number; // seconds since epoch
export type DirectionId = 0 | 1;

// ----- Translated strings -----

export interface Translation {
    text: string;
    /** BCP-47 language tag; optional in many feeds */
    language?: string;
}

export interface LocalizedText {
    translation: Translation[];
}

// ----- Core alert pieces -----

export interface ActivePeriod {
    /** either may be omitted per spec */
    start?: Timestamp;
    end?: Timestamp;
}

/** Trip descriptor (subset used inside informed_entity) */
export interface TripDescriptor {
    trip_id?: string;
    route_id?: string;
    direction_id?: DirectionId;
}

/** Entity selector used by alerts */
export interface InformedEntity {
    agency_id?: string;
    route_id?: string;
    route_type?: RouteType | number; // keep numeric for safety
    stop_id?: string;
    direction_id?: DirectionId;
    trip?: TripDescriptor;
}

/** Optional alert image (rarely used, but in spec) */
export interface AlertImage {
    localized_image: {
        url: string;
        media_type?: string; // e.g., "image/png"
    }[];
}

/** Main alert model */
export interface AlertModel {
    // enums
    effect: Effect | string; // keep open to be resilient to vendor extensions
    cause: Cause | string;

    // extended details (optional in many feeds)
    effect_detail?: LocalizedText;
    cause_detail?: LocalizedText;

    // required-ish user text
    header_text: LocalizedText;
    description_text?: LocalizedText;
    tts_header_text?: LocalizedText;
    tts_description_text?: LocalizedText;

    // severity + link
    severity_level?: Severity;
    url?: LocalizedText;

    // timing + scope
    active_period: ActivePeriod[];
    informed_entity: InformedEntity[];

    // optional extras from spec
    image?: AlertImage;
}

// ----- Feed wrappers (top level of alerts_pb.json) -----

export const Incrementality = {
    FULL_DATASET: "FULL_DATASET",
    DIFFERENTIAL: "DIFFERENTIAL",
} as const;
export type Incrementality = (typeof Incrementality)[keyof typeof Incrementality];

export interface FeedHeader {
    gtfs_realtime_version: string; // e.g., "2.0"
    incrementality?: Incrementality;
    timestamp?: Timestamp;
}

export interface FeedEntity {
    id: string;
    is_deleted?: boolean;
    alert?: AlertModel;
    // (trip_update/vehicle are not used in ST service-alerts feed)
}

export interface FeedMessage {
    header: FeedHeader;
    entity: FeedEntity[];
}

// ----- Data -----

const severityOrder: Record<Severity, number> = {
    [Severity.SEVERE]: 1,
    [Severity.WARNING]: 2,
    [Severity.INFO]: 3,
    [Severity.UNKNOWN_SEVERITY]: 4,
};

// ----- Functions -----

export function lessThan(a?: Severity, b?: Severity): number {
    const severityA = a || Severity.UNKNOWN_SEVERITY;
    const severityB = b || Severity.UNKNOWN_SEVERITY;
    return severityOrder[severityA] - severityOrder[severityB];
}

export function sortBySeverity(alerts: AlertModel[]): AlertModel[] {
    return alerts.slice().sort((a: AlertModel, b: AlertModel) => lessThan(a.severity_level, b.severity_level));
}

export function downgradeSeverity(severity: Severity | undefined): Severity {
    switch (severity) {
        case Severity.SEVERE:
            return Severity.WARNING;
        case Severity.WARNING:
        case Severity.INFO:
            return Severity.INFO;
        case Severity.UNKNOWN_SEVERITY:
        default:
            return Severity.UNKNOWN_SEVERITY;
    }
}
