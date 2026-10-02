# PIXICO Barber

Sistema React + Vite + Supabase para clientes e administração de uma barbearia.
A identidade visual foi preservada; autenticação, agenda e dados administrativos
agora dependem exclusivamente do Supabase.

## Desenvolvimento local

Requisitos: Node 22 ou 24 e npm. Execute `npm ci`, copie `.env.example` para
`.env.local` e preencha somente a URL e a chave pública de um Supabase **de testes**.
Execute `npm run dev`. Sem configuração, o site apresenta indisponibilidade:
não existe administrador local, senha embutida ou reserva simulada.

Para o banco novo de testes, consulte [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md).
Nunca execute `schema.sql` sobre um banco existente ou publique sua baseline isolada.

## Validação

- `npm run check`: lint, testes de regras/SQL e build.
- `npx playwright install chromium`: navegador para os testes.
- `npm run test:e2e`: fluxos no navegador com backend HTTP simulado localmente.
- `npm run test:pwa`: build real, service worker e navegação offline no Chromium.
- `npm audit --audit-level=high`: dependências.
- `npm run build:production`: valida configuração pública e HTTPS antes do build.

Os testes SQL usam PostgreSQL descartável via PGlite. Não acessam Supabase remoto.
O build comum permite ausência de configuração para testes; o build de produção
exige configuração válida. Nenhum comando acima publica ou executa migrations remotas.

## Documentação e estado

[PROJECT_STATUS.md](PROJECT_STATUS.md) registra auditoria, prioridades, resultados,
limitações e pendências. [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) descreve
homologação, SQL, Auth e Cloudflare Pages. Publicação depende de autorização explícita.
