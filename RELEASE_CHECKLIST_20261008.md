# PIXICO BARBER — situação de liberação (08/10/2026)

## Validado localmente
- ESLint, testes Node/PGlite e Vite build executados com sucesso.
- Playwright: 35 cenários E2E aprovados, incluindo mobile (320–1920 px).
- PWA: 2 cenários aprovados (offline e atualização do service worker).
- A versão publicada responde HTTP 200 em / e /login, sem erros de JavaScript no teste headless.
- Migrações de janela de 7 dias e sugestão de horário instaladas e exercitadas em banco PGlite descartável.
- Corrigida comparação de timestamps na remarcação para impedir ultrapassar meia-noite.
- Snapshot local pré-trabalho existente: C:\Users\johnv\Projects\pixicobarber-snapshot-20261008-142147.

## Impedimentos de liberação em produção
1. Supabase pnsqtpoypbweummokhia: chamadas de SQL e lista de migrações falham por timeout repetidamente. Logs postgres apontam 'cron job 2 job startup timeout'; REST e Edge HTTP também tiveram timeouts. A API real e agendamentos autenticados não foram verificados. Não publicar features dependentes da migração nem ligar os e-mails nessas condições.
2. Resend rejeitou a zona livre pixicobarber.abrdns.com com HTTP 422: "We don't allow free public domains. Please use a domain you own instead." A zona foi criada no ClouDNS e permanece gerenciável. Resend conserva dois domínios anteriores sem verificação. É necessário um domínio próprio compatível e registros DKIM/SPF antes do envio real.
3. A migração local 202610070003_email_outbox.sql diverge da versão remota (produção contém funções/tabelas criadas em etapas posteriores); reconciliar antes de aplicar ou gerar novas migrações.
4. npm audit, último diagnóstico: 5 vulnerabilidades altas e 2 moderadas em dependências transitivas do toolchain Tailwind/PostCSS; não aplicar upgrades maiores sem validar compatibilidade.
5. As duas fotos originais do barbeiro não estão disponíveis nesta sessão; não substituir a imagem do proprietário sem os arquivos autênticos.

## Política de publicação
- Branch de trabalho separado de main; não publicar em produção até teste real de banco, proteção RLS, cron, domínio de e-mail e confirmação das fotografias.
- Não carregar nem versionar .env.local, chaves ou tokens.
- Qualquer dispatch de e-mail permanece inativo até domínio verificado, runtime completo e auditoria da fila pendente.
