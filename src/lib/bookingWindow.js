import { bahiaDate } from './bookingRules';

export function addCalendarDays(iso, days) {
    const date = new Date(`${iso}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
}

export function bookingWindow(user, today = bahiaDate()) {
    return { start: today, end: addCalendarDays(today, 7), unrestricted: !!user?.isDeveloper };
}

export function editableUntilPreviousDay(appointment, today = bahiaDate()) {
    return ['pendente', 'confirmado', 'remarcado'].includes(appointment?.status)
        && appointment?.data > today;
}
