# Documentos nativos

## Arquitetura e escolha do editor

O módulo existente usa componentes Angular standalone, signals, formulários reativos e a cadeia `DocumentsComponent → DocumentService → DocumentRepository → Supabase`. As regras de negócio ficam nas RPCs: criação administrativa, responsável pela edição, todos os aprovadores designados, versões imutáveis e cópias controladas vinculadas à edição publicada.

O Tiptap foi escolhido por permitir uso direto em JavaScript/Angular, extensão do esquema e controle da interface, sem serviço de edição externo. StarterKit, TextStyleKit, TextAlign, TableKit, Image e uma extensão local de quebra de página cobrem os recursos do módulo. O editor é carregado com a rota de Documentos. As bibliotecas de exportação e importação são carregadas sob demanda.

- [Tiptap: instalação sem framework](https://tiptap.dev/docs/editor/getting-started/install/vanilla-javascript)
- [docx: geração de arquivos Word no navegador](https://docx.js.org/)
- [pdfmake: fontes incorporadas](https://pdfmake.github.io/docs/0.1/fonts/custom-fonts-client-side/vfs/)

`content_json` contém a árvore editável; `content_html` mantém uma representação interoperável. `content_schema_version=1` identifica o esquema. `content_revision` cresce em cada gravação de conteúdo, independentemente da edição do workflow (`version`). Imagens PNG/JPEG ficam incorporadas na árvore, no PostgreSQL da própria aplicação. O limite é 8 MB para cada representação do documento e 2 MB por imagem inserida pelo editor.

O HTML passa pelo esquema do editor, sem `bypassSecurityTrustHtml`. Imagens externas, SVG e links executáveis não são aceitos. O backend também valida estrutura, tamanho e os esquemas de imagens e links. A árvore normalizada é a entrada dos exportadores.

## Gravação, conflitos e acesso

O editor grava após 1,2 segundo sem alterações, quando os campos obrigatórios e a justificativa estão preenchidos. As requisições são serializadas. O `updated_at` esperado e o bloqueio da linha na RPC impedem sobrescritas por abas concorrentes. Alterações durante uma requisição ficam pendentes para a próxima gravação; o retorno da requisição não substitui o texto que o usuário continua digitando.

IndexedDB guarda uma recuperação local por usuário e documento. Ela é removida após a confirmação do salvamento. Erros de armazenamento local ficam visíveis. Falhas de rede e conflitos mantêm a edição aberta; a interface permite baixar o conteúdo aberto e recarregar o servidor, oferecendo a recuperação antes de substituir a versão atual. Navegação e fechamento da página protegem alterações pendentes. A recuperação local não substitui backup do banco.

Os papéis e as justificativas originais continuam obrigatórios. Renomear usa o mesmo salvamento auditado. Duplicar abre um novo rascunho, sem copiar código, aprovações ou histórico. Excluir exige Admin e documento em rascunho ou obsoleto, sem cópias pendentes/entregues. `deleted_at` alimenta a lixeira; restaurar mantém o estado anterior. A exclusão física continua bloqueada pela regra existente.

O painel mantém a parametrização de impressão/download. A visualização é nativa, inclusive nos atalhos do SIPOC. As restrições de cópia na interface mantêm o comportamento anterior; não constituem DRM sobre conteúdo que o usuário está autorizado a consultar.

## Exportação e versões aprovadas

- **DOCX:** pacote OOXML real, com títulos, estilos de texto, links, listas, tabelas, imagens e quebras de página; usa `docx`.
- **PDF:** texto selecionável, páginas A4, fontes incorporadas, listas, tabelas e imagens; usa `pdfmake`.
- **ODT:** pacote OpenDocument 1.3, com `mimetype` como primeira entrada sem compressão, manifesto, estilos, imagens e XML; usa `fflate` para o ZIP.

Downloads são produzidos no navegador, sem enviar documentos a uma plataforma de conversão. O conversor PDF puro em `supabase/functions/_shared/document-format.ts` é compartilhado com o backend.

Ao enviar para aprovação, `document-integration` autentica o usuário, verifica responsável/estado e lê o conteúdo canônico do banco. Ela gera e armazena o PDF no bucket privado `document-versions`, sob `usuário/documento/edição/revisão-do-conteúdo/arquivo.pdf`. A RPC compara o token de concorrência e a revisão do conteúdo antes de registrar o snapshot. Somente o backend pode fazer esse upload; um cliente não pode anexar um PDF diferente ao conteúdo em análise. O envio de e-mail continua usando o PDF daquele snapshot, inclusive para versões antigas.

Limitações de fidelidade: a área de edição tem largura A4 e quebras explícitas, mas não calcula páginas físicas em tempo real. A paginação final ocorre na exportação. O PDF utiliza Roboto incorporada como substituição das fontes escolhidas; DOCX/ODT preservam o nome da fonte, dependendo da disponibilidade no editor que os abre. Conversões DOCX/HTML priorizam conteúdo e formatação suportada; cabeçalhos, rodapés, campos, comentários, alterações controladas e estilos externos não têm conversão integral. Imagens remotas devem ser incorporadas. ODT é um formato de exportação, não de importação nesta implementação.

## Migração e implantação

1. Faça o backup habitual do banco e do bucket `document-versions`. Aplique as migrações anteriores e `20261018170000_native_documents.sql` no projeto Supabase. A migração roda em uma transação e não acessa Google APIs.
2. A tabela `document_legacy_archive`, somente leitura para Admin, recebe o estado integral de cada documento antes de qualquer conversão. Links antigos, HTML, caminhos dos PDFs, códigos, vínculos, decisões e snapshots permanecem preservados. Não descarte esse arquivo histórico.
3. Registros com HTML armazenado recebem `legacy_html` e são exibidos pelo editor. O responsável revisa e salva para converter. Registros contendo somente link recebem `legacy_pending`; o conteúdo remoto não está no banco e não pode ser reconstruído a partir do link. Obtenha uma cópia DOCX ou HTML do acervo existente e importe pelo editor. Documentos publicados precisam seguir a revisão administrativa antes da importação. Não remova o acervo externo até conferir esses registros.
4. Reimplante `document-integration` com verificação JWT habilitada. Configure `PUBLIC_APP_ORIGIN` com as origens permitidas. `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` são fornecidos pelo ambiente Supabase. E-mail continua exigindo `RESEND_API_KEY` e `RESEND_FROM`. Os antigos segredos `GOOGLE_*` podem ser removidos após a mudança; não são usados pelo código novo. A RPC de sincronização antiga é removida.
5. Publique o frontend junto da nova função. Não mantenha o frontend antigo em uso durante o corte: ele depende da RPC Google removida. Depois de aplicar a migração, execute `npm run db:types` no projeto correto; os contratos em `AppDatabase` já contemplam a nova estrutura.
6. Confira criação, recuperação, duas abas concorrentes, envio, aprovações, publicação e e-mail de uma cópia de teste. O PDF de uma versão anterior deve continuar disponível pelo fluxo de cópias.

Consulta de acompanhamento:

```sql
select id, title, status, content_origin, drive_link
from public.documents
where content_origin <> 'native'
order by title;
```

A execução local de testes não aplica migrações nem reimplanta funções no projeto remoto. Para rollback de implantação, restaure uma versão compatível do frontend, das funções e do esquema a partir do backup; não exclua os novos conteúdos nativos.

## Validação

```bash
npm test -- --watch=false
npm run build
npm run lint:check
node scripts/test-native-documents-db.mjs
npx deno check supabase/functions/document-integration/index.ts
npx deno test --allow-read --allow-env supabase/functions/_shared/document-format.test.ts
```

O teste PostgreSQL exige `initdb`, `pg_ctl` e `psql` no PATH. Ele cria e encerra um cluster temporário em `tmp/`, com porta livre em loopback, sem ler credenciais do projeto. Seu fixture representa os contratos prévios necessários às RPCs; o teste cobre a migração nova, preservação do legado, acesso, concorrência, aprovação idempotente, vínculo do PDF à revisão, exclusão e restauração. Ele não substitui uma implantação de homologação com todos os serviços Supabase.
