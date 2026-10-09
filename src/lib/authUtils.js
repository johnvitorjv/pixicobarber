export function profileToUser(authUser, profile) {
    if (!profile || profile.id !== authUser.id) throw new Error('Perfil inválido');
    return {
        id: authUser.id, email: authUser.email || '', nome: profile.nome || '',
        sobrenome: profile.sobrenome || '', whatsapp: profile.whatsapp || '', whatsappOptIn: profile.whatsapp_opt_in === true,
        fotoUrl: profile.foto_url || '', role: profile.role === 'admin' ? 'admin' : 'client',
        isDeveloper: profile.is_developer === true,
        nascimento: profile.nascimento, criadoEm: profile.criado_em,
    };
}
export function authMessage(error) {
    if (error.code === 'email_not_confirmed') return 'Confirme seu e-mail antes de entrar.';
    if (error.code === 'invalid_credentials') return 'E-mail ou senha incorretos.';
    if (error.status === 429) return 'Muitas tentativas. Aguarde alguns minutos.';
    if (error.code === 'weak_password') return 'Escolha uma senha mais forte, com pelo menos 8 caracteres.';
    return 'Não foi possível concluir o acesso. Verifique os dados e tente novamente.';
}
