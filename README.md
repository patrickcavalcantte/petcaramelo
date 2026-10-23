# Pet Caramelo

Saúde, estoque e gastos de uma galera de gatos. HTML, CSS e JavaScript puros (módulos ES), sem build, no mesmo estilo do Treino Fofo.

## O que faz

- **Gatos**: cadastro em lote (um nome por linha), ficha de cada um, arquivamento para adoção ou falecimento sem perder o histórico.
- **Saúde**: vacina, vermífugo, consulta, exame, medicação, pesagem. Um mesmo registro pode valer para vários gatos (o vermífugo da Galera inteira de uma vez). Próxima dose gera pendência no painel.
- **Documentos**: PDF ou foto de laudo, receita e carteirinha, guardados por gato num bucket privado (só com conta).
- **Estoque**: você registra a compra, marca a data em que **abriu o pacote** e, quando acaba, toca em **Acabou**. O app calcula quanto a Galera consome por dia, semana, mês e por gato, e prevê quando o pacote aberto deve acabar.
- **Gastos**: por mês e por categoria. Compras do estoque e cuidados com valor entram nos gastos automaticamente.

## Rodar local

```bash
npm run dev      # serve a pasta em http://localhost:3000
npm test         # roda os testes (Node 18+)
```

Abrir o `index.html` direto pelo arquivo não funciona: módulos ES exigem um servidor.

## Deploy na Vercel

Suba a pasta para um repositório e importe na Vercel. Framework preset: **Other**. Sem build command, output directory na raiz.

## Estrutura

- `js/domain/`: regras puras (datas em fuso de São Paulo, dinheiro em centavos, estimativa de estoque, pendências, cadastro em lote). Testadas.
- `js/logic.js`: o estado do app e as operações sobre ele (cadastrar, registrar, apagar, juntar estados). Testado.
- `js/validate.js`: validação do que chega dos formulários.
- `js/views.js`: telas, como funções que devolvem HTML.
- `js/app.js`: rotas (`#/gatos`, `#/estoque`...), eventos e fiação.
- `js/sync.js`: login, sincronização e documentos no Supabase.

## Como os dados ficam guardados

O estado inteiro (gatos, saúde, estoque, gastos) é um JSON no `localStorage` do navegador. Com conta, uma cópia vai para a tabela `app_state` do Supabase, uma linha por usuário, e volta quando você abre em outro aparelho. Sem conta, tudo fica só no aparelho.

**Juntar aparelhos.** Cada registro tem `id` e `updatedAt`, e apagar deixa uma lápide (`deleted: true`). Ao sincronizar, vale o registro mais recente, inclusive para exclusões. O banco não guarda "estoque atual": guarda contagens, compras e o consumo diário, e a estimativa é calculada na hora.

**Pendência resolvida pelo título.** A V5 de 2026 encerra a pendência da V5 de 2025 porque tem o mesmo gato, tipo e título (normalizado). Por isso o formulário sugere os títulos já usados.

**Segurança no banco.** `app_state` tem RLS por `user_id`; o bucket `documentos` só deixa cada pessoa mexer na pasta `<user_id>/`. A chave em `js/config.js` é a publishable, pública por design.

## Colocar no ar com sincronização

1. No Supabase (SQL Editor), rode uma vez cada arquivo de `supabase/`: `schema.sql`, `storage.sql` e `excluir-conta.sql`. Se o projeto já tinha o bucket `documentos` da versão anterior, pule o `storage.sql`.
2. Em **Authentication > URL Configuration**, coloque o endereço do site em Site URL e nas Redirect URLs (para o link de confirmação e de recuperação de senha voltarem ao app).
3. Para permitir só você e quem convidar, desligue **Allow new users to sign up** depois de criar as contas.

As tabelas da versão Next.js (`gatos`, `eventos_saude`, `gastos`...) não são mais usadas. Se houver dados nelas que você queira, exporte antes de apagar: o app novo não lê essas tabelas.

## Histórico

Esta versão substitui a antiga, em Next.js. O código anterior continua no commit inicial.
