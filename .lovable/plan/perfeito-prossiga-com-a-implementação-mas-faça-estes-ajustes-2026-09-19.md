PERFEITO. PROSSIGA COM A IMPLEMENTAÇÃO, MAS FAÇA ESTES AJUSTES IMPORTANTES:

1. NÃO ALTERE O PAPEL, AS 12 LOJAS OU O STATUS ATUAL DO ROBSON.

2. O objetivo imediato é permitir que o MASTER consiga recuperar/resetar a senha do Robson de forma segura.

3. NÃO tente descobrir, visualizar ou expor a senha atual do Robson.

4. Como a senha "123456" não atende à política de segurança existente, NÃO use essa senha fixa.

5. No botão "Resetar senha" da Central de Usuários, implemente o fluxo administrativo seguro já suportado pelo Supabase:

   - Master inicia o reset;

   - usuário recebe/inicia o fluxo de recuperação;

   - após autenticar no fluxo de recuperação, deve ser obrigado a definir uma nova senha;

   - somente depois da troca a flag de troca obrigatória deve ser removida;

   - não armazenar senha em texto;

   - não registrar senha, token ou credencial nos audit_logs.

6. Para o Robson, NÃO altere automaticamente role, lojas ou profile além do estritamente necessário para o fluxo de senha.

7. Se o reset administrativo atual não conseguir iniciar o fluxo corretamente, corrija a implementação existente em vez de criar outro sistema paralelo.

8. Implemente também as funcionalidades que você identificou como ausentes:

   - editar nome;

   - editar e-mail;

   - diagnóstico de acesso;

   - exclusão segura;

   - troca da própria senha;

   - troca obrigatória após reset;

   - proteção das rotas administrativas;

   - ocultação dos módulos placeholder;

   - auditoria das ações administrativas.

9. REUTILIZE as estruturas existentes:

   - profiles;

   - user_roles;

   - user_stores;

   - audit_logs;

   - RLS;

   - funções existentes;

   - Central de Usuários existente.

10. NÃO crie um segundo RBAC ou uma tabela paralela de permissões.

11. Antes de finalizar, execute:

   - typecheck;

   - build;

   - testes de autenticação;

   - testes de autorização;

   - testes de RLS;

   - testes das rotas;

   - testes da Central de Usuários;

   - teste do fluxo de reset/troca de senha.

12. Faça os testes destrutivos somente com usuário de teste.

    NÃO exclua, desative ou altere o Robson durante os testes.

13. NÃO publique automaticamente.

AO FINAL, RETORNE UM RELATÓRIO COM:

- arquivos alterados;

- tabelas alteradas;

- funções criadas/alteradas;

- RLS alterado;

- fluxo de reset implementado;

- como o Master fará o reset do Robson;

- como o Robson fará a troca da senha;

- testes executados e respectivos resultados;

- erros ou pendências restantes.

IMPORTANTE:

Se encontrar qualquer decisão de arquitetura que possa afetar dados existentes, pare antes de executar essa parte e explique a alteração necessária.