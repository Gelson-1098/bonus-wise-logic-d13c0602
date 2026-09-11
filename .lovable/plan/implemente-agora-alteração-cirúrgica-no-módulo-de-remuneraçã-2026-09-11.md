IMPLEMENTE AGORA — ALTERAÇÃO CIRÚRGICA NO MÓDULO DE REMUNERAÇÃO VARIÁVEL

OBJETIVO

Manter integralmente o motor de bônus e o funcionamento existente, mas tornar a seleção de regras determinística por:

LOJA + ANO + MÊS

Preservar todos os dados, versões, vínculos e históricos existentes.

NÃO RECONSTRUIR O MÓDULO.

NÃO ALTERAR bonus-engine.ts.

NÃO CRIAR UM NOVO MOTOR.

NÃO APAGAR VERSÕES DUPLICADAS.

NÃO RECALCULAR HISTÓRICOS.

Antes de modificar qualquer coisa, inspecione a implementação atual e faça a alteração mínima necessária.

==================================================

1. BANCO DE DADOS

==================================================

Adicionar em bonus_rule_versions:

- month INTEGER NULL

- constraint garantindo NULL ou valor entre 1 e 12

Manter quarter para compatibilidade com versões existentes.

Se store_id ainda não existir em bonus_rule_versions, adicionar:

- store_id UUID NULL

Interpretação:

- store_id NULL = regra global

- store_id preenchido = regra exclusiva daquela loja

- month NULL = versão legada/não específica de mês

- month 1–12 = versão específica daquele mês

Criar índice adequado para resolução por:

store_id + status + year + month

Preservar TODAS as versões existentes.

NÃO excluir.

NÃO mesclar.

NÃO substituir.

NÃO recalcular históricos.

==================================================

2. SALVAMENTO TRANSACIONAL

==================================================

Criar uma operação/função transacional, restrita ao usuário Master, para salvar de uma única vez:

- parâmetros da versão;

- critérios;

- inclusões;

- exclusões;

- alterações realizadas no rascunho.

Se qualquer parte falhar, desfazer o conjunto inteiro.

O objetivo é impedir salvamento parcial.

Não alterar permissões existentes além do necessário para garantir que somente Master possa salvar regras.

==================================================

3. RESOLUÇÃO DETERMINÍSTICA

==================================================

Centralizar a resolução na função existente de resolução de versão, sem criar um segundo mecanismo paralelo.

A prioridade obrigatória é:

1. bonus_periods.version_id já existente

2. regra específica da LOJA + ANO + MÊS

3. regra específica da LOJA + TRIMESTRE legado

4. regra GLOBAL + ANO + MÊS

5. regra GLOBAL + TRIMESTRE legado

IMPORTANTE:

Remover completamente qualquer fallback do tipo:

"última versão publicada"

"latest published"

"última regra disponível"

É PROIBIDO escolher silenciosamente uma regra recente quando o período não possui regra aplicável.

Se nenhuma regra aplicável for encontrada, retornar claramente:

REGRA NÃO CONFIGURADA PARA ESTE PERÍODO

E impedir o cálculo até que o período tenha uma regra válida.

==================================================

4. HISTÓRICO

==================================================

Se bonus_periods.version_id já estiver preenchido:

USAR EXATAMENTE ESSA VERSÃO.

Nunca substituir automaticamente.

Períodos já vinculados não podem mudar porque uma nova regra foi criada posteriormente.

Preservar calc_snapshot.

Não recalcular períodos históricos automaticamente.

Não alterar fechamentos existentes.

==================================================

5. ABERTURA DE PERÍODO

==================================================

Preservar o fluxo existente de openPeriod().

Quando abrir um período:

LOJA + ANO + MÊS

a resolução deve ocorrer ANTES da sincronização dos colaboradores e do cálculo.

Se já houver:

bonus_periods.version_id

usar esse vínculo.

Se não houver:

resolver pela ordem determinística definida acima.

Se não houver regra:

mostrar:

⚠️ REGRA NÃO CONFIGURADA PARA ESTE PERÍODO

e não criar vínculo incorreto.

==================================================

6. TELA /remuneracao/mensal/regras

==================================================

Manter a tela existente e seu visual.

Não reconstruir a interface.

Adicionar somente os controles necessários:

LOJA

ANO

MÊS

Loja deve permitir:

- Global

- todas as lojas disponíveis

Ano:

- 2026

Mês:

- Janeiro

- Fevereiro

- Março

- Abril

- Maio

- Junho

- Julho

- Agosto

- Setembro

- Outubro

- Novembro

