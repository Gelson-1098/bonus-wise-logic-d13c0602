# PRISMA — Acabamento final (sem redesign)

Nada de redesign, novas páginas ou novos módulos. Apenas rebrand, nomenclatura, acabamento fino e fechamento das lacunas de segurança reais.

## 1. Rebrand para PRISMA

Substituir o nome antigo pelo novo em todos os pontos onde ele aparece hoje (nenhuma mudança de layout, cor ou componente):

- Cabeçalho da barra lateral: **PRIS**MA (mesmo tratamento de destaque já usado hoje) + subtítulo "Inteligência para gestão e performance."
- Card de login: "Acesso ao PRISMA" e subtítulo novo, mantendo a menção aos perfis Master, Treinador e Gerente.
- Página inicial: título e subtítulo.
- Título da aplicação e metadados (`title`, `description`, `og:title`, `og:description`) na raiz e em todas as 22 rotas que hoje trazem o nome antigo — mesma estrutura, só o texto muda.
- Mensagem de acesso não autorizado do gate de autenticação.
- Título do dashboard.

Padrão de título: `Página | PRISMA`; título institucional: `PRISMA — Inteligência para gestão e performance`.

## 2. "Universos disponíveis" → "Visão Executiva"

No card do dashboard: trocar o título e adicionar a descrição "Visão consolidada dos principais indicadores e resultados." Grid, cards, links e status permanecem exatamente como estão.

## 3. Acabamento premium (ajustes pontuais)

Somente polimento, sem trocar paleta nem componentes:

- Consistência de raio/borda e padding entre cards do dashboard e das listagens.
- Estados de hover e foco visíveis e uniformes nos cards clicáveis e itens da sidebar.
- Estados de carregamento: usar skeleton nos blocos que hoje mostram "—" durante o fetch.
- Mensagens de erro de consulta padronizadas (hoje algumas falhas ficam silenciosas).
- Ajustes de responsividade em tabelas largas (rolagem horizontal contida) e no header em telas pequenas.
- Hierarquia tipográfica coerente entre título de página, título de card e rótulos.

## 4. Segurança essencial

Verificado no banco: as tabelas `positions`, `bonus_criteria` e `bonus_rule_versions` têm política de leitura `USING (true)` para qualquer usuário autenticado — ou seja, salário base (`positions.base_value`) e as fórmulas/pesos de bônus ficam legíveis por gerente e treinador. Correção proposta:

- `positions`: leitura restrita ao Master; gerentes continuam vendo o nome do cargo através das consultas de funcionários (sem `base_value`) — ajustar as seleções que hoje leem a tabela direto para não quebrar as telas.
- `bonus_criteria` e `bonus_rule_versions`: leitura restrita ao Master; o cálculo do bônus roda no servidor (server functions), portanto o gerente não precisa ler as regras diretamente.
- Nenhuma regra de negócio, cálculo ou peso é alterado — só quem pode ler.

Verificações adicionais (sem reconstruir nada):

- Confirmar que o autocadastro público continua desabilitado no backend de autenticação.
- Confirmar que a trigger de novo usuário não concede papel automaticamente (hoje só concede Master quando o banco está vazio) — manter assim.
- Confirmar que as rotas internas estão sob o gate autenticado e que as funções administrativas exigem Master no servidor, não apenas na interface.
- Confirmar que nenhum segredo/serviço aparece no frontend.

## 5. Revisão final

- Rodar build/typecheck, checar console e rotas/redirecionamentos antigos.
- Testar login, logout, bloqueio de usuário sem papel e carregamento do dashboard com Master e com Gerente.
- Confirmar que o nome PRISMA aparece corretamente em navegador, login, sidebar e dashboard.

## Detalhes técnicos

- Arquivos de marca: `src/components/app-sidebar.tsx`, `src/components/login-card.tsx`, `src/hooks/use-auth.ts`, `src/routes/__root.tsx`, `src/routes/index.tsx`, `src/routes/auth.tsx`, `src/routes/reset-password.tsx` e os `head()` das rotas em `src/routes/_authenticated/**`.
- Nomenclatura do card: `src/routes/_authenticated/dashboard.tsx`.
- Segurança: uma migração que substitui as três políticas `SELECT ... USING (true)` por `USING (is_master())`, mais ajuste das consultas afetadas em `src/routes/_authenticated/**` e `src/lib/*.functions.ts` para lerem via server function quando necessário.
- Estrutura de tabelas, cálculos (`src/lib/bonus-engine.ts`) e importação de metas ficam intocados.
