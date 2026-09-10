# PRISMA — Usuários, Orçamento consultivo e WhatsApp

Escopo restrito aos três itens pedidos. Nada de dashboards, cálculos, lançamentos, benefícios, metas gravadas ou layout geral é alterado.

## 1. Administração de Usuários

O que já existe e será preservado: a Central de Usuários (`/admin/usuarios`) com cards, filtros, lista, criação, alteração de papel, alteração de lojas, redefinição de senha e ativar/desativar; os perfis Master, Treinador e Gerente; a senha padrão já configurada.

O que foi verificado agora:
- a página abre como HTML normalmente (não é erro de servidor na abertura);
- o serviço de acesso responde e a leitura da lista de usuários chega a ser executada;
- existe 1 Master ativo, 11 usuários e senha padrão configurada.

A causa exata da tela "This page didn't load" ainda não está confirmada — ela aparece quando algo estoura durante a carga da página, e isso só é observável com uma sessão Master real. Por isso o primeiro passo é reprodução:

1. Entrar como Master no ambiente e abrir `/admin/usuarios` capturando a mensagem real do erro (console e resposta das chamadas ao servidor).
2. Corrigir apenas a causa apontada por essa reprodução (a suspeita principal é a chamada que lista os usuários devolvendo erro em formato inesperado, que hoje derruba a tela em vez de mostrar a mensagem na própria página).
3. Fazer a tela nunca mais quebrar por falha de carga: erro de leitura passa a aparecer dentro do card, com botão "Tentar novamente", em vez de substituir a página inteira.

Depois disso, conferir na prática, com o Master: ver a lista, criar usuário, alterar papel, vincular lojas, redefinir senha e ativar/desativar. O perfil Treinador fica selecionável na criação/edição, sem criar nenhum usuário novo (conforme sua resposta).

Nenhum usuário existente é criado, excluído, duplicado ou alterado.

## 2. Orçamento de Metas — acesso consultivo a todas as lojas

Hoje Gerente e Treinador só conseguem ler metas, períodos, faturamento e histórico das lojas vinculadas ao seu usuário, então a matriz aparece incompleta para eles.

Mudança: liberar **leitura** de todas as lojas para qualquer usuário autenticado nos dados que alimentam esse módulo (metas, períodos, valores realizados e histórico de faturamento), mantendo:
- edição, importação, geração de metas, exclusão e parâmetros de crescimento exclusivos do Master;
- o acesso operacional dos outros módulos (lançamentos, benefícios, bônus) inalterado, restrito às lojas do usuário.

No mesmo passo, as permissões de gravação desses dados que hoje estão abertas a qualquer usuário autenticado passam a exigir Master — é o que garante, de fato, que Gerente e Treinador fiquem em modo consulta.

Na tela, o Gerente/Treinador continua vendo exatamente a matriz atual (sem botões de edição, já ocultos hoje), agora com todas as lojas para comparação.

## 3. Ícone de WhatsApp — comparativo do mês

Na matriz de Orçamento de Metas, adicionar um ícone discreto de WhatsApp ao lado dos controles já existentes (o compartilhamento por loja continua como está).

Ao clicar, ele monta o comparativo do **mês atualmente selecionado**, usando exatamente os valores já exibidos na tela, para todas as lojas visíveis:

```text
📊 COMPARATIVO DE METAS — SETEMBRO/2026

🏪 Aclimação
🎯 Orçado: R$ 150.000,00
💰 Realizado: R$ 142.500,00
📈 Atingimento: 95,0%
```

Onde não houver realizado, o texto traz "Não lançado" e não mostra atingimento inventado. O texto é copiado para a área de transferência e aparece um aviso de "copiado". Com "Ano completo" selecionado, o título usa o ano.

## Detalhes técnicos

- `src/routes/_authenticated/admin/usuarios.tsx`: tratamento de erro da carga dentro do card (sem `throw` que derrube a rota) e ajuste pontual conforme o erro reproduzido.
- `src/lib/users.functions.ts` / `src/lib/users.server.ts`: correção mínima apenas se a reprodução apontar a falha aqui (ex.: normalizar a mensagem de erro devolvida ao cliente). Nenhuma mudança na regra de "último Master ativo" nem na auditoria.
- Migração de RLS, sem tocar em dados: `SELECT` liberado a `authenticated` em `store_goals`, `store_targets`, `bonus_periods`, `revenue_history`; `INSERT`/`UPDATE`/`DELETE` dessas tabelas passam a exigir `is_master()` (hoje há `INSERT` sem restrição). `app_settings` mantém leitura de `goal_growth` e escrita só Master.
- `src/routes/_authenticated/remuneracao/mensal/metas.tsx`: novo botão-ícone de WhatsApp que reaproveita os totais já calculados no componente da matriz (`selectedMonth`, meta orçada, realizado, atingimento). Nenhuma fórmula nova.
- Verificação: `bunx tsgo --noEmit` e testes no navegador como Master e como Gerente (matriz completa, sem ações de edição, botão WhatsApp gerando o texto do mês selecionado).
