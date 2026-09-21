import { apiFetch } from './apiFetch';

export type TollDirection = 'northbound' | 'southbound';
export interface TollRate {
    amount: number | null;
    status: 'priced' | 'free' | 'restricted' | 'stale' | 'unavailable';
    message: string | null;
    updatedAt: string | null;
    tripName?: string;
}
export type CommuteTolls = Record<TollDirection, TollRate>;
export const TOLL_ROUTES = { northbound: 'Bellevue → 128th / 160th', southbound: '160th → Bellevue' };

export function getTollDirection(now = new Date()): TollDirection {
    const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', hourCycle: 'h23' }).format(now));
    return hour < 12 ? 'southbound' : 'northbound';
}

// Bellevue–Lynnwood schedule: weekdays 5 a.m.–8 p.m., Pacific time.
// https://wsdot.wa.gov/travel/roads-bridges/toll-roads-bridges-tunnels/i-405-express-toll-lanes
export function getScheduledFreeReason(now = Date.now()): string | null {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', weekday: 'short', hour: 'numeric', hourCycle: 'h23' }).formatToParts(now);
    const weekday = parts.find(part => part.type === 'weekday')?.value;
    const hour = Number(parts.find(part => part.type === 'hour')?.value);
    if (weekday === 'Sat' || weekday === 'Sun') return 'Weekends are free';
    return hour < 5 || hour >= 20 ? 'Free overnight · 8 pm–5 am' : null;
}

function isFresh(rate: TollRate | undefined, now: number): boolean {
    const updated = rate?.updatedAt ? Date.parse(rate.updatedAt) : NaN;
    return Number.isFinite(updated) && now - updated <= 300000 && updated <= now + 60000 && rate?.status !== 'stale';
}

export function getTollDisplay(rate?: TollRate, now = Date.now(), useSchedule = true): string {
    const fresh = isFresh(rate, now);
    if (fresh && rate?.status === 'restricted') return /closed/i.test(rate.message ?? '') ? 'Closed' : /hov/i.test(rate.message ?? '') ? 'HOV only' : 'See signs';
    if (useSchedule && getScheduledFreeReason(now)) return 'Free';
    if (!fresh || !rate || rate.status === 'unavailable' || rate.amount === null || !Number.isFinite(rate.amount) || rate.amount < 0) return '—';
    return rate.amount === 0 ? 'Free' : `$${rate.amount.toFixed(2)}`;
}

export function getTollNote(rate?: TollRate, now = Date.now(), useSchedule = true): string | null {
    if (isFresh(rate, now) && rate?.status === 'restricted') return 'Follow posted signs';
    if (useSchedule && getScheduledFreeReason(now)) return null;
    if (!rate || rate.status === 'unavailable') return 'Rate unavailable';
    if (!isFresh(rate, now)) return 'Awaiting rate update';
    return null;
}

export async function getCommuteTolls(useMockData: boolean): Promise<CommuteTolls> {
    if (useMockData) {
        const rate = (amount: number): TollRate => ({ amount, status: 'priced', message: null, updatedAt: new Date().toISOString() });
        return { northbound: rate(7.25), southbound: rate(5.50) };
    }
    const response = await apiFetch('/wsdot/tolls');
    if (!response.ok) throw new Error('Toll rates unavailable');
    return response.json();
}
