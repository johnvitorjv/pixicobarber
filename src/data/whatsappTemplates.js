// Mensagens curtas e sem símbolos especiais para máxima compatibilidade no WhatsApp.
import { normalizeWhatsApp } from '../lib/contact';
import settingsStore from '../stores/settingsStore';

function formatData(data) {
    if (!data) return '';
    const [ano, mes, dia] = data.split('-');
    return `${dia}/${mes}/${ano}`;
}

export const TEMPLATES = {
    aprovacao: ({ nome, data, faixaInicio }) =>
        `Olá, ${nome}! Seu horário na Pixico Barber foi confirmado: ${formatData(data)}, às ${faixaInicio}. Até lá!`,
    rejeicao: ({ nome, data, motivo }) =>
        `Olá, ${nome}! Não foi possível confirmar seu horário de ${formatData(data)}. ${motivo ? `Motivo: ${motivo}.` : ''} Acesse o site para ver novas opções.`,
    rejeicao_com_sugestao: ({ nome, novaData, novaFaixa, motivo }) =>
        `Olá, ${nome}! Temos outra opção para você: ${formatData(novaData)}, ${novaFaixa}. ${motivo ? `Motivo da alteração: ${motivo}.` : ''} Confira e aceite no seu painel: https://pixicobarber.pages.dev/painel`,
    remarcacao_confirmada: ({ nome, data, faixaInicio }) =>
        `Olá, ${nome}! Seu novo horário foi confirmado: ${formatData(data)}, às ${faixaInicio}. Te esperamos!`,
    lembrete: ({ nome, data, faixaInicio, servicoNome }) =>
        `Olá, ${nome}! Lembrete Pixico: ${servicoNome}, ${formatData(data)} às ${faixaInicio}. Se não puder comparecer, cancele pelo painel.`,
    cobranca_confirmacao: ({ nome }) =>
        `Olá, ${nome}! Sua solicitação na Pixico está aguardando aprovação. Acompanhe pelo site.`,
    nao_compareceu: ({ nome, data }) =>
        `Olá, ${nome}. Você não compareceu ao agendamento de ${formatData(data)}. Em caso de imprevisto, fale conosco.`,
    boas_vindas: ({ nome }) =>
        `Olá, ${nome}! Bem-vindo à Pixico Barber. Agende seu próximo corte pelo nosso site!`,
};

export function gerarLinkWhatsApp(mensagem, numero) {
    const tel = numero || settingsStore.get().whatsappNumero;
    return `https://wa.me/${normalizeWhatsApp(tel)}?text=${encodeURIComponent(mensagem)}`;
}

export function gerarLinkWhatsAppCliente(whatsappCliente, mensagem) {
    return `https://wa.me/${normalizeWhatsApp(whatsappCliente)}?text=${encodeURIComponent(mensagem)}`;
}
