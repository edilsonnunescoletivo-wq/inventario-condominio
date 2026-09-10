'use client';

import { useEffect, useState } from 'react';
import {
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Plus,
  RefreshCw,
} from 'lucide-react';

const tabs = [
  ['colaboradores', 'Colaboradores'],
  ['equipamentos', 'Equipamentos'],
  ['jornadas', 'Jornadas'],
  ['marcacoes', 'Marcações'],
  ['espelho', 'Espelho de Ponto'],
  ['banco', 'Banco de Horas'],
  ['sincronizacoes', 'Sincronizações'],
];

const forms = {
  colaboradores: [
    {
      name: 'nome',
      label: 'Nome',
      required: true,
    },
    {
      name: 'cpf',
      label: 'CPF',
    },
    {
      name: 'matricula',
      label: 'Matrícula',
      required: true,
    },
    {
      name: 'cargo',
      label: 'Cargo',
    },
    {
      name: 'departamento',
      label: 'Departamento',
    },
    {
      name: 'data_admissao',
      label: 'Admissão',
      type: 'date',
    },
    {
      name: 'situacao',
      label: 'Situação',
      type: 'select',
      options: [
        'ativo',
        'afastado',
        'ferias',
        'desligado',
      ],
    },
    {
      name: 'jornada_id',
      label: 'Jornada',
      type: 'select',
      optionKey: 'jornadas',
    },
    {
      name: 'identificador_controlid',
      label: 'ID no Control iD',
      help: 'Somente o identificador do colaborador no equipamento. Não armazene biometria aqui.',
    },
  ],

  equipamentos: [
    {
      name: 'nome',
      label: 'Nome',
      required: true,
    },
    {
      name: 'fabricante',
      label: 'Fabricante',
      default: 'Control iD',
    },
    {
      name: 'modelo',
      label: 'Modelo',
      default: 'iDFace',
    },
    {
      name: 'ip',
      label: 'Endereço IP',
    },
    {
      name: 'porta',
      label: 'Porta',
      type: 'number',
      default: 80,
    },
    {
      name: 'firmware',
      label: 'Versão / firmware',
    },
    {
      name: 'credencial_integracao',
      label: 'Credencial do Agente',
      type: 'integration-credential',
      required: true,
      help: 'Chave exclusiva usada pelo Agente Soluções Condo para enviar marcações ao sistema. Não utilize a senha administrativa do iDFace.',
    },
  ],

  jornadas: [
    {
      name: 'nome',
      label: 'Nome',
      required: true,
    },
    {
      name: 'dias_semana',
      label: 'Dias da semana',
      help: 'Números de 0 a 6 separados por vírgula.',
    },
    {
      name: 'entrada',
      label: 'Entrada',
      type: 'time',
      required: true,
    },
    {
      name: 'inicio_intervalo',
      label: 'Início intervalo',
      type: 'time',
    },
    {
      name: 'fim_intervalo',
      label: 'Fim intervalo',
      type: 'time',
    },
    {
      name: 'saida',
      label: 'Saída',
      type: 'time',
      required: true,
    },
    {
      name: 'tolerancia_entrada_min',
      label: 'Tol. entrada (min)',
      type: 'number',
      default: 0,
    },
    {
      name: 'tolerancia_saida_min',
      label: 'Tol. saída (min)',
      type: 'number',
      default: 0,
    },
    {
      name: 'tolerancia_intervalo_min',
      label: 'Tol. intervalo (min)',
      type: 'number',
      default: 0,
    },
    {
      name: 'carga_horaria_min',
      label: 'Carga diária (min)',
      type: 'number',
      default: 480,
      required: true,
    },
  ],

  marcacoes: [
    {
      name: 'colaborador_id',
      label: 'Colaborador',
      type: 'select',
      optionKey: 'colaboradores',
      required: true,
    },
    {
      name: 'data_hora',
      label: 'Data e hora local',
      type: 'datetime-local',
      required: true,
    },
    {
      name: 'tipo',
      label: 'Tipo',
      type: 'select',
      options: [
        'entrada',
        'saida',
        'inicio_intervalo',
        'fim_intervalo',
        'nao_classificada',
      ],
    },
    {
      name: 'observacao',
      label: 'Justificativa',
      type: 'textarea',
      required: true,
    },
  ],

  banco: [
    {
      name: 'colaborador_id',
      label: 'Colaborador',
      type: 'select',
      optionKey: 'colaboradores',
      required: true,
    },
    {
      name: 'referencia',
      label: 'Referência',
      type: 'date',
      required: true,
    },
    {
      name: 'minutos',
      label: 'Minutos (+ crédito / - débito)',
      type: 'number',
      required: true,
    },
    {
      name: 'tipo',
      label: 'Tipo',
      type: 'select',
      options: [
        'credito',
        'debito',
        'ajuste',
      ],
    },
    {
      name: 'descricao',
      label: 'Descrição',
      type: 'textarea',
      required: true,
    },
  ],
};

