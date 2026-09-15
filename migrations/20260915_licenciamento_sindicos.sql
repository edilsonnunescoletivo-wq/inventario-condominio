-- Etapa 6: hierarquia Super Admin -> Sindico -> Condominios -> Equipe
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS tipo_conta varchar(30) NOT NULL DEFAULT 'equipe';
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS sindico_id uuid REFERENCES usuarios(id) ON DELETE SET NULL;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS licenca_status varchar(20) NOT NULL DEFAULT 'pendente';
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS licenca_inicio date;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS licenca_fim date;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS limite_condominios integer NOT NULL DEFAULT 0;

ALTER TABLE condominios ADD COLUMN IF NOT EXISTS sindico_id uuid REFERENCES usuarios(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_usuarios_sindico_id ON usuarios(sindico_id);
CREATE INDEX IF NOT EXISTS idx_condominios_sindico_id ON condominios(sindico_id);

UPDATE usuarios SET tipo_conta='superadmin', licenca_status='ativo' WHERE is_superadmin=true;
UPDATE usuarios SET tipo_conta='sindico' WHERE is_superadmin=false AND perfil='admin' AND tipo_conta='equipe';

ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_tipo_conta_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_tipo_conta_check CHECK (tipo_conta IN ('superadmin','sindico','equipe'));
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_licenca_status_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_licenca_status_check CHECK (licenca_status IN ('pendente','ativo','suspenso','vencido','bloqueado'));
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_limite_condominios_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_limite_condominios_check CHECK (limite_condominios >= 0);
