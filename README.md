# QA Agent 🤖

Agente de QA automatizado com duas funcionalidades principais:

1. **Geração de cenários de teste** a partir de cards do Asana via IA (Kiro CLI)
2. **Dashboard de métricas** com visão em tempo real do progresso de QA

## Requisitos

| Requisito | Versão | Instalação |
|---|---|---|
| **Node.js** | v18+ (ESM) | [nodejs.org](https://nodejs.org/) |
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

O que acontece:
1. Busca a task e subtarefas no Asana
2. Seleciona o prompt adequado (genérico ou específico do projeto)
3. Gera cenários de teste via Kiro CLI
4. Classifica automaticamente o tamanho da demanda (micro/P/M/G/GG)
5. Cria um card `[QA]` no projeto do Asana com a tag de tamanho

### Dashboard de métricas

```bash
npm run dashboard
```

Acesse `http://localhost:3000`.

## Funcionalidades

### Dashboard

- **KPIs**: Total de cards, finalizados, em andamento, taxa de bugs, relatos, densidade
- **Gráficos de rosca**: Cards e bugs por projeto
- **Gráfico de barras**: Densidade de bugs por projeto
- **Gráfico de linhas**: Evolução mensal (criados, finalizados por mês de criação, relatos)
- **Tempo médio de teste**: Por tamanho de demanda (micro/P/M/G/GG), calculado em horas úteis
- **Tabela**: Top 20 cards com mais bugs
- **Filtros**: Projeto, status, período (com calendário em pt-BR)
- **Auto-refresh**: Atualiza a cada 5 minutos
- **Snapshots diários**: Salva métricas em JSON e detecta anomalias de densidade

### Geração de testes

- Prompts específicos por projeto (GOV, APP CAMPO)
- Classificação automática de tamanho (lê do campo "Tamanho (em tech)" da task, com fallback por IA)
- Suporte a múltiplas tasks: `npm run qa -- <id1> <id2> <id3>`
- Suporte a WSL (detecta automaticamente no Windows)
- Retry com 3 tentativas em caso de falha

### Cálculo de tempo de ciclo

- Conta apenas horas úteis: 08h-17h, segunda a sexta
- Exclui feriados nacionais e emendas (terça/quinta)
- Última sexta do mês: meio expediente (08h-12h)
- Desconta períodos de pausa (seção "Pausado" no Asana)
- Desconta ociosidade (gaps > 1 dia útil sem atividade)

## Estrutura

```
qa-agent/
├── src/
│   ├── server.js              # Servidor HTTP do dashboard
│   ├── runner.js              # Orquestrador de geração de testes
│   ├── kiro.js                # Detecção e invocação do Kiro CLI
│   ├── classify.js            # Classificação de tamanho de demanda
│   ├── asana.js               # Integração com a API do Asana
│   └── dashboard/
│       ├── index.html         # Interface do dashboard
│       └── data.js            # Busca, normalização, métricas e cycle time
├── kiro/
│   └── prompts/
│       ├── generate-tests.txt      # Prompt genérico
│       ├── generate-tests-part2.txt # Continuação se incompleto
│       └── projects/               # Prompts específicos por projeto
├── data/
│   └── snapshots/             # Snapshots diários (JSON)
├── .env.example
└── package.json
```

## Variáveis de Ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `ASANA_TOKEN` | Sim | Token de acesso à API do Asana |
| `QA_PROJECT_ID` | Não | ID do projeto de QA (padrão: Features de Lançamento) |
| `QA_SECTION_ID` | Não | ID da seção "Em andamento" |
| `KIRO_PATH` | Não | Caminho absoluto para o kiro-cli |
| `PORT` | Não | Porta do dashboard (padrão: 3000) |
| `SINCE` | Não | Data de início dos dados (padrão: 2026-01-01) |

## Limitações

- Kiro CLI requer WSL ou Linux (no Windows, o runner usa WSL automaticamente)
- A qualidade dos cenários depende do detalhamento da task no Asana
- Tempo de ciclo pode ter imprecisões em cards sem histórico de atividade suficiente
- Feriados precisam ser atualizados anualmente no código
