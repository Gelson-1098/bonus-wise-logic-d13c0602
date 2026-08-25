# VÉRTICE — Controle Central de Acessos

Nada de remuneração, PLR, metas, KPI ou dados existentes é alterado. Só a camada de acesso, a marca visível e a nova Central de Usuários.

## 1. Marca nas telas visíveis

- Login: título "Acesso ao VÉRTICE", subtítulo "Gestão & Performance — perfis Master, Treinador e Gerente".
- Dashboard: cabeçalho "VÉRTICE" / "Gestão & Performance — visão geral dos universos".
- Página inicial pública: H1 "VÉRTICE" (selo "DEX Invest" acima permanece).
- Sidebar: "VÉRTICE" no lugar de "DEX INVEST".

Logo, favicon, paleta e tipografia ficam para o pacote de identidade visual completo.

## 2. Login sem autocadastro

- A aba "Criar conta" é removida por completo (nenhum "Cadastre-se"/"Sign up" na plataforma).
- Campos e-mail + senha, botão Entrar e link "Esqueci minha senha" (envia o e-mail de redefinição do Cloud; não cria conta).
- Autocadastro também é desligado na configuração de autenticação, para que ninguém crie conta fora da Central.
- Após qualquer login (senha ou Google), o sistema verifica se o e-mail tem cadastro ativo e papel definido. Se não tiver, encerra a sessão e mostra:
  - sem cadastro: "Este e-mail não possui acesso autorizado ao VÉRTICE."
  - inativo: "Seu acesso está desativado. Procure o administrador."
- Google passa a ser apenas método de autenticação: quem não foi cadastrado pelo Master não entra e não recebe papel nem loja automaticamente.

## 3. Senha padrão (Administração → Configurações → Segurança)

- Tela só do Master, com campo "Senha padrão", botões Salvar/Alterar, e a senha atual exibida sempre mascarada (nunca retornada em texto para a tela).
- A senha padrão fica guardada em área restrita do banco, acessível apenas pelo servidor — nada de senha no código do front, em `profiles`, `user_roles`, `user_stores` ou `audit_logs`.
- Se a autenticação recusar a senha por fraqueza: "A senha escolhida não atende aos requisitos mínimos de segurança."
- Ao trocar a senha padrão, nenhum usuário existente é alterado. Aviso: "A nova senha será utilizada para novos usuários e futuras redefinições."
- A auditoria registra apenas o evento `DEFAULT_PASSWORD_UPDATED`, sem o valor.

## 4. Central de Usuários (`/admin/usuarios`)

Título "Usuários", descrição "Gerencie acessos, perfis e lojas vinculadas.". Só Master; Gerente e Treinador são barrados na rota e no servidor.

Cards: Total, Ativos, Inativos, Masters, Gerentes, Treinadores. Botão "+ Novo usuário".

Formulário Novo usuário: Nome completo, E-mail, Papel (Master / Treinador / Gerente) e Lojas. Sem campo de senha — apenas o aviso "A senha padrão atual será utilizada.". Seleção de lojas com busca, "Selecionar todas", "Limpar seleção" e contador "N lojas selecionadas".

Validações: nome e e-mail obrigatórios, e-mail em formato válido e não duplicado, papel obrigatório, ao menos uma loja para Gerente e Treinador; para Master a seleção de lojas é ignorada (acesso global).

Depois de criar, um resumo com Nome, E-mail, Papel, Loja(s) e a senha mascarada, com botão "Copiar credenciais" (a senha é entregue apenas nesse retorno da criação, para você repassar).

Lista de usuários com Nome, E-mail, Papel, Lojas, Status, Último acesso, Criado em e menu de ações (Visualizar, Editar, Alterar papel, Alterar lojas, Redefinir senha, Ativar, Desativar, Ver auditoria). Filtros por busca, papel, loja e status, com estados de carregando, erro, vazio e recarregar.

Confirmação obrigatória em alteração de papel, alteração de lojas, redefinição de senha, ativação e desativação. Redefinir senha aplica a senha padrão atual e nunca grava o valor.

Proteção do último Master: não é possível desativar, rebaixar ou excluir o único Master ativo — "É necessário manter pelo menos um Master ativo na plataforma."

## 5. Perfis

Master (global e administrativo), Gerente (somente lojas vinculadas) e o novo Treinador — criado agora e com vínculo de lojas, com as permissões específicas a definir depois; por ora acesso equivalente ao de Gerente sem qualquer poder administrativo.

## Detalhes técnicos

Banco (migração mínima, sem tocar em dados existentes):
- `ALTER TYPE app_role ADD VALUE 'treinador'`.
- `profiles.active boolean not null default true` para o status Ativo/Inativo.
- Tabela `private.security_settings` (fora da API pública, sem GRANT para `anon`/`authenticated`) guardando a senha padrão; leitura/escrita apenas pelo servidor com a chave de serviço.
- `handle_new_user` deixa de atribuir papel automaticamente (mantém a criação do registro de perfil e a semente do primeiro Master já existente), para que Google/e-mail nunca gerem acesso por si.
- Nenhuma política RLS existente é removida; as atuais (`is_master()` para gerenciar `user_roles`/`user_stores`, leitura própria) já cobrem a Central.

Servidor — novo `src/lib/users.functions.ts`, todas as funções com `requireSupabaseAuth` + checagem `is_master` via `context.supabase` antes de qualquer ação, e `supabaseAdmin` importado dinamicamente dentro do handler:
- `listUsers`, `createUser`, `updateUser`, `updateUserRole`, `updateUserStores`, `resetUserPassword`, `activateUser`, `deactivateUser`
- `getDefaultPasswordStatus` (só metadados: se está configurada e quando) e `setDefaultPassword`
- criação: valida → lê a senha padrão → `auth.admin.createUser({ email_confirm: true })` → perfil → papel → lojas → auditoria; qualquer falha reverte o que foi criado (inclusive removendo o usuário do Auth) para não deixar registro parcial
- desativar usa `profiles.active = false` + banimento no Auth, de modo que o login realmente não conclui; ativar reverte
- último acesso lido do Auth (`last_sign_in_at`)
- `audit_logs` recebe `USER_CREATED`, `USER_UPDATED`, `USER_ROLE_UPDATED`, `USER_STORES_UPDATED`, `USER_PASSWORD_RESET`, `USER_ACTIVATED`, `USER_DEACTIVATED`, `DEFAULT_PASSWORD_UPDATED`, sempre com ator, alvo e metadados sem senhas ou chaves

Front:
- `src/routes/_authenticated/admin/usuarios.tsx` e `src/routes/_authenticated/admin/configuracoes.tsx` com `beforeLoad` de Master, `head()` própria; rotas específicas têm precedência sobre o splat `admin/$.tsx`, que segue como placeholder das demais telas.
- Formulários com Zod + react-hook-form, dados via React Query e componentes shadcn existentes; ícones Lucide conforme o briefing.
- Gate de autorização pós-login em um hook usado pelo shell autenticado e nas ações de login, encerrando a sessão de e-mail sem cadastro ou inativo. O layout `_authenticated/route.tsx` gerenciado não é alterado.
