-- Controle de Ponto
-- Migration versionada para aplicação manual futura.
-- NÃO executar automaticamente.
-- NÃO contém alterações fora do domínio de Controle de Ponto.

CREATE TABLE ponto_jornadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  condominio_id uuid NOT NULL
    REFERENCES condominios(id)
    ON DELETE CASCADE,

  nome text NOT NULL,

  dias_semana smallint[] NOT NULL DEFAULT '{}',

  entrada time NOT NULL,

  inicio_intervalo time,

  fim_intervalo time,

  saida time NOT NULL,

  tolerancia_entrada_min integer NOT NULL DEFAULT 0
    CHECK (tolerancia_entrada_min >= 0),

  tolerancia_saida_min integer NOT NULL DEFAULT 0
    CHECK (tolerancia_saida_min >= 0),

  tolerancia_intervalo_min integer NOT NULL DEFAULT 0
    CHECK (tolerancia_intervalo_min >= 0),

  carga_horaria_min integer NOT NULL
    CHECK (carga_horaria_min > 0),

  ativo boolean NOT NULL DEFAULT true,

  criado_por uuid
    REFERENCES usuarios(id)
    ON DELETE SET NULL,

  atualizado_por uuid
    REFERENCES usuarios(id)
    ON DELETE SET NULL,

  criado_em timestamptz NOT NULL DEFAULT now(),

  atualizado_em timestamptz NOT NULL DEFAULT now(),

  UNIQUE (condominio_id, nome),

  UNIQUE (condominio_id, id),

  CHECK (
    dias_semana <@ ARRAY[0,1,2,3,4,5,6]::smallint[]
  ),

  CHECK (
    (inicio_intervalo IS NULL AND fim_intervalo IS NULL)
    OR
    (
      inicio_intervalo IS NOT NULL
      AND fim_intervalo IS NOT NULL
      AND inicio_intervalo < fim_intervalo
    )
  )
);


CREATE TABLE ponto_colaboradores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  condominio_id uuid NOT NULL
    REFERENCES condominios(id)
    ON DELETE CASCADE,

  jornada_id uuid,

  nome text NOT NULL,

  cpf text,

  matricula text NOT NULL,

  cargo text,

  departamento text,

  data_admissao date,

  situacao text NOT NULL DEFAULT 'ativo'
    CHECK (
      situacao IN (
        'ativo',
        'afastado',
        'ferias',
        'desligado',
        'inativo'
      )
    ),

  identificador_controlid text,

  ativo boolean NOT NULL DEFAULT true,

  criado_por uuid
    REFERENCES usuarios(id)
    ON DELETE SET NULL,

  atualizado_por uuid
    REFERENCES usuarios(id)
    ON DELETE SET NULL,

  criado_em timestamptz NOT NULL DEFAULT now(),

  atualizado_em timestamptz NOT NULL DEFAULT now(),

  UNIQUE (condominio_id, matricula),

  UNIQUE (condominio_id, cpf),

  UNIQUE (condominio_id, identificador_controlid),

  UNIQUE (condominio_id, id)
);


CREATE TABLE ponto_equipamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  condominio_id uuid NOT NULL
    REFERENCES condominios(id)
    ON DELETE CASCADE,

  nome text NOT NULL,

  fabricante text NOT NULL DEFAULT 'Control iD',

  modelo text NOT NULL DEFAULT 'iDFace',

  ip inet,

  porta integer NOT NULL DEFAULT 80
    CHECK (porta BETWEEN 1 AND 65535),

  firmware text,

  situacao text NOT NULL DEFAULT 'ativo'
    CHECK (
      situacao IN (
        'ativo',
        'inativo',
        'erro',
        'manutencao'
      )
    ),

  ultima_comunicacao_em timestamptz,

  ultimo_evento_id bigint,

  -- Hash da credencial do agente local.
  -- Não armazenar senha do iDFace em texto puro.
  credencial_integracao_hash text,

  criado_por uuid
    REFERENCES usuarios(id)
    ON DELETE SET NULL,

  atualizado_por uuid
    REFERENCES usuarios(id)
    ON DELETE SET NULL,

  criado_em timestamptz NOT NULL DEFAULT now(),

  atualizado_em timestamptz NOT NULL DEFAULT now(),

  UNIQUE (condominio_id, id),

  CHECK (
    credencial_integracao_hash IS NULL
    OR length(credencial_integracao_hash) = 64
  )
);


