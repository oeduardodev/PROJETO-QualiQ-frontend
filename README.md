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

## Organização das features

Cada feature mantém suas responsabilidades isoladas, evitando arquivos excessivamente grandes e componentes com responsabilidades demais.

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
