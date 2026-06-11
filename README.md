# QA Agent 🤖

Agente de QA automatizado com duas funcionalidades principais:

1. **Geração de cenários de teste** a partir de cards do Asana via IA (Kiro CLI)
2. **Dashboard de métricas** com visão em tempo real do progresso de QA

## Requisitos

| Requisito | Versão | Instalação |
|---|---|---|
| **Node.js** | v18+ | [nodejs.org](https://nodejs.org/) |
| **Kiro CLI** | Última versão | [kiro.dev](https://kiro.dev) |
| **Asana Token** | — | [Developer Console](https://app.asana.com/0/developer-console) |

## Instalação

```bash
git clone <url-do-repositorio>
cd qa-agent
npm install
cp .env.example .env
```

Edite o `.env` com seu token do Asana.

## Uso

### Gerar cenários de teste

```bash
npm run qa -- <TASK_ID>
```

### Dashboard de métricas

```bash
npm run dashboard
```

Acesse `http://localhost:3000`.

## Estrutura

```
qa-agent/
├── src/
│   ├── server.js                # Servidor HTTP do dashboard
│   ├── runner.js                # Orquestrador de geração de testes
│   ├── asana.js                 # Integração com a API do Asana
│   └── dashboard/
│       ├── index.html           # Interface do dashboard
│       └── data.js              # Busca e normalização de dados
├── kiro/
│   └── prompts/                 # Prompts para geração via IA
├── tests/
│   └── generated/               # Cenários gerados (por data)
├── .env.example
└── package.json
```

## Dashboard

O dashboard exibe:

- **KPIs**: Total de cards, finalizados, em andamento, taxa de bugs, relatos, densidade
- **Gráficos de rosca**: Cards e bugs por projeto
- **Gráfico de barras**: Densidade de bugs por projeto
- **Gráfico de linhas**: Evolução mensal (criados, finalizados, relatos)
- **Tabela**: Top 20 cards com mais bugs

Filtros disponíveis: projeto, status, período (com calendário em pt-BR).

## Limitações

- Kiro CLI requer WSL ou Linux
- A qualidade dos cenários depende do detalhamento da task no Asana
