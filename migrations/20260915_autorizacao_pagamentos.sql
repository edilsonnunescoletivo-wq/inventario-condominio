CREATE TABLE IF NOT EXISTS diretorias (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 condominio_id uuid NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
 nome varchar(120) NOT NULL,
 descricao text,
 ativo boolean NOT NULL DEFAULT true,
 criado_em timestamptz NOT NULL DEFAULT now(),
 UNIQUE(condominio_id,nome)
);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS diretoria_id uuid REFERENCES diretorias(id) ON DELETE SET NULL;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS whatsapp varchar(30);
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_tipo_conta_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_tipo_conta_check CHECK (tipo_conta IN ('superadmin','sindico','equipe','diretor'));

CREATE TABLE IF NOT EXISTS autorizacoes_pagamento (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 condominio_id uuid NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
 diretoria_id uuid NOT NULL REFERENCES diretorias(id) ON DELETE RESTRICT,
 fornecedor_nome varchar(180) NOT NULL,
 fornecedor_id uuid REFERENCES fornecedores(id) ON DELETE SET NULL,
 numero_nota varchar(80) NOT NULL,
 descricao text NOT NULL,
 forma_pagamento varchar(20) NOT NULL CHECK (forma_pagamento IN ('avista','parcelado')),
 valor_total numeric(14,2) NOT NULL CHECK(valor_total>=0),
 status varchar(30) NOT NULL DEFAULT 'aguardando_aprovacoes' CHECK(status IN ('aguardando_aprovacoes','autorizada_pagamento','rejeitada','paga','cancelada')),
 criado_por uuid NOT NULL REFERENCES usuarios(id),
 administrador_aprovou boolean NOT NULL DEFAULT false,
 administrador_id uuid REFERENCES usuarios(id),
 administrador_assinado_em timestamptz,
 diretor_aprovou boolean NOT NULL DEFAULT false,
 diretor_id uuid REFERENCES usuarios(id),
 diretor_assinado_em timestamptz,
 notificar_diretor boolean NOT NULL DEFAULT false,
 lembrete_dias_antes integer CHECK(lembrete_dias_antes IS NULL OR lembrete_dias_antes>=0),
 whatsapp_notificado_em timestamptz,
 observacoes text,
 criado_em timestamptz NOT NULL DEFAULT now(),
 atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_aut_pag_condominio ON autorizacoes_pagamento(condominio_id);
CREATE INDEX IF NOT EXISTS idx_aut_pag_diretoria ON autorizacoes_pagamento(diretoria_id);
CREATE INDEX IF NOT EXISTS idx_aut_pag_status ON autorizacoes_pagamento(status);

CREATE TABLE IF NOT EXISTS autorizacao_pagamento_parcelas (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 autorizacao_id uuid NOT NULL REFERENCES autorizacoes_pagamento(id) ON DELETE CASCADE,
 numero integer NOT NULL CHECK(numero>0),
 valor numeric(14,2) NOT NULL CHECK(valor>=0),
 vencimento date NOT NULL,
 pago boolean NOT NULL DEFAULT false,
 pago_em timestamptz,
 UNIQUE(autorizacao_id,numero)
);

CREATE TABLE IF NOT EXISTS autorizacao_pagamento_historico (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 autorizacao_id uuid NOT NULL REFERENCES autorizacoes_pagamento(id) ON DELETE CASCADE,
 usuario_id uuid REFERENCES usuarios(id),
 acao varchar(60) NOT NULL,
 detalhe text,
 criado_em timestamptz NOT NULL DEFAULT now()
);
