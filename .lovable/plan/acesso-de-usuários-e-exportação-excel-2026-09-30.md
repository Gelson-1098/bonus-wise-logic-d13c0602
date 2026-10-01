# Acesso de usuários e exportação Excel

## Objetivo
Simplificar a criação e redefinição de acessos com senhas temporárias individuais, preservar as permissões atuais e acrescentar uma exportação Excel baseada exclusivamente nos dados persistidos.

## Implementação

### 1. Credenciais temporárias seguras
- Substituir o uso da senha padrão compartilhada por uma senha temporária individual no formato solicitado, gerada no servidor.
- Criar um armazenamento privado, inacessível ao navegador e aos usuários comuns, contendo somente credenciais temporárias ainda válidas.
- Na criação e no reset administrativo, atualizar o acesso oficial, marcar `must_change_password = true`, substituir qualquer senha temporária anterior e registrar a auditoria existente.
- Expor leitura da senha temporária apenas por função autenticada que valide o perfil Master.
- Apagar a credencial temporária quando o usuário concluir a troca de senha; senhas pessoais nunca serão armazenadas ou reveladas.
- Preservar usuários existentes, seus papéis, lojas e senhas atuais. Apenas novos usuários e resets futuros entrarão no novo fluxo.

### 2. Central de usuários
- Manter a tela e os componentes atuais.
- Após criar ou resetar, abrir um modal persistente com nome, login, senha temporária e link do sistema.
- Adicionar visualizar, copiar senha, copiar mensagem completa e abrir WhatsApp com a mensagem preenchida.
- Mostrar na tabela se há senha temporária disponível; quando não houver, exibir “Senha pessoal ativa”, sem revelar qualquer senha pessoal.
- Remover da interface o fluxo antigo de senha padrão compartilhada, sem apagar estruturas legadas nesta etapa.
- Manter mensagens específicas para e-mail duplicado, falhas no acesso, perfil, papel e vínculos de loja.

### 3. Primeiro acesso e reset
- Manter o bloqueio existente que encaminha usuários com troca pendente para `/alterar-senha`.
- Impedir navegação normal até a troca ser concluída.
- Após a troca confirmada pelo serviço de autenticação, limpar a credencial temporária, desmarcar a obrigação e liberar o sistema.
- O reset administrativo passará a gerar e exibir uma nova senha temporária imediatamente, sem depender do envio de e-mail.

### 4. Exportação Excel
- Acrescentar a central na área existente de Períodos e conferência, sem criar uma nova seção visual desnecessária.
- Filtros: mês/ano ou intervalo de datas, uma/todas/múltiplas lojas e status.
- Conforme definido, em Benefícios: `Fechado = Aprovado` e `Estimado = Pendente`; não haverá registros “Reprovados” porque esse estado não existe na fonte.
- Buscar dados por função autenticada e respeitar as lojas autorizadas; Master poderá selecionar todas.
- Gerar `.xlsx` com quatro abas: Consolidado, Por Loja, Resumo Financeiro e Detalhamento.
- Usar os valores já persistidos de Benefícios. Campos sem fonte real, como data e autor da aprovação, permanecerão vazios em vez de serem inventados.
- Totais e consolidações serão fórmulas no arquivo; a tela mostrará a confirmação e liberará o download.

## Banco e segurança
- Adicionar somente a estrutura privada necessária à credencial temporária e funções restritas ao servidor administrativo.
- Não alterar `user_roles`, `user_stores`, RLS existente, lojas, remuneração, metas, bônus ou dados operacionais.
- Não registrar senhas em auditoria, logs ou mensagens de erro.

## Validação
- Criar um usuário de teste, copiar/enviar o acesso, entrar com a senha temporária, confirmar o redirecionamento obrigatório, trocar a senha e validar que a temporária deixa de funcionar e de aparecer.
- Resetar o mesmo usuário e repetir o fluxo com uma nova senha temporária.
- Confirmar acesso apenas às lojas autorizadas e rejeição para não-Master na leitura de credenciais.
- Gerar e abrir o Excel, conferir as quatro abas, fórmulas sem erros, totais contra os dados do sistema, filtros de loja/período e exclusão de Estimados quando “Aprovados” estiver selecionado.
- Remover apenas os dados temporários criados para o teste, preservando os dados reais.
