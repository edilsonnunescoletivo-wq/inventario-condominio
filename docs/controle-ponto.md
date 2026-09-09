# Controle de Ponto

A migration `db/migrations/001_controle_ponto.sql` cria somente as tabelas do dominio de ponto. Ela nao e executada pelo Next.js e deve ser aplicada manualmente no banco correto depois de revisada.

## Isolamento

As rotas autenticadas usam `requireSession` e obtem `condominio_id` da sessao ativa. O `condominio_id` enviado pelo navegador nao e usado para autorizar consultas. As foreign keys compostas e os filtros tenant+id impedem relacionamentos entre condominios.

## Agente local Control iD

O servidor nao se conecta ao IP privado do equipamento. Um agente instalado na rede local devera:

1. Ler as marcacoes usando o mecanismo oficialmente documentado pelo fabricante.
2. Normalizar os dados para o contrato abaixo.
3. Enviar os eventos por HTTPS para `POST /api/ponto/ingest/{deviceId}`.
4. Enviar a credencial no header `X-Ponto-Device-Token`.
5. Repetir eventos com seguranca: o servidor usa `equipamento_id + id_externo_evento` como chave idempotente.

Exemplo de payload do agente:

```json
{
  "events": [
    {
      "id": 1842,
      "userId": "matricula-ou-id-configurado",
      "timestamp": "2026-09-09T12:00:00.000Z",
      "eventType": "entrada"
    }
  ]
}
```

O identificador do usuario no equipamento deve estar cadastrado em `ponto_colaboradores.identificador_controlid`. O agente nao deve enviar `condominio_id`: o servidor o resolve a partir do equipamento autenticado.

A credencial do equipamento/agente e armazenada somente como SHA-256 em `credencial_integracao_hash`. A definicao inicial ou rotacao dessa credencial deve ocorrer por um processo administrativo server-side ou CLI seguro, nunca por armazenamento no frontend.

O adaptador em `lib/controlid.js` deliberadamente nao chama endpoints Control iD nao comprovados. A implementacao de leitura deve ser adicionada no agente local quando a documentacao e o modelo exato do equipamento forem confirmados.
