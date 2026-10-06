# PIXICO Barber — auditoria e conclusão técnica

## Implantação inicial real — 06/10/2026

- Preflight READ ONLY executado com sucesso no Supabase `pnsqtpoypbweummokhia`.
- Backup lógico pré-migration salvo localmente fora do repositório em `C:\Users\johnv\PixicoBackups\2026-10-06_before_foundation.json`.
- Foundation aplicada no Supabase real como migration `production_foundation_20261006`.
- Dados de teste de clientes/agendamentos removidos; conta admin PIXICO preservada.
- Catálogo de lançamento: 18 serviços ativos/agendáveis. Serviço legado `Sobrancelha` preservado, porém inativo e oculto.
- PostgREST público validado contra o projeto real: catálogo, expediente e dados do negócio respondendo corretamente.
- Build de produção com a URL/chave pública reais aprovado localmente.
- Cloudflare Pages já contém configuração do mesmo Supabase no deploy atual; publicação do novo frontend ainda é o gate final.
- Configuração Auth ainda requer troca do Site URL `localhost:3000` para `https://pixicobarber.pages.dev` e redirects exatos antes de validar recuperação de senha.

Atualizado em 06/10/2026, America/Bahia. Branch: `finalizacao-pixico`.
Escopo autorizado: arquivos e commits locais. Nenhum push, deploy, alteração de
Cloudflare ou execução de SQL remoto foi realizado.

## Finalização das regras confirmadas — 06/10/2026

Esta seção substitui os números de validação e as regras da auditoria de 02/10
registrada abaixo. Trabalho restrito a este repositório, sem acesso a produção,
sem push, sem instalação de dependências e sem audit online nesta etapa.

Os commits `49b38b5` e `f97862e` foram revisados e preservados. A continuação
partiu dos três arquivos pendentes existentes; não repetiu a auditoria completa
nem introduziu novas funcionalidades. Documentação pública de Supabase/PostgreSQL
foi consultada; nenhum projeto remoto foi conectado.

- PIXICO Barber; WhatsApp **5571994096863**; endereço **R. da Palestina, 297c -
  Itacaranha, Salvador - BA, 40713-660**.
- Terça a sábado, 09:00–20:00; pausa padrão 13:00–15:30; domingo/segunda fechados.
  Inícios na grade absoluta de 15 minutos (:00/:15/:30/:45). Toda a duração deve
  caber em um intervalo livre. Sem limites artificiais por dia ou turno.
- Exceção de data contém `disponivel`, `intervalos` e `bloqueios`, com múltiplas
  faixas e precisão de minuto. Substitui integralmente dias, expediente, pausa,
  férias e fechamentos globais. O admin deve incluir a pausa desejada na exceção.
  Feriados são decididos manualmente; não há calendário automático de feriados.
- Salvar/retirar exceção, mudar expediente ou dias permitidos de serviço é
  rejeitado atomicamente se invalidar reserva ativa futura, inclusive iniciada
  e ainda não encerrada. O erro informa reserva/data; remarque ou cancele primeiro.
  Propostas e solicitações sem reserva são revalidadas ao confirmar/aceitar.
- Catálogo: 18 serviços confirmados, preços/durações testados individualmente.
  Corte criança: R$ 50 / 45 min, somente terça/quarta/quinta, mesmo com domingo
  aberto. Bigodin: R$ 5 / 5 min, mantendo inícios a cada 15 min. Freestyle:
  R$ 5 / 30 min, exatamente como informado. Pigmentação: R$ 20 / 15 min de cadeira.
- Platinado (R$ 100) e Luzes (R$ 80): duração variável, aplicação aproximada de
  15 min **não é término do atendimento**. Pedido `solicitado`, término nulo,
  sem reserva garantida; aparece na fila administrativa e no painel do cliente.
  Admin define data/início/fim ocupado para confirmar, incluindo processamento
  e lavagem. Ocupação conservadora contínua de **30 a 480 min**, sem sobreposição
  ou passagem por bloqueio/pausa. Esse mínimo de 30 min é uma proteção técnica
  interpretada, a validar com o profissional; não é duração química prometida.
  Não há aproveitamento automático de tempo de processamento para outro cliente.
