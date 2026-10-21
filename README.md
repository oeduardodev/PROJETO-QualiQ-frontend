# Orbis — Sistema de Gestão da Qualidade

O **Orbis** é uma aplicação de **Sistema de Gestão da Qualidade (SGQ)** desenvolvida em **Angular 22**, mantendo os fluxos de negócio existentes, a integração com **Supabase** e a identidade visual baseada em **Tailwind CSS**.

## Requisitos

Para executar o projeto, é necessário ter instalado:

- Node.js `^22.22.3`, `^24.15.0` ou `^26.0.0`
- npm `11` ou superior

## Configuração do ambiente

Copie o arquivo `.env.example` para `.env`:

```bash
cp .env.example .env
```

Em seguida, informe as credenciais públicas do projeto Supabase:

```dotenv
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Antes dos comandos `start` e `build`, o script:

```text
scripts/generate-env.mjs
```

converte essas variáveis para:

```text
public/env.js
```

Por segurança e para evitar configurações específicas de ambiente no repositório, tanto o arquivo `.env` quanto o `public/env.js` gerado não são versionados.

## Opções configuráveis no Supabase

As opções dos formulários são consultadas no banco ao abrir a tela. Para alterar nomes, ordem ou disponibilidade, edite as tabelas de referência no Supabase e recarregue a página:

| Área           | Tabela                                                                                                                            |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Incidentes     | `ticket_statuses`, `notification_severities`, `analysis_tools`                                                                    |
| Helpdesk       | `helpdesk_statuses`, `helpdesk_categories`, `helpdesk_priorities`                                                                 |
| Planos de ação | `action_plan_statuses`                                                                                                            |
| Riscos         | `risk_types`, `risk_statuses`, `risk_preventive_action_statuses`, `risk_contingency_plan_statuses`, `risk_matrix_classifications` |
| SLAs           | `sla_statuses`                                                                                                                    |
| Dimensões      | `dimension_classifications`, `dimension_colors`                                                                                   |
| Indicadores    | `indicator_statuses`                                                                                                              |

Nas tabelas de etapas (`ticket_statuses`, `helpdesk_statuses` e `action_plan_statuses`), `key` é o valor persistido, `label` é o texto exibido e `order_index` controla a ordem das colunas. `next_status_key` continua atendendo fluxos genéricos, mas as transições de incidentes e a aprovação de progresso dos planos de Operação são validadas pelas funções do banco. Marque uma etapa inicial com `is_initial = true` e uma final com `is_terminal = true`. Há apenas uma etapa inicial por fluxo. Uma etapa inativa continua visível para registros antigos, mas não aparece nas opções para novos registros.

As faixas de `risk_matrix_classifications` são editadas em **Gerenciamento de Riscos → Classificações da matriz** por um administrador. Elas cobrem as pontuações de 1 a 25 sem lacunas e determinam o nível, as cores e a legenda da matriz. Riscos novos e históricos começam como rascunho; no gerenciamento, Admin ou Gestor envia para aprovação e um Admin aprova ou rejeita com motivo. Só riscos aprovados aparecem no painel. A edição de um risco aprovado o devolve ao rascunho.

Ao editar um risco, o responsável é escolhido entre os usuários cadastrados e uma justificativa é obrigatória; ela aparece no histórico da alteração. Nomes antigos sem vínculo com usuário continuam disponíveis ao editar o registro. No gerenciamento, riscos podem ser desativados e reativados sem perder vínculos. O filtro mostra ativados, desativados ou todos; riscos desativados não aparecem no painel nem nas listas de seleção de outras áreas. O botão **Histórico** mostra alterações do risco, decisões de aprovação e inclusões ou remoções de fatores, ações preventivas e planos de contingência. Registros anteriores à auditoria têm um estado inicial e os eventos de aprovação cujas datas já estavam disponíveis.

Em `analysis_tools`, `requires_completion` exige a confirmação da análise antes de concluir o incidente. `render_kind` escolhe o formulário de causa: `ishikawa`, `five_whys`, `none` ou o formulário genérico (confirmação de análise). Novas chaves podem reutilizar um desses renderizadores.

`form_field_types` registra os tipos aceitos nos esquemas JSON dos campos de incidente. A interface interpreta esses tipos ao exibir os campos.

Em `indicator_statuses`, `min_goal_ratio` é o limite mínimo em relação à meta; deixe `NULL` na etapa de fallback. O registro de valores consulta esses limites diretamente no banco. As opções de unidade e frequência vêm, respectivamente, das funções `get_indicator_unit_options()` e `get_indicator_frequency_options()` sobre os ENUMs do PostgreSQL.

Após alterar o esquema, execute `npm run db:types` para atualizar os tipos gerados em `database.generated.ts`.

## Execução

Instale as dependências:

```bash
npm install
```

Inicie o ambiente de desenvolvimento:

```bash
npm start
```

A aplicação estará disponível em:

```text
http://localhost:4200
```

## Qualidade e validação

O projeto possui comandos específicos para formatação, lint, testes e build:

```bash
npm run lint
npm run lint:check
npm test -- --watch=false
npm run build
```

### `npm run lint`

Executa o **Prettier** e aplica automaticamente as correções disponíveis pelo **ESLint**, incluindo a padronização de linhas em branco entre métodos.

### `npm run lint:check`

Executa apenas as validações de formatação e lint, sem modificar os arquivos.

### `npm test -- --watch=false`

Executa a suíte de testes uma única vez, sem manter o processo em modo de observação.

### `npm run build`

Gera o build de produção da aplicação e valida possíveis erros de compilação.

## Arquitetura

A aplicação segue uma organização baseada em responsabilidades, separando infraestrutura, regras de acesso a dados, funcionalidades e elementos compartilhados.

```text
src/app/
├── core/
│   ├── data-access/     # Repositórios globais, como perfis
│   ├── models/          # Contratos de domínio e tabelas do Supabase
│   ├── services/        # Serviços globais, autenticação e perfis
│   └── supabase/        # Configuração do cliente Supabase
│
├── features/            # Funcionalidades carregadas por rota
│   └── <feature>/
│       ├── data-access/ # Repositories, services, mappers e constantes de fluxo
│       ├── *.component.{ts,html,scss}
│       └── <component>/ # Componentes isolados quando a feature possui vários
│
├── layout/              # Shell principal e navegação
│
└── shared/
    ├── components/      # Componentes reutilizáveis
    ├── data/            # Conteúdo metodológico compartilhado
    ├── services/        # Serviços compartilhados de interface
    └── utils/           # Funções puras e reutilizáveis
