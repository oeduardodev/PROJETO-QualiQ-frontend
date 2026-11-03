# Construção de Formulários

O módulo **Construção de Formulários** permite ao administrador criar pesquisas internas independentes da pesquisa de satisfação. Cada formulário pode ser associado a um processo e a um setor, além de receber descrição, cor e mensagem de agradecimento próprias.

O editor oferece perguntas de texto curto, texto longo, escolha única, múltipla escolha, nota de 1 a 5 e data. As perguntas podem ser marcadas como obrigatórias e reordenadas. O administrador salva rascunhos e publica quando estiver pronto. A publicação fixa a estrutura e gera um link em `/formulario-publico/<token>`. Qualquer pessoa com esse link pode responder sem login enquanto o formulário estiver publicado. O administrador pode encerrar o link sem apagar as respostas.

O **Painel de Resultados** apresenta a quantidade de respostas, a média das notas, a distribuição das escolhas e cada resposta individual. As respostas são isoladas por estabelecimento. O banco valida o token, o estado do formulário, as opções e todas as perguntas obrigatórias antes de gravar uma resposta.

Para ativar, aplique a migração `20261102120000_form_builder.sql` e publique a aplicação Angular. A migração habilita o módulo no ambiente de homologação e concede acesso inicial aos administradores. Nos demais estabelecimentos, habilite o adicional na implantação e configure o acesso de usuários ao módulo. A criação e publicação exigem perfil de administrador.
