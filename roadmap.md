# Roadmap

- [ ] Auditar tela, resolução, banco e dados atuais
- [ ] Adicionar escopo mensal mínimo e resolução determinística
- [ ] Implementar edição em rascunho e salvamento explícito seguro
- [ ] Configurar somente regras fornecidas para Spoleto e preservar Aeroporto
- [ ] Validar isolamento, ausência de fallback, histórico e motor existente

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
