# Regularização cirúrgica de acessos e administração de usuários

## Diagnóstico confirmado

- Robson possui uma única conta de autenticação, com e-mail confirmado, senha cadastrada, sem banimento e sem exclusão.
- O perfil público correspondente está ativo, com o mesmo e-mail, papel `treinador` e 12 vínculos únicos com lojas ativas.
- Não existem duplicidades em autenticação, perfil, papel ou vínculos de loja; também não há funcionário com esse e-mail, o que não é requisito para autenticação.
- Não há evidência de bloqueio por confirmação, banimento, perfil, papel, lojas ou RLS. Como nunca houve login concluído, o erro informado está restrito à credencial de senha.
- A Central de Usuários já cria usuários, altera papel e lojas, ativa/desativa, registra auditoria e protege o servidor com validação Master.
- Faltam edição efetiva de nome/e-mail, diagnóstico, exclusão segura, troca da própria senha, troca obrigatória após reset e proteção direta nas rotas de Cadastros e Auditoria.
- O menu já é expansível, mas hoje exibe vários módulos que são apenas telas em desenvolvimento.

## Alterações

1. **Robson**
   - Preservar o papel e as 12 lojas atuais, pois estão íntegros e não foi fornecida uma configuração diferente.
   - Não alterar dados operacionais, não criar conta duplicada e não tocar em senha/hash durante o diagnóstico.
   - Disponibilizar reset administrativo seguro para resolver a credencial quando o Master executar a ação.

2. **Reset e troca obrigatória**
   - Acrescentar somente o campo necessário em `profiles` para indicar troca obrigatória de senha; não criar tabela nova.
   - O reset administrativo marcará esse estado e usará o mecanismo oficial de recuperação de senha, sem armazenar, registrar ou exibir senha.
   - Não será usada a senha fixa `123456`: ela é bloqueada pela proteção contra senhas vazadas, tem menos de 8 caracteres e contradiz a exigência de não armazenar senha em texto. A segurança existente não será reduzida.
   - Após autenticar por recuperação, o usuário será direcionado à troca obrigatória e não seguirá para o sistema até concluí-la.

3. **Própria senha**
   - Criar uma única tela reutilizável para troca de senha com senha atual, nova senha e confirmação.
   - Validar a senha atual antes da alteração, atualizar pelo serviço oficial de autenticação e limpar o indicador de troca obrigatória somente após sucesso.
   - Adicionar acesso pelo menu de perfil.

4. **Central de Usuários existente**
   - Reutilizar a tela atual para editar nome e e-mail, papel, lojas e status.
   - Adicionar diagnóstico objetivo de autenticação, perfil, papel e lojas.
   - Adicionar exclusão com confirmação, proteção do último Master e limpeza controlada apenas dos registros de acesso do usuário.
   - Tratar “Permissões” pelos mecanismos existentes de papel e lojas; não criar um segundo RBAC ou matriz paralela.
   - Registrar criação, edição, e-mail, papel, lojas, status, reset e exclusão em `audit_logs`, sem dados secretos.

5. **Rotas, menu e acesso por loja**
   - Adicionar validação Master no carregamento de `/admin/cadastros` e `/admin/auditoria`, mantendo a proteção já existente em `/admin/usuarios` e `/admin/configuracoes`.
   - Preservar `user_stores`, `can_access_store` e as políticas atuais; corrigir somente caminhos concretos que contornem esse escopo.
   - Manter categorias recolhíveis e ocultar do menu os módulos que hoje são apenas placeholders, sem excluir rotas ou funcionalidades.
   - Exibir corretamente Master, Gerente ou Treinador no rodapé.

## Validação

- Verificar novamente Robson em autenticação, perfil, papel e lojas após as alterações, sem mudar seus vínculos.
- Testar Master na Central: listar, editar, diagnosticar, alterar papel/lojas, ativar/desativar, resetar e excluir usuário de teste com confirmações e auditoria.
- Testar Gerente e Treinador por URL direta nas três rotas administrativas e em loja não vinculada.
- Testar recuperação/reset, bloqueio até troca, troca da própria senha com senha atual correta/incorreta e retorno normal após sucesso.
- Confirmar que usuário desativado não entra e reativado volta a entrar.
- Verificar RLS, logs, frontend e respostas para ausência de senha, token ou credencial sensível.
- Executar verificação de tipos, compilação, scan de segurança e testes reais em sessões separadas.

## Limites

- Não alterar dados operacionais das lojas, cálculos, metas, bônus, históricos ou layouts fora desse escopo.
- Testes destrutivos serão feitos somente com conta de teste; Robson não terá papel, lojas ou status alterados automaticamente.
- O login do Robson com uma senha conhecida só poderá ser comprovado após o Master iniciar a recuperação/reset; senhas existentes não são legíveis nem serão expostas.
