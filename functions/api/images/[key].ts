interface Env {
  DB: D1Database;
}

export const onRequestGet: PagesFunction<Env, 'key'> = async (context) => {
  try {
    const { env, params } = context;
    const key = params.key as string;

    if (!key) {
      return new Response('Missing image key', { status: 400 });
    }

    // Get the object from D1 database
    const image = await env.DB.prepare(
      'SELECT data, mime_type FROM images WHERE key = ?'
    ).bind(key).first<{ data: ArrayBuffer; mime_type: string }>();

    if (!image) {
      return new Response('Image not found', { status: 404 });
    }

    const headers = new Headers();
    headers.set('Content-Type', image.mime_type);
    headers.set('Cache-Control', 'public, max-age=604800'); // Cache on client for 1 week
    headers.set('Access-Control-Allow-Origin', '*');

    return new Response(image.data, {
      headers
    });
  } catch (e: any) {
    return new Response(e.message || 'Internal Server Error', { status: 500 });
  }
};
