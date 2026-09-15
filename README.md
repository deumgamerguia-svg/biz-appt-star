# Agenda Agora

## Visão geral

O Agenda Agora é um SaaS de agendamento com uma arquitetura fixa de três painéis. Essa separação é permanente e deve ser preservada durante todo o desenvolvimento do produto.

## Estrutura oficial do SaaS

### Painel 1 — Cliente final

- Rota pública: `/agendar/:slug`
- Não exige login.
- É acessado pelo link público de cada estabelecimento.
- O cliente escolhe o serviço.
- O cliente escolhe o profissional quando o estabelecimento utilizar profissionais vinculados.
- O cliente escolhe o dia e o horário disponível.
- O cliente informa seus dados.
- O cliente paga o sinal configurado para o serviço.
- O agendamento é refletido na agenda do Painel 2.
- Tudo que aparece aqui é configurado pelo dono do estabelecimento no Painel 2.

### Painel 2 — Dono do estabelecimento

- Login: `/auth`
- Painel: `/painel`
- Acesso exclusivo de contas com função `owner`.
- É o produto vendido para barbearias, salões, nail designers, estética e demais estabelecimentos.
- O dono gerencia agenda, horários disponíveis, horários bloqueados e dias fixos de funcionamento.
- O dono gerencia serviços, valores, sinal, profissionais, clientes e configurações do estabelecimento.
- As configurações do Painel 2 alimentam automaticamente o Painel 1 público daquele estabelecimento.
- O dono pode visualizar a página pública `/agendar/:slug` para conferir como o Painel 1 está ficando.
- O Painel 2 não cria outros estabelecimentos e não possui poderes de Master.

### Painel 3 — Master da plataforma

- Login exclusivo: `/master-login`
- Painel: `/master`
- Acesso exclusivo de conta com função `super_admin`.
- É utilizado somente pelo dono da plataforma Agenda Agora.
- Cria o estabelecimento e o acesso que será usado no Painel 2.
- Define o telefone/número de acesso e a senha do dono do estabelecimento.
- Controla ativação, suspensão e plano/acesso de cada estabelecimento.
- O Painel 3 administra as contas dos estabelecimentos, mas não substitui o Painel 2 na gestão diária do negócio.

## Regra permanente de acesso

As três áreas não devem ser misturadas:

- Cliente final acessa somente o Painel 1 público.
- Dono do estabelecimento acessa somente o Painel 2.
- Master acessa somente o Painel 3.

O estabelecimento e o acesso do dono são criados exclusivamente pelo Painel Master. Não existe cadastro público de estabelecimento.

## Fluxo principal

`Painel 3 cria o estabelecimento e o acesso do dono → dono entra no Painel 2 e configura o negócio → configurações alimentam o Painel 1 → cliente agenda e paga o sinal no Painel 1 → agendamento aparece no Painel 2.`
