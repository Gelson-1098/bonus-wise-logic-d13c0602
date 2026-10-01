<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Vínculos manuais de colaboradores são gravados em `employee_period_entries` por período, após autorização pela loja do período, porque o cadastro mestre não deve ser alterado.
- Senhas iniciais e resets usam credenciais temporárias individuais no esquema privado, acessíveis somente por funções administrativas e apagadas após a troca pessoal, para impedir compartilhamento e exposição permanente.
- A exportação financeira de benefícios lê os valores persistidos por funções autenticadas e gera quatro abas no navegador, para preservar o escopo de lojas do usuário sem duplicar dados.
- A evolução de Benefícios mantém cada competência no armazenamento existente, vinculada por `employee_id`, com ocorrências, ajustes e memória de cálculo no próprio registro para preservar históricos sem duplicar o cadastro mestre.