- Migração alterada somente em `202610010001_production_foundation.sql`, sem
  aplicação remota. Preserva histórico antes de atualizar preços; reutiliza UUIDs
  por nome normalizado/aliases; mantém fotos, perfis, usuários e Storage. Serviços
  desconhecidos são preservados. Duplicatas ambíguas, conflitos de horário ou
  químicos ativos futuros legados abortam tudo para revisão, sem apagar dados.
  Reservas fixas existentes preservam sua duração ocupada ao remarcar, mesmo se
  o catálogo mudar. RLS, grants, roles, notas privadas, notificações e exclusão
  GiST foram preservados; o lock transacional também cobre mudanças em serviços.

Revisão final desta continuação:

- Backfill usa o preço promocional disponível antes de atualizar o catálogo,
  preservando valores já registrados. Continua sem recuperar com certeza um preço
  histórico nunca salvo. Duração legada é preservada como intervalo, sem arredondar
  segundos ao remarcar. Permissões de funções privadas de outros usos são mantidas.
- Foundation aborta antes das alterações se já houver tabelas da fundação ou se
  faltar o trigger legado de cadastro habilitado. Se uma versão anterior já foi
  aplicada, será necessário SQL incremental revisado, não executar este arquivo.
- Preflight acompanha os dois schemas: somente leitura/ROLLBACK, timeouts, RLS,
  triggers, versões/extensões, aliases ambíguos, químicos ativos e reservas a
  revisar perante os novos padrões. Relatórios de padrões não consideram overrides
  como justificativa automática; os resultados exigem revisão do operador.
- Pedido químico sem reserva pode ser cancelado mesmo após o horário preferido.
  Admin valida data, início na grade e ocupação completa antes de enviar; conflito
  mantém os campos para retry. O modal apresenta o erro da ação uma única vez.
- Calendário desconsidera pedidos sem fim/cancelados/rejeitados ao calcular sua
  extensão. Restaurar exceção usa o tratamento de gravação confirmada do cache;
  releitura falha fica no aviso compartilhado, sem sugerir nova exclusão.
- Testes SQL têm fixtures isoladas; quatro cenários antes dependentes da ordem
  também passaram executados sozinhos. PWA aguarda o reload real antes de consultar
  caches, corrigindo a corrida observada. Passou em três repetições completas.
- Nenhum auxiliar temporário de edição ficou no repositório. Os dois scripts em
  `scripts/` são usados pelo build e foram mantidos. Não houve refatoração visual.
- Modal químico abre com cabeçalho/fechamento acessíveis e sem overflow em 320/390 px.
  A captura rolada durante edição não representa corte do cabeçalho na abertura;
  o alinhamento original foi mantido. O botão de fechar recebeu nome acessível.

Commits locais desta continuação: `294fc1f` (foundation/preflight/legado e fixtures)
e `b8d08de` (confirmação química/calendário/cache/E2E), seguidos da consolidação
dos testes PWA, geometria do modal e roteiro de homologação. Os dois commits
anteriores solicitados permanecem ancestrais intactos desta branch.

Validação final desta etapa: **50 testes Node/SQL**, **20 cenários de navegador** e
**2 de PWA** (72 distintos), todos aprovados; lint, build e `git diff --check`. SQL executado em
PGlite descartável, incluindo rollback, preservação de legado, catálogo completo,
exceções, restrições, pedidos químicos e duas inserções concorrentes na fila local.
O teste de exclusão também contorna o trigger para provar a constraint independente.
PGlite serializa consultas: **não valida disputa real entre duas conexões**.
Os testes funcionais usam somente backend simulado local e bloqueiam HTTP externo.
Build/Chromium foram executados localmente, com backend somente em localhost.
Nenhum Supabase produtivo, Cloudflare ou GitHub remoto foi acessado. Fontes externas
existentes no HTML não foram alteradas; os testes de navegador/PWA bloqueiam HTTP
fora de localhost. Scan do bundle não detectou chave privilegiada; somente
`.env.example` está versionado. Audit online não foi repetido; o resultado de
02/10 abaixo é histórico. Build final sem aviso de chunk grande.

