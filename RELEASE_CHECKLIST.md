# PIXICO — homologação e publicação

Nada deste documento foi executado em Supabase ou Cloudflare remotos.
Push, deploy e execução de SQL remoto dependem de autorização explícita do proprietário.

## 1. Revisão antes de executar SQL

A migration `supabase/migrations/202610010001_production_foundation.sql` é
transacional. Ela adiciona tabelas de expediente/configuração/despesas/notificações,
colunas históricas, regras de status/duração/capacidade e uma constraint de exclusão
que rejeita sobreposição em um único barbeiro. Recria policies e grants das tabelas
da aplicação, protege role e notas internas, fixa cadastro como cliente e configura
Storage/Realtime. Não apaga reservas nem corrige conflitos automaticamente.

O preço histórico de registros antigos é preenchido com o catálogo disponível:
o preço original, se nunca foi salvo, não pode ser reconstruído automaticamente.
Admins existentes são mantidos; como o cadastro antigo permitia elevação indevida,
cada UUID administrativo deve ser revisado por um operador confiável.

Em banco **existente**, execute primeiro apenas `supabase/preflight.sql` em ambiente
autorizado. Ele é somente leitura e termina com ROLLBACK. Revise colunas, constraints,
policies/grants adicionais, status nulos/inválidos, serviços inválidos e sobreposições.
Compare o schema real com a baseline. Produza backup verificável antes de migrar.
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
- Conferir catálogo, duração, preços, dias de trabalho, almoço, limites, férias,
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
  parcialmente, limite diário/turno e alteração de expediente concorrente com reserva.
- Testar serviços com 30/45/60 minutos, almoço, dia fechado, férias, horários bloqueados,
  passado, janela de 60 dias e cancelamento que libera horários.
- Confirmar, rejeitar com motivo, propor nova data, aceitar pelo cliente, cancelar,
  registrar ausência e concluir apenas atendimento iniciado com cobrança/pagamento.
  Proposta mantém a reserva original e não garante o novo horário até o aceite.
- Alterar preço do catálogo e comprovar histórico/cobrança/receita preservados.
- Salvar clientes/tags/favoritos/blacklist, configurações, imagens e despesas; reler
  em outro dispositivo. Fechar um dia não cancela reservas já existentes.
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
