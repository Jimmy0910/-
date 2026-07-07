interface Env {
  DB: D1Database;
}

interface UserContext {
  user?: { id: string; username: string };
}

// GET /api/mistakes - List mistakes (can filter by chapterId, otherwise lists all for user)
export const onRequestGet: PagesFunction<Env, any, UserContext> = async (context) => {
  try {
    const { request, env, data } = context;
    const userId = data.user!.id;
    const url = new URL(request.url);
    const chapterId = url.searchParams.get('chapterId');

    let mistakes;

    if (chapterId) {
      // List mistakes under specific chapter (with ownership check)
      mistakes = await env.DB.prepare(
        `SELECT m.*, t.name as template_name, t.fields as template_fields
         FROM mistakes m
         JOIN chapters c ON m.chapter_id = c.id
         JOIN subjects s ON c.subject_id = s.id
         JOIN templates t ON m.template_id = t.id
         WHERE m.chapter_id = ? AND s.user_id = ?
         ORDER BY m.created_at DESC`
      )
      .bind(chapterId, userId)
      .all();
    } else {
      // List all mistakes for the user across all chapters/subjects
      mistakes = await env.DB.prepare(
        `SELECT m.*, c.name as chapter_name, s.name as subject_name, t.name as template_name, t.fields as template_fields
         FROM mistakes m
         JOIN chapters c ON m.chapter_id = c.id
         JOIN subjects s ON c.subject_id = s.id
         JOIN templates t ON m.template_id = t.id
         WHERE s.user_id = ?
         ORDER BY m.created_at DESC`
      )
      .bind(userId)
      .all();
    }

    // Parse the JSON string data and fields for response
    const results = mistakes.results.map((m: any) => ({
      ...m,
      data: JSON.parse(m.data),
      template_fields: JSON.parse(m.template_fields)
    }));

    return new Response(JSON.stringify(results), {
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

// POST /api/mistakes - Create a mistake record
export const onRequestPost: PagesFunction<Env, any, UserContext> = async (context) => {
  try {
    const { request, env, data } = context;
    const userId = data.user!.id;
    const { title, chapterId, templateId, data: mistakeData } = await request.json() as any;

    if (!title || title.trim() === '' || !chapterId || !templateId || !mistakeData) {
      return new Response(JSON.stringify({ error: 'title, chapterId, templateId, and data are required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 1. Verify chapter ownership
    const chapter = await env.DB.prepare(
      `SELECT 1 FROM chapters c 
       JOIN subjects s ON c.subject_id = s.id 
       WHERE c.id = ? AND s.user_id = ?`
    )
    .bind(chapterId, userId)
    .first();

    if (!chapter) {
      return new Response(JSON.stringify({ error: 'Chapter not found or access denied.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 2. Verify template ownership
    const template = await env.DB.prepare('SELECT 1 FROM templates WHERE id = ? AND user_id = ?')
      .bind(templateId, userId)
      .first();

    if (!template) {
      return new Response(JSON.stringify({ error: 'Template not found or access denied.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const id = crypto.randomUUID();
    const now = Date.now();
    const dataStr = typeof mistakeData === 'string' ? mistakeData : JSON.stringify(mistakeData);

    await env.DB.prepare(
      `INSERT INTO mistakes (id, chapter_id, template_id, title, data, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(id, chapterId, templateId, title.trim(), dataStr, now, now)
    .run();

    return new Response(JSON.stringify({
      success: true,
      mistake: {
        id,
        chapter_id: chapterId,
        template_id: templateId,
        title: title.trim(),
        data: typeof mistakeData === 'string' ? JSON.parse(mistakeData) : mistakeData,
        created_at: now,
        updated_at: now
      }
    }), {
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

// PUT /api/mistakes - Update a mistake record
export const onRequestPut: PagesFunction<Env, any, UserContext> = async (context) => {
  try {
    const { request, env, data } = context;
    const userId = data.user!.id;
    const { id, title, data: mistakeData } = await request.json() as any;

    if (!id || !title || title.trim() === '' || !mistakeData) {
      return new Response(JSON.stringify({ error: 'id, title, and data are required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const dataStr = typeof mistakeData === 'string' ? mistakeData : JSON.stringify(mistakeData);
    const now = Date.now();

    // Update mistake only if it belongs to the current user
    const result = await env.DB.prepare(
      `UPDATE mistakes 
       SET title = ?, data = ?, updated_at = ? 
       WHERE id = ? 
       AND EXISTS (
         SELECT 1 FROM chapters c 
         JOIN subjects s ON c.subject_id = s.id 
         WHERE c.id = mistakes.chapter_id 
         AND s.user_id = ?
       )`
    )
    .bind(title.trim(), dataStr, now, id, userId)
    .run();

    if (result.meta.changes === 0) {
      return new Response(JSON.stringify({ error: 'Mistake record not found or access denied.' }), {
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

// DELETE /api/mistakes?id=xxx - Delete a mistake record
export const onRequestDelete: PagesFunction<Env, any, UserContext> = async (context) => {
  try {
    const { request, env, data } = context;
    const userId = data.user!.id;
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return new Response(JSON.stringify({ error: 'Mistake id is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Delete mistake only if it belongs to the current user
    const result = await env.DB.prepare(
      `DELETE FROM mistakes 
       WHERE id = ? 
       AND EXISTS (
         SELECT 1 FROM chapters c 
         JOIN subjects s ON c.subject_id = s.id 
         WHERE c.id = mistakes.chapter_id 
         AND s.user_id = ?
       )`
    )
    .bind(id, userId)
    .run();

    if (result.meta.changes === 0) {
      return new Response(JSON.stringify({ error: 'Mistake record not found or access denied.' }), {
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