Próximo passo seguro: somente com autorização específica, homologar em PostgreSQL/Supabase descartável
isolado de produção, com cópia revisada do legado, duas conexões concorrentes e
PostgREST/RPC reais. Confirmar duração química, possíveis aliases de catálogo,
dados conflitantes e overrides antes de qualquer autorização de produção.
Não publicar frontend novo contra schema antigo. Roteiro em RELEASE_CHECKLIST.md.

Arquivos da entrega acumulada de regras e revisão (21):

| Área | Arquivos |
|---|---|
| Banco | `supabase/migrations/202610010001_production_foundation.sql`, `supabase/preflight.sql` |
| Regras e dados | `src/lib/bookingRules.js`, `src/hooks/useSupabase.js`, `src/data/models.js`, `src/stores/availabilityStore.js`, `src/stores/settingsStore.js` |
| Cliente | `src/pages/BookingPage.jsx`, `src/pages/DashboardPage.jsx` |
| Admin | `src/components/DayOverrideEditor.jsx`, `src/pages/admin/AdminDisponibilidade.jsx`, `src/pages/admin/AdminAgendamentos.jsx`, `src/pages/admin/AdminCalendario.jsx`, `src/pages/admin/AdminDashboard.jsx`, `src/pages/admin/AdminServicos.jsx` |
| Testes | `tests/database.test.js`, `tests/rules.test.js`, `tests/e2e/flows.spec.js`, `tests/pwa/offline.spec.js` |
| Documentação | `PROJECT_STATUS.md`, `RELEASE_CHECKLIST.md` |

Capturas locais de QA (não versionadas): `test-results/date-override-mobile.png`
e `test-results/chemical-confirmation-mobile.png`. Editor de exceções e modal de
confirmação química revisados a 390 px, com a identidade visual existente.

## Ambiente e localização do trabalho

Checkout original: `C:\Windows\System32\pixicobarber`. A sessão não conseguia
escrever arquivos/.git devido às ACLs. O repositório, inclusive .git e a alteração
preexistente do package-lock, foi preservado em uma cópia gravável:
**`C:\Users\johnv\Projects\pixicobarber-finalizacao`**.
Todas as entregas estão nessa cópia. O original permanece sem as correções;
não houve mudança das ACLs. O lockfile foi atualizado junto às dependências.

## Arquitetura atual

React 19 + Vite 7 + Router 7 + Tailwind 3 + GSAP + Lucide. SPA com home, cadastro,
login, recuperação, reserva, painel do cliente e nove telas administrativas.
A identidade visual/galeria/assets foram preservados. Telas admin e home são
carregadas por rota; SDK Supabase é um chunk separado.

Supabase é a única fonte de autenticação e dados. AuthProvider restaura/renova
sessões e consulta role em profiles. Guards controlam navegação; a autorização real
é exercida por RLS, grants, triggers e RPCs. Não há backend próprio/service_role.

Hooks usam leituras paginadas, isolamento de identidade, erros/retry, Realtime e
polling. Stores compartilhadas mantêm apenas cache em memória de expediente,
exceções, configurações, notificações e despesas. Cache privado é limpo ao mudar
a sessão. localStorage só contém sessão gerenciada pelo SDK e preferência de PWA;
senhas, agenda e cadastros locais foram removidos do código, sem apagar dados do navegador.

SQL legado: schema.sql é baseline histórica para banco novo descartável;
fix_definitivo.sql foi desativado para impedir recriação do trigger vulnerável.
Migration versionada e preflight foram preparados. PWA tem manifesto/ícones, SW
com cache estático e página offline informativa. Deploy previsto: GitHub → Pages,
sem publicação efetuada.

## Auditoria inicial e causa raiz

Todos os fontes, stores, SQL, configurações, rotas e estilos do repositório foram
inspecionados; imagens binárias preservadas. Achados da versão original:

- Admin por e-mail fixo/metadados editáveis; cadastro SQL aceitava role do usuário.
- UPDATE próprio permitia autopromoção; policy admin de profiles podia recursar.
- Login local com senha em texto claro/administrador embutido.
- Reservas sem exclusão de conflitos, duração, expediente, almoço, capacidade ou
  validação de transição no servidor; status arbitrário no INSERT.
