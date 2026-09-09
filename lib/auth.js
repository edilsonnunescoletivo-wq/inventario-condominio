import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { JWT_SECRET, assertConfig } from './config';

assertConfig();
const secret = new TextEncoder().encode(JWT_SECRET);
export async function hashPassword(password){return bcrypt.hash(password,12)}
export async function verifyPassword(password,hash){return bcrypt.compare(password,hash)}
export async function signToken(user){
  return new SignJWT({nome:user.nome,email:user.email,is_superadmin:!!user.is_superadmin})
    .setProtectedHeader({alg:'HS256'}).setSubject(user.id).setIssuedAt().setExpirationTime('12h').sign(secret);
}
export async function verifyToken(token){const {payload}=await jwtVerify(token,secret);return payload}
