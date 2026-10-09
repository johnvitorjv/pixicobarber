import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';

const WEEKDAYS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const two = n => String(n).padStart(2, '0');
const isoDay = (y, m, d) => `${y}-${two(m + 1)}-${two(d)}`;
const displayDay = iso => iso ? iso.split('-').reverse().join('/') : '';
const parsedMonth = iso => /^\d{4}-\d{2}-\d{2}$/.test(iso || '') ? new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, 1) : new Date();
const monthKey = date => isoDay(date.getFullYear(), date.getMonth(), 1).slice(0, 7);

export default function CalendarPicker({ value = '', onChange, minDate, maxDate, isAvailable, onMonthChange, disabled = false, label = 'Escolha uma data', compact = false }) {
    const [shownMonth, setShownMonth] = useState(() => parsedMonth(value || minDate));
    const month = shownMonth.getMonth(), year = shownMonth.getFullYear();
    const earliest = (minDate || '1900-01-01').slice(0, 7);
    const latest = (maxDate || '2099-12-31').slice(0, 7);
    const selectedMonth = monthKey(shownMonth);
    const canBack = selectedMonth > earliest, canNext = selectedMonth < latest;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const first = new Date(year, month, 1).getDay();
    const days = useMemo(() => [...Array.from({ length: first }, () => null), ...Array.from({ length: daysInMonth }, (_, i) => isoDay(year, month, i + 1))], [first, daysInMonth, month, year]);
    const years = useMemo(() => {
        const lo = Number(earliest.slice(0, 4)), hi = Number(latest.slice(0, 4));
        return Array.from({ length: Math.min(250, Math.max(1, hi - lo + 1)) }, (_, i) => lo + i);
    }, [earliest, latest]);
    const setMonth = (y, m) => {
        const next = new Date(y, m, 1);
        const key = monthKey(next);
        if (key >= earliest && key <= latest) setShownMonth(next);
    };
    useEffect(() => { onMonthChange?.(isoDay(year, month, 1)); }, [onMonthChange, year, month]);
    return (
        <section aria-label={label} className={`bg-[#090909] border border-white/15 ${compact ? 'p-3 sm:p-4' : 'p-4 sm:p-6'} w-full`}>
            <div className="flex items-center gap-2 justify-between mb-5">
                <button type="button" aria-label="Mês anterior" disabled={disabled || !canBack} onClick={() => setMonth(year, month - 1)} className="w-9 h-9 border border-white/10 text-white disabled:opacity-25 flex items-center justify-center"><ChevronLeft size={17} /></button>
                <div className="flex items-center gap-1 min-w-0">
                    <select aria-label="Mês" value={month} onChange={e => setMonth(year, Number(e.target.value))} className="bg-black text-white uppercase font-bold text-xs sm:text-sm max-w-[130px] px-1 py-2 focus:outline-primary">
                        {MONTHS.map((name, index) => <option key={name} value={index} disabled={monthKey(new Date(year, index, 1)) < earliest || monthKey(new Date(year, index, 1)) > latest}>{name}</option>)}
                    </select>
                    <select aria-label="Ano" value={year} onChange={e => setMonth(Number(e.target.value), month)} className="bg-black text-white font-bold text-xs sm:text-sm px-1 py-2 focus:outline-primary">
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
                <button type="button" aria-label="Próximo mês" disabled={disabled || !canNext} onClick={() => setMonth(year, month + 1)} className="w-9 h-9 border border-white/10 text-white disabled:opacity-25 flex items-center justify-center"><ChevronRight size={17} /></button>
            </div>
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
                {WEEKDAYS.map(day => <span key={day} className="text-center text-primary/90 uppercase text-[9px] font-bold tracking-wide py-1.5">{day}</span>)}
                {days.map((day, i) => {
                    if (!day) return <span key={`pad-${i}`} />;
                    const allowed = (!minDate || day >= minDate) && (!maxDate || day <= maxDate);
                    const available = allowed && (isAvailable ? isAvailable(day) : true);
                    const selected = day === value;
                    return <button type="button" key={day} data-calendar-date={day} aria-label={`Selecionar ${displayDay(day)}`} aria-pressed={selected} disabled={disabled || !allowed || available === false}
                        onClick={() => onChange(day)} className={`relative aspect-square min-h-9 w-full text-xs font-bold border transition-colors focus:outline-2 focus:outline-primary ${selected ? 'bg-primary text-black border-primary' : available === false || !allowed ? 'text-zinc-700 border-white/[0.03] cursor-not-allowed' : 'text-white border-white/10 hover:border-primary/60 hover:bg-primary/10'}`}>
                        {Number(day.slice(-2))}
                        {available === true && !selected && <span aria-hidden="true" className="absolute top-1 right-1 w-1 h-1 rounded-full bg-green-500" />}
                    </button>;
                })}
            </div>
        </section>
    );
}

export function CalendarInput({ value, onChange, minDate, maxDate, label = 'Data', className = '', placeholder = 'Escolher data' }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
        if (!open) return undefined;
        const outside = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        const key = e => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('pointerdown', outside);
        document.addEventListener('keydown', key);
        return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', key); };
    }, [open]);
    return <div ref={ref} className={`relative min-w-0 ${className}`}>
        <button type="button" aria-label={label} aria-expanded={open} onClick={() => setOpen(v => !v)} className="w-full min-w-[135px] flex items-center justify-between gap-3 text-left bg-black border border-white/20 hover:border-primary/50 focus:outline-primary p-3 text-xs sm:text-sm text-white">
            <span>{displayDay(value) || placeholder}</span><CalendarDays size={17} className="text-primary shrink-0" />
        </button>
        {open && <div className="absolute z-[200] top-full right-0 mt-2 w-[min(88vw,365px)] shadow-[0_20px_60px_rgba(0,0,0,.9)]">
            <div className="border border-white/15 bg-black flex items-center justify-between px-3 py-2"><span className="text-zinc-400 text-[10px] uppercase tracking-widest">{label}</span><button type="button" aria-label="Fechar calendário" onClick={() => setOpen(false)}><X size={15} /></button></div>
            <CalendarPicker value={value} minDate={minDate} maxDate={maxDate} onChange={next => { onChange(next); setOpen(false); }} compact label={`Calendário: ${label}`} />
            {value && <button type="button" className="w-full border border-white/10 bg-black px-4 py-2 text-xs text-zinc-300 hover:text-primary" onClick={() => { onChange(''); setOpen(false); }}>Limpar data</button>}
        </div>}
    </div>;
}
