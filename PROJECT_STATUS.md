# PIXICO Barber — auditoria e conclusão técnica

Atualizado em 02/10/2026, America/Bahia. Branch: `finalizacao-pixico`.
Escopo autorizado: arquivos e commits locais. Nenhum push, deploy, alteração de
Cloudflare ou execução de SQL remoto foi realizado.

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
- Regras remotas: dias/horários, almoço, férias, bloqueios, limites diário/turno e
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
notificação. O controle de som sem implementação foi retirado. WhatsApp abre texto
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
  A exclusão é testada; disputa real de locks/capacidade exige staging.
- Testes de navegador funcional usam HTTP simulado. PWA usa build/SW reais.
  Headers de Cloudflare e experiência física mobile exigem validação externa.
- Tokens JWT já emitidos podem valer até expirar, mesmo com refresh revogado.
- Bucket público legado mantém fotos públicas. Policies desconhecidas adicionais
  de Storage e funções SECURITY DEFINER reais precisam de auditoria no preflight.
- Domínio Supabase customizado exige ajuste explícito da CSP antes de publicar.
- Fechar horário impede novas reservas; não cancela nem apaga as já existentes.

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
| VALID | P1 | Build/lint/SQL/navegador e audit | Revisão final em andamento |
| PWA | P1 | Cache seguro, offline e update | Offline e atualização testados em build real |
| RELEASE | P1 | CI, headers, configuração e roteiro de rollout | Preparado; nada publicado |
| DEPS | P1 | Dependências compatíveis com lock e audit | Atualizadas; audit com zero vulnerabilidades |
| SCALE | P2 | Filtros remotos/visualização paginada | Leituras completas + chunks feitos; filtros pendentes |
| MEDIA | P2 | Storage e migração de imagens legadas | Pendente |
| UX | P2 | Acessibilidade/observabilidade/telemetria completa | Parcial; pendente |
| CLEAN | P3 | Refinamentos mantendo identidade | Mocks/factories/fallbacks removidos; opcionais pendentes |

## Validação

- `npm run check`: lint sem erros, **28 testes** aprovados e build sem aviso de chunk
  grande na última execução. Inclui contatos/overrides e rollback de migration com conflito legado.
- `npm run test:e2e`: 9/10 aprovados; ajustes de layout a 320 px em validação.
  Cadastro, login/logout, proteção, reserva/cancelamento, conflito, recuperação completa,
  erro de gravação e configurações estão cobertos.
- `npm run test:pwa`: aprovado, com Chromium/build/SW reais, offline e caches.
- SQL: roles/RLS, tentativas de fraude, notas privadas, exclusão, duração, bloqueios,
  limites, cancelamento, proposta, histórico e JSON inválido.
- Audit final: zero vulnerabilidades. Verificação de secrets/grants e commits em andamento.
- Nenhum comando remoto de mutação executado.

## Checklist até produção

- [x] Auditoria completa antes da implementação e preservação do checkout original.
- [x] Plano P0–P3 na raiz.
- [x] Implementar correções P0/P1 e preparar SQL transacional sem apagar dados.
- [x] Validar RLS/cadastro malicioso/autopromoção/notas privadas em banco descartável.
- [x] Validar duração/conflito/almoço/bloqueios/capacidade/status/preços em SQL local.
- [x] Testar cadastro, login, recuperação, logout e falhas de reserva/gravação no navegador.
- [x] Testar PWA offline/cache em build real.
- [ ] Concluir revisão final 320 px, lint/build/testes/audit/secrets e commits locais.
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

92% estimados da etapa local; gates externos permanecem abertos. Percentuais se
referem a entregas verificadas, não à duração exata. Estimativa restante: 8–15 min,
revisável caso os testes revelem novos problemas. Não equivale a 92% de prontidão
produtiva. Nenhuma previsão de fim da homologação pode ser precisa sem acesso,
dados reais e autorização. Roteiro completo: [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md).

## Referências

[Auth events](https://supabase.com/docs/reference/javascript/auth-onauthstatechange),
[Logout e sessões](https://supabase.com/docs/guides/auth/signout),
[Exclusão de intervalos](https://www.postgresql.org/docs/15/rangetypes.html),
[RPCs com joins](https://docs.postgrest.org/en/v13/references/api/resource_embedding.html),
[Headers Pages](https://developers.cloudflare.com/pages/configuration/headers/),
[SPA no Pages](https://developers.cloudflare.com/pages/configuration/serving-pages/).
