export function assertPublicBundleConfig(jsChunks, url, publicKey) {
  const contents = Array.isArray(jsChunks) ? jsChunks.filter(chunk => typeof chunk === 'string') : [];
  const hasUrl = typeof url === 'string' && url.length > 0 && contents.some(chunk => chunk.includes(url));
  const hasKey = typeof publicKey === 'string' && publicKey.length > 0 && contents.some(chunk => chunk.includes(publicKey));
  if (!hasUrl || !hasKey) {
    throw new Error('Build bloqueado: configuração pública do Supabase ausente do JavaScript final.');
  }
}
