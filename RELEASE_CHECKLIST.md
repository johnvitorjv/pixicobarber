# PIXICO — homologação e publicação

## Estado remoto atual — 06/10/2026

- [x] Preflight READ ONLY executado no Supabase real.
- [x] Backup lógico pré-migration salvo localmente.
- [x] Foundation aplicada como `production_foundation_20261006`.
- [x] Clientes/agendamentos históricos de teste removidos; admin PIXICO preservado.
- [x] 18 serviços oficiais ativos/agendáveis; `Sobrancelha` legado inativo/oculto.
- [x] PostgREST público validado no Supabase real e build de produção aprovado.
- [ ] Ajustar Site URL/redirects do Supabase Auth para `https://pixicobarber.pages.dev`.
- [ ] Publicar o novo frontend no Cloudflare Pages e executar smoke test final público.
- [ ] Validar cadastro/login/recuperação de senha e um agendamento real de teste antes da inauguração.

## Gate local atualizado — 06/10/2026

- [x] Regras confirmadas: ter–sáb 09:00–20:00, pausa 13:00–15:30, inícios a cada
  15 min, sem caps; contato/endereço atualizados; 18 serviços com valores confirmados.
- [x] Exceções completas por data, vários intervalos/bloqueios, abertura dom/seg,
  fechamento e restauração do padrão com proteção de reservas futuras.
- [x] Corte criança ter/qua/qui; Platinado/Luzes com solicitação sem reserva,
  duração variável e confirmação administrativa da ocupação total.
- [x] Revisar e preservar `49b38b5`/`f97862e` e alterações pendentes anteriores.
- [x] 50 testes Node/SQL, 20 de navegador, 2 PWA (72 distintos); lint, build e diff.
  PWA também aprovada em três repetições; cenários SQL executados isoladamente.
- [x] Preflight somente leitura testado nos schemas legado e novo; aliases, RLS,
  triggers, químicos ativos, nulabilidade e versões/extensões incluídos na revisão.
- [x] Preservar duração legada sem arredondar, preço promocional de backfill e
  grants de funções privadas não pertencentes ao PIXICO.
- [x] Impedir reaplicação da foundation e abortar se faltar trigger de cadastro;
  rollback e conservação do schema original comprovados em banco descartável.
- [ ] Revisar com o profissional o mínimo conservador de 30 min e máximo de
  480 min de ocupação química contínua. Inclui aplicação, processamento e lavagem;
  15 min é somente aplicação aproximada. Pedido não bloqueia agenda e não garante
  horário; confirmação revalida a disponibilidade e pode falhar por conflito.
- [ ] Revisar que override substitui também pausa/férias/bloqueios globais. Inserir
  todos os intervalos e pausas desejados nessa data; feriados são manuais.
- [ ] Revisar aliases do catálogo real: nomes normalizados são reaproveitados;
  duplicatas ambíguas abortam a migração. Serviços desconhecidos não são excluídos.
- [ ] Preparar PostgreSQL/Supabase descartável autorizado, isolado de produção,
  para testar migração com legado revisado e concorrência em duas conexões.
  PGlite cobre SQL/exclusão, mas sua fila não reproduz duas transações simultâneas.
- [ ] No ensaio, testar reserva × reserva, reserva × fechamento, confirmação
  química × reserva e mudança de dias permitidos × reserva. Apenas estado
  consistente pode ser efetivado; repetir em READ COMMITTED e documentar resultado.
- [ ] Testar PostgREST: novo `solicitado`, `faixa_fim` nulo em pedidos químicos,
  `confirmacao_manual` público, catálogo com `duracao` nula, `dias_permitidos` e
  `aplicacao_minutos`. Notas privadas continuam inacessíveis a clientes.
- [ ] Resolver por revisão, nunca apagando dados, qualquer reserva ativa legada
  fora das regras ou químico ativo futuro. Esses casos abortam a migração inteira.
  Químicos futuros exigem preparação explícita de dados/ocupação em ensaio antes
  de propor uma migração produtiva; não basta assumir que duram 15 min. A foundation
  rejeita todo químico ativo legado futuro, mesmo após alterar seu término: qualquer
  adaptação desse gate exige plano SQL revisado e aprovado, preservando reservas.

Nenhum passo remoto acima está autorizado nesta etapa. A revisão local terminou;
o próximo gate técnico é o ensaio isolado explicitamente autorizado. Só depois
avaliar backup, janela e aprovação produtiva.

Sequência do próximo ensaio, após autorização restrita ao ambiente de teste:

