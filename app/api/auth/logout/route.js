import { query } from '@/lib/db';
import {
  requireSession,
  apiError,
  tokenFromRequest,
} from '@/lib/session';
import {
  audit,
  tokenHash,
} from '@/lib/audit';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const user =
      await requireSession(request);

    const token =
      tokenFromRequest(request);

    await query(
      `
      UPDATE sessoes
      SET encerrado_em = now()
      WHERE usuario_id = $1
        AND token_hash = $2
        AND encerrado_em IS NULL
      `,
      [
        user.id,
        tokenHash(token),
      ]
    );

    await audit(request, {
      condominio_id:
        user.condominio_id,

      usuario_id:
        user.id,

      acao:
        'logout',

      modulo:
        'auth',

      descricao:
        'Sessão encerrada',
    });

    return Response.json({
      ok: true,
    });
  } catch (error) {
    return apiError(error);
  }
}
