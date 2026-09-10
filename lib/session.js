import { verifyToken } from './auth';
import { query } from './db';
import { tokenHash } from './audit';

export function tokenFromRequest(request) {
  const authorization =
    request.headers.get('authorization') || '';

  if (
    !authorization
      .toLowerCase()
      .startsWith('bearer ')
  ) {
    return null;
  }

  return authorization
    .slice(7)
    .trim();
}

function requestedCondo(request) {
  const value =
    request.headers.get('x-condominio-id') || '';

  return value.trim() || null;
}

export async function requireSession(request) {
  const token =
    tokenFromRequest(request);

  if (!token) {
    throw Object.assign(
      new Error('Não autenticado'),
      { status: 401 }
    );
  }

  let payload;

  try {
    payload =
      await verifyToken(token);
  } catch {
    throw Object.assign(
      new Error(
        'Sessão inválida ou expirada'
      ),
      { status: 401 }
    );
  }

  if (!payload?.sub) {
    throw Object.assign(
      new Error(
        'Sessão inválida ou expirada'
      ),
      { status: 401 }
    );
  }

  /*
   * Confirma que o usuário continua
   * existente e ativo.
   */
  const userResult =
    await query(
      `
      SELECT
        id,
        nome,
        email,
        ativo,
        condominio_id,
        is_superadmin
      FROM usuarios
      WHERE id=$1
      LIMIT 1
      `,
      [payload.sub]
    );

  const base =
    userResult.rows[0];

  if (
    !base ||
    !base.ativo
  ) {
    throw Object.assign(
      new Error('Usuário inativo'),
      { status: 401 }
    );
  }

  /*
   * Confirma que o token ainda representa
   * uma sessão ativa.
   *
   * Isso permite invalidar um JWT antes
   * de seu vencimento, por exemplo em logout.
   */
  const sessionResult =
    await query(
      `
      SELECT 1
      FROM sessoes
      WHERE usuario_id=$1
        AND token_hash=$2
        AND encerrado_em IS NULL
        AND expira_em > now()
      LIMIT 1
      `,
      [
        base.id,
        tokenHash(token),
      ]
    );

  if (!sessionResult.rowCount) {
    throw Object.assign(
      new Error(
        'Sessão encerrada ou expirada'
      ),
      { status: 401 }
    );
  }

  /*
   * Condomínio solicitado pelo cliente.
   *
   * O header nunca concede acesso por si só.
   * A associação é conferida abaixo.
   */
  const wanted =
    requestedCondo(request) ||
    base.condominio_id;

  if (!wanted) {
    throw Object.assign(
      new Error(
        'Nenhum condomínio selecionado'
      ),
      { status: 403 }
    );
  }

  let access;

  /*
   * Superadmin pode acessar qualquer
   * condomínio ativo.
   */
  if (base.is_superadmin) {
    const result =
      await query(
        `
        SELECT
          c.id AS condominio_id,
          'admin'::text AS perfil,
          c.nome AS condominio,
          c.cnpj,
          c.ativo AS condominio_ativo,
          c.status,
          c.modulos
        FROM condominios c
        WHERE c.id=$1
        LIMIT 1
        `,
        [wanted]
      );

    access =
      result.rows[0];
  }

  /*
   * Usuário comum precisa possuir vínculo
   * ativo com o condomínio solicitado.
   */
  else {
    const result =
      await query(
        `
        SELECT
          uc.condominio_id,
          uc.perfil,
          c.nome AS condominio,
          c.cnpj,
          c.ativo AS condominio_ativo,
          c.status,
          c.modulos
        FROM usuario_condominios uc

        JOIN condominios c
          ON c.id=uc.condominio_id

        WHERE uc.usuario_id=$1
          AND uc.condominio_id=$2
          AND uc.ativo=true

        LIMIT 1
        `,
        [
          base.id,
          wanted,
        ]
      );

    access =
      result.rows[0];
  }

  if (
    !access ||
    !access.condominio_ativo ||
    access.status !== 'ativo'
  ) {
    throw Object.assign(
      new Error(
        'Sem acesso a este condomínio'
      ),
      { status: 403 }
    );
  }

  return {
    ...base,
    ...access,
    is_superadmin:
      Boolean(base.is_superadmin),
  };
}

export async function requireAdmin(request) {
  const user =
    await requireSession(request);

  if (
    !user.is_superadmin &&
    user.perfil !== 'admin'
  ) {
    throw Object.assign(
      new Error(
        'Acesso restrito ao administrador'
      ),
      { status: 403 }
    );
  }

  return user;
}

export async function requireSuperAdmin(request) {
  const user =
    await requireSession(request);

  if (!user.is_superadmin) {
    throw Object.assign(
      new Error(
        'Acesso restrito ao Super Administrador'
      ),
      { status: 403 }
    );
  }

  return user;
}

export function apiError(error) {
  console.error(error);

  const status =
    error?.status || 500;

  return Response.json(
    {
      error:
        status === 500
          ? 'Erro interno do servidor'
          : error.message,
    },
    { status }
  );
}
