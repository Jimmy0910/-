import { hashPassword } from './_utils';

interface Env {
  DB: D1Database;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const { username, password } = await request.json() as any;

    if (!username || !password || username.trim() === '' || password.length < 6) {
      return new Response(JSON.stringify({ error: 'Username must not be empty, and password must be at least 6 characters.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const trimmedUsername = username.trim();

    // Check if user already exists
    const existing = await env.DB.prepare('SELECT id FROM users WHERE username = ?')
      .bind(trimmedUsername)
      .first();

    if (existing) {
      return new Response(JSON.stringify({ error: 'Username already exists.' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create user
    const userId = crypto.randomUUID();
    const passwordHash = await hashPassword(password);
    const now = Date.now();

    await env.DB.prepare('INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)')
      .bind(userId, trimmedUsername, passwordHash, now)
      .run();

    return new Response(JSON.stringify({ success: true, message: 'User registered successfully.' }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