- Dezembro

Q1/Q2/Q3/Q4 podem continuar aparecendo apenas como agrupamento visual.

O trimestre NÃO é a unidade principal de aplicação da regra.

A unidade real é:

LOJA + ANO + MÊS

Ao trocar Loja/Ano/Mês, carregar somente a configuração correspondente.

==================================================

7. RASCUNHO E SALVAMENTO

==================================================

Eliminar a dependência de gravação automática por onBlur ou alteração imediata de switch.

Usar estado local de rascunho.

Fluxo:

1. carregar regras;

2. editar regras;

3. alterações ficam somente no rascunho;

4. mostrar:

⚠️ ALTERAÇÕES NÃO SALVAS

5. clicar:

💾 SALVAR REGRAS

6. executar salvamento transacional;

7. após sucesso mostrar:

✅ REGRAS SALVAS COM SUCESSO

Loja: [nome]

Competência: [MM/AAAA]

Inclusões e exclusões de critérios também permanecem no rascunho até clicar em SALVAR.

Após salvar, atualizar o estado local para refletir a versão persistida.

==================================================

8. SPOLETO JABAQUARA — SETEMBRO/2026

==================================================

Criar uma versão mensal EXCLUSIVA para:

Spoleto Jabaquara

09/2026

A versão deve ser baseada na regra global correspondente, preservando os critérios existentes copiados.

Adicionar os quatro critérios informados:

1. Pedidos cancelados

Meta:

≤ 0,7%

2. Koncluí

Meta:

> 90%

3. Loja limpa e organizada

Considerar:

- nenhum produto vencido nas visitas;

- banheiro abastecido;

- loja limpa;

- loja organizada;

- conformidade operacional.

Não inventar peso ou valor.

4. Cursos Plataforma Prato

Permitir configuração/registro de:

- cursos planejados;

- cursos concluídos;

- percentual;

- observação;

- status.

NÃO inventar meta, peso ou valor para este critério.

IMPORTANTE:

Os critérios específicos do Spoleto devem ficar isolados da regra global e das demais lojas.

Produto vencido e demais critérios eliminatórios existentes devem ser preservados.

==================================================

9. AEROPORTO GRU — SETEMBRO/2026

==================================================

Existem versões publicadas duplicadas do Aeroporto.

PRESERVAR TODAS.

NÃO EXCLUIR.

NÃO MESCLAR.

NÃO SOBRESCREVER.

Para Setembro/2026, selecionar deterministicamente uma versão publicada válida para o Aeroporto.

A seleção deve considerar:

- loja;

- ano;

- mês/trimestre aplicável;

- status publicada;

- compatibilidade com o período.

NÃO escolher simplesmente "a mais recente" se houver mais de uma versão igualmente válida.

Se houver empate real entre versões igualmente aplicáveis e o sistema não conseguir determinar uma única versão com segurança:

NÃO escolher arbitrariamente.

Informar:

⚠️ EXISTEM MÚLTIPLAS VERSÕES VÁLIDAS PARA ESTE PERÍODO — NECESSÁRIA DEFINIÇÃO DO MASTER

Depois que Setembro for vinculado a uma versão, usar:

bonus_periods.version_id

como vínculo definitivo daquele período.

Preservar os critérios existentes do Aeroporto:

- CMV

- Koncluí

- Efetivo

- Turno 24h

NÃO alterar pesos, valores ou metas existentes.

==================================================

10. DEMAIS LOJAS

==================================================

As demais lojas Domino's devem continuar utilizando a regra global aplicável.

Não copiar critérios do Spoleto.

Não copiar critérios do Aeroporto.

Não alterar suas regras atuais.

Testar explicitamente o isolamento.

==================================================

11. CARGOS

==================================================

Preservar a associação existente por:

bonus_criteria.position_id

Não criar critérios individualmente para funcionários.

O fluxo deve continuar:

LOJA

↓

MÊS

↓

VERSÃO

↓

CARGO

↓

CRITÉRIOS

↓

FUNCIONÁRIO

↓

CÁLCULO

==================================================

12. MOTOR DE BÔNUS

==================================================

NÃO ALTERAR:

src/lib/bonus-engine.ts

O motor existente deve continuar responsável pelo cálculo.

Não hardcodar novas regras de bônus no motor.

Não alterar:

- cálculo;

- limites;

- valores;

- pesos;

- comportamento de eliminatórios;

salvo se for absolutamente necessário para corrigir integração com a nova resolução de versão.

==================================================

13. ELIMINATÓRIOS

==================================================

Preservar o comportamento atual.

