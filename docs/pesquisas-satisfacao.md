# Pesquisa de satisfação

O administrador configura critérios por setor, cria perguntas Likert (1 a 5), NPS (0 a 10) e abertas, associa a pesquisa a um processo opcional e publica o questionário em **Pesquisas → Questionários e Links**. A publicação congela as perguntas para que resultados antigos continuem comparáveis. Cada link pode ser associado a um processo, compartilhado livremente e desativado sem perder respostas.

O público responde em `/pesquisa-publica/<token>`, sem login. O banco valida o token, o estado da pesquisa, todas as perguntas obrigatórias e os limites de nota e texto. As respostas ficam no estabelecimento do link. O gestor dono do processo recebe um aviso para revisar cada nova resposta. Pesquisas sem processo são tratadas pelo administrador.

O painel mostra a média Likert, o percentual de notas 4–5, o NPS (% notas 9–10 menos % notas 0–6), os totais por pergunta e setor e a situação de cada resposta. O filtro por link permite analisar os resultados de cada link separadamente. O gestor registra a análise crítica e a ação tomada.

A função `survey-sentiment` analisa os campos abertos sob demanda, usa a cota de IA do estabelecimento e compara a classificação do texto com o sentido das notas objetivas. O resultado fica salvo na resposta. Ela exige `AI_API_KEY` e, como nas demais Edge Functions, as variáveis padrão `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` do ambiente Supabase. Ative a IA e configure a cota no estabelecimento antes de usar o botão **Analisar respostas abertas**.

Implantação: aplicar a migração `20261031130000_satisfaction_surveys.sql` e implantar a Edge Function `survey-sentiment` junto com a aplicação Angular. O link público só ficará funcional depois da migração. A migração habilita o módulo no ambiente de homologação e concede acesso inicial aos administradores e gestores. Nos outros estabelecimentos, habilite o adicional na implantação e ajuste os acessos no gerenciamento de usuários.
