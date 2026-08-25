# Metas — Importação de faturamento do ano anterior e geração automática de metas

Novo módulo exclusivo do Administrador (Master): importar a planilha Excel do ano anterior, mapear as colunas, conferir, confirmar e gerar automaticamente as metas de Faturamento e de TC do ano seguinte. O gerente só visualiza a meta da própria loja.

## Fluxo do Administrador

```text
[ IMPORTAR EXCEL ]
   1. Leitura        → sistema lê todas as colunas e abas
   2. Mapeamento     → Loja | Mês | Receita de Vendas | Taxa de Serviço | TC
   3. Pré-visualização → Loja, Mês, Receita, Taxa, Base (Receita+Taxa), TC
   4. Validação      → alertas de erros e duplicidades
   5. Confirmar      → grava histórico e gera metas do ano seguinte
```

Nenhuma alteração manual na planilha original é necessária. O sistema sugere o mapeamento pelos nomes das colunas e o administrador pode corrigir.

## Regras de cálculo

- Faturamento Base da Meta = Receita de Vendas + Taxa de Serviço (os três valores ficam sempre separados na base e nas telas).
- Meta de Faturamento = Faturamento Base do mês do ano anterior × (1 + crescimento).
- Meta de TC = TC do mês do ano anterior × (1 + crescimento), arredondada para inteiro.
- Mês a mês, preservando sazonalidade — nunca dividir o total anual por 12.
- Meta anual = soma das metas mensais (FAT e TC).
- Sem arredondamento antes do cálculo; formatação apenas na exibição (R$ 0.000,00 e TC 0.000).

## Percentual de crescimento

Parâmetro configurável no painel administrativo (padrão 10%), separado para Faturamento e para TC, nunca fixo no código. Alterar o parâmetro não muda metas já geradas: o recálculo só acontece quando o administrador clica em "Gerar metas" / confirma o recálculo. Cada geração cria uma nova versão registrada.

## Validações antes de confirmar

Loja sem nome ou não cadastrada no sistema, mês ausente/inválido, valores vazios, negativos, TC inválido, faturamento inválido e duplicidade Loja+Ano+Mês. Nada é gravado antes da confirmação.

## Reimportação (nunca apaga histórico)

Ao encontrar Loja + Ano + Mês já existente: aviso "Já existe uma informação para este período." com [ CANCELAR ] e [ SUBSTITUIR ]. Substituir é exclusivo do administrador e fica registrado na auditoria (valor anterior e novo).

## Telas

- **Metas → Importar faturamento ano anterior** (só Master): wizard das 5 etapas acima.
- **Metas → Dashboard** (Master): filtros Ano, Loja, Mês; colunas Loja, Mês, Receita A-1, Taxa de Serviço A-1, Base A-1, Meta FAT, TC A-1, Meta TC; totais anuais por loja; e uma visão do fluxo (Receita + Taxa → Base → +10% → Meta / TC → +10% → Meta TC).
- **Minha meta** (Gerente): apenas a própria loja e período — Meta de Faturamento e Meta de TC e, quando houver realizado, valor realizado e % da meta. Sem acesso à importação e sem poder editar meta.
- **Observações por loja**: campo de observação do gerente no período, visível ao Master.

## Detalhes técnicos

- Tabelas novas: `revenue_history` (ano, mês, store_id, receita_vendas, taxa_servico, faturamento_base_meta, tc, imported_at, imported_by; único por loja+ano+mês) e `store_goals` (ano, mês, store_id, faturamento_base_ano_anterior, meta_faturamento, tc_ano_anterior, meta_tc, growth_fat_pct, growth_tc_pct, generated_at, version). Tabela `app_settings` para o percentual de crescimento. `faturamento_base_meta` é coluna gerada (receita + taxa).
- GRANTs + RLS: escrita/importação somente Master (`is_master()`); gerente lê apenas as linhas das suas lojas via `can_access_store()`.
- Parsing do Excel no cliente com a lib `xlsx` já instalada (leitura e mapeamento), gravação via server functions (`createServerFn` + `requireSupabaseAuth`) que revalidam papel Master, aplicam as fórmulas no servidor e escrevem em `audit_logs`.
- Campo `manager_note` em `store_targets` para a observação da loja.
- Novas rotas sob `src/routes/_authenticated/metas.tsx` (dashboard + importação, condicionadas ao papel) e link no menu lateral.
- O motor de bônus continua usando a meta do período; o gatilho de 90% passa a comparar o realizado com a `meta_faturamento` gerada.
