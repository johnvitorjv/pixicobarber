import { STATUS } from '../data/models.js';

// Only this individual request has priority while waiting for the barber's decision.
export function isPriorityFavoriteRequest(appointment, favorite) {
    return !!favorite && [STATUS.PENDENTE, STATUS.SOLICITADO].includes(appointment.status);
}

// The API already returns appointments newest first. Keep that order within
// both groups; approved, cancelled and historical bookings are never promoted.
export function prioritizePendingFavorites(appointments, clients) {
    const favorites = new Set(clients.filter(client => client.favorito).map(client => client.id));
    return [...appointments].sort((a, b) =>
        Number(isPriorityFavoriteRequest(b, favorites.has(b.clienteId))) -
        Number(isPriorityFavoriteRequest(a, favorites.has(a.clienteId))));
}
