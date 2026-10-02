export function isPublicKey(key) {
    if (typeof key !== 'string') return false;
    if (key.startsWith('sb_publishable_')) return key.length > 15;
    try {
        const payload = key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(atob(payload)).role === 'anon';
    } catch { return false; }
}
export function validatePublicConfig(url, key, production = false) {
    if (!isPublicKey(key)) throw new Error('Configure VITE_SUPABASE_ANON_KEY com uma chave pública anon ou publishable.');
    let parsed;
    try { parsed = new URL(url); } catch { throw new Error('Configure VITE_SUPABASE_URL com a URL do projeto.'); }
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
    if (parsed.username || parsed.password || parsed.search || parsed.hash || !['https:', 'http:'].includes(parsed.protocol) || (parsed.protocol !== 'https:' && (production || !local))) {
        throw new Error('A URL do Supabase deve usar HTTPS; HTTP só é permitido no desenvolvimento local.');
    }
}
