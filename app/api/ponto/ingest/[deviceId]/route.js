import { query } from '@/lib/db';
import { apiError } from '@/lib/session';
import { integrationCredentialMatches } from '@/lib/controlid';
import { ingestDeviceEvents } from '@/lib/ponto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  try {
    const { deviceId } = await params;
    const token = request.headers.get('x-ponto-device-token') || '';
    if (!token) return Response.json({ error: 'Credencial do agente ausente.' }, { status: 401 });
    const result = await query(`SELECT id,condominio_id,credencial_integracao_hash FROM ponto_equipamentos WHERE id=$1 AND situacao='ativo'`, [deviceId]);
    const device = result.rows[0];
    if (!device || !device.credencial_integracao_hash || !integrationCredentialMatches(token, device.credencial_integracao_hash)) return Response.json({ error: 'Agente não autorizado.' }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    if (!Array.isArray(body.events) || body.events.length > 1000) return Response.json({ error: 'Envie events como uma lista de até 1000 eventos.' }, { status: 400 });
    return Response.json(await ingestDeviceEvents({ request, device, events: body.events }));
  } catch (error) { return apiError(error); }
}
