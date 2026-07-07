interface Env {
  BUCKET: R2Bucket;
}

export const onRequestGet: PagesFunction<Env, 'key'> = async (context) => {
  try {
    const { env, params } = context;
    const key = params.key as string;

    if (!key) {
      return new Response('Missing image key', { status: 400 });
    }

    // Get the object from Cloudflare R2
    const object = await env.BUCKET.get(key);

    if (!object) {
      return new Response('Image not found', { status: 404 });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('Cache-Control', 'public, max-age=604800'); // Cache on client for 1 week
    headers.set('Access-Control-Allow-Origin', '*');

    return new Response(object.body, {
      headers
    });
  } catch (e: any) {
    return new Response(e.message || 'Internal Server Error', { status: 500 });
  }
};
