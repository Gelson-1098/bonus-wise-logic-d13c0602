# Vínculo manual de colaborador ao período

## Objetivo
Permitir que um usuário autorizado adicione manualmente um colaborador já cadastrado à apuração da loja, mês e ano selecionados em Remuneração → Lançamentos, sem alterar o cadastro mestre.

## Alterações

### 1. Funções seguras no servidor
- Reutilizar `bonus_periods`, `employees` e `employee_period_entries`; nenhuma tabela ou migração nova.
- Criar uma leitura autenticada que recebe o período, confirma que ele existe e valida o acesso do usuário à loja desse período.
- Retornar colaboradores ativos da base com nome, matrícula, cargo e loja atual, excluindo os que já estão vinculados ao período.
- Criar uma gravação autenticada que repete a validação do período e da loja, busca cargo e valor-base no cadastro existente e insere somente o vínculo mensal.
- Gravar no lançamento o `store_id` do período, mantendo intacto o `store_id` do cadastro mestre do colaborador.
- Tratar explicitamente a restrição única de período + colaborador e registrar o vínculo no histórico de ações existente.

### 2. Tela de Lançamentos
- Manter o card, tabela e identidade visual atuais.
- Adicionar “Adicionar colaborador” ao lado de “Sincronizar colaboradores ativos”, disponível somente quando o período puder ser editado.
- Abrir um modal simples com pesquisa por nome ou matrícula e seleção de um colaborador disponível.
- Mostrar nome, matrícula, cargo e loja atual para conferência, sem editar o cadastro mestre.
- Após confirmação do servidor, fechar o modal, atualizar imediatamente a lista e manter o fluxo normal de lançamento/apuração.
- Em erro ou duplicidade, manter o modal aberto e exibir a mensagem real sem falso sucesso.

## Segurança e isolamento
- Preservar RLS e usar autenticação já existente.
- Validar a permissão pela loja do período no servidor; Master continua com acesso global e demais perfis somente dentro de seus vínculos atuais.
- O vínculo valerá apenas para o `period_id` selecionado e não será propagado para outros meses, anos ou lojas.
- Não alterar motor de cálculo, regras, metas, cadastro mestre, sincronização existente ou outras telas.

## Validação
- Confirmar compilação e ausência de erros no navegador.
- Em Jabaquara — Julho/2026, pesquisar e adicionar um colaborador da base de outra loja.
- Confirmar exibição imediata com cargo e valor-base, seguida de atualização da página com persistência.
- Tentar adicionar novamente o mesmo colaborador ao mesmo período e confirmar rejeição sem duplicata.
- Trocar de competência e confirmar que o vínculo não aparece automaticamente em outro período.
- Confirmar que um usuário sem acesso à loja do período não consegue listar nem vincular colaboradores.