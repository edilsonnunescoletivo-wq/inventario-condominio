-- Controle de Ponto
-- Adiciona suporte a soft delete de equipamentos.
--
-- Migration incremental.
-- Executar somente após 001_controle_ponto.sql.

ALTER TABLE ponto_equipamentos
  ADD COLUMN IF NOT EXISTS ativo boolean
  NOT NULL
  DEFAULT true;

CREATE INDEX IF NOT EXISTS
  ponto_equipamentos_ativos_tenant_idx
ON ponto_equipamentos(
  condominio_id,
  ativo,
  situacao
);
