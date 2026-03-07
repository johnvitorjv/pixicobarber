import { useState } from 'react';
import financialStore from '../../stores/financialStore';
import { FORMAS_PAGAMENTO } from '../../data/models';
import { useStoreSync } from '../../hooks/useStore';
import { DollarSign, TrendingUp, TrendingDown, Plus, X, ArrowDown, ArrowUp } from 'lucide-react';

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

    const stats = financialStore.getStats(periodo);
    const todas = financialStore.getAll();
    const porServico = financialStore.getPorServico();
    const porPagamento = financialStore.getPorFormaPagamento();

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
                <StatCard icon={TrendingUp} label="Entradas" valor={formatPreco(stats.totalEntradas)} cor="text-emerald-400" bg="bg-emerald-400/10" />
                <StatCard icon={TrendingDown} label="Saídas" valor={formatPreco(stats.totalSaidas)} cor="text-red-400" bg="bg-red-400/10" />
                <StatCard icon={DollarSign} label="Lucro" valor={formatPreco(stats.lucro)} cor="text-primary" bg="bg-primary/10" />
                <StatCard icon={DollarSign} label="Ticket Médio" valor={formatPreco(stats.ticketMedio)} cor="text-blue-400" bg="bg-blue-400/10" />
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
                        <h3 className="font-display font-bold text-sm uppercase tracking-wider mb-4">Por Serviço</h3>
                        {Object.keys(porServico).length === 0 ? (
                            <p className="text-zinc-600 font-modern text-sm">Nenhum dado ainda.</p>
                        ) : (
                            <div className="space-y-2">
                                {Object.entries(porServico).map(([nome, d]) => (
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

                    {/* Por forma de pagamento */}
                    <div className="bg-zinc-900/40 border border-white/5 p-5">
                        <h3 className="font-display font-bold text-sm uppercase tracking-wider mb-4">Por Pagamento</h3>
                        {Object.keys(porPagamento).length === 0 ? (
                            <p className="text-zinc-600 font-modern text-sm">Nenhum dado ainda.</p>
                        ) : (
                            <div className="space-y-2">
                                {Object.entries(porPagamento).map(([forma, d]) => (
                                    <div key={forma} className="flex items-center justify-between py-2 border-b border-white/5">
                                        <span className="font-modern text-sm capitalize">{FORMAS_PAGAMENTO.find(f => f.id === forma)?.label || forma}</span>
                                        <div className="text-right">
                                            <span className="text-primary font-bold text-sm">{formatPreco(d.total)}</span>
                                            <span className="text-zinc-600 text-[10px] ml-2">({d.qtd}x)</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {tab === 'transacoes' && (
                <div className="overflow-x-auto">
                    {todas.length === 0 ? (
                        <div className="bg-zinc-900/40 border border-white/5 p-12 text-center">
                            <p className="text-zinc-500 font-modern">Nenhuma transação registrada.</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-white/10">
                                    {['Tipo', 'Descrição', 'Valor', 'Pgto', 'Data'].map(h => (
                                        <th key={h} className="text-left py-3 px-3 text-[9px] font-bold uppercase tracking-[0.4em] text-zinc-500">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {todas.slice(0, 50).map(tx => (
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
                                        <td className="py-3 px-3 font-modern text-zinc-500 capitalize">{FORMAS_PAGAMENTO.find(f => f.id === tx.formaPagamento)?.label || tx.formaPagamento || '—'}</td>
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

function StatCard({ icon: Icon, label, valor, cor, bg }) {
    return (
        <div className={`${bg} border border-white/5 p-4`}>
            <Icon size={16} className={`${cor} mb-2`} />
            <span className={`text-xl md:text-2xl font-display font-bold ${cor} block`}>{valor}</span>
            <span className="text-[9px] font-bold uppercase tracking-[0.4em] text-zinc-500 mt-1 block">{label}</span>
        </div>
    );
}
