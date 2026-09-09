import QRCode from 'qrcode';
export const runtime='nodejs';
export async function GET(request,{params}){const {tipo,token}=await params;const base=new URL(request.url).origin;const url=`${base}/q/${encodeURIComponent(tipo)}/${encodeURIComponent(token)}`;const svg=await QRCode.toString(url,{type:'svg',margin:1,width:320});return new Response(svg,{headers:{'Content-Type':'image/svg+xml','Cache-Control':'public, max-age=3600'}})}
