import { describe, expect, it } from 'vitest';
import { getAlertSeverity, type CorridorAlert } from './carCommuteService';

const alert: CorridorAlert = { id: 1, corridorLabel: 'I-405', category: 'Construction', priority: 'Highest' };

describe('drive alert severity', () => {
    it.each(['Construction', 'Roadwork', 'Road Work', 'Maintenance', ' CONSTRUCTION '])('shows highest-priority %s as a warning', (category) => {
        expect(getAlertSeverity({ ...alert, category, headline: 'The NE 85th St on-ramp is closed for paving.' })).toBe('medium');
    });

    it.each([
        'The on-ramp to the freeway is closed for construction.',
        'All lanes are closed on the NE 85th St on-ramp.',
        'The right lane is closed for construction.',
        'All lanes are open during construction.',
        'The roadway is not closed during construction.',
    ])('does not escalate limited or negated closures: %s', (headline) => {
        expect(getAlertSeverity({ ...alert, headline })).toBe('medium');
    });

    it.each(['Collision', 'Closure', 'Incident', 'Disabled Vehicle', 'Weather'])('preserves highest-priority %s alerts', (category) => {
        expect(getAlertSeverity({ ...alert, category })).toBe('high');
    });

    it.each(['All northbound lanes are closed for construction.', 'The roadway is fully blocked.', 'All mainline lanes will be closed.'])('preserves explicit mainline closures: %s', (description) => {
        expect(getAlertSeverity({ ...alert, headline: 'Construction on I-405.', description })).toBe('high');
    });

    it('keeps lower-priority notices and missing data at their existing levels', () => {
        expect(getAlertSeverity({ ...alert, priority: 'High' })).toBe('medium');
        expect(getAlertSeverity({ ...alert, priority: 'Medium' })).toBe('medium');
        expect(getAlertSeverity({ ...alert, priority: 'Low' })).toBe('low');
        expect(getAlertSeverity({ id: 2, corridorLabel: 'I-90' })).toBe('low');
    });
});