Quando um critério eliminatório não for atingido:

status = ELIMINADO

total = R$ 0,00

Preservar o registro do motivo no resultado/snapshot conforme a arquitetura atual.

Critérios comuns existentes:

- Produto vencido → eliminatório / zera

- SAC → eliminatório / zera

- Faltas → eliminatório / zera

- Mais de 3 atrasos → eliminatório / zera

- Mais de 1 atestado → eliminatório / zera

Não modificar a semântica existente.

==================================================

14. PRESENTEÍSMO

==================================================

Não alterar o mecanismo atual.

Referências:

Operador:

R$400 máximo

R$200 presenteísmo

R$200 desempenho

Trainee:

R$500 máximo

R$250 presenteísmo

R$250 desempenho

Gerente Pleno:

R$600 máximo

sem obrigação de divisão 50/50.

Não hardcodar esses valores se eles já estiverem parametrizados pelos critérios existentes.

==================================================

15. TESTES OBRIGATÓRIOS

==================================================

Executar:

1. TypeScript / build / lint conforme disponível.

2. Teste da resolução:

a) período já vinculado → mantém version_id

b) loja + mês → encontra regra correta

c) loja + trimestre legado → funciona somente quando aplicável

d) global + mês → encontra regra global

e) global + trimestre legado → funciona somente quando aplicável

f) nenhuma regra → REGRA NÃO CONFIGURADA PARA ESTE PERÍODO

3. Teste de eliminatório:

resultado:

ELIMINADO

R$ 0,00

4. Teste real Setembro/2026:

Spoleto Jabaquara

5. Teste real Setembro/2026:

Aeroporto GRU

6. Teste real Setembro/2026:

uma Domino's padrão

7. Teste de isolamento:

Spoleto não aparece em Domino's.

Aeroporto não aparece em outras lojas.

8. Teste:

Julho/2026 ≠ Setembro/2026

Alterar Setembro não pode alterar Julho.

9. Teste:

editar → salvar → consultar → atualizar página → consultar novamente.

10. Conferir:

bonus_periods.version_id

11. Conferir:

calc_snapshot

12. Conferir:

não houve exclusão ou duplicação indevida de versões.

13. Conferir:

console do navegador sem erros relacionados à alteração.

14. Conferir:

requisições/mutations sem falhas.

==================================================

16. ARQUIVOS

==================================================

Trabalhar somente onde necessário.

Arquivos previstos:

src/lib/bonus.functions.ts

src/lib/rules.functions.ts

src/routes/_authenticated/remuneracao/mensal/regras.tsx

src/routes/_authenticated/remuneracao/mensal/lancamentos.tsx

migration necessária

testes necessários

Não modificar arquivos não relacionados sem justificativa.

==================================================

17. FORA DO ESCOPO

==================================================

NÃO alterar:

- bonus-engine.ts

- cálculos existentes

- metas existentes

- importações

- cadastro de lojas

- permissões existentes, exceto a proteção necessária do salvamento Master

- relatórios

- outras telas

- histórico

- snapshots

NÃO:

- reconstruir o módulo;

- criar novo motor;

- criar fluxo paralelo;

- apagar versões;

- mesclar versões;

- recalcular histórico;

- inventar pesos;

- inventar valores;

- inventar metas;

- usar última regra publicada como fallback.

==================================================

18. CRITÉRIO FINAL DE ACEITE

==================================================

A implementação somente estará concluída quando este fluxo estiver funcionando:

LOJA + ANO + MÊS

↓

RESOLUÇÃO DETERMINÍSTICA

↓

VERSÃO CORRETA

↓

CARGO

↓

CRITÉRIOS

↓

CÁLCULO EXISTENTE

↓

RESULTADO

↓

SNAPSHOT / HISTÓRICO

Sem contaminação entre:

- lojas;

- meses;

- versões;

- períodos históricos.

Ao terminar, não responda apenas "implementado".

Retorne objetivamente:

1. O que foi alterado.

2. Migration criada/executada.

3. Arquivos alterados.

4. Como ficou a resolução de versão.

5. Como ficou o salvamento.

6. Qual versão foi vinculada ao Aeroporto em Setembro/2026.

7. Como ficou a configuração do Spoleto em Setembro/2026.

8. Testes executados e respectivos resultados.

9. Eventuais riscos ou pendências.

IMPORTANTE:

Se encontrar qualquer ambiguidade que possa causar cálculo financeiro incorreto, NÃO escolha silenciosamente uma opção.

PARE naquele ponto e sinalize claramente a ambiguidade para o Master.