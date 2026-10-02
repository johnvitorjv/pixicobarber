# PIXICO Barber — auditoria e conclusão técnica

Data: 01/10/2026, America/Bahia. Branch: `finalizacao-pixico`.
Somente trabalho e commits locais. Push, deploy e mudanças de produção não autorizados.
Nenhuma conexão ao banco remoto foi feita.

## Ambiente

O checkout original em `C:\Windows\System32\pixicobarber` tem ACL sem escrita para
esta sessão. Foi copiado com Git e alterações preexistentes para
`C:\Users\johnv\Projects\pixicobarber-finalizacao`, excluindo node_modules/dist.
A mudança preexistente no package-lock foi preservada. Não houve alteração das ACLs.

## Arquitetura atual

SPA React 19, Vite 7, Router 7, Tailwind 3, GSAP e Lucide. `main.jsx` define home,
login, cadastro, reserva, painel cliente e nove telas admin. Não há backend próprio.
Supabase Auth e `hooks/useSupabase.js` fornecem profiles/services/appointments;
appointments tem Realtime. Stores locais fornecem disponibilidade, configurações,
clientes, despesas e notificações. Telas misturam dados remotos e locais.
SQL: `schema.sql` e `fix_definitivo.sql`, scripts manuais sem migrations/testes.
PWA: manifesto e ícones PIXICO, SW manual. Deploy informado: GitHub → Cloudflare Pages.

## O que já funciona / reaproveitar

Identidade visual, landing/galeria, componentes responsivos, formulários, assistente
de reserva e painéis existem. CRUD básico Supabase e mapeamentos de campos estão
implementados. São evidências de código, não validação do serviço em produção.
Todos os arquivos fonte, stores, dados, SQL, configurações, rotas e estilos foram
inspecionados. Imagens binárias preservadas. Configuração remota desconhecida.

## O que está quebrado e incompleto

### Riscos críticos e segurança

- Admin reconhecido por metadados editáveis e e-mail fixo no frontend.
- Trigger copia role dos metadados; UPDATE próprio permite autopromoção no banco.
- Policy admin de profiles consulta profiles, causando potencial recursão de RLS.
- Fallback autentica usando senhas em texto claro e administrador embutido.
- Sem constraint de conflitos: reservas concorrentes/sobrepostas podem coexistir.
- INSERT cliente permite status arbitrário; cancelamento pode modificar outras colunas.
- Nenhuma validação no servidor de duração, passado, expediente, almoço e capacidade.
- Bloqueios/expediente são locais e não chegam aos outros dispositivos.

### Banco / Supabase

- Sem persistência remota de regras, despesas, notificações e configurações.
- Admin não enxerga serviços inativos pela policy SELECT original.
- favorito/status adicionais dependem do segundo script; sem controle de versões.
- Conclusão descarta cobrança/pagamento; receita usa preço atual, alterando histórico.
- Tags/apelidos/notas/blacklist parecem salvar mas usam apenas localStorage.
- Proposta de remarcação muda data diretamente; cliente não pode aceitar proposta.
- Sem índices adequados, trilha de status e limites; uso de UTC muda o dia na Bahia.
- Schema/policies efetivamente instalados, backups e administradores remotos desconhecidos.

### Frontend / estabilidade / PWA

- Listener Auth sem cleanup efetivo; refresh remoto vazio; foto do painel só local.
- Esqueci minha senha sem ação; confirmação de cadastro apresentada como erro.
- Reserva sempre 30 min, independente do serviço; envio duplo sem proteção.
- DailyDetail do calendário usa `sb` fora de escopo (ReferenceError).
- Mutações falham silenciosamente e fecham modal; leituras falhas viram listas vazias.
- Histórico ignora cancelado_admin; falta rota 404/ErrorBoundary e testes/CI.
- SW não cacheia index para fallback, pode misturar versões e remove caches alheios.
- Responsividade definida mas ainda não testada no navegador.
- mockData.js, data/services.js e assets Vite sem uso, dados padrão inconsistentes.

## Baseline executada

