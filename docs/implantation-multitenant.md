# Implantação e isolamento por estabelecimento

## Estrutura

Cada perfil operacional possui um único `establishment_id`. As tabelas operacionais também possuem essa chave, com índices, políticas RLS e, para referências entre tabelas, chaves estrangeiras compostas. `current_establishment_id()` só retorna o estabelecimento de um usuário ativo quando ele também está ativo. Políticas restritivas e gatilhos impedem leitura, gravação e referências entre estabelecimentos, inclusive quando um cliente envia outra chave no payload.

O perfil `implantacao` é a exceção: não possui estabelecimento, cargo personalizado ou categoria operacional. Ele acessa somente a API administrativa `implantation` e os catálogos necessários. A API verifica a sessão e o perfil antes de usar a service role. O papel não aparece nos formulários comuns e a função `assign_implantation_role(uuid)` não pode ser executada pelos papéis `anon` e `authenticated`.

O catálogo usa os módulos existentes como grupos de permissão: `strategy` reúne Matriz de Valor e Dimensões; `indicators` reúne Ficha, Alimentação, Análise Crítica e Painel. Os demais módulos base seguem as rotas existentes. Os planos Start, Pro e Corporate oferecem o mesmo Sistema Base. Módulos adicionais são independentes do plano. Apenas Helpdesk já tem funcionalidade interna; os outros permanecem catalogados como em desenvolvimento e não liberam rotas ou dados até sua implementação.

O modo de IA e `ai_monthly_limit` pertencem ao estabelecimento. `consume_ai_quota()` aplica o limite mensal por estabelecimento antes de uma análise. A tabela de consumo não aceita escrita direta por usuários convencionais.

## Migração de dados existentes

As migrações `20261024100000` a `20261024105000` criam o **Ambiente de Homologação** (`00000000-0000-4000-8000-000000000001`), vinculam a ele os perfis e dados operacionais existentes e preservam suas relações. O Helpdesk existente permanece habilitado nesse ambiente. Configurações que antes usavam chaves globais passam a ter chave composta com `establishment_id`; novos estabelecimentos recebem as configurações padrão copiadas da Homologação. Não há migração financeira.

## Administração

Na rota `/implantacao`, a conta global pode consultar, criar e editar estabelecimentos; escolher plano, status e limite de IA; habilitar módulos adicionais; consultar os usuários vinculados; e convidar o primeiro administrador. As alterações são registradas em `implantation_audit`.

O convite do administrador usa a autenticação Supabase já adotada pelo aplicativo. O perfil do administrador recebe o estabelecimento selecionado pela API, nunca por um valor enviado pelo convidado. Convites posteriores pela tela de Usuários herdam o estabelecimento do administrador autenticado. A suspensão ou desativação bloqueia o acesso operacional sem apagar dados.

Para criar **outra** conta global, crie primeiro o usuário no Supabase Auth por uma operação administrativa. Depois, com uma conexão privilegiada ao banco, crie o perfil com o mesmo UUID e execute:

```sql
SELECT public.assign_implantation_role('UUID-DO-USUARIO-AUTH'::uuid);
```

Se o perfil ainda não existir, crie-o com os campos obrigatórios do esquema atual, `role = 'implantacao'` e `establishment_id = NULL`. Não grave senhas em SQL, migrações ou no repositório. A conta de teste `implantacao@qualiq.com.br` já foi criada no projeto de teste vinculado; sua senha temporária deve ser substituída quando o endereço de e-mail estiver funcional.

## Aplicação e verificação

Em outro projeto Supabase, aplique as migrações em ordem, configure os segredos de autenticação e origem pública já descritos no [README](../README.md), e implante as funções `user-management`, `implantation`, `ai-analysis` e `document-integration`. Publique o frontend após essas etapas.

```bash
npx supabase db push --linked
npx supabase functions deploy user-management
npx supabase functions deploy implantation
npx supabase functions deploy ai-analysis
npx supabase functions deploy document-integration
node scripts/test-multi-tenant-db.mjs
npm run build
```

O teste de banco inicia um PostgreSQL descartável, aplica um esquema reduzido e verifica isolamento, módulos, IA, suspensão, referências cruzadas e a conta global. Requer `initdb`, `pg_ctl` e `psql` disponíveis no `PATH`. `supabase/tests/verify_linked_tenant.sql` contém uma checagem de leitura para o projeto vinculado. O bucket de avatares passou a ser privado; a aplicação usa URLs assinadas para exibir fotos.