- Regras, notas/tags/blacklist, despesas, configurações e notificações locais.
- Preço atual alterava receita histórica; conclusão não persistia pagamento.
- Proposta alterava reserva diretamente e não suportava aceite seguro.
- Recuperação sem ação; refresh de perfil vazio; listener de Auth sem cleanup.
- Calendário com variável fora de escopo, reserva sempre 30 min e envio duplicado.
- Erros engolidos/listas vazias e modais fechados mesmo quando gravação falhava.
- SW com fallback inválido, versões misturadas e remoção de caches alheios.
- Scripts SQL sem migrations, testes ou documentação de publicação.

Baseline: lint **48 erros + 1 aviso**; build bloqueado por EPERM em System32;
audit de produção **10 achados (7 altos, 2 moderados, 1 baixo)**.
A árvore completa instalada inicialmente também continha vulnerabilidades.

## O que funciona na implementação local

- Cadastro por Supabase, sucesso com confirmação de e-mail, login por role do banco,
  sessão restaurada, logout aguardado e recuperação/alteração de senha.
- Coordenação de eventos de Auth, cleanup e descarte de resultados obsoletos.
  Renovação do perfil não desmonta formulários de uma sessão já identificada.
  Logout normal é local; recuperação de senha solicita revogação global.
- Agenda usa slots do servidor e duração/preço promocional reais. Guard de envio
  duplo, conflito acionável e formulário preservado quando gravação falha.
- Regras remotas: dias/horários, almoço, férias, bloqueios, exceções completas e
  janela de 60 dias no fuso America/Bahia.
- Exclusão PostgreSQL de intervalos sobrepostos, inclusive serviços de duração
  diferente; lock transacional coordena reservas e alteração de regras.
- Cancelamentos, confirmação, rejeição, ausência, conclusão com cobrança/pagamento
  e proposta com aceite. A proposta preserva o horário original; o novo horário
  é revalidado no aceite e pode ter ficado ocupado.
- Perfis administrativos, notas/tags/favoritos/blacklist, configurações, despesas
  e notificações persistidos. Contato público/WhatsApp lê configurações salvas;
  números brasileiros recebem DDI quando informado apenas DDD/número.
- Notas privadas de perfil/agendamento protegidas por grants e RPCs que verificam
  admin. Tabelas com essas notas não são transmitidas diretamente pelo Realtime.
- Históricos preservam nome/preço reservado e cobrança. Encerrados não podem ser
  reabertos nem ter horário histórico alterado.
- Notificações e trilha de status geradas no mesmo commit de banco.
- Serviço inativo visível ao admin; cliente não altera catálogo/regras/financeiro.
- Erros/loading/retry, fronteira de erros, rota desconhecida e feedback de gravação.
- Fotos após autenticação, com tipos/tamanho/redimensionamento e erro de leitura.
  Cadastro não inclui imagens grandes em JWT/metadados.
- PWA: navegação online, offline informativo, cache só de assets/ícones e atualização
  explícita. Não há cache persistente de consultas privadas ou fila offline.
- Build com proteção contra chave privilegiada em VITE_, exemplo de ambiente seguro,
  headers CSP/segurança/cache e CI de validação preparados.

Esses pontos foram implementados/testados localmente. A entrega/renovação de tokens
pelo serviço real, SMTP, configuração instalada e produção não foram homologadas.

## O que ainda está quebrado/incompleto

Não há falha P0 conhecida sem correção preparada no código local. **A produção
continua com a versão e schema anteriores**, pois não houve autorização para alterá-la.
A aplicação nova não deve ser publicada sem aplicar/homologar a migration.

Não foi possível verificar remotamente schema efetivo, dados legados, admins,
SMTP, redirect URLs, RLS/Storage extras, backups, Realtime e configuração do Pages.
A aplicação real só será considerada pronta após os gates externos abaixo.

P2: upload de imagens/base64 legado para Storage; filtros/paginação visual no servidor
para grandes volumes (as leituras já deixam de truncar silenciosamente em 1.000 rows);
observabilidade sem dados pessoais, acessibilidade completa e testes físicos Android/iOS.
Última atividade de perfil ainda usa os dados legados; telemetria de presença não foi criada.
P3: refinamentos de textos e redução de imports legados sem alteração visual.

