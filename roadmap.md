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
- [ ] Mapear persistência atual de metas e realizado
- [ ] Implementar limpeza Master por ano, mês e loja opcional
- [ ] Adicionar confirmação e atualização automática na tela de Metas
- [ ] Validar isolamento entre lojas e períodos
