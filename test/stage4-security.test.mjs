import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {build} from 'esbuild';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';

process.env.JWT_SECRET='stage4-test-secret-only';
process.env.DATABASE_URL='postgres://unused';

const db=new PGlite();
globalThis.__testDb=db;
await db.exec((await fs.readFile('test/base-schema.sql','utf8')).replace('valor_restante numeric,','valor_restante numeric GENERATED ALWAYS AS (valor_total-valor_pago) STORED,'));
await db.exec(await fs.readFile('migrations/20260910_operacao.sql','utf8'));
await db.exec(await fs.readFile('migrations/20260914_reference_ui.sql','utf8'));
await fs.mkdir('test-results',{recursive:true});

await build({
  stdin:{contents:`export * from './lib/auth';export * from './lib/session';export {GET as dashboardGET} from './app/api/dashboard/route';`,resolveDir:process.cwd()},
  bundle:true,platform:'node',format:'esm',outfile:'test-results/stage4-security.mjs',packages:'external',
  plugins:[{name:'isolated-database',setup(b){
    b.onResolve({filter:/(^@\/lib\/db$|^\.\/db$)/},()=>({path:'database',namespace:'test'}));
    b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:`async function run(sql,args=[]){const r=await globalThis.__testDb.query(sql,args);return {...r,rowCount:r.affectedRows||r.rows.length}}export const query=run;export const pool={query:run};`}));
  }}]
});

const api=await import('../test-results/stage4-security.mjs');
const q=(s,p=[])=>db.query(s,p);
const c1=crypto.randomUUID(),c2=crypto.randomUUID(),u1=crypto.randomUUID();

await q("INSERT INTO condominios(id,cnpj,nome,ativo,status) VALUES($1,'33333333000133','Condomínio A',true,'ativo'),($2,'44444444000144','Condomínio B',true,'ativo')",[c1,c2]);
const hash=await api.hashPassword('Stage4-password-2026');
await q("INSERT INTO usuarios(id,condominio_id,nome,email,senha_hash,perfil) VALUES($1,$2,'Administrador A','admin-a@example.test',$3,'usuario')",[u1,c1,hash]);
await q("INSERT INTO usuario_condominios(usuario_id,condominio_id,perfil,ativo) VALUES($1,$2,'admin',true)",[u1,c1]);
await q("INSERT INTO ordens_servico(condominio_id,numero_os,titulo,status,prioridade) VALUES($1,'OS-A1','OS do A','aberta','alta'),($2,'OS-B1','OS do B','aberta','critica'),($2,'OS-B2','Outra OS do B','aberta','alta')",[c1,c2]);

const token=await api.signToken({id:u1,nome:'Administrador A'});
function request(condoId){return new Request('http://localhost/api/dashboard',{headers:{Authorization:'Bearer '+token,...(condoId?{'X-Condominio-Id':condoId}:{})}})}

test('dashboard contabiliza somente dados do condomínio autorizado',async()=>{
  const response=await api.dashboardGET(request(c1));
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.metrics.os,1);
  assert.equal(body.alerts.length,1);
  assert.equal(body.alerts[0].ref,'OS-A1');
});

test('usuário não pode trocar o X-Condominio-Id para condomínio sem vínculo',async()=>{
  const response=await api.dashboardGET(request(c2));
  assert.equal(response.status,403);
  const body=await response.json();
  assert.match(body.error,/Sem acesso/);
});
