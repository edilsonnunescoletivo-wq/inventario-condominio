import { query } from '@/lib/db';
import { apiError } from '@/lib/session';
import { integrationCredentialMatches } from '@/lib/controlid';
import { ingestDeviceEvents } from '@/lib/ponto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  try {
    const { deviceId } = await params;

    if (!deviceId) {
      return Response.json(
        { error: 'Equipamento inválido.' },
        { status: 400 }
      );
    }

    const token =
      request.headers.get('x-ponto-device-token') || '';

    if (!token) {
      return Response.json(
        { error: 'Credencial do agente ausente.' },
        { status: 401 }
      );
    }

    const result = await query(
      `
      SELECT
        id,
        condominio_id,
        credencial_integracao_hash
      FROM ponto_equipamentos
      WHERE id = $1
        AND situacao = 'ativo'
        AND ativo = true
      LIMIT 1
      `,
      [deviceId]
    );

    const device = result.rows[0];

    if (
      !device ||
      !device.credencial_integracao_hash ||
      !integrationCredentialMatches(
        token,
        device.credencial_integracao_hash
      )
    ) {
      return Response.json(
        { error: 'Agente não autorizado.' },
        { status: 401 }
      );
    }

    const body =
      await request.json().catch(() => ({}));

    if (
      !Array.isArray(body.events) ||
      body.events.length < 1 ||
      body.events.length > 1000
    ) {
      return Response.json(
        {
          error:
            'Envie events como uma lista contendo de 1 a 1000 eventos.',
        },
        { status: 400 }
      );
    }

    const response =
      await ingestDeviceEvents({
        request,
        device,
        events: body.events,
      });

    return Response.json(response);
  } catch (error) {
    return apiError(error);
  }
}