- `npm run lint`: 48 erros, 1 warning.
- `npm run build`: EPERM nos temporários Vite em System32.
- Build com configLoader runner: transforma 1.828 módulos, falha escrevendo dist antigo.
- `npm audit --omit=dev`: 10 achados, sendo 7 high, 2 moderate, 1 low na árvore original.
  Avaliar exposição e atualizar compatíveis; sem afirmar exploração na SPA.

## Plano priorizado

| ID | Prioridade | Entrega | Estado |
| --- | --- | --- | --- |
| AUTH | P0 | Supabase obrigatório, perfil confiável, sessão/cleanup, remover senha/admin local | Pendente |
| RLS | P0 | Migration, admin sem recursão, role protegida e policies restritas | Pendente |
| BOOK | P0 | Constraints e validação no banco; RPC de slots sem dados pessoais | Pendente |
| AVAIL | P0 | Regras/bloqueios remotos compartilhados entre cliente e admin | Pendente |
| VALID | P1 | Build/lint e testes locais de segurança, duração e concorrência | Pendente |
| RECOVER | P1 | Recuperação, alteração de senha, confirmação e logout confiável | Pendente |
| ADMIN | P1 | Confirmação/rejeição/cancelamento/conclusão, remarcação com aceite | Pendente |
| DATA | P1 | Clientes, fotos, tags, notas, blacklist e configurações persistentes | Pendente |
| FIN | P1 | Histórico de preço, cobrança/pagamento e despesas remotas | Pendente |
| NOTIF | P1 | Notificações remotas geradas pelo servidor | Pendente |
| PWA | P1 | Offline válido, cache seguro e atualização | Pendente |
| RELEASE | P1 | CI, headers Pages, documentação de staging e deploy | Pendente |
| DEPS | P1 | Atualizar dependências compatíveis e repetir audit | Pendente |
| SCALE | P2 | Paginação, filtros remotos, otimização de bundle | Pendente |
| MEDIA | P2 | Migrar base64 legado para Storage com policies por proprietário | Pendente |
| UX | P2 | Acessibilidade e observabilidade completas | Pendente |
| CLEAN | P3 | Limpar resíduos e refinar textos mantendo identidade | Pendente |

## Checklist completo até produção

- [x] Auditoria e plano antes de editar implementação.
- [x] Preservar checkout original e mudança preexistente; resolver ACL com cópia local.
- [ ] Implementar P0/P1 em commits pequenos.
- [ ] Build, lint, testes e audit aprovados.
- [ ] Testar SQL descartável: RLS, cadastro malicioso e autopromoção.
- [ ] Testar conflitos concorrentes, duração, almoço, fechamento e capacidade.
- [ ] Testar cancelamento, aceite de proposta, status e receita histórica.
- [ ] Verificar bundle sem secrets/service_role.
- [ ] Navegador desktop/mobile, sessão, falha de rede e PWA offline.
- [ ] Preflight somente leitura para banco real e conflitos preexistentes.
- [ ] Com autorização explícita: backup e aplicar migrations primeiro em staging.
- [ ] Configurar SMTP, Site URL, redirects exatos, recuperação e confirmação em staging.
- [ ] Revisar serviços, expediente real e promoção de administrador por SQL confiável.
- [ ] Auditar policies adicionais/privilégios e roles reais antes de produção.
- [ ] Homologar cliente/admin em dispositivos diferentes e Realtime real.
- [ ] Conferir HTTPS, variáveis públicas, branch Pages e rollback do frontend.
- [ ] Obter autorização explícita antes de push/deploy/migration de produção.
- [ ] Após autorização: aplicar migration, publicar e executar smoke test.

## Progresso

Auditoria concluída; execução local iniciando: 20%. Estimativas são faixas revisáveis,
nunca promessa de precisão de minutos. Trabalho local e prontidão de produção serão
reportados separadamente; homologação/produção não atingem 100% sem etapas externas.

## Referências

- https://supabase.com/docs/reference/javascript/auth-onauthstatechange
- https://www.postgresql.org/docs/15/rangetypes.html
- https://developers.cloudflare.com/pages/configuration/headers/
- https://developers.cloudflare.com/pages/configuration/serving-pages/
