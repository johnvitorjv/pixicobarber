// ═══════════════════════════════════════════════
// PIXICO BARBER — WhatsApp Templates
// ═══════════════════════════════════════════════

const WHATSAPP_NUMBER = '5571994096863';

function formatData(dataStr) {
    if (!dataStr) return '';
    const [y, m, d] = dataStr.split('-');
    return `${d}/${m}/${y}`;
}

export const TEMPLATES = {
    aprovacao: ({ nome, data, faixaInicio, faixaFim }) =>
        `Olá, ${nome}! ✅ Seu horário na PIXICO Barber foi confirmado para ${formatData(data)} na faixa de ${faixaInicio} às ${faixaFim}. Pedimos que chegue sem atraso para manter a organização dos atendimentos. Qualquer imprevisto, nos avise. Obrigado!`,

    rejeicao: ({ nome, data, faixa, motivo }) =>
        `Olá, ${nome}! O horário que você solicitou para ${formatData(data)} em ${faixa} não está disponível no momento por: ${motivo}. Podemos verificar outra data/horário para você. Nos avise pelo WhatsApp se quiser reagendar!`,

    rejeicao_com_sugestao: ({ nome, data, faixa, motivo, novaData, novaFaixa }) =>
        `Olá, ${nome}! O horário que você solicitou para ${formatData(data)} em ${faixa} não está disponível: ${motivo}. Podemos te atender em ${formatData(novaData)} na faixa de ${novaFaixa}? Se estiver bom para você, nos confirme por aqui. 🤝`,

    remarcacao_confirmada: ({ nome, data, faixaInicio, faixaFim }) =>
        `Olá, ${nome}! ✅ Seu horário foi remarcado com sucesso para ${formatData(data)} na faixa de ${faixaInicio} às ${faixaFim}. Te esperamos na PIXICO Barber! 💈`,

    lembrete: ({ nome, data, faixaInicio, servicoNome }) =>
        `Olá, ${nome}! 🔔 Lembrete: Seu ${servicoNome} está marcado para amanhã (${formatData(data)}) às ${faixaInicio}. Conte com a gente! Se precisar de algo, avise. PIXICO Barber 💈`,

    cobranca_confirmacao: ({ nome }) =>
        `Olá, ${nome}! Vimos que seu horário ainda está pendente de confirmação. Pode confirmar para nós? Obrigado! PIXICO Barber 💈`,

    nao_compareceu: ({ nome, data }) =>
        `Olá, ${nome}. Notamos que você não compareceu ao seu horário do dia ${formatData(data)}. Caso tenha tido algum imprevisto, entre em contato para reagendarmos. PIXICO Barber`,

    boas_vindas: ({ nome }) =>
        `Olá, ${nome}! 👋 Bem-vindo à PIXICO Barber! Seu cadastro foi realizado com sucesso. Agora você pode agendar pelo nosso site. Qualquer dúvida, estamos aqui! 💈`,
};

export function gerarLinkWhatsApp(mensagem, numero) {
    const tel = numero || WHATSAPP_NUMBER;
    return `https://wa.me/${tel.replace(/\D/g, '')}?text=${encodeURIComponent(mensagem)}`;
}

export function gerarLinkWhatsAppCliente(whatsappCliente, mensagem) {
    return `https://wa.me/${whatsappCliente.replace(/\D/g, '')}?text=${encodeURIComponent(mensagem)}`;
}
