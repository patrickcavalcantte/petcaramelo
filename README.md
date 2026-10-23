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

- `js/domain/`: regras puras (datas em fuso de São Paulo, dinheiro em centavos, estimativa e média de consumo do estoque, pendências, cadastro em lote). Testadas.
- `js/logic.js`: o estado do app e as operações sobre ele (cadastrar, registrar, apagar, juntar estados). Testado.
- `js/reconcile.js`: baixar, juntar e gravar com checagem de versão, para duas pessoas usarem a mesma Galera. Testado.
- `js/validate.js`: validação do que chega dos formulários.
- `js/views.js`: telas, como funções que devolvem HTML. `js/tour.js`: o passeio de boas-vindas.
- `js/app.js`: rotas (`#/gatos`, `#/estoque`...), eventos e fiação.
- `js/sync.js`: login, Galera compartilhada e documentos no Supabase.

## Como os dados ficam guardados

O estado inteiro (gatos, saúde, estoque, gastos) é um JSON no `localStorage` do navegador. Com conta, uma cópia vai para a **Galera** na nuvem e volta quando você abre em outro aparelho. Sem conta, tudo fica só no aparelho.

**Galera compartilhada.** Os dados pertencem a uma Galera, e as pessoas entram nela como membros. Em **Conta > Convidar alguém** sai um código de uso único, válido por 7 dias; quem digita o código em **Entrar na Galera de outra pessoa** passa a ver e editar os mesmos dados, cada um com a própria conta. Cada pessoa participa de uma Galera só.

**Duas pessoas gravando.** A gravação confere a versão (`salvar_estado` só vale se ninguém gravou depois do último download). Se a outra pessoa chegou antes, o app baixa, junta e tenta de novo. O app também busca novidades ao voltar para a aba e a cada minuto com a aba aberta.

**Juntar versões.** Cada registro tem `id` e `updatedAt`, e apagar deixa uma lápide (`deleted: true`). Ao juntar, vale o registro mais recente, inclusive para exclusões. O banco não guarda "estoque atual": guarda compras, aberturas de pacote e contagens, e a estimativa é calculada na hora.

**Pendência resolvida pelo título.** A V5 de 2026 encerra a pendência da V5 de 2025 porque tem o mesmo gato, tipo e título (normalizado). Por isso o formulário sugere os títulos já usados.

**Segurança no banco.** As tabelas da Galera têm RLS: só membros leem e gravam. Convites, entrada e saída passam por funções do banco. O bucket `documentos` guarda os arquivos numa pasta por Galera e só membros acessam. A chave em `js/config.js` é a publishable, pública por design.

## Colocar no ar com sincronização

1. No Supabase (SQL Editor), rode uma vez cada arquivo de `supabase/`, nesta ordem: `schema.sql`, `storage.sql`, `excluir-conta.sql`. Podem ser rodados de novo sem problema. Se o projeto tinha a tabela `app_state` da versão anterior, o `schema.sql` converte os dados dela em Galera e a remove.
2. Em **Authentication > URL Configuration**, coloque o endereço do site em Site URL e nas Redirect URLs (para o link de confirmação e de recuperação de senha voltarem ao app).
3. O e-mail padrão do Supabase só entrega para endereços da equipe do projeto. Para quem não é da equipe, crie a conta em **Authentication > Users > Add user** (marcando "Auto confirm user"), ou configure um SMTP próprio em **Authentication > SMTP Settings**.
4. Para permitir só você e quem convidar, desligue **Allow new users to sign up** depois de criar as contas.

## Histórico

Esta versão substitui a antiga, em Next.js. O código anterior continua no primeiro commit.
