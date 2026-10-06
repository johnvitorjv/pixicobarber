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
    if (c.duracaoSlot !== 15) throw new Error('Os inícios devem seguir a grade de 15 minutos.');
    if ((c.ferias || []).some(f => !f.inicio || !f.fim || f.inicio > f.fim)) throw new Error('Verifique as datas de férias.');
    return c;
}
export function generateDay(dateStr, config, override) {
    if (!config) return { disponivel: false, motivo: 'Carregando expediente', faixas: [] };
    validateSchedule(config);
    if (override) {
        validateOverride(override);
        return { ...override, faixas: dayGrid(override) };
    }
    if ((config.ferias || []).some(f => dateStr >= f.inicio && dateStr <= f.fim)) return { disponivel: false, motivo: 'Férias', faixas: [] };
    const block = (config.bloqueiosEspeciais || []).find(b => b.data === dateStr);
    if (block) return { disponivel: false, motivo: block.motivo || 'Fechado', faixas: [] };
    if (!config.diasFuncionamento.includes(new Date(dateStr + 'T12:00:00').getDay())) return { disponivel: false, motivo: 'Fechado', faixas: [] };
    const day = defaultOpenDay(config);
    return { ...day, faixas: dayGrid(day) };
}
export function defaultOpenDay(config) {
    return { disponivel: true, intervalos: [
        { inicio: config.horarioInicio, fim: config.intervaloAlmoco.inicio },
        { inicio: config.intervaloAlmoco.fim, fim: config.horarioFim },
    ].filter(f => f.inicio < f.fim), bloqueios: [] };
}
export function validateOverride(day) {
    if (typeof day?.disponivel !== 'boolean' || !Array.isArray(day.intervalos) || !Array.isArray(day.bloqueios)) throw new Error('Exceção de data inválida.');
    for (const ranges of [day.intervalos, day.bloqueios]) {
        for (const f of ranges) if (!Number.isFinite(timeMinutes(f.inicio)) || !Number.isFinite(timeMinutes(f.fim)) || f.inicio >= f.fim) throw new Error('Verifique o início e o fim de cada intervalo.');
    }
    if (day.disponivel && !day.intervalos.length) throw new Error('Informe pelo menos um intervalo de trabalho.');
    const sorted = [...day.intervalos].sort((a,b) => a.inicio.localeCompare(b.inicio));
    if (sorted.some((f,i) => i > 0 && f.inicio <= sorted[i-1].fim)) throw new Error('Una intervalos contíguos e remova sobreposições.');
    return day;
}
export function fitsDay(day, start, end) {
    return day.disponivel && day.intervalos?.some(f => start >= timeMinutes(f.inicio) && end <= timeMinutes(f.fim)) &&
        !day.bloqueios?.some(f => start < timeMinutes(f.fim) && end > timeMinutes(f.inicio));
}
function dayGrid(day) {
    if (!day.disponivel) return [];
    const result = [], format = m => String(Math.floor(m / 60)).padStart(2,'0') + ':' + String(m % 60).padStart(2,'0');
    for (let t = 0; t + 15 < 1440; t += 15) {
        if (day.intervalos.some(f => t >= timeMinutes(f.inicio) && t < timeMinutes(f.fim))) result.push({ id: format(t), inicio: format(t), fim: format(t + 15), disponivel: !!fitsDay(day,t,t+15) });
    }
    return result;
}
export function serviceAllowedOnDate(service, date) {
    return !service?.diasPermitidos || service.diasPermitidos.includes(new Date(date + 'T12:00:00').getDay());
}
export function serviceDurationLabel(service) {
    return service.confirmacaoManual ? 'Duração variável · confirmação manual' : `${service.duracao} min`;
}
export function mutationMessage(error) {
    if (error.code === '23P01' || error.code === '23505') return 'Esse horário acabou de ficar indisponível. Escolha outro.';
    if (error.code === '23503') return 'Este registro possui histórico e deve ser desativado.';
    if (error.code === '42501') return 'Você não tem permissão para essa operação.';
    if (error.code === 'P0001') return error.message;
    if (error?.constructor === Error && !error.code) return error.message;
    return 'Não foi possível salvar. Verifique a conexão e tente novamente.';
}