```

## Organização das responsabilidades

Os componentes são **standalone** e utilizam:

- formulários reativos tipados;
- `signal` para gerenciamento de estado local;
- `computed` para valores derivados do estado.

Os componentes devem concentrar-se principalmente na apresentação e interação com o usuário.

As operações de negócio são delegadas aos **services**, responsáveis por orquestrar os fluxos da aplicação.

O acesso ao Supabase fica isolado nos **repositories**, evitando que componentes realizem consultas diretamente ao banco de dados.

Quando uma operação exige transformação ou construção de payloads maiores, essa responsabilidade é movida para **mappers puros**.

A autenticação, os serviços globais e a configuração do cliente Supabase permanecem centralizados em:

```text
src/app/core/
```

As migrações do banco de dados e as **Edge Functions** existentes permanecem em:

```text
supabase/
```

## Tipos do Supabase

O arquivo `src/app/core/models/database.generated.ts` é gerado a partir do esquema `public` do Supabase. Após alterar o banco, autentique a CLI com `npx supabase login` (ou configure `SUPABASE_ACCESS_TOKEN`) e execute:

```bash
npm run db:types
```

As opções de unidade e frequência dos indicadores são carregadas pelo aplicativo diretamente do banco. Seus tipos em `database.ts` usam os enums do arquivo gerado. `Database` representa o esquema gerado; `AppDatabase` mantém os contratos usados pelos repositórios atuais.

No helpdesk, as categorias e prioridades vêm das tabelas `public.helpdesk_categories` e `public.helpdesk_priorities`. Para incluir uma opção, adicione uma linha no Supabase com `key`, `label` e `order_index`; em prioridades, também é possível definir `badge_background` e `badge_foreground` como cores hexadecimais. Apenas linhas com `is_active = true` aparecem em novos chamados. `is_default` escolhe a opção inicial do formulário, e somente uma linha por tabela pode ser padrão. Após recarregar a página, a nova opção aparece sem alteração no frontend. O fluxo de status continua definido na aplicação.

As severidades de incidentes vêm de `public.notification_severities` e são compartilhadas por chamados, tipos e classificações. A tabela usa os mesmos campos de ordenação, ativação, padrão e cores das prioridades do helpdesk. Os status dos incidentes continuam vinculados à sequência do fluxo na aplicação.

## Organização das features

Cada feature mantém suas responsabilidades isoladas, evitando arquivos excessivamente grandes e componentes com responsabilidades demais.

### Incidentes

O módulo de Incidentes fica em `features/incidents/`, com componentes, serviços, repositórios e mappers nomeados com `incident` ou `incidents`. As telas usam `/incidentes/realizacao`, `/incidentes/painel` e `/incidentes/parametrizacao`; o formulário público usa `/incidente-publico/:token`.

Os antigos caminhos `/notificacoes/realizacao`, `/notificacoes/painel` e `/notificacoes/parametrizacao` redirecionam para as telas equivalentes. Links públicos em `/notificacao-publica/:token` continuam válidos. Os nomes `notification_*`, as RPCs públicas e a origem persistida `notification` permanecem como contratos legados do Supabase, documentados em `core/models/database.ts`, para manter compatibilidade com os dados e migrações existentes. O futuro módulo de notificações entre usuários terá sua própria feature.

### Processes

Dentro de:

```text
features/processes/
```

os módulos:

```text
process-management/
sipoc/
slas/
```

mantêm separadamente:

- TypeScript;
- HTML;
- SCSS;
- constantes específicas do componente.

O diretório:

```text
features/processes/data-access/
```

permanece compartilhado pela funcionalidade e concentra repositories, services, mappers e demais recursos relacionados ao acesso e tratamento de dados.

### Strategy

Em:

```text
features/strategy/
```

os módulos:

```text
dimensions/
value-matrix/
```

seguem a mesma estrutura utilizada em `processes`.

Cada componente mantém seus próprios arquivos de interface e estilos, enquanto:

```text
features/strategy/data-access/
```

permanece compartilhado pela feature.

## Tema e estilos compartilhados

Os estilos semânticos reutilizáveis ficam centralizados em:

```text
src/styles.css
```

dentro de:

```css
@layer components;
```

Foram definidos grupos de classes responsáveis por representar padrões visuais utilizados em diferentes telas:

```text
ui-page-*
ui-table-*
ui-button-*
ui-form-*
ui-kanban-*
```

Essas classes reduzem a repetição de grandes conjuntos de utilitários Tailwind nos templates.

Por exemplo:

```text
ui-empty-state
```

substitui:

```text
py-6 text-center text-xs text-slate-300
```

Enquanto:

```text
ui-page-header
```

representa o padrão responsivo utilizado nos cabeçalhos das páginas.

## Padronização de formulários

Componentes que utilizam formulários padronizados devem aplicar a classe:

```text
ui-standard-fields
```

no elemento host.

Dessa forma, os estilos compartilhados dos controles permanecem centralizados no tema global.

Estados específicos de botões, comportamentos exclusivos ou variações visuais pertencentes apenas a uma tela devem continuar no arquivo SCSS do respectivo componente.

A regra geral é:

- **Crie uma classe global** quando um papel visual se repetir em diferentes partes da aplicação.
- **Use utilitários Tailwind diretamente** para ajustes simples e pontuais.
- **Use o SCSS do componente** quando o comportamento ou estilo for exclusivo daquela tela.

Essa divisão mantém a interface consistente sem transformar o arquivo global de estilos em um conjunto de regras específicas de componentes.

## Fluxos de Operação

As migrações `20261016130000` a `20261016134000` implementam os fluxos auditados de documentos, cópias controladas, incidentes e planos de ação. Aplique-as no projeto Supabase antes de publicar o frontend. A criação e o reinício da revisão de documentos exigem perfil Admin; o responsável pode editar e enviar seu documento, e todos os aprovadores cadastrados precisam decidir com justificativa antes da publicação. A publicação preserva uma versão do conteúdo nativo. Cópias controladas usam o PDF imutável daquela versão, gerado no backend.

O módulo de Documentos usa um editor nativo Tiptap, sem API ou redirecionamento ao Google Docs. Aplique a migração `20261018170000_native_documents.sql` e reimplante a Edge Function `document-integration` antes de publicar este frontend. A função gera os PDFs de aprovação e mantém o envio de cópias por e-mail. Configure `PUBLIC_APP_ORIGIN`; origens adicionais podem ser incluídas em `PUBLIC_APP_ADDITIONAL_ORIGINS` (separadas por vírgula), usado também por `user-management`. Para e-mail, configure `RESEND_API_KEY` e `RESEND_FROM`. Os antigos segredos `GOOGLE_*` não são mais utilizados.

O editor oferece formatação, tabelas, imagens PNG/JPEG incorporadas, links, listas, quebras de página e exportação local em DOCX, PDF e ODT. O salvamento automático começa após preencher os campos obrigatórios, incluindo a justificativa. Falhas e conflitos mantêm o rascunho aberto, com recuperação local por usuário. A exclusão é lógica e permite restauração, preservando auditoria e vínculos. Consulte [a arquitetura, implantação e migração dos documentos](docs/native-documents.md) para o procedimento completo e as limitações de conversão.

As solicitações de cópia são aprovadas pelo Admin, podem ser enviadas por e-mail, registram entrega e devolução e destacam atrasos. As classificações de incidente definem questionário, ferramenta de análise e prazo; links públicos aceitam respostas sem cadastro e a triagem administrativa encaminha ao gestor. Planos reúnem origens manuais, incidentes e análises de indicadores, com tarefas, controlador, evidências e aprovação do progresso. A caixa de entrada mostra atribuições aos usuários vinculados.
