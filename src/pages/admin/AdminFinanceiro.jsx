import { useState } from 'react';
import financialStore from '../../stores/financialStore';
import { FORMAS_PAGAMENTO, STATUS } from '../../data/models';
import { useStoreSync } from '../../hooks/useStore';
import { isSupabaseConfigured } from '../../lib/supabase';
import { useSupabaseAppointments } from '../../hooks/useSupabase';
import { DollarSign, TrendingUp, TrendingDown, Plus, X, ArrowDown, ArrowUp, Scissors, CreditCard, Calendar } from 'lucide-react';

function formatPreco(v) { return `R$ ${Number(v || 0).toFixed(2)}`; }
function formatData(d) { if (!d) return ''; try { return new Date(d).toLocaleDateString('pt-BR'); } catch { return d; } }

export default function AdminFinanceiro() {
    const storeTick = useStoreSync();
    const [periodo, setPeriodo] = useState('mes');
    const [tab, setTab] = useState('resumo');

    // Nova despesa
    const [despDescricao, setDespDescricao] = useState('');
    const [despValor, setDespValor] = useState('');
    const [despCategoria, setDespCategoria] = useState('despesa');

    // Supabase data
    const sb = isSupabaseConfigured();
    const { appointments: sbApps } = useSupabaseAppointments();

    // ═══ Calcular dados financeiros direto dos agendamentos concluídos ═══
    const hoje = new Date();
    const hojeStr = hoje.toISOString().split('T')[0];

    function getInicioPeriodo() {
        if (periodo === 'dia') return hojeStr;
        if (periodo === 'semana') {
            const d = new Date(hoje);
            d.setDate(hoje.getDate() - hoje.getDay());
            return d.toISOString().split('T')[0];
        }
        if (periodo === 'mes') {
            return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`;
        }
        return '2020-01-01';
    }

    const inicioPeriodo = getInicioPeriodo();

    // Agendamentos concluídos = ENTRADAS financeiras
    const concluidos = sb
        ? sbApps.filter(a => a.status === 'concluido' || a.status === STATUS.CONCLUIDO)
        : [];

    // Filtrar por período
    const concluidosPeriodo = concluidos.filter(a => {
        const d = (a.data || a.criadoEm || '').slice(0, 10);
        return d >= inicioPeriodo && d <= hojeStr;
    });

    // Entradas do financialStore (despesas manuais)
    const despesasStore = financialStore.getSaidas();
    const despesasPeriodo = despesasStore.filter(t => {
        const d = (t.criadoEm || '').split('T')[0];
        return d >= inicioPeriodo && d <= hojeStr;
    });

    // STATS
    const totalEntradas = concluidosPeriodo.reduce((s, a) => s + (a.servicoPreco || 0), 0);
    const totalSaidas = despesasPeriodo.reduce((s, t) => s + (t.valor || 0), 0);
    const lucro = totalEntradas - totalSaidas;
    const ticketMedio = concluidosPeriodo.length > 0 ? totalEntradas / concluidosPeriodo.length : 0;

    // POR SERVIÇO
    const porServico = {};
    concluidosPeriodo.forEach(a => {
        const key = a.servicoNome || 'Serviço';
        if (!porServico[key]) porServico[key] = { total: 0, qtd: 0 };
        porServico[key].total += a.servicoPreco || 0;
        porServico[key].qtd++;
    });

    // TODAS as transações para a lista (entradas + despesas)
    const todasTransacoes = [
        ...concluidosPeriodo.map(a => ({
            id: a.id,
            tipo: 'entrada',
            descricao: `${a.servicoNome || 'Serviço'} — ${a._clienteNome || 'Cliente'}`,
            valor: a.servicoPreco || 0,
            formaPagamento: '',
            criadoEm: a.data || a.criadoEm,
        })),
        ...despesasPeriodo.map(t => ({
            id: t.id,
            tipo: 'saida',
            descricao: t.descricao,
            valor: t.valor,
            formaPagamento: t.formaPagamento || '',
            criadoEm: t.criadoEm,
        })),
    ].sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || ''));

    function addDespesa() {
        if (!despDescricao || !despValor) return;
        financialStore.registrarDespesa({ descricao: despDescricao, valor: Number(despValor), categoria: despCategoria });
        setDespDescricao('');
        setDespValor('');
        setTab('transacoes');
    }

    return (
        <div className="p-6 lg:p-8">
            <div className="mb-6">
                <span className="text-[10px] font-bold uppercase tracking-[1em] text-primary mb-2 block">Gestão</span>
                <h1 className="font-display font-bold text-2xl uppercase tracking-tight">Financeiro</h1>
            </div>

            {/* Period toggle */}
            <div className="flex gap-2 mb-6">
                {['dia', 'semana', 'mes', 'total'].map(p => (
                    <button key={p} onClick={() => setPeriodo(p)}
                        className={`px-4 py-2 text-[10px] font-bold uppercase tracking-wider border transition-colors ${periodo === p ? 'border-primary text-primary bg-primary/5' : 'border-white/10 text-zinc-500 hover:text-white'}`}>
                        {p === 'dia' ? 'Hoje' : p === 'semana' ? 'Semana' : p === 'mes' ? 'Mês' : 'Total'}
                    </button>
                ))}
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                <StatCard icon={TrendingUp} label="Entradas" valor={formatPreco(totalEntradas)} sub={`${concluidosPeriodo.length} atendimento(s)`} cor="text-emerald-400" bg="bg-emerald-400/10" />
                <StatCard icon={TrendingDown} label="Saídas" valor={formatPreco(totalSaidas)} sub={`${despesasPeriodo.length} despesa(s)`} cor="text-red-400" bg="bg-red-400/10" />
                <StatCard icon={DollarSign} label="Lucro" valor={formatPreco(lucro)} sub={lucro >= 0 ? 'Positivo' : 'Negativo'} cor="text-primary" bg="bg-primary/10" />
                <StatCard icon={DollarSign} label="Ticket Médio" valor={formatPreco(ticketMedio)} sub="por atendimento" cor="text-blue-400" bg="bg-blue-400/10" />
            </div>

            {/* Tabs */}
            <div className="flex gap-4 border-b border-white/10 mb-6">
                {['resumo', 'transacoes', 'nova'].map(t => (
                    <button key={t} onClick={() => setTab(t)}
                        className={`pb-3 text-[10px] font-bold uppercase tracking-wider transition-colors border-b-2 ${tab === t ? 'border-primary text-primary' : 'border-transparent text-zinc-500 hover:text-white'}`}>
                        {t === 'resumo' ? 'Resumo' : t === 'transacoes' ? 'Transações' : '+ Despesa'}
                    </button>
                ))}
            </div>

            {tab === 'resumo' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Por serviço */}
                    <div className="bg-zinc-900/40 border border-white/5 p-5">
                        <h3 className="font-display font-bold text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
                            <Scissors size={14} className="text-primary" /> Por Serviço
                        </h3>
                        {Object.keys(porServico).length === 0 ? (
                            <p className="text-zinc-600 font-modern text-sm">Nenhum atendimento concluído no período.</p>
                        ) : (
                            <div className="space-y-2">
                                {Object.entries(porServico)
                                    .sort((a, b) => b[1].total - a[1].total)
                                    .map(([nome, d]) => (
                                        <div key={nome} className="flex items-center justify-between py-2 border-b border-white/5">
                                            <span className="font-modern text-sm">{nome}</span>
                                            <div className="text-right">
                                                <span className="text-primary font-bold text-sm">{formatPreco(d.total)}</span>
                                                <span className="text-zinc-600 text-[10px] ml-2">({d.qtd}x)</span>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        )}
                    </div>

                    {/* Resumo geral */}
                    <div className="bg-zinc-900/40 border border-white/5 p-5">
                        <h3 className="font-display font-bold text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
                            <Calendar size={14} className="text-primary" /> Resumo do Período
                        </h3>
                        <div className="space-y-3">
                            <div className="flex justify-between py-2 border-b border-white/5">
                                <span className="text-zinc-500 text-sm font-modern">Atendimentos concluídos</span>
                                <span className="font-bold text-white">{concluidosPeriodo.length}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-white/5">
                                <span className="text-zinc-500 text-sm font-modern">Total de entradas</span>
                                <span className="font-bold text-emerald-400">{formatPreco(totalEntradas)}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-white/5">
                                <span className="text-zinc-500 text-sm font-modern">Total de despesas</span>
                                <span className="font-bold text-red-400">{formatPreco(totalSaidas)}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-white/5">
                                <span className="text-zinc-500 text-sm font-modern">Lucro líquido</span>
                                <span className={`font-bold ${lucro >= 0 ? 'text-primary' : 'text-red-400'}`}>{formatPreco(lucro)}</span>
                            </div>
                            <div className="flex justify-between py-2">
                                <span className="text-zinc-500 text-sm font-modern">Ticket médio</span>
                                <span className="font-bold text-blue-400">{formatPreco(ticketMedio)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {tab === 'transacoes' && (
                <div className="overflow-x-auto">
                    {todasTransacoes.length === 0 ? (
                        <div className="bg-zinc-900/40 border border-white/5 p-12 text-center">
                            <p className="text-zinc-500 font-modern">Nenhuma transação no período selecionado.</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-white/10">
                                    {['Tipo', 'Descrição', 'Valor', 'Data'].map(h => (
                                        <th key={h} className="text-left py-3 px-3 text-[9px] font-bold uppercase tracking-[0.4em] text-zinc-500">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {todasTransacoes.slice(0, 50).map(tx => (
                                    <tr key={tx.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                                        <td className="py-3 px-3">
                                            {tx.tipo === 'entrada' ? (
                                                <span className="flex items-center gap-1 text-emerald-400 text-[10px] font-bold uppercase"><ArrowDown size={12} /> Entrada</span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-red-400 text-[10px] font-bold uppercase"><ArrowUp size={12} /> Saída</span>
                                            )}
                                        </td>
                                        <td className="py-3 px-3 font-modern">{tx.descricao}</td>
                                        <td className={`py-3 px-3 font-modern font-bold ${tx.tipo === 'entrada' ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {tx.tipo === 'saida' ? '-' : ''}{formatPreco(tx.valor)}
                                        </td>
                                        <td className="py-3 px-3 font-modern text-zinc-500">{formatData(tx.criadoEm)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {tab === 'nova' && (
                <div className="max-w-md">
                    <h3 className="font-display font-bold text-sm uppercase tracking-wider mb-4">Registrar Despesa</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-[0.4em] text-zinc-500 block mb-1">Descrição</label>
                            <input type="text" value={despDescricao} onChange={e => setDespDescricao(e.target.value)} className="w-full bg-black/50 border border-white/10 px-4 py-3 text-white font-modern focus:border-primary focus:outline-none" placeholder="Ex: Produto de limpeza" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-[0.4em] text-zinc-500 block mb-1">Valor</label>
                            <input type="number" value={despValor} onChange={e => setDespValor(e.target.value)} className="w-full bg-black/50 border border-white/10 px-4 py-3 text-white font-modern focus:border-primary focus:outline-none" placeholder="0.00" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-[0.4em] text-zinc-500 block mb-1">Categoria</label>
                            <select value={despCategoria} onChange={e => setDespCategoria(e.target.value)} className="w-full bg-black/50 border border-white/10 px-4 py-3 text-white font-modern focus:border-primary focus:outline-none">
                                <option value="despesa">Despesa</option>
                                <option value="produto">Produto</option>
                                <option value="equipamento">Equipamento</option>
                                <option value="aluguel">Aluguel</option>
                                <option value="outro">Outro</option>
                            </select>
                        </div>
                        <button onClick={addDespesa} disabled={!despDescricao || !despValor} className="w-full bg-primary text-black py-3 font-display font-bold uppercase text-xs tracking-[0.3em] disabled:opacity-30 disabled:cursor-not-allowed">
                            Registrar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function StatCard({ icon: Icon, label, valor, sub, cor, bg }) {
    return (
        <div className={`${bg} border border-white/5 p-4`}>
            <Icon size={16} className={`${cor} mb-2`} />
            <span className={`text-xl md:text-2xl font-display font-bold ${cor} block`}>{valor}</span>
            <span className="text-[9px] font-bold uppercase tracking-[0.4em] text-zinc-500 mt-1 block">{label}</span>
            {sub && <span className="text-[8px] text-zinc-600 mt-0.5 block">{sub}</span>}
        </div>
    );
}