1. Confirmar project ref/host e isolamento de produção; receber do operador uma
   cópia revisada/minimizada do legado. Não obter dados produtivos nesta etapa.
2. No banco de teste existente, executar somente `supabase/preflight.sql` integral,
   em uma conexão, guardando todos os resultados. Confirmar READ ONLY, ROLLBACK
   e sucesso; erro/timeout interrompe o ensaio. Não executar a baseline nesse banco.
3. Revisar objetos existentes, trigger de cadastro, aliases, reservas/químicos e
   policies/grants extras. Preflight aprovado não autoriza aplicar a migration.
4. Se a foundation ainda não estiver instalada e os dados forem compatíveis,
   aprovar separadamente sua aplicação no teste; caso já exista, parar e preparar
   migration incremental. Não alterar uma versão já aplicada na história real.
5. Testar as quatro disputas em duas conexões READ COMMITTED, ambos os sentidos
   de aquisição do lock, commit e rollback. Homologar Auth/PostgREST/RPC/Realtime.
   PGlite serializado e HTTP simulado não substituem esse passo.

## 1. Revisão antes de executar SQL

A migration `supabase/migrations/202610010001_production_foundation.sql` é
transacional. Ela adiciona tabelas de expediente/configuração/despesas/notificações,
colunas históricas, regras de status/duração/expediente e uma constraint de exclusão
que rejeita sobreposição em um único barbeiro. Recria policies e grants das tabelas
da aplicação, protege role e notas internas, fixa cadastro como cliente e configura
Storage/Realtime. Não apaga reservas nem corrige conflitos automaticamente.

O preço histórico de registros antigos é preenchido com o catálogo disponível:
usa promoção vigente quando disponível, antes da troca de catálogo, e preserva
preço já registrado. O preço original, se nunca foi salvo, não pode ser reconstruído
com certeza e exige revisão financeira.
Admins existentes são mantidos; como o cadastro antigo permitia elevação indevida,
cada UUID administrativo deve ser revisado por um operador confiável.

Em banco **existente**, execute primeiro apenas `supabase/preflight.sql` em ambiente
autorizado. Ele é somente leitura e termina com ROLLBACK. Revise colunas, constraints,
policies/grants adicionais, status nulos/inválidos, serviços inválidos e sobreposições.
Compare o schema real com a baseline. Produza backup verificável antes de migrar.
O preflight também lista tables já existentes, estado de RLS, triggers, extensões,
catálogo ambíguo, químicos ativos e desvios das novas regras padrão. Overrides
explícitos podem justificar desvios: revisar, não excluir registros automaticamente.
Se o schema privado for compartilhado, revisar seu USAGE/grants e funções de
outros sistemas; a migration só revoga EXECUTE das funções internas do PIXICO.
A migration aborta inteira se os dados existentes violarem constraints: não force,
não remova dados e não desative a exclusão para conseguir aplicá-la.

Em banco **novo descartável**, aplique `schema.sql` e a migration imediatamente,
sem expor a baseline insegura entre as duas etapas. `fix_definitivo.sql` foi desativado:
não deve recriar o antigo trigger de metadados. O teste SQL reproduz essa sequência.

A aplicação nova requer a migration. O frontend antigo usa consultas/autorizações
incompatíveis com os novos grants: planeje uma janela coordenada de manutenção,
aplique o SQL aprovado, publique a versão nova aprovada e teste antes de reabrir reservas.
Não publique frontend novo contra banco antigo.

## 2. Supabase de homologação

- Confirmar e-mail habilitado, política de senha com mínimo de 8 caracteres e
  proteção/rate limits de Auth adequados. Configurar SMTP com entrega real.
- Configurar Site URL de homologação e redirects **exatos**:
  `https://HOST_HOMOLOGACAO/login` e `https://HOST_HOMOLOGACAO/recuperar-acesso`.
  Não autorizar redirects genéricos para hosts arbitrários.
- Em desenvolvimento, autorizar as duas rotas de localhost usadas no teste manual.
- Promover somente a conta aprovada por SQL executado por operador confiável.
  Nunca aceitar role em metadados ou expor service_role ao navegador.
- Conferir catálogo, duração, preços, dias de trabalho, almoço, exceções, férias,
  endereço e telefone reais. Valores iniciais da migration precisam de revisão.
- RLS deve estar habilitada; revisar policies adicionais em schemas públicos/Storage.
  A migration só remove no Storage as policies legadas conhecidas; policies extras
  devem ser inspecionadas antes de permitir uploads. Fotos são públicas no bucket.
