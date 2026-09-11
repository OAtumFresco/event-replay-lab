# Event Replay Lab

**Restabelecer uma ligação e recuperar o que aconteceu durante a ausência do cliente.**

[English](README.md) · [Testes](https://github.com/OAtumFresco/event-replay-lab/actions/workflows/test.yml) · [Rui Andrade](https://github.com/OAtumFresco)

Um servidor de Server-Sent Events e um cliente com estado local. O servidor conserva um histórico limitado. Quando o cliente regressa, recebe os eventos em falta ou um retrato do estado atual, se já não existir histórico suficiente.

![O cliente regressa com um cursor: recebe os eventos em falta ou um retrato atual se o histórico tiver expirado.](docs/flow.svg)

## Executar

Requer **Node.js 22.13+**. Sem dependências npm, base de dados ou serviços externos.

```sh
git clone https://github.com/OAtumFresco/event-replay-lab.git
cd event-replay-lab
npm start
```

Abrir **http://127.0.0.1:4179**. A variável `LAB_PORT` permite escolher outra porta.

```sh
npm run check
npm test
```

## Duas formas de recuperar

1. Carregar em **Disconnect subscriber** e depois três vezes em **Add one event**. O servidor chega a 3 e o cliente continua em 0.
2. Carregar em **Reconnect subscriber**. Chegam apenas os eventos 1, 2 e 3, pela ordem correta.
3. Desligar novamente e carregar em **Add 25 events**. O histórico só conserva os últimos 20.
4. Restabelecer a ligação. Chega um único snapshot com o motivo `history-expired`, que substitui o estado local.
5. Reiniciar o servidor. O identificador do fluxo muda e o contador em memória volta a zero. O cliente recebe um snapshot `stream-changed`.

## Como funciona

Cada cursor tem o formato `identificador-do-fluxo:sequência`. O identificador muda quando o servidor reinicia. A sequência cresce durante a vida desse processo.

| Cursor | Recuperação |
| --- | --- |
| Ausente | Snapshot inicial, seguido de eventos novos |
| Dentro do histórico | Eventos posteriores à sequência conhecida |
| Imediatamente antes do evento mais antigo disponível | Todos os eventos em falta, sem snapshot desnecessário |
| Histórico expirado | Snapshot atual |
| Pertencente a outro processo | Snapshot do novo fluxo |
| Inválido ou à frente do servidor | Snapshot com motivo explícito |

O cabeçalho `Last-Event-ID` enviado pelo navegador tem prioridade sobre o cursor da ligação manual. Comentários periódicos mantêm a ligação ativa sem alterar a sequência.

O cliente ignora eventos já aplicados, valida a correspondência entre ID e conteúdo e pede um snapshot se detetar uma lacuna. Substituir o estado por um snapshot não executa os efeitos dos eventos antigos.

## Decisões técnicas

O [histórico](src/log.js) conserva 20 eventos imutáveis. A passagem entre recuperação e subscrição acontece de forma síncrona num único processo. O [transporte SSE](src/sse.js) liberta subscrições ao desligar e fecha ligações de clientes lentos quando o buffer deixa de aceitar escrita. O servidor limita-se a 64 subscrições.

O [modelo do cliente](public/model.js) está separado do transporte, permitindo testar duplicados, lacunas, valores incoerentes e substituição de estado. Os testes HTTP verificam a recuperação real, prioridade do cabeçalho e limites de ligação. Consultar a [verificação](docs/verification.md).

## Limites

É uma projeção de estado em memória, num único processo. Reiniciar apaga o histórico e o contador. Várias instâncias exigiriam um registo ordenado partilhado e coordenação do identificador do fluxo. Um snapshot recupera o estado atual, mas não recupera todos os eventos expirados nem efeitos externos.

A ação de incremento não é idempotente: a interface não repete escritas automaticamente e indica quando o resultado de um pedido é incerto. O [Offline Sync Lab](https://github.com/OAtumFresco/offline-sync-lab) demonstra essa outra parte do problema.

Não inclui autenticação, isolamento de clientes, persistência de cursores ou validação de carga de produção. Usa apenas loopback e não está preparado para alojamento público. Recarregar a página inicia a recuperação por snapshot.

Implementação independente baseada em [Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events) e [HTTP do Node](https://nodejs.org/api/http.html). Não contém regras de jogos, código dos produtos ou dados de clientes.

Ainda não foi atribuída uma licença open source. Consultar [NOTICE](NOTICE). [Contactar Rui Andrade](https://ratecnologias.cv/#contacto).
