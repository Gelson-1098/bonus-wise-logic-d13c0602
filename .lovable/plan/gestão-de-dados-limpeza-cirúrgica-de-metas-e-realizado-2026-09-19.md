# Gestão de Dados — limpeza cirúrgica de Metas e Realizado

## Objetivo
Adicionar, somente para o perfil Master, uma aba **Gestão de Dados** na página atual de Metas. A limpeza será sempre limitada por ano, mês e loja opcional, com confirmação explícita, auditoria e atualização automática da tela.

## Implementação
- Reutilizar a listagem atual de lojas e os componentes existentes de abas, seleção, botões e confirmação.
- Adicionar uma função autenticada no módulo atual de metas, validando novamente no servidor que o usuário é Master.
- **Limpar Metas:** excluir somente registros de `store_goals` com o ano, mês e loja escolhidos; “Todas as Lojas” mantém o filtro obrigatório de ano+mês.
- **Limpar Realizado:** manter `bonus_periods` e seus demais dados; definir apenas `store_targets.revenue_actual` e `store_targets.tc_actual` como `NULL` nos períodos encontrados pelo ano+mês+loja opcional, e remover somente o registro correspondente de `revenue_history` para impedir que a leitura consultiva reapresente o valor como realizado.
- Antes de qualquer gravação, resolver e validar o conjunto exato de lojas/períodos do escopo. Não aceitar IDs de loja inexistentes.
- Registrar em `audit_logs` o tipo de limpeza, ano, mês, loja ou todas as lojas e quantidades afetadas.
- Exibir a frase de confirmação solicitada e, após sucesso, invalidar/refazer somente as consultas de metas e realizado.

## Validação
- Confirmar compilação e tipos.
- Verificar que nenhuma operação exclui `bonus_periods` ou tabelas relacionadas.
- Testar os filtros de escopo para loja específica e todas as lojas, comprovando que outro mês, ano e loja permanecem fora da alteração.
- Confirmar o estado “Não lançado” após limpar realizado e a possibilidade de reimportar metas depois da limpeza.

## Fora do escopo
Motor de bônus, cálculos, regras de remuneração/metas, importadores, demais páginas e demais dados permanecerão inalterados.
