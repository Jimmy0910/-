interface Env {
  DB: D1Database;
}

interface UserContext {
  user?: { id: string; username: string };
}

// GET /api/chapters?subjectId=xxx - List all chapters for a specific subject (with ownership check)
export const onRequestGet: PagesFunction<Env, any, UserContext> = async (context) => {
  try {
    const { request, env, data } = context;
    const userId = data.user!.id;
    const url = new URL(request.url);
    const subjectId = url.searchParams.get('subjectId');

    if (!subjectId) {
      return new Response(JSON.stringify({ error: 'subjectId is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const chapters = await env.DB.prepare(
      `SELECT c.* FROM chapters c 
       JOIN subjects s ON c.subject_id = s.id 
       WHERE c.subject_id = ? AND s.user_id = ? 
       ORDER BY c.created_at ASC`
    )
    .bind(subjectId, userId)
    .all();

    return new Response(JSON.stringify(chapters.results), {
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

// POST /api/chapters - Create a chapter under a subject (with ownership check)
export const onRequestPost: PagesFunction<Env, any, UserContext> = async (context) => {
  try {
    const { request, env, data } = context;
    const userId = data.user!.id;
    const { name, subjectId } = await request.json() as any;

    if (!name || name.trim() === '' || !subjectId) {
      return new Response(JSON.stringify({ error: 'Chapter name and subjectId are required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify subject ownership
    const subject = await env.DB.prepare('SELECT id FROM subjects WHERE id = ? AND user_id = ?')
      .bind(subjectId, userId)
      .first();

    if (!subject) {
      return new Response(JSON.stringify({ error: 'Subject not found or access denied.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const id = crypto.randomUUID();
    const now = Date.now();

    await env.DB.prepare('INSERT INTO chapters (id, subject_id, name, created_at) VALUES (?, ?, ?, ?)')
      .bind(id, subjectId, name.trim(), now)
      .run();

    return new Response(JSON.stringify({ success: true, chapter: { id, subject_id: subjectId, name: name.trim(), created_at: now } }), {
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

// PUT /api/chapters - Update a chapter name (with ownership check)
export const onRequestPut: PagesFunction<Env, any, UserContext> = async (context) => {
  try {
    const { request, env, data } = context;
    const userId = data.user!.id;
    const { id, name } = await request.json() as any;

    if (!id || !name || name.trim() === '') {
      return new Response(JSON.stringify({ error: 'Chapter id and name are required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Update chapter only if the parent subject belongs to the current user
    const result = await env.DB.prepare(
      `UPDATE chapters 
       SET name = ? 
       WHERE id = ? 
       AND EXISTS (
         SELECT 1 FROM subjects s 
         WHERE s.id = chapters.subject_id 
         AND s.user_id = ?
       )`
    )
    .bind(name.trim(), id, userId)
    .run();

    if (result.meta.changes === 0) {
      return new Response(JSON.stringify({ error: 'Chapter not found or access denied.' }), {
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

// DELETE /api/chapters?id=xxx - Delete a chapter (with ownership check)
export const onRequestDelete: PagesFunction<Env, any, UserContext> = async (context) => {
  try {
    const { request, env, data } = context;
    const userId = data.user!.id;
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return new Response(JSON.stringify({ error: 'Chapter id is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Delete chapter only if the parent subject belongs to the current user
    const result = await env.DB.prepare(
      `DELETE FROM chapters 
       WHERE id = ? 
       AND EXISTS (
         SELECT 1 FROM subjects s 
         WHERE s.id = chapters.subject_id 
         AND s.user_id = ?
       )`
    )
    .bind(id, userId)
    .run();

    if (result.meta.changes === 0) {
      return new Response(JSON.stringify({ error: 'Chapter not found or access denied.' }), {
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
