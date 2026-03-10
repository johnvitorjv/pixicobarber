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
        <div className="p-6 md:p-10 max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                <div>
                    <span className="text-[10px] font-bold uppercase tracking-[1em] text-primary mb-3 block">Relatórios</span>
                    <h1 className="font-display font-bold text-3xl md:text-5xl uppercase tracking-tighter">Financeiro</h1>
                </div>

                {/* Period toggle superior */}
                <div className="flex bg-white/[0.02] border border-white/5 p-1">
                    {[
                        { id: 'dia', label: 'Hoje' },
                        { id: 'semana', label: '7 Dias' },
                        { id: 'mes', label: 'Mês' },
                        { id: 'total', label: 'Total' }
                    ].map(p => (
                        <button key={p.id} onClick={() => setPeriodo(p.id)}
                            className={`px-6 py-3 text-[10px] font-bold uppercase tracking-widest transition-all ${periodo === p.id ? 'bg-primary text-black' : 'text-zinc-500 hover:text-white hover:bg-white/[0.02]'}`}>
                            {p.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
                <StatCard icon={TrendingUp} label="Entradas" valor={formatPreco(totalEntradas)} sub={`${concluidosPeriodo.length} ATENDIMENTOS`} cor="text-emerald-400" />
                <StatCard icon={TrendingDown} label="Saídas" valor={formatPreco(totalSaidas)} sub={`${despesasPeriodo.length} DESPESAS`} cor="text-red-400" />
                <StatCard icon={DollarSign} label="Lucro Líquido" valor={formatPreco(lucro)} sub={lucro >= 0 ? 'SUPERÁVIT' : 'DÉFICIT'} cor={lucro >= 0 ? "text-primary" : "text-red-400"} />
                <StatCard icon={DollarSign} label="Ticket Médio" valor={formatPreco(ticketMedio)} sub="POR SERVIÇO" cor="text-white" />
            </div>

            {/* Tabs Principais */}
            <div className="flex flex-wrap gap-2 border-b border-white/10 mb-8">
                {[
                    { id: 'resumo', label: 'Visão Geral' },
                    { id: 'transacoes', label: 'Extrato Completo' },
                    { id: 'nova', label: '+ Registrar Despesa' }
                ].map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)}
                        className={`px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] transition-colors border-b-2 font-display ${tab === t.id ? 'border-primary text-primary' : 'border-transparent text-zinc-500 hover:text-white'}`}>
                        {t.label}
                    </button>
                ))}
            </div>

            {tab === 'resumo' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Por serviço */}
                    <div className="bg-black border border-white/5 p-8">
                        <h3 className="font-display font-bold text-base uppercase tracking-widest mb-8 flex items-center gap-3 border-b border-white/10 pb-4">
                            <Scissors size={16} className="text-primary" /> Desempenho por Serviço
                        </h3>
                        {Object.keys(porServico).length === 0 ? (
                            <p className="text-zinc-500 font-modern text-sm uppercase tracking-widest text-center py-8">Nenhum atendimento na janela selecionada</p>
                        ) : (
                            <div className="space-y-1">
                                {Object.entries(porServico)
                                    .sort((a, b) => b[1].total - a[1].total)
                                    .map(([nome, d]) => (
                                        <div key={nome} className="flex items-center justify-between py-4 border-b border-white/5 hover:bg-white/[0.02] px-4 -mx-4 transition-colors">
                                            <span className="font-display font-bold uppercase tracking-widest text-xs">{nome}</span>
                                            <div className="text-right">
                                                <span className="text-primary font-display font-bold tabular-nums text-sm">{formatPreco(d.total)}</span>
                                                <span className="text-zinc-500 font-bold text-[9px] uppercase tracking-[0.2em] ml-3">({d.qtd}x)</span>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        )}
                    </div>

                    {/* Resumo geral */}
                    <div className="bg-black border border-white/5 p-8 h-fit">
                        <h3 className="font-display font-bold text-base uppercase tracking-widest mb-8 flex items-center gap-3 border-b border-white/10 pb-4">
                            <Calendar size={16} className="text-primary" /> Balanço do Período
                        </h3>
                        <div className="space-y-1">
                            <div className="flex justify-between items-center py-4 border-b border-white/5">
                                <span className="text-zinc-400 text-[10px] uppercase font-bold tracking-widest">Atendimentos</span>
                                <span className="font-display font-bold tabular-nums text-white text-base">{concluidosPeriodo.length}</span>
                            </div>
                            <div className="flex justify-between items-center py-4 border-b border-white/5">
                                <span className="text-zinc-400 text-[10px] uppercase font-bold tracking-widest">Entradas Brutas</span>
                                <span className="font-display font-bold tabular-nums text-emerald-400 text-base">{formatPreco(totalEntradas)}</span>
                            </div>
                            <div className="flex justify-between items-center py-4 border-b border-white/5">
                                <span className="text-zinc-400 text-[10px] uppercase font-bold tracking-widest">Saídas / Custos</span>
                                <span className="font-display font-bold tabular-nums text-red-400 text-base">{formatPreco(totalSaidas)}</span>
                            </div>
                            <div className="flex justify-between items-center py-4 border-b border-white/5 bg-white/[0.02] px-4 -mx-4">
                                <span className="text-white text-[10px] uppercase font-bold tracking-widest">Lucro Líquido</span>
                                <span className={`font-display font-bold tabular-nums text-xl ${lucro >= 0 ? 'text-primary' : 'text-red-400'}`}>{formatPreco(lucro)}</span>
                            </div>
                            <div className="flex justify-between items-center py-4 px-4 -mx-4 mt-2">
                                <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest">Ticket Médio Geral</span>
                                <span className="font-display font-bold tabular-nums text-white text-sm">{formatPreco(ticketMedio)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {tab === 'transacoes' && (
                <div className="overflow-x-auto bg-black border border-white/5 pt-4">
                    {todasTransacoes.length === 0 ? (
                        <div className="p-16 text-center">
                            <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">O extrato está vazio neste período.</p>
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-white/10 bg-white/[0.02]">
                                    {['Movimento', 'Descrição', 'Valor', 'Data'].map((h, i) => (
                                        <th key={h} className={`py-4 px-6 text-[9px] font-bold uppercase tracking-widest text-zinc-500 ${i === 2 ? 'text-right' : ''}`}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {todasTransacoes.slice(0, 50).map(tx => (
                                    <tr key={tx.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                                        <td className="py-4 px-6">
                                            {tx.tipo === 'entrada' ? (
                                                <span className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3 py-1 text-[9px] font-bold uppercase tracking-widest">
                                                    <ArrowDown size={10} /> Entrada
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 px-3 py-1 text-[9px] font-bold uppercase tracking-widest">
                                                    <ArrowUp size={10} /> Saída
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-4 px-6 font-display font-bold uppercase tracking-tight text-white group-hover:text-primary transition-colors">{tx.descricao}</td>
                                        <td className={`py-4 px-6 font-display font-bold tabular-nums text-right ${tx.tipo === 'entrada' ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {tx.tipo === 'saida' ? '- ' : ''}{formatPreco(tx.valor)}
                                        </td>
                                        <td className="py-4 px-6 font-bold uppercase tracking-widest text-[10px] text-zinc-500">{formatData(tx.criadoEm)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {tab === 'nova' && (
                <div className="max-w-xl bg-black border border-white/5 p-8">
                    <h3 className="font-display font-bold text-lg uppercase tracking-tight mb-8 border-b border-white/10 pb-4">Registrar Lançamento Manual</h3>
                    <div className="space-y-6">
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block mb-3">Descrição da Despesa *</label>
                            <input type="text" value={despDescricao} onChange={e => setDespDescricao(e.target.value)} className="w-full bg-black border border-white/10 px-4 py-4 text-white font-modern focus:border-primary focus:outline-none transition-colors" placeholder="Ex: Fornecedor de Pomadas" />
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block mb-3">Valor (R$) *</label>
                                <input type="number" value={despValor} onChange={e => setDespValor(e.target.value)} className="w-full bg-black border border-white/10 px-4 py-4 text-white font-modern focus:border-primary focus:outline-none transition-colors" placeholder="0.00" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block mb-3">Categoria Operacional</label>
                                <select value={despCategoria} onChange={e => setDespCategoria(e.target.value)} className="w-full bg-black border border-white/10 px-4 py-4 text-white font-modern focus:border-primary focus:outline-none appearance-none cursor-pointer uppercase text-xs tracking-widest">
                                    <option value="despesa">Despesa Geral</option>
                                    <option value="produto">Compra de Produto</option>
                                    <option value="equipamento">Equipamento/Ferramenta</option>
                                    <option value="aluguel">Aluguel/Imóvel</option>
                                    <option value="outro">Outro</option>
                                </select>
                            </div>
                        </div>
                        <button onClick={addDespesa} disabled={!despDescricao || !despValor} className="w-full bg-primary text-black py-4 mt-4 font-display font-bold uppercase text-xs tracking-[0.3em] hover:bg-white transition-colors disabled:opacity-30 disabled:hover:bg-primary disabled:cursor-not-allowed flex items-center justify-center gap-3">
                            <Plus size={16} /> Confirmar Cadastro
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function StatCard({ icon: Icon, label, valor, sub, cor }) {
    return (
        <div className="bg-black border border-white/5 p-6 md:p-8 hover:border-white/20 transition-colors group">
            <div className="flex items-center justify-between mb-6">
                <span className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500">{label}</span>
                <Icon size={18} className={`${cor} opacity-50 group-hover:opacity-100 transition-opacity`} />
            </div>
            <span className={`text-3xl md:text-4xl font-display font-bold tabular-nums block mb-2 ${cor}`}>{valor}</span>
            {sub && <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-600 block">{sub}</span>}
        </div>
    );
}
