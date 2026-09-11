BEGIN;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS senha_alterada_em timestamptz;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS revisao jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS checklist_execucao_id uuid REFERENCES checklist_execucoes(id);
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS consumo_itens jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS estoque_baixado_em timestamptz;
ALTER TABLE areas_reservaveis ADD COLUMN IF NOT EXISTS regras jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE reservas ADD COLUMN IF NOT EXISTS aceite_regulamento jsonb;
ALTER TABLE reservas ADD COLUMN IF NOT EXISTS morador_id uuid REFERENCES moradores(id);
ALTER TABLE comunicados ADD COLUMN IF NOT EXISTS versao integer NOT NULL DEFAULT 1;
ALTER TABLE comunicados ADD COLUMN IF NOT EXISTS anexos jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE comunicados ADD COLUMN IF NOT EXISTS agendado_em timestamptz;
CREATE TABLE IF NOT EXISTS operacao_eventos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), condominio_id uuid NOT NULL REFERENCES condominios(id), usuario_id uuid REFERENCES usuarios(id),
 entidade text NOT NULL, entidade_id uuid NOT NULL, acao text NOT NULL, dados jsonb NOT NULL DEFAULT '{}', criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS operacao_eventos_entidade ON operacao_eventos(condominio_id,entidade,entidade_id,criado_em);
CREATE TABLE IF NOT EXISTS comunicados_versoes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), condominio_id uuid NOT NULL REFERENCES condominios(id), comunicado_id uuid NOT NULL REFERENCES comunicados(id),
 versao integer NOT NULL, dados jsonb NOT NULL, usuario_id uuid REFERENCES usuarios(id), criado_em timestamptz NOT NULL DEFAULT now(), UNIQUE(comunicado_id,versao)
);
CREATE TABLE IF NOT EXISTS comunicados_leituras (
 comunicado_id uuid NOT NULL REFERENCES comunicados(id), condominio_id uuid NOT NULL REFERENCES condominios(id), leitor_id uuid NOT NULL, tipo text NOT NULL CHECK(tipo IN ('equipe','morador')), versao integer NOT NULL, lido_em timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(comunicado_id,leitor_id,tipo,versao)
);
CREATE TABLE IF NOT EXISTS reservas_bloqueios (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),condominio_id uuid NOT NULL REFERENCES condominios(id),area_id uuid NOT NULL REFERENCES areas_reservaveis(id),inicio timestamptz NOT NULL,fim timestamptz NOT NULL,motivo text NOT NULL,criado_por uuid REFERENCES usuarios(id),ativo boolean NOT NULL DEFAULT true,CHECK(fim>inicio)
);
CREATE TABLE IF NOT EXISTS moradores_acessos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),condominio_id uuid NOT NULL REFERENCES condominios(id),morador_id uuid NOT NULL REFERENCES moradores(id),email text NOT NULL,senha_hash text NOT NULL,ativo boolean NOT NULL DEFAULT true,senha_alterada_em timestamptz,criado_em timestamptz NOT NULL DEFAULT now(),UNIQUE(condominio_id,morador_id),UNIQUE(condominio_id,email)
);
CREATE TABLE IF NOT EXISTS recuperacoes_senha (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),email text NOT NULL,tipo text NOT NULL CHECK(tipo IN ('equipe','morador')),conta_id uuid NOT NULL,condominio_id uuid NOT NULL REFERENCES condominios(id),token_hash text UNIQUE,expira_em timestamptz,usado_em timestamptz,criado_em timestamptz NOT NULL DEFAULT now(),atendido_por uuid REFERENCES usuarios(id)
);
CREATE TABLE IF NOT EXISTS operacao_limites (
 chave text NOT NULL,janela timestamptz NOT NULL,quantidade integer NOT NULL,PRIMARY KEY(chave,janela)
);
CREATE TABLE IF NOT EXISTS alertas_acompanhamento (
 condominio_id uuid NOT NULL REFERENCES condominios(id),chave text NOT NULL,usuario_id uuid NOT NULL REFERENCES usuarios(id),providencia text NOT NULL DEFAULT '',visto_em timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(condominio_id,chave)
);
CREATE TABLE IF NOT EXISTS passagens_plantao (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),condominio_id uuid NOT NULL REFERENCES condominios(id),usuario_id uuid NOT NULL REFERENCES usuarios(id),turno text NOT NULL,pendencias text NOT NULL,criado_em timestamptz NOT NULL DEFAULT now(),recebido_por uuid REFERENCES usuarios(id),recebido_em timestamptz
);
CREATE TABLE IF NOT EXISTS importacoes_operacionais (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),condominio_id uuid NOT NULL REFERENCES condominios(id),usuario_id uuid NOT NULL REFERENCES usuarios(id),tipo text NOT NULL,quantidade integer NOT NULL,criado_em timestamptz NOT NULL DEFAULT now()
);
COMMIT;
