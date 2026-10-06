const REGISTRATION_BUCKET = 'pixico-registration';

export function dataUrlToBlob(dataUrl) {
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/jpeg;base64,')) {
        throw new Error('Foto inválida. Selecione a imagem novamente.');
    }
    const [header, payload] = dataUrl.split(',');
    const mime = header.match(/^data:([^;]+);base64$/)?.[1] || 'image/jpeg';
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
}

export async function uploadRegistrationPhoto(supabase, dataUrl) {
    if (!supabase) throw new Error('Cadastro indisponível no momento.');
    const blob = dataUrlToBlob(dataUrl);
    if (blob.size > 512 * 1024) throw new Error('A foto processada ficou muito grande. Escolha outra imagem.');

    const id = crypto.randomUUID();
    const path = `pending/${id}.jpg`;
    const { error } = await supabase.storage
        .from(REGISTRATION_BUCKET)
        .upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false });

    if (error) throw new Error('Não foi possível enviar sua foto. Tente novamente.');

    const { data } = supabase.storage.from(REGISTRATION_BUCKET).getPublicUrl(path);
    if (!data?.publicUrl) throw new Error('Não foi possível preparar sua foto. Tente novamente.');
    return { path, url: data.publicUrl };
}

export { REGISTRATION_BUCKET };
