# Correção do motor de bônus — separar "Cancelados iFood" e "Pedidos com Chamado"

## Situação atual (verificada no banco)

Hoje existe **um único indicador** `Cancelamentos/Chamados` na versão publicada 1º Trimestre/2026:

| Cargo (base) | Valor atual do indicador único | Peso |
|---|---|---|
| Gerentes (R$ 600) | R$ 60,00 | 10% |
| Gerente Trainee (R$ 500) | R$ 50,00 | 10% |
| Operadores / Instrutor (R$ 400) | R$ 40,00 | 10% |

Não há nenhum período aprovado/fechado nem resultado lançado, então a correção pode ser aplicada na própria versão publicada sem afetar histórico.

## O que será feito

Substituir o indicador único por **dois indicadores independentes**, em todos os cargos:

1. **Cancelados iFood** (código `CANC_IFOOD`)
2. **Pedidos com Chamado** (código `CHAMADO`)

Valores conforme você definiu:

| Cargo | Cancelados iFood | Pedidos com Chamado |
|---|---|---|
| Gerentes (todos os níveis: Jr, Pleno II, Pleno III, Sênior, PJ, Gerente) | R$ 30,00 (5%) | R$ 30,00 (5%) |
| Gerente Trainee | R$ 25,00 (5%) | R$ 25,00 (5%) |
| Operador, Operador I, Operador II, Instrutor III | R$ 20,00 (5%) | R$ 20,00 (5%) |

Cada um passa a ter **meta e lançamento próprios**: o gerente marca "atingiu / não atingiu" separadamente, e o pagamento de um não depende do outro. Se o Gerente atinge Cancelados iFood e não atinge Pedidos com Chamado, recebe R$ 30 + R$ 0; atingindo os dois, R$ 60.

## Validações que o sistema vai conferir

Na tela do Motor de Regras, cada cargo mostra um painel de conferência com bloqueio/alerta antes de publicar:

- Soma dos valores dos indicadores = valor máximo do cargo (Gerente R$ 600, Trainee R$ 500, Operador R$ 400).
- Soma dos pesos = 100%.
- Teto por cargo: o cálculo nunca paga acima do valor máximo (já existe no motor, ficará visível como aviso).
- Todo indicador com regra de atingimento própria — aviso se algum ficar sem meta definida.

Ponto a corrigir de tabela: nos cargos de gerência os pesos hoje somam **99,99%** (três indicadores de 13,33%). Com a divisão, ajusto para fechar exatamente 100% (13,34 / 13,33 / 13,33), mantendo os valores em R$ intactos.

## Revisão dos demais critérios

Depois de aplicar essa correção, monto uma tela/relatório de conferência por cargo (indicador, meta, peso, valor, eliminatório) para você comparar com o combinado com os gerentes e me apontar os próximos ajustes.

## Detalhes técnicos

- Migração de dados na versão publicada: renomear a linha `CANC` para `Cancelados iFood` (`CANC_IFOOD`, valor/peso ajustados) e inserir a linha nova `CHAMADO` para cada `position_id`, mantendo `sort_order` sequencial e as metas textuais (`< 1%` cancelados, `< 5%` chamados) editáveis.
- Correção dos pesos de 13,33 → 13,34 no primeiro indicador dos cargos de gerência.
- Registro em `audit_logs` da alteração de critérios.
- `bonus-engine.ts` já trata cada critério de forma independente (valor por linha, sem agrupamento) — nenhuma mudança de lógica é necessária; apenas os alertas de soma de pesos/valores ganham destaque na UI de regras.
