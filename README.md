# Gatil

Saúde, estoque e gastos de uma colônia de gatos. Primeira versão para uso próprio: Next.js na Vercel, dados no Supabase.

## O que faz

- **Gatos**: cadastro em lote (um nome por linha), ficha de cada um, arquivamento para adoção ou falecimento sem perder o histórico.
- **Saúde**: vacina, vermífugo, consulta, exame, medicação, pesagem. Um mesmo registro pode valer para vários gatos (o vermífugo da colônia inteira de uma vez). Próxima dose gera pendência no painel.
- **Documentos**: PDF ou foto de laudo, receita e carteirinha, guardados por gato, num bucket privado.
- **Estoque**: areia e ração com estimativa de quanto sobrou e de quando acaba, sem precisar dar baixa todo dia.
- **Gastos**: por mês e por categoria. Compras do estoque e cuidados com valor entram nos gastos automaticamente.

## Decisões de arquitetura

**Estoque estimado, não registrado.** O banco não guarda "quantidade atual". Ele guarda contagens ("tem 6 kg"), compras ("comprei 12 kg") e o consumo diário. A estimativa percorre os eventos em ordem e nunca fica negativa, então um período em que a areia acabou não "come" a compra seguinte. Quando há duas contagens, o app calcula o consumo real e sugere ajustar o chute inicial. Lógica em `src/lib/domain/estoque.ts`.

**Pendência resolvida pelo título.** A V5 de 2026 encerra a pendência da V5 de 2025 porque tem o mesmo gato, tipo e título (normalizado). Títulos diferentes para a mesma coisa não se reconhecem, por isso o formulário sugere os títulos já usados. Lógica em `src/lib/domain/vencimentos.ts`.

**Segurança no banco, não só no app.** Todas as tabelas têm RLS por `user_id`. Além disso, as chaves estrangeiras são compostas `(id, user_id)`: chaves estrangeiras ignoram RLS, então sem isso alguém que conhecesse o UUID de um gato alheio poderia pendurar um registro nele. As ações que gravam em duas tabelas (compra + gasto, evento + gasto) rodam em funções Postgres para serem atômicas.

**Upload direto do navegador para o Storage.** Funções da Vercel aceitam corpos de até uns 4,5 MB, e foto de laudo passa disso. O arquivo vai direto ao Supabase Storage (protegido pela pasta `<user_id>/`) e só o metadado passa pelo servidor. Se o registro falhar, o upload é desfeito.

**Datas no fuso de São Paulo.** A Vercel roda em UTC. Sem cuidado, depois das 21h o "hoje" do servidor já seria amanhã.

**Dinheiro em centavos.** Inteiro, nunca float.

**Formulários sem JavaScript.** Server Actions com redirecionamento e mensagem na URL. Funciona em qualquer celular. A exceção é o envio de documentos, que precisa de JS.

## Como colocar no ar

1. Crie um projeto no [Supabase](https://supabase.com).
2. No SQL Editor, rode `supabase/migrations/0001_init.sql` e depois `0002_storage.sql`, nessa ordem. (Com a CLI: `supabase db push`.)
3. Em **Authentication > Users**, crie seu usuário com e-mail e senha.
4. Em **Authentication > Sign In / Providers**, desligue **Allow new users to sign up**. O app não tem tela de cadastro, mas a API aceitaria cadastros se isso ficar ligado.
5. Copie `.env.example` para `.env.local` e preencha com a URL e a chave publishable (Project Settings > API).
6. Rode local: `npm install && npm run dev`.
7. Na Vercel, importe o repositório e configure as mesmas duas variáveis de ambiente.

## Testes

```bash
npm test          # 100+ testes de unidade (Vitest)
npm run lint      # checagem de tipos
```

Os testes de unidade cobrem a lógica que pode errar em silêncio: estimativa de estoque (inclusive estoque zerado entre compras e empates no mesmo dia), pendências de saúde, conversão de valores em reais ("R$ 1.234,56", "89,9", "1.234"), datas no fuso certo, cadastro em lote, validação de formulários e proteção contra redirecionamento aberto.

`supabase/tests/rls_check.sql` testa o banco: a conta B não vê, não altera e não apaga nada da conta A, não consegue pendurar registros em gatos alheios mesmo sabendo o UUID, não forja `user_id`, e as funções de lote e compra se comportam como esperado. Rode contra um Supabase local:

```bash
supabase start && supabase db reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/tests/rls_check.sql
```

**O que não tem teste automatizado:** as páginas e o fluxo de upload no navegador. Testá-los de verdade pede um Supabase local rodando e um navegador (Playwright). Para uma versão de uso próprio, achei melhor cobrir bem a lógica e o banco e testar a interface usando.

## Limitações conhecidas

- Erro de validação recarrega o formulário vazio. Resolver pede `useActionState` em cada formulário.
- Painel carrega todos os eventos na memória. Ótimo para dezenas de gatos, a revisar se passar de alguns milhares de registros.
- Apagar o gato remove os arquivos do Storage antes das linhas do banco. Se a remoção do banco falhar depois, os arquivos já terão ido embora.
- Tipos do banco escritos à mão em `src/lib/tipos.ts`. O próximo passo é gerar com `supabase gen types`.

## Próximos passos possíveis

- Extração automática de laudos e receitas (o motivo original do app).
- Agenda de medicação com checklist diário para tratamentos em andamento.
- Gráfico de peso por gato.
- Link de compartilhamento do histórico de um gato com o veterinário ou com quem adotar.