- Cadastro não grava imagens em metadados/JWT. Fotos de perfil e catálogo continuam
  em campos de imagem base64 limitados/redimensionados. Migração desses campos para
  Storage é melhoria P2; os dados antigos devem ser preservados.
- Perfis e agendamentos com notas privadas não são publicados no Realtime.
  Notificações sem notas privadas invalidam a lista de reservas; polling/retorno
  de conexão atualiza o restante. Verificar Realtime real nos dois dispositivos.
- Confirmar descoberta dos RPCs e embeddings no PostgREST após a migration.

## 3. Testes manuais em homologação

- Cliente A e cliente B em navegadores separados: criar/confirmar contas, entrar,
  recarregar, restaurar/renovar sessão, sair e recuperar acesso pelo e-mail recebido.
- Após alterar senha, provar nova senha e revogação dos refresh tokens de outras sessões.
  Access tokens já emitidos podem valer até seu prazo de expiração; isso é comportamento
  do Supabase JWT. Não reduzir expiração arbitrariamente sem validar renovação.
- Cliente tentar role admin via metadados/REST, notas privadas, financeiro, dados de
  outro cliente, confirmação arbitrária e gravação de duração/preço forjados.
- Dois clientes reservar o mesmo horário simultaneamente em **conexões diferentes**:
  uma reserva deve ganhar, a outra deve receber conflito; testar slots que se sobrepõem
  parcialmente e alteração de expediente concorrente com reserva, sem caps artificiais.
- Testar serviços com 5/15/30/45 minutos, almoço, dia fechado, férias, horários bloqueados,
  passado, janela de 60 dias e cancelamento que libera horários.
- Confirmar, rejeitar com motivo, propor nova data, aceitar pelo cliente, cancelar,
  registrar ausência e concluir apenas atendimento iniciado com cobrança/pagamento.
  Proposta mantém a reserva original e não garante o novo horário até o aceite.
- Alterar preço do catálogo e comprovar histórico/cobrança/receita preservados.
- Salvar clientes/tags/favoritos/blacklist, configurações, imagens e despesas; reler
  em outro dispositivo. Fechar um dia com reservas incompatíveis deve falhar e
  preservar tanto as reservas quanto a regra anterior.
- Interromper rede durante leituras/gravações: erro visível, formulário preservado,
  retry e ausência de pedido fictício/duplicado.
- Verificar 320/390/768/1280 px, Android e iOS, teclado, instalação PWA, atualização
  de versão e modo offline informativo. Não existe envio offline de reservas.
- WhatsApp abre texto para o operador enviar; não há envio automático, push ou
  lembrete cron. A interface não promete essas automações.

## 4. Cloudflare Pages — após autorização

- Validar branch aprovada, nunca mudar main por inferência. Executar `npm ci`,
  `npm run check`, `npm run test:e2e`, `npm run test:pwa` e audit.
- Node 22/24; comando de build recomendado: `npm run build:production`;
  diretório de saída: `dist`. Apenas URL e chave pública anon/publishable como VITE_.
  O build recusa chaves privilegiadas; nenhum secret deve ser colocado em VITE_.
- Confirmar ambiente de preview separado de produção. Não compartilhar Supabase
  produtivo com previews que gravam dados.
- A SPA usa fallback padrão do Pages (sem 404.html); conferir acesso direto às rotas.
- `public/_headers` contém CSP e headers de segurança/cache. Domínio Supabase customizado
  exige trocar connect-src pelo HTTPS/WSS exato aprovado; testar CSP em Pages real,
  pois vite preview não aplica os headers do Cloudflare.
- HTTPS, domínio, manifest/ícones, SW sem cache persistente de API/HTML privado e
  atualização explícita. Não limpar caches de outros aplicativos.
- Atualizar Site URL/redirects de produção somente com autorização e domínio exato.
- Após deploy autorizado: cadastro/login/recuperação/reserva/admin/cancelamento e
  conferência SQL de integridade. Monitorar erros sem logar tokens ou dados pessoais.
- Recuperação: manter backup e release anterior compatível com o schema seguro.
  Priorizar correção da release; não restaurar policies vulneráveis para voltar
  ao frontend antigo. Alteração destrutiva de schema exige plano separado aprovado.

## Referências técnicas

[Auth: saída e escopo](https://supabase.com/docs/guides/auth/signout),
[Auth: sessões](https://supabase.com/docs/guides/auth/sessions),
[RPCs com relações](https://docs.postgrest.org/en/v13/references/api/resource_embedding.html),
[Cloudflare SPA](https://developers.cloudflare.com/pages/configuration/serving-pages/),
[Headers do Pages](https://developers.cloudflare.com/pages/configuration/headers/).