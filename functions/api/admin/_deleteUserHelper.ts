export async function deleteUserAndData(userId: string, db: D1Database): Promise<void> {
  // 1. Find all mistakes belonging to the user
  const mistakes = await db.prepare(
    `SELECT m.data 
     FROM mistakes m
     JOIN chapters c ON m.chapter_id = c.id
     JOIN subjects s ON c.subject_id = s.id
     WHERE s.user_id = ?`
  )
  .bind(userId)
  .all();

  const imageKeys = new Set<string>();
  const uuidImageRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]+$/i;

  function extractImageKeys(val: any): void {
    if (typeof val === 'string') {
      if (uuidImageRegex.test(val)) {
        imageKeys.add(val);
      }
    } else if (Array.isArray(val)) {
      for (const item of val) {
        extractImageKeys(item);
      }
    } else if (val !== null && typeof val === 'object') {
      for (const key of Object.keys(val)) {
        extractImageKeys(val[key]);
      }
    }
  }

  if (mistakes.results) {
    for (const m of mistakes.results) {
      try {
        const parsed = JSON.parse(m.data as string);
        extractImageKeys(parsed);
      } catch (e) {
        // ignore parsing errors
      }
    }
  }

  // 2. Delete images from 'images' table
  if (imageKeys.size > 0) {
    const keysArray = Array.from(imageKeys);
    // Delete in chunks of 100 to avoid query size limits
    for (let i = 0; i < keysArray.length; i += 100) {
      const chunk = keysArray.slice(i, i + 100);
      const placeholders = chunk.map(() => '?').join(',');
      await db.prepare(`DELETE FROM images WHERE key IN (${placeholders})`).bind(...chunk).run();
    }
  }

  // 3. Delete the user from the 'users' table
  await db.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();
}
