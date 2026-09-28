# Roadmap

- [x] Auditar tela, resolução, banco e dados atuais
- [x] Adicionar escopo mensal mínimo e resolução determinística
- [x] Implementar edição em rascunho e salvamento explícito seguro
- [x] Configurar somente regras fornecidas para Spoleto e preservar Aeroporto
- [x] Validar isolamento, ausência de fallback, histórico e motor existente

- [x] Corrigir composição do faturamento para metas: receita líquida + taxa de serviço/entrega; validar com RelatorioConsolidadoVenda_1_1.xls sem alterar outros módulos.
## Login e importação de funcionários
- [x] Simplificar visualmente somente as telas inicial e de acesso
- [x] Importar PDF/Excel e identificar nome, loja e cargo
- [x] Permitir conferência e correção antes de salvar
- [x] Impedir duplicatas e validar persistência após atualização

## Gestão de dados de Metas
- [x] Mapear persistência atual de metas e realizado
- [x] Implementar limpeza Master por ano, mês e loja opcional
- [x] Adicionar confirmação e atualização automática na tela de Metas
- [x] Validar isolamento entre lojas e períodos
## Benefits persistence and WhatsApp copy
- [x] Audit current Benefits server functions, page mutations, and store authorization
- [x] Route Benefits reads/writes through authorized server functions with explicit database error handling
- [x] Add consolidated and individual WhatsApp clipboard actions using existing calculated values
- [x] Validate save, edit, deduplication, reload persistence, clipboard output, and unauthorized store rejection

## Vínculo manual de colaborador ao período
- [x] Auditar período, vínculos existentes, permissões e proteção contra duplicidade
- [x] Implementar busca autenticada de colaboradores disponíveis por período
- [x] Adicionar seleção e vínculo manual no card Colaboradores
- [x] Validar Jabaquara — Julho/2026, atualização imediata e rejeição de duplicidade
