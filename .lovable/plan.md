# VÉRTICE — Marca nas telas + Criação de usuários pelo Master

## 1. Textos visíveis da marca

Trocar os últimos rótulos "DEX BONUS" / "Plataforma DEX Invest" que aparecem na tela:

- Card de login: título passa a "Acesso ao VÉRTICE" e a descrição para "Gestão & Performance das lojas DEX Invest — perfis Master e Gerente."
- Cabeçalho do Dashboard: título "VÉRTICE" com descrição "Gestão & Performance — visão geral dos universos".
- Página pública inicial: o H1 "DEX BONUS" passa a "VÉRTICE", mantendo o selo "DEX Invest" acima.
- Sidebar: "DEX INVEST" passa a "VÉRTICE" com o destaque de cor no segundo bloco da palavra.

Sem mexer em logo, favicon, paleta ou tipografia (isso é o pacote visual completo, tarefa separada).

## 2. Nova tela: Administração → Usuários (`/admin/usuarios`)

Acesso exclusivo Master (mesma checagem `is_master` já usada em `/admin/*`).

Formulário "Novo usuário":
- Nome completo
- E-mail
- Senha inicial (com botão para gerar senha forte e copiar)
- Papel: Master ou Gerente
- Lojas atribuídas: lista de lojas ativas com seleção múltipla (obrigatória para Gerente; ignorada para Master, que já vê tudo)

Ao salvar, o sistema cria o acesso, define o papel, vincula as lojas e mostra a senha para você repassar ao gerente. Validações: e-mail válido, senha mínima de 8 caracteres, e-mail ainda não cadastrado, gerente precisa de ao menos uma loja.

Abaixo do formulário, uma lista dos usuários já existentes com nome, e-mail, papel e lojas vinculadas, permitindo:
- alterar as lojas atribuídas
- alternar o papel entre Master e Gerente
- redefinir a senha

Cada uma dessas ações é registrada na auditoria (`audit_logs`), como já acontece nos outros módulos.

## 3. Login

A aba "Criar conta" do login sai do ar: os acessos passam a ser criados apenas pelo Master nesta nova tela, evitando cadastros não autorizados. O login com e-mail/senha e Google continuam iguais.

## Detalhes técnicos

- Novo `src/lib/users.functions.ts` com server functions sob `requireSupabaseAuth`, cada handler validando `is_master` antes de agir (mesmo padrão de `goals.functions.ts`), e usando `supabaseAdmin` importado dinamicamente dentro do handler:
  - `listUsers` — junta `profiles`, `user_roles`, `user_stores`
  - `createUser` — `auth.admin.createUser({ email_confirm: true })`, depois insere em `user_roles` e `user_stores`; em caso de falha nos vínculos, remove o usuário criado
  - `updateUserRole`, `updateUserStores`, `resetUserPassword`
  - grava `audit_logs` em cada operação de escrita
- Nova rota `src/routes/_authenticated/admin/usuarios.tsx` com `beforeLoad` de master, `head()` própria, formulário com Zod + react-hook-form e React Query para a lista.
- A rota específica tem precedência sobre o splat `admin/$.tsx`, que segue como placeholder das demais telas de administração.
- Nenhuma alteração de schema, RLS ou regra de bônus.
