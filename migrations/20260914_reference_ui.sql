BEGIN;
CREATE TABLE IF NOT EXISTS agenda_compromissos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 condominio_id uuid NOT NULL REFERENCES condominios(id),
 tipo text NOT NULL DEFAULT 'outro',
 titulo text NOT NULL,
 inicio timestamptz NOT NULL,
 fim timestamptz NOT NULL,
 local text,
 responsavel text,
 observacoes text,
 status text NOT NULL DEFAULT 'programado',
 criado_por uuid REFERENCES usuarios(id),
 ativo boolean NOT NULL DEFAULT true,
 criado_em timestamptz NOT NULL DEFAULT now(),
 atualizado_em timestamptz NOT NULL DEFAULT now(),
 CHECK (fim > inicio)
);
CREATE INDEX IF NOT EXISTS agenda_compromissos_condominio_inicio ON agenda_compromissos(condominio_id,inicio) WHERE ativo;
CREATE TABLE IF NOT EXISTS notificacoes_leituras (
 condominio_id uuid NOT NULL REFERENCES condominios(id),
 usuario_id uuid NOT NULL REFERENCES usuarios(id),
 chave text NOT NULL,
 lida_em timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(condominio_id,usuario_id,chave)
);
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS periodicidade text;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS responsavel text;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS whatsapp text;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS endereco text;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS anexo jsonb NOT NULL DEFAULT '[]'::jsonb;
COMMIT;