Não existem push, lembretes cron, envio automático WhatsApp nem som automático de
notificação. O controle de som sem implementação foi retirado. Falha de encerramento
após troca de senha permite retry sem repetir a alteração; gravação confirmada com
releitura falha mantém sucesso e expõe erro de atualização. WhatsApp abre texto
para o operador enviar. A agenda atende **um barbeiro**; multi-profissional exige
evolução de schema e escopo, não apenas um filtro de frontend.

## Riscos e limites críticos remanescentes

- Migration não aplicada: fixes de segurança do banco ainda não protegem produção.
- Admins criados anteriormente precisam de revisão manual; nenhuma conta foi removida
  ou rebaixada automaticamente.
- Conflitos/linhas inválidas legadas abortam a migration inteira. Não excluir dados
  para contornar; preparar resolução revisada após preflight/backup.
- Preços nunca registrados no passado não podem ser recuperados com certeza:
  o backfill usa o catálogo disponível e precisa de revisão financeira.
- Frontend antigo é incompatível com os novos grants. Rollout precisa de janela
  coordenada; rollback não deve restaurar policies vulneráveis.
- PGlite testa SQL PostgreSQL real em ambiente descartável com Auth/Storage simulados.
  Não reproduz GoTrue, PostgREST nem duas conexões PostgreSQL simultâneas.
  A exclusão é testada; disputa real de locks exige staging.
- Testes de navegador funcional usam HTTP simulado. PWA usa build/SW reais.
  Headers de Cloudflare e experiência física mobile exigem validação externa.
- Tokens JWT já emitidos podem valer até expirar, mesmo com refresh revogado.
- Bucket público legado mantém fotos públicas. Policies desconhecidas adicionais
  de Storage e funções SECURITY DEFINER reais precisam de auditoria no preflight.
- Domínio Supabase customizado exige ajuste explícito da CSP antes de publicar.
- Fechar horário com reserva ativa incompatível é rejeitado; exige remarcação ou
  cancelamento explícito anterior, sem apagar histórico.

## Prioridades

| ID | Prioridade | Entrega | Estado |
|---|---|---|---|
| AUTH-TRUST | P0 | Remover admin/fallback inseguro; role confiável e sessão | Implementado local |
| DB-ROLE | P0 | Cadastro client, grants e RLS sem autopromoção/recursão | SQL testado; aplicar autorizado |
| DB-SLOT | P0 | Exclusão, duração, expediente/capacidade e transições | SQL testado; disputa real em staging |
| PRIVACY | P0 | Notas administrativas protegidas em REST/RPC/Realtime | SQL testado; revisar políticas reais |
| AVAIL | P1 | Expediente/exceções remotos compartilhados | Implementado local |
| RECOVER | P1 | E-mail de confirmação, recuperação e logout | Navegador simulado; SMTP real pendente |
| ADMIN | P1 | Status, conclusão/pagamento, cancelamento e remarcação | Implementado/testado local |
| DATA | P1 | Clientes/imagens/tags/blacklist e contato/configuração | Implementado local |
| FIN | P1 | Preço histórico, cobrança e despesas | Implementado/testado; backfill a revisar |
| NOTIF | P1 | Notificações/trilha no servidor e leitura persistente | Implementado/testado local |
| VALID | P1 | Build/lint/SQL/navegador e audit | Concluído local: 43 testes, lint/build e audit aprovados |
| PWA | P1 | Cache seguro, offline e update | Offline e atualização testados em build real |
| RELEASE | P1 | CI, headers, configuração e roteiro de rollout | Preparado; nada publicado |
| DEPS | P1 | Dependências compatíveis com lock e audit | Atualizadas; audit com zero vulnerabilidades |
| SCALE | P2 | Filtros remotos/visualização paginada | Leituras completas + chunks feitos; filtros pendentes |
| MEDIA | P2 | Storage e migração de imagens legadas | Pendente |
| UX | P2 | Acessibilidade/observabilidade/telemetria completa | Parcial; pendente |
| CLEAN | P3 | Refinamentos mantendo identidade | Mocks/factories/fallbacks removidos; opcionais pendentes |

## Validação da auditoria anterior (02/10; resultados atuais acima)

- **43 testes distintos aprovados**: 29 testes Node/SQL, 12 cenários funcionais
  Playwright e 2 cenários de PWA. Cadastro/login também passaram em 6 repetições
  adicionais para verificar a coordenação da sessão.
