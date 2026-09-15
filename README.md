# Agenda Agora

## Visão geral

O Agenda Agora é um SaaS de agendamento para negócios que trabalham com horários marcados, com painel do estabelecimento, painel Master e página pública de agendamento.

## Estrutura

- `/auth` — acesso do estabelecimento
- `/master-login` — acesso exclusivo do Master
- `/master` — administração da plataforma
- `/painel` — agenda e gestão do estabelecimento
- `/agendar/:slug` — agendamento público

## Regra de acesso

O estabelecimento e o acesso do dono são criados/configurados exclusivamente pelo painel Master. O painel do estabelecimento não oferece cadastro público nem criação de negócio.
