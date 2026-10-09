# PIXICO BARBER — WhatsApp bridge (PREPARADO, DESLIGADO)

- VM Ubuntu 24.04 x86_64, Oracle 1 GB / 2 GB swap; Node 22+, Baileys.
- Fila privada no Supabase, distinta dos e-mails. Não há envios retroativos.
- Opt-in independente do cliente e do barbeiro. Telefone de cadastro não significa consentimento.
- Bot não recebe tarefas sem chave aleatória forte e sem o modo de produção.

## Próximas etapas APÓS receber e autorizar o número secundário
1. Instalar Node.js 22 na VM e copiar os arquivos desta pasta para /opt/pixico-whatsapp.
2. Instalar as dependências com npm install --omit=dev. Manter o diretório auth privado (0700).
3. Gerar token aleatório forte com 32 bytes; armazenar APENAS seu hash SHA-256 no banco e o token original no servidor com permissão 0600.
4. Emparelhar o telefone pelo QR no terminal sem ativar o envio; confirmar o vínculo.
5. Testar com dois telefones próprios consentidos, os fluxos cliente e admin, retry, conexão e reinício.
6. Só então registrar telefone autorizado do barbeiro em private.whatsapp_settings, habilitar os envios e iniciar o systemd.

## Avisos e segurança
- Baileys é NÃO OFICIAL: existe risco de bloqueio e desconexão do número.
- WhatsApp Web não oferece entrega exactly-once garantida; outbox e diário reduzem duplicações.
- Nenhuma porta de entrada extra: conexão do bot com Supabase por HTTPS de saída. NÃO liberar 3000 nem 8080.
- Nunca commitar o arquivo worker.env real, os arquivos de sessão ou o token.
- Arquivo Edge: supabase/functions/pixico-whatsapp-bridge/index.ts.
- Migração: supabase/migrations/202610090002_whatsapp_staging.sql.
