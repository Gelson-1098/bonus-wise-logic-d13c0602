# Correção cirúrgica do login por e-mail e senha

## Diagnóstico confirmado

- Todos os 14 usuários de `profiles` possuem conta correspondente no serviço de autenticação, perfil e papel; não há conta sem perfil ou sem papel.
- Cinco contas estão confirmadas. Oito contas ativas antigas e uma conta inativa antiga têm senha cadastrada, mas o e-mail não foi confirmado.
- As contas criadas pela Central de Usuários atual já usam o mecanismo administrativo oficial com e-mail confirmado; o problema de confirmação está restrito ao legado.
- As tentativas recentes de uma conta já confirmada chegaram ao serviço de autenticação e foram rejeitadas como senha incorreta. Essa senha não será redefinida sem solicitação.
- O formulário ainda envia o e-mail exatamente como digitado, sem remover espaços nem normalizar maiúsculas.

## Alterações

1. Normalizar somente o e-mail no login com `trim().toLowerCase()`, preservando a senha exatamente como digitada.
2. Manter intactas as mensagens e a separação entre autenticação e autorização.
3. Confirmar, pelo mecanismo administrativo oficial, apenas as oito contas ativas legadas que já possuem perfil, papel, senha e ainda não têm e-mail confirmado.
4. Não confirmar a conta inativa, não criar contas, não redefinir senhas e não alterar lojas, papéis ou permissões.

## Validação

- Verificar novamente a correspondência entre autenticação, perfis, funcionários, papéis e lojas.
- Confirmar que as contas ativas legadas ficaram aptas para login e que a inativa permaneceu bloqueada.
- Testar em sessão limpa o formulário com e-mail em maiúsculas e com espaços, além dos estados de senha incorreta e usuário inexistente.
- Verificar o carregamento do link `/auth`, o redirecionamento e a autorização posterior sem alterar regras existentes.
- Validar compilação e funcionamento da prévia.

## Limite do teste

O login completo por senha de um usuário comum só pode ser comprovado sem redefinição se uma credencial real estiver disponível. Na ausência dela, a validação confirmará todo o estado da conta e os cenários negativos, sem modificar senhas.
