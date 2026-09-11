import {fail,text,amount,transaction,event} from './operacao';
export async function importRows(u,b){return transaction(async c=>{
 if(!['unidades','moradores','inventario'].includes(b.tipo)||!Array.isArray(b.rows)||!b.rows.length||b.rows.length>300)fail('Envie de 1 a 300 linhas de unidades, moradores ou inventário.');
 await c.query('SELECT id FROM condominios WHERE id=$1 FOR UPDATE',[u.condominio_id]);
 const unitRows=(await c.query('SELECT id,bloco,unidade FROM unidades WHERE condominio_id=$1 AND ativo',[u.condominio_id])).rows;
 const existing=b.tipo==='moradores'?(await c.query('SELECT nome,email,unidade_id FROM moradores WHERE condominio_id=$1 AND ativo',[u.condominio_id])).rows:b.tipo==='inventario'?(await c.query('SELECT patrimonio,descricao,localizacao FROM inventario WHERE condominio_id=$1 AND ativo',[u.condominio_id])).rows:unitRows;
 const norm=v=>text(v).toLocaleLowerCase('pt-BR');const unitKey=r=>norm(r.bloco)+'|'+norm(r.unidade);
 const key=r=>b.tipo==='unidades'?unitKey(r):b.tipo==='moradores'?r.unidade_id+'|'+norm(r.email||r.nome):norm(r.patrimonio)||norm(r.descricao)+'|'+norm(r.localizacao);
 const keys=new Set(existing.map(key));const preview=[];
 for(const [i,row] of b.rows.entries()){
 const r={};for(const [k,v] of Object.entries(row))r[k]=text(v,200);let error='';
 if(b.tipo==='unidades'&&!r.unidade)error='Informe a unidade.';
 if(b.tipo==='moradores'){const unit=unitRows.find(x=>unitKey(x)===unitKey(r));if(!unit)error='Unidade não cadastrada. Importe as unidades primeiro.';r.unidade_id=unit?.id;if(!r.nome)error='Informe o nome.';if(r.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email))error='E-mail inválido.';}
 if(b.tipo==='inventario'){if(!r.descricao)error='Informe a descrição.';if(r.quantidade!==''&&r.quantidade!==undefined&&(!Number.isFinite(Number(r.quantidade))||Number(r.quantidade)<0))error='Quantidade inválida.';}
 const duplicate=keys.has(key(r));if(!error&&!duplicate)keys.add(key(r));preview.push({linha:i+2,dados:r,situacao:error?'erro':duplicate?'duplicado':'novo',erro:error});
 }
 if(b.confirmar){if(preview.some(x=>x.situacao==='erro'))fail('Corrija as linhas com erro antes de importar.');for(const p of preview.filter(x=>x.situacao==='novo')){const r=p.dados;if(b.tipo==='unidades')await c.query('INSERT INTO unidades(condominio_id,bloco,unidade,tipo) VALUES($1,$2,$3,$4)',[u.condominio_id,r.bloco||null,r.unidade,'apartamento']);if(b.tipo==='moradores')await c.query('INSERT INTO moradores(condominio_id,unidade_id,nome,email,telefone,tipo) VALUES($1,$2,$3,$4,$5,$6)',[u.condominio_id,r.unidade_id,r.nome,r.email||null,r.telefone||null,'morador']);if(b.tipo==='inventario')await c.query(`INSERT INTO inventario(condominio_id,patrimonio,descricao,localizacao,quantidade,unidade,estado_conservacao,criado_por,atualizado_por) VALUES($1,$2,$3,$4,$5,'un','bom',$6,$6)`,[u.condominio_id,r.patrimonio||null,r.descricao,r.localizacao||null,r.quantidade?amount(r.quantidade):1,u.id]);}
 const added=preview.filter(x=>x.situacao==='novo').length;await c.query('INSERT INTO importacoes_operacionais(condominio_id,usuario_id,tipo,quantidade) VALUES($1,$2,$3,$4)',[u.condominio_id,u.id,b.tipo,added]);return {adicionados:added,ignorados:preview.length-added};}
 return {preview};
})}
