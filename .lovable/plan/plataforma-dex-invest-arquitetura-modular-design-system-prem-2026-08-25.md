# Plataforma DEX INVEST — Arquitetura Modular + Design System Premium

Objetivo: transformar o sistema atual (que já funciona) em uma plataforma corporativa modular com navegação por universos e um design system único, sem tocar em cálculos, regras, dados, usuários ou segurança.

## O que NÃO será alterado

- Motor de cálculo de bônus, regras, pesos e valores por cargo.
- Tabelas, dados, usuários, políticas de acesso (RLS) e permissões existentes.
- Importação de Excel e geração de metas (+10% configurável) já implementadas.

As páginas atuais continuam funcionando exatamente igual — mudam de endereço, de casca visual e de nome, não de comportamento.

## Fase 1 — Casca da plataforma e design system (esta entrega)

### 1. Design system central

Um único conjunto de tokens em `src/styles.css`, aplicado a toda a plataforma:

- Fundo `#F5F7FA`, cards `#FFFFFF`, sidebar `#0F172A`, azul principal `#2563EB`, azul profundo `#1E3A8A`, textos `#111827` / `#64748B`, borda `#E2E8F0`.
- Status: sucesso `#16A34A`, atenção `#D97706`, erro `#DC2626`, informação `#4F46E5`.
- Proporção 80% neutros / 15% azul / 5% status.
- Uma cor de identificação por universo, usada apenas em detalhes (ícone e realce), nunca dominando a tela.
- Ícones exclusivamente Lucide, 18–20px padrão e 22–24px em destaque.

### 2. Sidebar premium hierárquica

Sidebar escura, expansível, com os 10 universos: Dashboard, Operação, Remuneração, KPI, Benefícios, Treinamento, Avaliações, Auditorias, Relatórios, Administração.

- Grupos expandem/recolhem com ChevronRight → ChevronDown (rotação suave, ~180ms).
- Item ativo: fundo azul discreto, texto e ícone brancos, barra indicadora lateral.
- Estado (aberto/recolhido e grupos expandidos) fica salvo entre sessões.
- Recolhida mostra só ícones, com tooltip do nome.
- No mobile vira menu off-canvas; no tablet, adaptável.
- Itens exclusivos do Administrador continuam ocultos para o Gerente.

### 3. Header e navegação

- Breadcrumb em toda página interna (Universo › Módulo › Submódulo), último item destacado.
- Busca global, centro de notificações (Bell) e menu de perfil (Perfil, Configurações, Ajuda, Sair).
- Header compacto no mobile.

### 4. Biblioteca de componentes reutilizáveis

Componentes padrão usados por todos os módulos, hoje e no futuro:

- Cabeçalho de módulo (título, descrição, ações), card de KPI (rótulo pequeno, valor grande 28–32px, variação com ícone de tendência + texto + cor, comparação com período anterior).
- Indicador de tendência que respeita a natureza do indicador (queda de cancelamentos = positivo).
- Badges e status com ícone + texto (CheckCircle2, Clock3, AlertTriangle, XCircle, Info, CircleDashed).
- Tabela premium (cabeçalho `#F8FAFC`, hover de linha, ordenação com ArrowUpDown, menu de ações MoreHorizontal).
- Barra de filtros (loja, período, cargo, status, busca, limpar filtros), seletor de período `‹ Agosto 2026 ›`.
- Empty states com ícone, mensagem e ação sugerida; skeletons de carregamento para cards e tabelas.
- Alertas, modais (radius 16px, ação principal à direita) e diálogos de confirmação para ações críticas (fechar/reabrir período, excluir, substituir importação, alterar regra).
- Blocos de Ranking e Melhores/Piores evoluções.
- Botões com hierarquia e ícones fixos por ação (Plus, SlidersHorizontal, Upload, Download, RefreshCw, Trash2, ArrowLeft).

### 5. Reorganização dos módulos existentes

Os módulos atuais entram no universo Remuneração › **Remuneração Mensal** (novo nome do módulo de bônus), com as rotas antigas redirecionando para as novas:

```text
/remuneracao/mensal/painel        <- /painel
/remuneracao/mensal/lancamentos   <- /lancamento
/remuneracao/mensal/metas         <- /metas
/remuneracao/mensal/periodos      <- /periodos
/remuneracao/mensal/regras        <- /regras
/admin/cadastros                  <- /cadastros
/admin/auditoria                  <- /auditoria
```

Cada rota recebe seu próprio título e descrição de página.

### 6. Estrutura dos demais universos

Todos os universos e submódulos da lista são criados e navegáveis, seguindo o padrão Dashboard → Gestão → Execução → Acompanhamento → Resultados → Histórico. Onde a regra de negócio ainda não foi definida (PLR, KPI, iFood, 99Food, Benefícios, Treinamento, Avaliações, Auditorias, Relatórios), a tela apresenta o layout definitivo com um estado inicial claro ("Módulo em preparação") — sem inventar critérios, valores ou dados fictícios.

O registro de universos fica em um único arquivo de configuração, para que novos universos (Compras, Estoque, Campanhas, Planejamento) sejam acrescentados sem refazer a navegação.

## Fases seguintes (para aprovar depois, uma a uma)

1. **PLR Semestral** — tabelas próprias, motor de regras independente, períodos 1º/2º semestre, apuração e auditoria.
2. **KPI como camada central de dados** — lojas, indicadores, sincronizações com log e status, ranking, comparativos e alertas configuráveis.
3. **Integrações iFood e 99Food** — conectores independentes via API oficial/OAuth, com segredos guardados de forma segura; indicadores não fornecidos pela fonte aparecem como "não disponível", nunca estimados.
4. **Benefícios, Treinamento, Avaliações, Auditorias e Relatórios** — regras e formulários conforme você for definindo.

## Notas técnicas

- Sidebar sobre o componente `sidebar` do shadcn (`collapsible="icon"`), estado persistido; registro de navegação tipado em um único módulo.
- Rotas TanStack em `src/routes/_authenticated/<universo>/<modulo>.tsx`; rotas antigas mantidas como redirects permanentes para não quebrar links salvos.
- Tokens em `@theme inline` com valores em oklch; nenhuma cor fixa em componente.
- `AppShell` é substituído por `PlatformShell` (SidebarProvider + header + breadcrumb + área de conteúdo); os conteúdos atuais das páginas são movidos sem alteração de lógica.
- Carregamento por universo, com paginação/filtros nas listagens; nenhum carregamento global de dados.
- Acessibilidade: foco visível, labels, tooltips, contraste e nunca cor como único sinal.
