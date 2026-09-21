import { describe, expect, it } from 'vitest';
import { getTollDirection, getTollDisplay, getScheduledFreeReason, type TollRate } from './tollService';

const now = Date.parse('2026-09-21T18:00:00Z');
const rate: TollRate = { amount: 7.25, status: 'priced', message: '$7.25', updatedAt: new Date(now).toISOString() };
describe('commute tolls', () => {
    it('switches at Pacific noon, including standard time', () => {
        expect(getTollDirection(new Date('2026-09-21T18:59:00Z'))).toBe('southbound');
        expect(getTollDirection(new Date('2026-09-21T19:00:00Z'))).toBe('northbound');
        expect(getTollDirection(new Date('2026-12-21T19:59:00Z'))).toBe('southbound');
        expect(getTollDirection(new Date('2026-12-21T20:00:00Z'))).toBe('northbound');
    });
    it('displays money, free and restrictions distinctly', () => {
        expect(getTollDisplay(rate, now)).toBe('$7.25');
        expect(getTollDisplay({ ...rate, amount: 0, status: 'free' }, now)).toBe('Free');
        expect(getTollDisplay({ ...rate, amount: null, status: 'restricted', message: 'HOV ONLY' }, now)).toBe('HOV only');
        expect(getTollDisplay({ ...rate, status: 'restricted', message: 'CLOSED' }, now)).toBe('Closed');
    });
    it('never presents missing or stale prices as current', () => {
        expect(getTollDisplay(undefined, now)).toBe('—');
        expect(getTollDisplay(rate, now + 301000)).toBe('—');
        expect(getTollDisplay({ ...rate, updatedAt: null }, now)).toBe('—');
    });
});

describe('scheduled free hours', () => {
    it('shows free on a Pacific weekend even with missing or stale feed data', () => {
        const sunday = Date.parse('2026-09-21T01:00:00Z'); // Sunday evening in Seattle, Monday UTC.
        expect(getTollDisplay(undefined, sunday)).toBe('Free');
        expect(getTollDisplay({ ...rate, status: 'stale' }, sunday)).toBe('Free');
        expect(getScheduledFreeReason(sunday)).toBe('Weekends are free');
    });
    it('uses 5 am and 8 pm boundaries in Pacific daylight and standard time', () => {
        for (const [before, start, end] of [['2026-09-21T11:59:00Z', '2026-09-21T12:00:00Z', '2026-09-22T03:00:00Z'], ['2026-12-21T12:59:00Z', '2026-12-21T13:00:00Z', '2026-12-22T04:00:00Z']]) {
            expect(getTollDisplay(undefined, Date.parse(before))).toBe('Free');
            expect(getTollDisplay(undefined, Date.parse(start))).toBe('—');
            expect(getTollDisplay(undefined, Date.parse(end))).toBe('Free');
        }
    });
    it('preserves fresh restrictions and keeps demo prices independent of the schedule', () => {
        const sunday = Date.parse('2026-09-21T01:00:00Z');
        const freshRate = { ...rate, updatedAt: new Date(sunday).toISOString() };
        expect(getTollDisplay({ ...freshRate, status: 'restricted', message: 'CLOSED' }, sunday)).toBe('Closed');
        expect(getTollDisplay(freshRate, sunday, false)).toBe('$7.25');
    });
});