function generateIntegrationCredential() {
  if (
    typeof window === 'undefined' ||
    !window.crypto ||
    !window.crypto.getRandomValues
  ) {
    return '';
  }

  const bytes = new Uint8Array(32);

  window.crypto.getRandomValues(bytes);

  return Array.from(
    bytes,
    byte => byte.toString(16).padStart(2, '0')
  ).join('');
}

const dateInput = value => {
  const date = value
    ? new Date(value)
    : new Date();

  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
};

const minuteText = value => {
  const minutes = Number(value || 0);

  const sign =
    minutes < 0
      ? '-'
      : '';

  const absolute =
    Math.abs(minutes);

  return `${sign}${Math.floor(
    absolute / 60
  )}h ${absolute % 60}min`;
};

const formatDateTime = value =>
  value
    ? new Intl.DateTimeFormat(
        'pt-BR',
        {
          timeZone: 'America/Bahia',
          dateStyle: 'short',
          timeStyle: 'short',
        }
      ).format(new Date(value))
    : '-';

function GenericTable({ rows }) {
  if (!rows.length) {
    return (
      <div className="empty">
        Nenhum registro encontrado.
      </div>
    );
  }

  const columns = Object.keys(
    rows[0]
  )
    .filter(
      key =>
        ![
          'id',
          'condominio_id',
          'criado_por',
          'atualizado_por',
        ].includes(key)
    )
    .slice(0, 9);

  return (
    <div className="tablewrap">
      <table className="table">
        <thead>
          <tr>
            {columns.map(key => (
              <th key={key}>
                {key.replaceAll('_', ' ')}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map(
            (row, index) => (
              <tr
                key={
                  row.id ||
                  index
                }
              >
                {columns.map(
                  key => (
                    <td key={key}>
                      {row[key] ==
                      null
                        ? '-'
                        : typeof row[
                              key
                            ] ===
                            'object'
                          ? JSON.stringify(
                              row[
                                key
                              ]
                            )
                          : String(
                              row[
                                key
                              ]
                            )}
                    </td>
                  )
                )}
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function PontoModule({
  auth,
  initialTab = 'colaboradores',
  canManage = false,
}) {
  const [tab, setTab] =
    useState(initialTab);

  const [items, setItems] =
    useState([]);

  const [jornadas, setJornadas] =
    useState([]);

  const [
    colaboradores,
    setColaboradores,
  ] = useState([]);

  const [summary, setSummary] =
    useState([]);

  const [busy, setBusy] =
    useState(false);

  const [error, setError] =
    useState('');

  const [notice, setNotice] =
    useState('');

  const [modal, setModal] =
    useState(null);

  const [
    integrationCredential,
    setIntegrationCredential,
  ] = useState('');

  const [
    showIntegrationCredential,
    setShowIntegrationCredential,
  ] = useState(false);

  const [
    credentialCopied,
    setCredentialCopied,
  ] = useState(false);

  const [filters, setFilters] =
    useState({
      de: dateInput(
        new Date(
          new Date().getFullYear(),
          new Date().getMonth(),
          1
        )
      ),
      ate: dateInput(
        new Date()
      ),
      colaborador_id: '',
    });

  const load = async resource => {
    setBusy(true);
    setError('');

    try {
      const params =
        new URLSearchParams();

      if (
        resource === 'espelho' ||
        resource === 'marcacoes'
      ) {
        params.set(
          'de',
          filters.de
        );

        params.set(
          'ate',
          filters.ate
        );
      }

      if (
        (
          resource ===
            'espelho' ||
          resource === 'banco'
        ) &&
        filters.colaborador_id
      ) {
        params.set(
          'colaborador_id',
          filters.colaborador_id
        );
      }

      const query =
        params.toString()
          ? `?${params}`
          : '';

      const data =
        await auth(
          `/api/ponto/${resource}${query}`
        );

      setItems(
        data.items || []
      );

      setSummary(
        resource ===
          'espelho' ||
          resource === 'banco'
          ? data.resumo || []
          : []
      );

      const [j, c] =
        await Promise.all([
          auth(
            '/api/ponto/jornadas'
          ),
          auth(
            '/api/ponto/colaboradores'
          ),
        ]);

      setJornadas(
        j.items || []
      );

      setColaboradores(
        c.items || []
      );
    } catch (e) {
      setError(
        e.message ||
          'Erro ao carregar dados.'
      );
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    load(tab);
  }, [tab]);

  const openNewForm =
    resource => {
      setError('');
      setNotice('');
      setCredentialCopied(false);
      setShowIntegrationCredential(
        false
      );

      if (
        resource ===
        'equipamentos'
      ) {
        setIntegrationCredential(
          generateIntegrationCredential()
        );
      } else {
        setIntegrationCredential('');
      }

      setModal(resource);
    };

  const closeForm = () => {
    setModal(null);
    setIntegrationCredential('');
    setShowIntegrationCredential(
      false
    );
    setCredentialCopied(false);
  };

  const regenerateCredential =
    () => {
      const credential =
        generateIntegrationCredential();

      setIntegrationCredential(
        credential
      );

      setCredentialCopied(false);
      setShowIntegrationCredential(
        true
      );
    };

  const copyCredential =
    async () => {
      if (
        !integrationCredential
      ) {
        return;
      }

      try {
        await navigator.clipboard.writeText(
          integrationCredential
        );

        setCredentialCopied(
          true
        );

        window.setTimeout(
          () =>
            setCredentialCopied(
              false
            ),
          2500
        );
      } catch {
        setError(
          'Não foi possível copiar a credencial automaticamente. Selecione a chave e copie manualmente.'
        );
      }
    };

  const submit =
    async event => {
      event.preventDefault();

      const payload =
        Object.fromEntries(
          new FormData(
            event.currentTarget
          ).entries()
        );

      if (
        payload.dias_semana
      ) {
        payload.dias_semana =
          payload.dias_semana
            .split(',')
            .map(Number)
            .filter(
              Number.isInteger
            );
      }

      if (
        modal ===
        'equipamentos'
      ) {
        payload.credencial_integracao =
          integrationCredential;

        if (
          !integrationCredential ||
          integrationCredential.length <
            32
        ) {
          setError(
            'Gere uma credencial segura para o Agente Soluções Condo antes de salvar.'
          );

          return;
        }
      }

      try {
        setBusy(true);
        setError('');
        setNotice('');

        await auth(
          `/api/ponto/${modal}`,
          {
            method: 'POST',
            body: JSON.stringify(
              payload
            ),
          }
        );

        const savedResource =
          modal;

        closeForm();

        setNotice(
          savedResource ===
            'equipamentos'
            ? 'Equipamento salvo com sucesso. Guarde a credencial do Agente em local seguro, pois ela não será exibida novamente.'
            : 'Registro salvo com sucesso.'
        );

        await load(tab);
      } catch (e) {
        setError(
          e.message ||
            'Não foi possível salvar o registro.'
        );
      } finally {
        setBusy(false);
      }
    };

  const title =
    tabs.find(
      ([key]) => key === tab
    )?.[1] ||
    'Controle de Ponto';

  const filterBar =
    (
      tab === 'espelho' ||
      tab === 'banco' ||
      tab === 'marcacoes'
    ) && (
      <div className="ponto-filters">
        <label>
          De
          <input
            type="date"
            value={
              filters.de
            }
            onChange={
              event =>
                setFilters(
                  current => ({
                    ...current,
                    de:
                      event
                        .target
                        .value,
                  })
                )
            }
          />
        </label>

        <label>
          Até
          <input
            type="date"
            value={
              filters.ate
            }
            onChange={
              event =>
                setFilters(
                  current => ({
                    ...current,
                    ate:
                      event
                        .target
                        .value,
                  })
                )
            }
          />
        </label>

        {(
          tab ===
            'espelho' ||
          tab === 'banco'
        ) && (
          <label>
            Colaborador
            <select
              value={
                filters.colaborador_id
              }
              onChange={
                event =>
                  setFilters(
                    current => ({
                      ...current,
                      colaborador_id:
                        event
                          .target
                          .value,
                    })
                  )
              }
            >
              <option value="">
                Todos
              </option>

              {colaboradores.map(
                item => (
                  <option
                    key={
                      item.id
                    }
                    value={
                      item.id
                    }
                  >
                    {
                      item.nome
                    }
                  </option>
                )
              )}
            </select>
          </label>
        )}

        <button
          type="button"
          className="btn light small"
          onClick={() =>
            load(tab)
          }
          disabled={busy}
        >
          Aplicar
        </button>
      </div>
    );

  const renderField =
    field => {
      if (
        field.type ===
        'integration-credential'
      ) {
        return (
          <div
            className="field full"
            key={field.name}
          >
            <label>
              {field.label}
              {field.required
                ? ' *'
                : ''}
            </label>

            <div
              style={{
                display: 'flex',
                gap: '8px',
                alignItems:
                  'center',
              }}
            >
              <div
                style={{
                  position:
                    'relative',
                  flex: 1,
                }}
              >
                <input
                  name={
                    field.name
                  }
                  type={
                    showIntegrationCredential
                      ? 'text'
                      : 'password'
                  }
                  value={
                    integrationCredential
                  }
                  onChange={
                    event => {
                      setIntegrationCredential(
                        event
                          .target
                          .value
                      );

                      setCredentialCopied(
                        false
                      );
                    }
                  }
                  required={
                    field.required
                  }
                  autoComplete="new-password"
                  spellCheck={
                    false
                  }
                  style={{
                    width:
                      '100%',
                    paddingRight:
                      '44px',
                  }}
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowIntegrationCredential(
                      current =>
                        !current
                    )
                  }
                  aria-label={
                    showIntegrationCredential
                      ? 'Ocultar credencial'
                      : 'Mostrar credencial'
                  }
                  title={
                    showIntegrationCredential
                      ? 'Ocultar credencial'
                      : 'Mostrar credencial'
                  }
                  style={{
                    position:
                      'absolute',
                    right: '8px',
                    top: '50%',
                    transform:
                      'translateY(-50%)',
                    border: 0,
                    background:
                      'transparent',
                    cursor:
                      'pointer',
                    display:
                      'flex',
                    alignItems:
                      'center',
                    justifyContent:
                      'center',
                  }}
                >
                  {showIntegrationCredential ? (
                    <EyeOff
                      size={
                        18
                      }
                    />
                  ) : (
                    <Eye
                      size={
                        18
                      }
                    />
                  )}
                </button>
              </div>

              <button
                type="button"
                className="btn light"
                onClick={
                  regenerateCredential
                }
                title="Gerar nova credencial"
              >
                <KeyRound
                  size={16}
                />
                Gerar
              </button>

              <button
                type="button"
                className="btn light"
                onClick={
                  copyCredential
                }
                disabled={
                  !integrationCredential
                }
                title="Copiar credencial"
              >
                <Copy
                  size={16}
                />
                {credentialCopied
                  ? 'Copiada'
                  : 'Copiar'}
              </button>
            </div>

            {field.help && (
              <span className="helper">
                {field.help}
              </span>
            )}

            <span className="helper">
              Guarde esta
              credencial antes de
              salvar. Depois do
              cadastro ela não
              deverá ser exibida
              novamente pelo
              sistema.
            </span>
          </div>
        );
      }

      return (
        <div
          className={`field ${
            field.type ===
            'textarea'
              ? 'full'
              : ''
          }`}
          key={field.name}
        >
          <label>
            {field.label}
            {field.required
              ? ' *'
              : ''}
          </label>

          {field.type ===
          'textarea' ? (
            <textarea
              name={
                field.name
              }
              required={
                field.required
              }
            />
          ) : field.type ===
            'select' ? (
            <select
              name={
                field.name
              }
              defaultValue={
                field.default ||
                ''
              }
              required={
                field.required
              }
            >
              <option value="">
                Selecione
              </option>

              {(
                field.optionKey ===
                'jornadas'
                  ? jornadas
                  : field.optionKey ===
                      'colaboradores'
                    ? colaboradores
                    : field.options ||
                      []
              ).map(
                item => (
                  <option
                    key={
                      item.id ||
                      item
                    }
                    value={
                      item.id ||
                      item
                    }
                  >
                    {item.nome ||
                      item}
                  </option>
                )
              )}
            </select>
          ) : (
            <input
              name={
                field.name
              }
              type={
                field.type ||
                'text'
              }
              defaultValue={
                field.default ??
                ''
              }
              required={
                field.required
              }
            />
          )}

          {field.help && (
            <span className="helper">
              {field.help}
            </span>
          )}
        </div>
      );
    };

  return (
    <section className="ponto-shell">
      <div className="ponto-tabs">
        {tabs.map(
          ([key, label]) => (
            <button
              type="button"
              key={key}
              className={`tab ${
                tab === key
                  ? 'active'
                  : ''
              }`}
              onClick={() =>
                setTab(key)
              }
            >
              {label}
            </button>
          )
        )}
      </div>

      {(notice || error) && (
        <div
          className={
            error
              ? 'errorbox'
              : 'successbox'
          }
        >
          {error || notice}
        </div>
      )}

      <div className="ponto-toolbar">
        <div>
          <h2>{title}</h2>

          <p className="muted">
            Horários exibidos no
            fuso America/Bahia.
          </p>
        </div>

        <div className="actions">
          <button
            type="button"
            className="btn light small"
            onClick={() =>
              load(tab)
            }
            disabled={busy}
          >
            <RefreshCw
              size={14}
            />
            Atualizar
          </button>

          {canManage &&
            forms[tab] && (
              <button
                type="button"
                className="btn primary small"
                onClick={() =>
                  openNewForm(
                    tab
                  )
                }
              >
                <Plus
                  size={14}
                />
                Novo
              </button>
            )}
        </div>
      </div>

      {filterBar}

      {modal &&
        canManage && (
          <form
            className="ponto-form"
            onSubmit={submit}
          >
            <div className="form-grid">
              {forms[
                modal
              ].map(
                renderField
              )}
            </div>

            <div className="modalfoot">
              <button
                type="button"
                className="btn light"
                onClick={
                  closeForm
                }
              >
                Cancelar
              </button>

              <button
                type="submit"
                className="btn primary"
                disabled={busy}
              >
                {busy
                  ? 'Salvando...'
                  : 'Salvar'}
              </button>
            </div>
          </form>
        )}

      {tab === 'espelho' ? (
        <>
          <div className="ponto-summary-grid">
            {summary.map(
              row => (
                <div
                  className="ponto-summary"
                  key={`${row.colaborador_id}-${row.data}`}
                >
                  <strong>
                    {
                      row.colaborador
                    }{' '}
                    - {row.data}
                  </strong>

                  <span>
                    Previsto:{' '}
                    {minuteText(
                      row.previsto_min
                    )}
                  </span>

                  <span>
                    Trabalhado:{' '}
                    {minuteText(
                      row.trabalhado_min
                    )}
                  </span>

                  <span>
                    Atraso:{' '}
                    {minuteText(
                      row.atraso_min
                    )}{' '}
                    - Extra:{' '}
                    {minuteText(
                      row.extra_min
                    )}
                  </span>

                  <b>
                    Saldo:{' '}
                    {minuteText(
                      row.saldo_min
                    )}
                    {row.incompleto
                      ? ' - Incompleto'
                      : ''}
                  </b>

                  <small>
                    {row.marcacoes
                      .map(
                        mark =>
                          `${mark.tipo}: ${formatDateTime(
                            mark.data_hora
                          )}`
                      )
                      .join(
                        ' | '
                      ) ||
                      'Sem marcações'}
                  </small>
                </div>
              )
            )}
          </div>

          {!summary.length && (
            <div className="empty">
              Nenhum espelho
              encontrado.
            </div>
          )}
        </>
      ) : tab ===
        'banco' ? (
        <>
          <div className="ponto-summary-grid">
            {summary.map(
              row => (
                <div
                  className="ponto-summary"
                  key={
                    row.colaborador_id
                  }
                >
                  <strong>
                    {
                      row.colaborador
                    }
                  </strong>

                  <span>
                    Créditos:{' '}
                    {minuteText(
                      row.creditos_min
                    )}
                  </span>

                  <span>
                    Débitos:{' '}
                    {minuteText(
                      row.debitos_min
                    )}
                  </span>

                  <b>
                    Saldo:{' '}
                    {minuteText(
                      row.saldo_min
                    )}
                  </b>
                </div>
              )
            )}
          </div>

          <GenericTable
            rows={items}
          />
        </>
      ) : (
        <GenericTable
          rows={items}
        />
      )}
    </section>
  );
}