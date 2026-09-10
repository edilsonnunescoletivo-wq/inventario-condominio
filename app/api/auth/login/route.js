import { query } from '@/lib/db';
import { signToken, verifyPassword } from '@/lib/auth';
import { apiError } from '@/lib/session';
import {
  audit,
  requestIp,
  tokenHash,
} from '@/lib/audit';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const body = await request.json();

    const email = String(
      body?.email || ''
    )
      .trim()
      .toLowerCase();

    const senha =
      body?.senha || '';

    if (!email || !senha) {
      return Response.json(
        {
          error:
            'Informe e-mail e senha.',
        },
        { status: 400 }
      );
    }

    /*
     * Localiza o usuário pelo e-mail.
     *
     * A aplicação já possui unicidade
     * de e-mail normalizado no banco.
     */
    const userResult =
      await query(
        `
        SELECT
          id,
          nome,
          email,
          senha_hash,
          ativo,
          condominio_id,
          is_superadmin
        FROM usuarios
        WHERE lower(email) = lower($1)
        ORDER BY criado_em
        LIMIT 1
        `,
        [email]
      );

    const user =
      userResult.rows[0];

    /*
     * Validação da senha.
     *
     * A mesma mensagem é utilizada para
     * usuário inexistente, inativo ou
     * senha incorreta, evitando revelar
     * detalhes sobre contas cadastradas.
     */
    const passwordValid =
      user &&
      user.ativo &&
      (await verifyPassword(
        senha,
        user.senha_hash
      ));

    if (!passwordValid) {
      await audit(request, {
        usuario_id:
          user?.id || null,

        condominio_id:
          user?.condominio_id ||
          null,

        acao:
          'login_falha',

        modulo:
          'auth',

        descricao:
          'Tentativa de login sem sucesso',

        detalhes: {
          email,
        },
      });

      return Response.json(
        {
          error:
            'E-mail ou senha inválidos.',
        },
        { status: 401 }
      );
    }

    /*
     * Busca todos os condomínios aos quais
     * o usuário possui acesso ativo.
     */
    const accessResult =
      await query(
        `
        SELECT
          uc.condominio_id,
          uc.perfil,
          c.nome,
          c.status
        FROM usuario_condominios uc

        JOIN condominios c
          ON c.id = uc.condominio_id

        WHERE uc.usuario_id = $1
          AND uc.ativo = true
          AND c.ativo = true
          AND c.status = 'ativo'

        ORDER BY c.nome
        `,
        [user.id]
      );

    /*
     * Usuários comuns precisam possuir
     * pelo menos um condomínio ativo.
     *
     * Superadmin pode entrar mesmo sem
     * associação em usuario_condominios.
     */
    if (
      !user.is_superadmin &&
      !accessResult.rowCount
    ) {
      return Response.json(
        {
          error:
            'Usuário sem condomínio ativo.',
        },
        { status: 403 }
      );
    }

    /*
     * Define o condomínio inicial.
     *
     * Primeiro tenta manter o condomínio
     * configurado atualmente no usuário,
     * desde que ainda esteja entre seus
     * vínculos ativos.
     *
     * Caso contrário utiliza o primeiro
     * condomínio ativo disponível.
     *
     * Para superadmin sem vínculo direto,
     * poderá permanecer com o condomínio
     * configurado na tabela usuarios.
     */
    const currentAccess =
      accessResult.rows.find(
        item =>
          String(
            item.condominio_id
          ) ===
          String(
            user.condominio_id
          )
      );

    const initialCondoId =
      currentAccess?.condominio_id ||
      accessResult.rows[0]
        ?.condominio_id ||
      user.condominio_id ||
      null;

    /*
     * Gera o JWT.
     */
    const token =
      await signToken(user);

    /*
     * Registra a sessão no banco.
     *
     * O token em texto puro NÃO é salvo.
     * Apenas seu hash é armazenado.
     */
    await query(
      `
      INSERT INTO sessoes(
        usuario_id,
        condominio_id,
        token_hash,
        expira_em,
        ip,
        user_agent,
        ultimo_acesso_em
      )
      VALUES(
        $1,
        $2,
        $3,
        now() + interval '12 hours',
        $4,
        $5,
        now()
      )
      `,
      [
        user.id,
        initialCondoId,
        tokenHash(token),
        requestIp(request),
        request.headers.get(
          'user-agent'
        ) || null,
      ]
    );

    /*
     * Auditoria do login realizado.
     */
    await audit(request, {
      usuario_id:
        user.id,

      condominio_id:
        initialCondoId,

      acao:
        'login_sucesso',

      modulo:
        'auth',

      descricao:
        'Login realizado',
    });

    /*
     * Nunca retornar senha_hash.
     */
    return Response.json({
      token,

      user: {
        id:
          user.id,

        nome:
          user.nome,

        email:
          user.email,

        is_superadmin:
          Boolean(
            user.is_superadmin
          ),
      },

      condominios:
        accessResult.rows,
    });
  } catch (error) {
    return apiError(error);
  }
}
