# Regras mensais por loja — implementação cirúrgica

## Objetivo
Manter o motor de bônus existente e tornar a seleção de regras determinística por **loja + ano + mês**, preservando qualquer versão já vinculada a um período.

## Alterações

1. **Banco de dados**
   - Adicionar `month` opcional em `bonus_rule_versions`, limitado a 1–12.
   - Manter `quarter` para organização e compatibilidade com versões existentes.
   - Criar índice para busca por `store_id + status + year + month`.
   - Criar uma função transacional, restrita ao Master, que salve de uma vez os parâmetros da versão e todos os critérios editados; qualquer falha desfaz o conjunto inteiro.
   - Preservar todas as versões e vínculos existentes; não apagar, mesclar nem recalcular históricos.

2. **Resolução determinística**
   - Centralizar a resolução nesta ordem: versão já vinculada ao período; loja+mês; loja+trimestre legado; global+mês; global+trimestre legado.
   - Remover totalmente o fallback para “última publicada”.
   - Se nenhuma versão aplicável existir, bloquear abertura/cálculo com `REGRA NÃO CONFIGURADA PARA ESTE PERÍODO`.
   - Ao reencontrar um período aberto sem `version_id`, vincular a regra correta antes de sincronizar colaboradores; períodos já vinculados nunca mudam.

3. **Tela existente de regras**
   - Manter `/remuneracao/mensal/regras` e seu visual atual.
   - Liberar o seletor de loja para Global e todas as lojas disponíveis.
   - Adicionar seletores de ano e mês, com Janeiro–Dezembro e indicação do trimestre apenas como agrupamento visual.
   - Carregar somente a configuração correspondente ao escopo selecionado.
   - Substituir gravações por `onBlur` e switches imediatos por um rascunho local.
   - Adicionar `SALVAR REGRAS`, indicador de alterações não salvas e confirmação com loja e competência.
   - Inclusões e exclusões de indicadores também permanecem locais até o salvamento.

4. **Configuração de setembro/2026**
   - **Spoleto:** criar versão mensal exclusiva em rascunho, baseada na regra global correspondente, e adicionar para todos os cargos os quatro critérios informados: Pedidos cancelados (`≤ 0,7%`), Koncluí (`> 90%`), Loja limpa e organizada e Cursos Plataforma Prato. Os dois últimos ficam configuráveis, sem meta, peso ou valor inventado; Produto vencido e demais regras copiadas são preservados.
   - **Aeroporto:** preservar todas as versões existentes e escolher deterministicamente a versão publicada válida como origem para setembro, mantendo CMV, Koncluí, Efetivo e Turno 24h sem alterar pesos ou valores.
   - **Demais lojas:** continuam usando a versão global aplicável, sem receber critérios exclusivos.

## Validação
- Compilação e checagem de tipos.
- Testes unitários da resolução: vínculo histórico, loja+mês, fallbacks trimestrais controlados, global e ausência de regra.
- Testes do motor existente: cálculo normal e eliminatório resultando em `ELIMINADO` e `R$ 0,00`.
- Testes reais de isolamento em setembro/2026 para Spoleto, Aeroporto e uma Domino's padrão.
- Teste de independência julho versus setembro e de combinação sem regra.
- Teste de edição → salvar → consultar → atualizar a página → consultar novamente.
- Conferência final de `bonus_periods.version_id`, `calc_snapshot`, ausência de duplicação e erros no navegador/requisições.

## Arquivos previstos
- `src/lib/bonus.functions.ts`
- `src/lib/rules.functions.ts`
- `src/routes/_authenticated/remuneracao/mensal/regras.tsx`
- `src/routes/_authenticated/remuneracao/mensal/lancamentos.tsx`
- migration gerada para `bonus_rule_versions` e salvamento transacional
- testes focados nas regras/resolução, se a estrutura atual de testes permitir

## Fora do escopo
- Nenhuma alteração em `bonus-engine.ts`, cálculos, metas, importações, lojas, permissões, relatórios ou outras telas.
- Nenhuma exclusão de versões duplicadas, dado histórico ou snapshot.
- Nenhum peso, valor ou meta será inventado.
