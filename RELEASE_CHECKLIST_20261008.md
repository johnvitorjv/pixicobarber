# PIXICO BARBER — relatório de liberação (08/10/2026)

## Infraestrutura e produção
- Hostinger: domínio registrado e e-mail de titular validado.
- Cloudflare Pages: pixicobarber.site, www.pixicobarber.site e pixicobarber.pages.dev apontam para o MESMO projeto. Certificado HTTPS funcionando nas três URLs.
- GitHub: branch main recebeu a atualização 3ecc27b, implantada com sucesso pela Cloudflare; versão anterior recuperável pelo histórico de deployments (commit 495e19b).
- Pós-deploy: nove rotas/hosts no Chromium headless responderam HTTP 200, sem exceções JS, e API pública de serviços Supabase respondeu HTTP 200.
- Conta João Silva no banco: perfil client com is_developer=true (janela sem limitação de sete dias).

## Agendamentos
- Cliente pode solicitar troca de serviço, data e horário até o dia anterior, quando há vaga para a duração total do novo serviço.
- A troca cancela a reserva anterior e abre um novo pedido pendente de aprovação, em uma transação atômica.
- Clientes comuns têm horizonte de sete dias; desenvolvedor tem exceção. Toda validação crítica ocorre no servidor.
- Sugestão pelo barbeiro usa horários consultados no servidor. A aceitação cabe ao cliente, e não ao administrador.
- Validações locais: 53 testes Node/PGlite, ESLint, Vite e suites Playwright; rodadas específicas confirmaram recusa motivada e proposta sem WhatsApp obrigatório.
- Não foram criados ou alterados agendamentos de clientes reais para fazer testes.

## E-mail
- Remetente: PIXICO Barber <agendamento@pixicobarber.site>; recebimento no domínio não contratado (apenas ENVIO no Resend).
- Resend: DKIM/SPF/MX/CNAME verificados; primeira mensagem enviada através da Edge Function do Supabase, entrega confirmada no Resend e no Gmail do destinatário.
- Fila private.email_outbox e cron dispatch-pixico-emails-every-minute habilitados; cron voltou a registrar execuções bem-sucedidas.
- Senhas/chaves exclusivamente em Vault; não incluir secrets no git.
- Links de e-mail dos gatilhos legados ainda podem apontar para pages.dev, domínio funcional e preservado.

## Pendências não ocultadas
- Imagem do rosto: as fotografias autênticas de referência não foram fornecidas; o asset pixico_owner_about.png foi preservado. Solicitar as fotos antes de alterar feições.
- A migração local 202610070003_email_outbox.sql não representa todos os refinamentos já presentes no banco remoto. Não reaplicar cegamente; reconciliar migrations primeiro.
- npm audit indicou anteriormente sete avisos transitivos do toolchain de desenvolvimento Tailwind/PostCSS; revisar upgrades compatíveis sem mudanças forçadas.
- Monitorar cron e Supabase: ocorreram timeouts antes do restabelecimento; últimas execuções de DB/Edge/cron e envio foram bem-sucedidas.
- Autenticação com credenciais reais, ciclo completo de agendamento e concorrência de múltiplas conexões em PRODUÇÃO não foram executados nesta validação, para preservar dados de clientes.

## Proteções
- PC-SILVA: monitor 3/Opera GX nunca foi acessado, capturado ou modificado.
- Snapshot antes das alterações: C:\Users\johnv\Projects\pixicobarber-snapshot-20261008-142147.
- Rollback do front-end: restaurar deployment Cloudflare do commit 495e19b se necessário; manter migrações de produção, sem apagar agendamentos.
