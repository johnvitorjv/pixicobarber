export const ACTIVE_STATUSES = ['pendente', 'confirmado', 'aguardando_cliente', 'remarcado'];
export function bahiaDate(date = new Date()) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
export function calendarDate(date) {
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}
export function timeMinutes(value) {
    if (!/^\d{2}:\d{2}$/.test(value || '')) return NaN;
    const [h, m] = value.split(':').map(Number);
    return h < 24 && m < 60 ? h * 60 + m : NaN;
}
export function validateSchedule(c) {
    if (!c || !Array.isArray(c.diasFuncionamento) || c.diasFuncionamento.some(d => !Number.isInteger(d) || d < 0 || d > 6)) throw new Error('Dias de funcionamento inválidos.');
    const start = timeMinutes(c.horarioInicio), end = timeMinutes(c.horarioFim);
    const lunchStart = timeMinutes(c.intervaloAlmoco?.inicio), lunchEnd = timeMinutes(c.intervaloAlmoco?.fim);
    if (![start, end, lunchStart, lunchEnd].every(Number.isFinite) || start >= end || lunchStart >= lunchEnd || lunchStart < start || lunchEnd > end) throw new Error('Verifique os horários de expediente e pausa.');
    if (!Number.isInteger(c.duracaoSlot) || c.duracaoSlot < 5 || c.duracaoSlot > 120) throw new Error('Intervalo entre horários deve ser de 5 a 120 minutos.');
    for (const key of ['limiteClientesDia', 'limiteClientesTurno']) {
        if (!Number.isInteger(c[key]) || c[key] < 1 || c[key] > 100) throw new Error('Limite de clientes deve estar entre 1 e 100.');
    }
    if ((c.ferias || []).some(f => !f.inicio || !f.fim || f.inicio > f.fim)) throw new Error('Verifique as datas de férias.');
    return c;
}
export function generateDay(dateStr, config, override) {
    if (!config) return { disponivel: false, motivo: 'Carregando expediente', faixas: [] };
    validateSchedule(config);
    if ((config.ferias || []).some(f => dateStr >= f.inicio && dateStr <= f.fim)) return { disponivel: false, motivo: 'Férias', faixas: [] };
    const block = (config.bloqueiosEspeciais || []).find(b => b.data === dateStr);
    if (block) return { disponivel: false, motivo: block.motivo || 'Fechado', faixas: [] };
    if (override?.disponivel === false) return { ...override, faixas: [] };
    if (!override?.disponivel && !config.diasFuncionamento.includes(new Date(dateStr + 'T12:00:00').getDay())) return { disponivel: false, motivo: 'Fechado', faixas: [] };
    const faixas = [];
    const start = timeMinutes(config.horarioInicio), end = timeMinutes(config.horarioFim);
    const lunchStart = timeMinutes(config.intervaloAlmoco.inicio), lunchEnd = timeMinutes(config.intervaloAlmoco.fim);
    const format = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
    for (let t = start; t + config.duracaoSlot <= end; t += config.duracaoSlot) {
        if (t < lunchEnd && t + config.duracaoSlot > lunchStart) continue;
        const blocked = (override?.faixas || []).some(f => f.disponivel === false && t < timeMinutes(f.fim) && t + config.duracaoSlot > timeMinutes(f.inicio));
        faixas.push({ id: format(t), inicio: format(t), fim: format(t + config.duracaoSlot), disponivel: !blocked });
    }
    return { disponivel: true, faixas };
}
export function mutationMessage(error) {
    if (error.code === '23P01' || error.code === '23505') return 'Esse horário acabou de ficar indisponível. Escolha outro.';
    if (error.code === '23503') return 'Este registro possui histórico e deve ser desativado.';
    if (error.code === '42501') return 'Você não tem permissão para essa operação.';
    if (error.code === 'P0001') return error.message;
    if (error?.constructor === Error && !error.code) return error.message;
    return 'Não foi possível salvar. Verifique a conexão e tente novamente.';
}
