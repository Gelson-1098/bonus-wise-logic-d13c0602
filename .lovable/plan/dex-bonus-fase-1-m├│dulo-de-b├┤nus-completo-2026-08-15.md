# DEX Bonus — Fase 1 (módulo de Bônus completo)

Sistema web corporativo para calcular, conferir, aprovar e exportar bônus das lojas DEX Invest, com motor de regras editável, versionamento trimestral, histórico imutável e acesso separado por loja.

## Fluxo que vai funcionar de ponta a ponta

```text
LOGIN → (Gerente) Minha Loja → Período → Funcionários → Lançamento
      → Cálculo automático → Justificativa → Enviar
      → (Master) Conferência → Aprovar / Solicitar correção
      → Fechamento (snapshot) → Exportação XLSX/CSV/PDF
```

## Telas da Fase 1

- **Login** (e-mail/senha) e redirecionamento por perfil.
- **Dashboard Master**: cards (bônus total, aprovado, pendente, funcionários, lojas, % elegibilidade) e gráficos (bônus por loja, por cargo, elegíveis x não elegíveis, evolução mensal).
- **Dashboard Gerente**: apenas a própria loja, status do fechamento, pendências, ranking interno.
- **Lançamento do Bônus**: seletor Período / Loja / Status, tabela de funcionários (Cargo, Meta, Resultado, Atingimento, Bônus base, Bônus calculado, Status, Observação) e ficha individual em modal com o detalhamento por critério.
- **Funcionários / Cargos / Lojas / Usuários**: CRUD, com o gerente restrito à própria loja.
- **Metas**: meta por loja e período, com base histórica + % de crescimento (ex.: 2025 + 10%) editável e meta ajustada manualmente registrada.
- **Motor de Regras / Critérios**: tabela editável por versão trimestral (cargo, critério, tipo, meta, peso, faixas, % de pagamento, valor, eliminatório, obrigatório, vigência, status), com alerta quando os pesos não fecham 100%.
- **Publicar Regras**: resumo antes de publicar e confirmação; versão publicada passa a ser oficial.
- **Simulador**: altera meta/resultado/peso temporariamente e mostra o bônus estimado, sem tocar no fechamento.
- **Central de Conferência (Master)**: filtros, aprovar / reprovar / solicitar correção / editar / ver detalhes.
- **Fechamentos e Histórico**: períodos congelados, reabertura só pelo Master com motivo.
- **Auditoria**: log de usuário, data/hora, ação, campo, valor anterior e novo.
- **Exportação**: XLSX (resumo geral + detalhamento por loja com subtotais), CSV e PDF.
- **Menu com módulos futuros** (Avaliação diária, Feedback, Benefícios, Treinamentos, Secullum) visíveis como "Em desenvolvimento".

## Regras de cálculo (parametrizadas, nada fixo no código)

1. Atingimento da loja = Realizado ÷ Meta × 100.
2. Faixas de elegibilidade configuráveis (hoje 90% mínimo, 95% alerta, 100% meta) com semáforo 🔴🟡🟢🔵.
3. Abaixo do mínimo → `SEM GATILHO`, bônus R$ 0,00 com motivo explícito.
4. Critérios eliminatórios configuráveis (elimina / reduz / alerta / exige justificativa / exige aprovação Master).
5. Soma dos critérios atingidos conforme peso e valor da versão vigente, limitada ao valor base do cargo.
6. Cada resultado grava snapshot da regra, entradas e memória de cálculo — regra alterada depois não recalcula período fechado.

## Dados iniciais (da sua planilha e do briefing)

Lojas: as 13 informadas, incluindo Boali. Cargos com valor base editável: Operador/Operador I/II/Instrutor R$ 400, Gerente Trainee R$ 500, Gerente Jr/Pleno/Sênior/PJ R$ 600. Critérios da planilha (Konkluí, iFood, Cancelamentos, Chamados, NPS, CMV Pulse, Custo de entrega, Efetivo, UniDomino's) e eliminatórios (falta injustificada, atrasos, medidas disciplinares, produto vencido, QA, multas/OER, auditoria negativa) cadastrados como versão inicial editável.

### Inconsistências que serão cadastradas como estão e sinalizadas na tela, não "corrigidas"

- Cargos da planilha (Operador I/II, Instrutor III, Gerente Jr, Pleno II/III, Sênior, PJ) não coincidem com os do briefing (Gerente / Trainee / Operador); ambos ficam cadastrados.
- Pesos não fecham 100%: operacionais somam 50% (Konkluí 20 + iFood 10 + Cancelamentos 10 + NPS 10) e liderança soma 25% nos pesos individuais listados, enquanto o resumo por categoria indica 40/20/25/15.
- "Gerente Jr" tem 4 linhas de indicador contra 13 dos demais cargos de liderança.
- Cancelamentos <1% e Chamados <5% compartilham um único peso de 10% (5% cada) no material.
- Regra especial "gabaritando os eliminatórios garante ≥50% do prêmio" fica cadastrada como regra opcional desativada, aguardando sua confirmação.
- Praia do Canto: "Gisele" e "Gizely" ficam como dois registros distintos com alerta de possível duplicidade para o Master decidir.
- Nenhum peso, valor ou nome será inventado; onde falta definição, o parâmetro nasce vazio e sinalizado.

## Design

Visual corporativo minimalista: cinza, azul acinzentado, azul claro fosco, branco; cards com bordas discretas e sombra leve, tipografia limpa, sidebar fixa em desktop e navegação colapsável em mobile. Sem aparência de planilha.

## Detalhes técnicos

- Lovable Cloud (Postgres + Auth) com RLS: `has_role()` em tabela `user_roles` separada e `user_stores` para vínculo de loja; gerente só lê/escreve dados da própria loja, Master vê tudo. Nada de autorização apenas no frontend.
- Tabelas: `profiles`, `user_roles`, `user_stores`, `stores`, `positions`, `employees`, `bonus_periods`, `bonus_rule_versions`, `bonus_criteria`, `store_targets`, `employee_period_entries`, `employee_criterion_results`, `bonus_calculations` (com snapshot JSON), `bonus_approvals`, `audit_logs`; estrutura preparada para `store_evaluations`, `store_feedback`, `benefits`, `trainings`, `secullum_records`.
- Cálculo e transições de status em server functions (TanStack Start) — nunca no cliente; triggers de auditoria no banco.
- Rotas autenticadas sob `_authenticated/`, dados via TanStack Query, exportação XLSX/CSV/PDF gerada no cliente a partir do fechamento.
- Fases 2–5 (avaliação diária, benefícios, treinamentos, Secullum) só com telas de placeholder e tabelas previstas, sem integração falsa.
