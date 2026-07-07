interface Env {
  DB: D1Database;
}

interface UserContext {
  user?: { id: string; username: string };
}

// GET /api/subjects - List all subjects for the user
export const onRequestGet: PagesFunction<Env, any, UserContext> = async (context) => {
  try {
    const { env, data } = context;
    const userId = data.user!.id;

    const subjects = await env.DB.prepare('SELECT * FROM subjects WHERE user_id = ? ORDER BY created_at DESC')
      .bind(userId)
      .all();

    return new Response(JSON.stringify(subjects.results), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// POST /api/subjects - Create a subject
export const onRequestPost: PagesFunction<Env, any, UserContext> = async (context) => {
  try {
    const { request, env, data } = context;
    const userId = data.user!.id;
    const { name } = await request.json() as any;

    if (!name || name.trim() === '') {
      return new Response(JSON.stringify({ error: 'Subject name is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const id = crypto.randomUUID();
    const now = Date.now();

    await env.DB.prepare('INSERT INTO subjects (id, user_id, name, created_at) VALUES (?, ?, ?, ?)')
      .bind(id, userId, name.trim(), now)
      .run();

    return new Response(JSON.stringify({ success: true, subject: { id, name: name.trim(), created_at: now } }), {
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

// PUT /api/subjects - Update a subject
export const onRequestPut: PagesFunction<Env, any, UserContext> = async (context) => {
  try {
    const { request, env, data } = context;
    const userId = data.user!.id;
    const { id, name } = await request.json() as any;

    if (!id || !name || name.trim() === '') {
      return new Response(JSON.stringify({ error: 'Subject id and name are required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const result = await env.DB.prepare('UPDATE subjects SET name = ? WHERE id = ? AND user_id = ?')
      .bind(name.trim(), id, userId)
      .run();

    if (result.meta.changes === 0) {
      return new Response(JSON.stringify({ error: 'Subject not found or access denied.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// DELETE /api/subjects?id=xxx - Delete a subject
export const onRequestDelete: PagesFunction<Env, any, UserContext> = async (context) => {
  try {
    const { request, env, data } = context;
    const userId = data.user!.id;
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return new Response(JSON.stringify({ error: 'Subject id is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const result = await env.DB.prepare('DELETE FROM subjects WHERE id = ? AND user_id = ?')
      .bind(id, userId)
      .run();

    if (result.meta.changes === 0) {
      return new Response(JSON.stringify({ error: 'Subject not found or access denied.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
