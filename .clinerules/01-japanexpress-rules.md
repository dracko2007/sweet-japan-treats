# REGRAS DO PROJETO — japanexpress-store.com

## PERFIL & ORÇAMENTO
- **Usuário:** Não-programador, dono da loja japanexpress-store.com.
- **Agente Core:** GLM 5.2 via Z.ai (1M Context Window).
- **Prioridade de tokens:** Alta sensibilidade ao acúmulo em loops longos. O usuário roda tarefas no piloto automático, então o agente deve economizar tokens por conta própria, sem resets manuais da janela.

## MANDAMENTO DE CONSERVAÇÃO DE TOKENS (CRÍTICO)
1. **Sem leituras redundantes:** Antes de ler um arquivo com qualquer ferramenta, verifique se já tem o conteúdo completo no histórico da conversa. Não use ferramentas de leitura no mesmo arquivo mais de uma vez por sessão.
2. **Operações atômicas:** Quebre tarefas complexas em pequenos passos lógicos. Não rode loops de análise multi-arquivo se o objetivo pode ser atingido editando um único arquivo-alvo.
3. **Sem reescrever arquivos inteiros:** Ao atualizar um arquivo, produza *apenas* os blocos/linhas que mudam (diffs). Nunca reescreva um arquivo de 500 linhas só para trocar 2 linhas de CSS/HTML.
4. **Parar e pedir direção:** Se um loop de debug/geração falhar mais de 3 iterações seguidas, PARE imediatamente, resuma o bloqueio em 1–2 frases e peça permissão/orientação antes de gastar mais tokens.

## PADRÕES DE DESENVOLVIMENTO
- **Site-alvo:** japanexpress-store.com (e-commerce de produtos japoneses importados para o Brasil, sob regras de Remessa Conforme).
- **Integridade do código:** Todo HTML, CSS e JS deve permanecer leve, de carregamento rápido e moderno.
- **Verificação:** Sempre explicar o que foi alterado em português claro e não-técnico após uma edição bem-sucedida, para que o usuário teste facilmente no ambiente ao vivo.

## FLUXO DE VERSIONAMENTO (GIT) — OBRIGATÓRIO
- **Sempre commitar e dar push:** Toda vez que concluir qualquer alteração nos arquivos do projeto (código, config ou conteúdo), execute imediatamente `git add` + `git commit` + `git push`, sem exceção e sem deixar para depois.
- **Um commit por alteração concluída:** Nunca acumule mudanças pendentes. Assim que uma edição estiver pronta e validada, commit e push na hora.
- **Mensagens de commit:** Curtas e em português, descrevendo o que mudou (ex.: "ajusta espaçamento do header", "adiciona banner de promoção", "corrige link do rodapé").
- **Ordem correta:** adicionar (`git add`) → commitar (`git commit -m "..."`) → enviar (`git push`). Confirmar que o push foi concluído antes de considerar a tarefa finalizada.
