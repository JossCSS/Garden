// Netlify Function: guarda y lee el jardín en MongoDB Atlas.
// Ruta pública: /api/garden?id=<id-del-jardin>
//   GET  -> { state }   (null si aún no existe)
//   PUT  -> body { state } guarda el jardín completo
import { MongoClient } from 'mongodb';

let clientPromise = null;
function getClient() {
  if (!process.env.MONGODB_URI) throw new Error('Falta la variable MONGODB_URI');
  if (!clientPromise) {
    clientPromise = new MongoClient(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 5,
    }).connect().catch((e) => { clientPromise = null; throw e; });
  }
  return clientPromise;
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

const MAX_BYTES = 200_000;

export default async (req) => {
  const url = new URL(req.url);
  const id = url.searchParams.get('id') || '';
  if (!/^[\w-]{3,64}$/.test(id)) return json({ error: 'El id del jardín no es válido.' }, 400);

  let col;
  try {
    const client = await getClient();
    col = client.db(process.env.MONGODB_DB || 'jardin').collection('gardens');
  } catch (e) {
    return json({ error: 'No hay conexión con la base de datos.', detail: String(e.message || e) }, 503);
  }

  if (req.method === 'GET') {
    const doc = await col.findOne({ _id: id });
    return json({ state: doc ? doc.state : null, updatedAt: doc ? doc.updatedAt : null });
  }

  if (req.method === 'PUT' || req.method === 'POST') {
    const raw = await req.text();
    if (raw.length > MAX_BYTES) return json({ error: 'El jardín es demasiado grande para guardarse.' }, 413);
    let body;
    try { body = JSON.parse(raw); } catch { return json({ error: 'El cuerpo no es JSON válido.' }, 400); }
    const s = body && body.state;
    if (!s || typeof s !== 'object' || !Array.isArray(s.plants) || !Array.isArray(s.decor)) {
      return json({ error: 'Faltan datos del jardín.' }, 400);
    }
    // No dejamos que un dispositivo con datos viejos pise uno más nuevo
    const current = await col.findOne({ _id: id }, { projection: { 'state.updatedAt': 1 } });
    if (current && current.state && (current.state.updatedAt || 0) > (s.updatedAt || 0)) {
      return json({ ok: false, stale: true, state: (await col.findOne({ _id: id })).state }, 409);
    }
    await col.updateOne({ _id: id }, { $set: { state: s, updatedAt: new Date() } }, { upsert: true });
    return json({ ok: true });
  }

  return json({ error: 'Método no permitido.' }, 405);
};

export const config = { path: '/api/garden' };
