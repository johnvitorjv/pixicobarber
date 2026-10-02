export default function DataState({ loading, error, retry }) {
    if (error) return <div role="alert" className="p-4 my-4 border border-red-500/30 text-red-400">
        {error} {retry && <button onClick={retry} className="underline ml-3">Tentar novamente</button>}
    </div>;
    if (loading) return <p role="status" className="p-4 my-4 text-zinc-400">Carregando...</p>;
    return null;
}
