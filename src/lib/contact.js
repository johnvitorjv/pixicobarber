export function normalizeWhatsApp(number = '') {
    const digits = String(number).replace(/\D/g, '');
    return [10, 11].includes(digits.length) ? '55' + digits : digits;
}