- `npm run check`: lint sem erros, 29 testes aprovados e build sem aviso de chunk
  grande. Inclui contatos/overrides e rollback integral de migration com conflito legado.
- `npm run test:e2e`: 12 cenários aprovados. Nove telas administrativas a 320/390 px
  e rotas públicas/de cliente a 320 px, sem overflow ou erro de execução.
  Cadastro, login/logout, proteção de role, reserva/cancelamento, conflito,
  recuperação completa, erro de gravação, contato salvo e flags persistidas cobertos.
  A recuperação com senha já alterada e logout falhando repete somente o encerramento.
- `npm run test:pwa`: 2 cenários aprovados com Chromium/build/SW reais. Offline,
  atualização e preservação de caches de outros aplicativos verificados. A versão
  do SW deriva do conteúdo do build e dos assets estáticos.
- SQL: roles/RLS, tentativas de fraude, notas privadas, exclusão, duração, bloqueios,
  limites, cancelamento, proposta, histórico e JSON inválido.
- Build final: entrada 344,62 kB; Supabase 223,38 kB; home 138,38 kB.
  `npm run build:production` sem configuração pública é rejeitado intencionalmente;
  isso impede publicar um build sem conexão configurada.
- `npm audit --audit-level=high`: zero vulnerabilidades.
  Bundle sem chave privilegiada detectada; somente `.env.example` versionado.
  `git diff --check` aprovado. Alterações organizadas em sete commits locais.
- Nenhum comando remoto de mutação executado. Testes funcionais usam HTTP simulado
  local; SQL usa banco descartável. As limitações de homologação permanecem explícitas.

## Checklist até produção

- [x] Auditoria completa antes da implementação e preservação do checkout original.
- [x] Plano P0–P3 na raiz.
- [x] Implementar correções P0/P1 e preparar SQL transacional sem apagar dados.
- [x] Validar RLS/cadastro malicioso/autopromoção/notas privadas em banco descartável.
- [x] Validar duração/conflito/almoço/bloqueios/capacidade/status/preços em SQL local.
- [x] Testar cadastro, login, recuperação, logout e falhas de reserva/gravação no navegador.
- [x] Testar PWA offline/cache em build real.
- [x] Concluir revisão final 320 px, lint/build/testes/audit/secrets e commits locais.
- [ ] Autorizar acesso de homologação e executar preflight somente leitura no banco real.
- [ ] Revisar admins, serviços, expediente, backfill e dados/policies reais.
- [ ] Backup verificável e aplicar migration em staging, com autorização.
- [ ] Configurar SMTP/Site URL/redirects/senha no Supabase de staging.
- [ ] Homologar PostgREST/RPCs/joins, Auth/Realtime e concorrência com duas conexões reais.
- [ ] Testar Android/iOS físicos e headers/CSP/fallback no Pages de preview autorizado.
- [ ] Aprovar janela de rollout, SQL e publicação/branch/variáveis públicas.
- [ ] Autorizar expressamente cada push/deploy/migration produtiva.
- [ ] Executar rollout autorizado, smoke tests e monitoramento sem secrets.

## Progresso

**100% da etapa local de auditoria e implementação P0/P1 concluída. Tempo restante
nessa etapa: 0 minutos.** As correções preparadas e verificadas estão na cópia
local indicada acima. Isso não representa 100% de prontidão produtiva: aplicação
real da migration, configuração e homologação externa continuam necessárias.
P2/P3 e gates externos permanecem registrados; não há previsão confiável para
encerrá-los sem os dados, acessos e autorizações correspondentes.
Roteiro completo: [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md).

## Referências

[Auth events](https://supabase.com/docs/reference/javascript/auth-onauthstatechange),
[Logout e sessões](https://supabase.com/docs/guides/auth/signout),
[Exclusão de intervalos](https://www.postgresql.org/docs/15/rangetypes.html),
[RPCs com joins](https://docs.postgrest.org/en/v13/references/api/resource_embedding.html),
[Headers Pages](https://developers.cloudflare.com/pages/configuration/headers/),
[SPA no Pages](https://developers.cloudflare.com/pages/configuration/serving-pages/).