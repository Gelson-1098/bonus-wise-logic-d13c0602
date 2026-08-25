# Acessos de gerentes, observações por mês e importação de metas

## 1. Acessos por loja (só você cria)

Nova aba **Usuários** dentro de Cadastros (visível apenas para Master):

- Formulário: nome, e-mail, senha inicial, loja(s) vinculada(s).
- A conta é criada já confirmada, com perfil **Gerente**, e aparece na lista com loja, último acesso e ações: redefinir senha, trocar loja, desativar.
- O gerente entra e vê apenas a loja dele: lançamento dos indicadores dos funcionários, metas realizadas e observações.
- Critérios, pesos, valores e versões de regras continuam **somente leitura** para o gerente — criar/editar/publicar segue exclusivo do Master (as regras de acesso do banco já bloqueiam isso; a tela deixará isso explícito, sem botões de edição).

## 2. Observações da loja por mês

Campo de observações da loja em cada período (mês):

- O gerente escreve o esclarecimento no fechamento do mês; fica gravado junto ao período.
- Você vê a observação na tela de Períodos (conferência) e ela entra na exportação do fechamento.
- Depois que o período é aprovado/fechado, a observação fica travada como histórico.

## 3. Importação da planilha e geração automática de metas

Novo bloco **Importar faturamento** (Master):

- Você envia o Excel do ano passado; a tela lê as colunas e você confirma o mapeamento (loja, mês, faturamento sem taxa, taxa de serviço, taxa de entrega, TC).
- Cálculos aplicados por loja/mês:
  - **FAT líquido realizado** = faturamento sem taxa + taxa de serviço
  - **TC realizado** = total de clientes atendidos
  - **TM realizado** = FAT líquido ÷ TC
  - **Meta FAT** = FAT líquido do ano anterior × 1,10
  - **Meta TC** = TC do ano anterior × 1,10
  - **Meta TM** = Meta FAT ÷ Meta TC
- A taxa de entrega é guardada separada (não entra no FAT líquido), para você distinguir receita de serviço de taxa de entrega.
- Antes de gravar, uma **prévia** mostra loja por loja: realizado ano anterior × meta gerada, com aviso de linhas sem loja correspondente ou valores inválidos.
- Depois de importar, as metas de FAT/TC/TM já aparecem preenchidas em cada período mensal de cada loja (mês atual e meses seguintes), com possibilidade de você ajustar manualmente a meta de um mês específico — o ajuste manual prevalece.
- O percentual de 10% fica configurável na tela, caso queira usar outro valor num ano futuro.
- TC e TM são **informativos de meta** (realizado vs. meta), não critérios de bônus; o gatilho de bônus continua o de faturamento.

## Detalhes técnicos

- Banco:
  - Nova tabela `store_history_monthly` (loja, ano, mês, faturamento sem taxa, taxa de serviço, taxa de entrega, faturamento líquido, TC, TM, origem da importação) com RLS: leitura para quem tem acesso à loja, escrita só Master.
  - `store_targets` ganha `tc_target`, `tc_actual`, `tm_target`, `tm_actual`, `tc_history`, e `manager_note` (observação do gerente no mês).
  - Grants + políticas na mesma migração; auditoria registra importações e edições de meta.
- Criação de usuário: server function com middleware de auth + verificação `is_master()`, usando o cliente administrativo carregado dentro do handler (Auth Admin API + `profiles`, `user_roles`, `user_stores`).
- Importação: leitura do Excel no navegador com a lib `xlsx` já instalada; a gravação vai por server function em lote, com validação Zod e geração/atualização dos períodos e metas.
- Telas: nova aba em `cadastros.tsx` (Usuários + Importar faturamento), campos de TC/TM e observação em `lancamento.tsx`, exibição da observação e das metas TC/TM em `periodos.tsx` e no painel.
