import { query } from '@/lib/db';
export const runtime='nodejs';
export async function GET(){try{await query('SELECT 1');return Response.json({ok:true,version:'6.0.0'})}catch(e){return Response.json({ok:false},{status:500})}}