CREATE TABLE ponto_marcacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  condominio_id uuid NOT NULL
    REFERENCES condominios(id)
    ON DELETE CASCADE,

  colaborador_id uuid NOT NULL,

  equipamento_id uuid,

  data_hora timestamptz NOT NULL,

  tipo text NOT NULL
    CHECK (
      tipo IN (
        'entrada',
        'saida',
        'inicio_intervalo',
        'fim_intervalo',
        'nao_classificada'
      )
    ),

  origem text NOT NULL DEFAULT 'agente_local'
    CHECK (
      origem IN (
        'agente_local',
        'manual',
        'importacao'
      )
    ),

  id_externo_evento text,

  situacao text NOT NULL DEFAULT 'valida'
    CHECK (
      situacao IN (
        'valida',
        'duplicada',
        'ignorada',
        'ajuste'
      )
    ),

  observacao text,

  criado_por uuid
    REFERENCES usuarios(id)
    ON DELETE SET NULL,

  criado_em timestamptz NOT NULL DEFAULT now(),

  UNIQUE (equipamento_id, id_externo_evento),

  UNIQUE (condominio_id, id)
);


CREATE TABLE ponto_banco_horas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  condominio_id uuid NOT NULL
    REFERENCES condominios(id)
    ON DELETE CASCADE,

  colaborador_id uuid NOT NULL,

  referencia date NOT NULL,

  tipo text NOT NULL
    CHECK (
      tipo IN (
        'credito',
        'debito',
        'ajuste'
      )
    ),

  minutos integer NOT NULL
    CHECK (minutos <> 0),

  saldo_apos_min integer,

  descricao text NOT NULL,

  origem text NOT NULL DEFAULT 'manual'
    CHECK (
      origem IN (
        'apuracao',
        'manual',
        'fechamento'
      )
    ),

  criado_por uuid
    REFERENCES usuarios(id)
    ON DELETE SET NULL,

  criado_em timestamptz NOT NULL DEFAULT now(),

  UNIQUE (condominio_id, id)
);


CREATE TABLE ponto_sincronizacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  condominio_id uuid NOT NULL
    REFERENCES condominios(id)
    ON DELETE CASCADE,

  equipamento_id uuid NOT NULL,

  iniciado_em timestamptz NOT NULL DEFAULT now(),

  finalizado_em timestamptz,

  status text NOT NULL
    CHECK (
      status IN (
        'executando',
        'sucesso',
        'parcial',
        'erro'
      )
    ),

  quantidade_importada integer NOT NULL DEFAULT 0
    CHECK (quantidade_importada >= 0),

  quantidade_duplicada integer NOT NULL DEFAULT 0
    CHECK (quantidade_duplicada >= 0),

  erro text,

  log jsonb NOT NULL DEFAULT '{}'::jsonb,

  criado_por uuid
    REFERENCES usuarios(id)
    ON DELETE SET NULL,

  UNIQUE (condominio_id, id)
);


CREATE INDEX ponto_jornadas_tenant_idx
  ON ponto_jornadas(condominio_id, ativo);

CREATE INDEX ponto_colaboradores_tenant_idx
  ON ponto_colaboradores(condominio_id, situacao, nome);

CREATE INDEX ponto_equipamentos_tenant_idx
  ON ponto_equipamentos(condominio_id, situacao);

CREATE INDEX ponto_marcacoes_tenant_data_idx
  ON ponto_marcacoes(condominio_id, data_hora);

CREATE INDEX ponto_marcacoes_colaborador_data_idx
  ON ponto_marcacoes(
    condominio_id,
    colaborador_id,
    data_hora
  );

CREATE INDEX ponto_banco_tenant_colaborador_idx
  ON ponto_banco_horas(
    condominio_id,
    colaborador_id,
    referencia
  );

CREATE INDEX ponto_sincronizacoes_tenant_idx
  ON ponto_sincronizacoes(
    condominio_id,
    equipamento_id,
    iniciado_em DESC
  );


ALTER TABLE ponto_colaboradores
  ADD CONSTRAINT ponto_colaborador_jornada_tenant_fk
  FOREIGN KEY (condominio_id, jornada_id)
  REFERENCES ponto_jornadas(condominio_id, id)
  ON DELETE SET NULL (jornada_id);


ALTER TABLE ponto_marcacoes
  ADD CONSTRAINT ponto_marcacao_colaborador_tenant_fk
  FOREIGN KEY (condominio_id, colaborador_id)
  REFERENCES ponto_colaboradores(condominio_id, id)
  ON DELETE RESTRICT,

  ADD CONSTRAINT ponto_marcacao_equipamento_tenant_fk
  FOREIGN KEY (condominio_id, equipamento_id)
  REFERENCES ponto_equipamentos(condominio_id, id)
  ON DELETE SET NULL (equipamento_id);


ALTER TABLE ponto_banco_horas
  ADD CONSTRAINT ponto_banco_colaborador_tenant_fk
  FOREIGN KEY (condominio_id, colaborador_id)
  REFERENCES ponto_colaboradores(condominio_id, id)
  ON DELETE CASCADE;


ALTER TABLE ponto_sincronizacoes
  ADD CONSTRAINT ponto_sync_equipamento_tenant_fk
  FOREIGN KEY (condominio_id, equipamento_id)
  REFERENCES ponto_equipamentos(condominio_id, id)
  ON DELETE CASCADE;