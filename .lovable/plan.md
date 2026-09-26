# Persistência segura e cópia para WhatsApp em Benefícios

## Objetivo
Corrigir somente a aba Benefícios para que leituras e gravações sejam confirmadas pelo banco com autorização por loja, e adicionar cópia individual e consolidada para WhatsApp usando os valores já calculados.

## Alterações

### 1. Server Functions de Benefícios
- Reutilizar `src/lib/benefits.functions.ts` e as chaves atuais de `app_settings`.
- Validar sessão, perfil ativo, papel e vínculo em `user_stores` antes de qualquer leitura ou gravação.
- Manter Master com acesso global; restringir qualquer usuário não-Master às lojas vinculadas.
- Resolver a loja pelo cadastro existente, sem criar ou alterar lojas.
- Usar a credencial administrativa somente depois da autorização, preservando o RLS fechado para o navegador.
- Ler a chave histórica anual e as chaves atuais por loja, preservando a precedência já usada pela tela.
- Salvar e excluir somente na chave da loja autorizada; editar pelo mesmo `id` para não duplicar.
- Validar e lançar todos os erros de leitura, escrita e auditoria antes de retornar sucesso.
- Manter parâmetros alteráveis somente pelo Master e status limitado à loja autorizada.

### 2. Tela de Benefícios
- Substituir todas as leituras e gravações diretas em `app_settings` pelas Server Functions existentes.
- Mostrar sucesso, fechar o formulário e atualizar os dados apenas após confirmação do servidor.
- Em erro, manter o formulário aberto e os valores preenchidos.
- Atualizar e buscar novamente lançamentos, parâmetros e status após cada operação confirmada.

### 3. Copiar WhatsApp
- Adicionar um botão geral junto aos controles da tabela para copiar o consolidado da loja e competência selecionadas.
- Adicionar um botão compacto de cópia em cada linha.
- Formatar os textos com `BenefitEntry`, `currentMonthEntries`, `storeSummary` e `brl`, sem criar ou alterar cálculos.
- Usar Clipboard API com fallback compatível e mostrar confirmação somente depois da cópia.

## Segurança e dados
- Nenhuma nova tabela ou política aberta.
- Nenhuma alteração no motor de cálculo, valores, metas, bônus ou outras páginas.
- Nenhum dado operacional será alterado durante a implementação; os testes de gravação usarão um lançamento real controlado e restaurarão seu valor original.

## Validação
- Compilação e erros de execução.
- Salvar, recarregar e confirmar persistência no banco.
- Editar o mesmo registro, recarregar e confirmar ausência de duplicidade.
- Conferir cópia individual e consolidada em texto.
- Confirmar rejeição de loja sem vínculo para usuário não-Master.
