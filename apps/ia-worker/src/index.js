import { createServer } from 'node:http';
import { createClient } from '@supabase/supabase-js';
import { extraerDeGemini } from './gemini.js';

const PORT = Number(process.env.PORT || 8787);
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5174')
  .split(',').map((s) => s.trim()).filter(Boolean);

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Faltan SUPABASE_URL / SUPABASE_ANON_KEY en el entorno del ia-worker');
}

function clienteComoUsuario(jwt) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    db: { schema: 'lukeapp' },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  });
}

function corsHeaders(origin) {
  const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    Vary: 'Origin',
  };
}

async function marcarError(supabase, documentoId, mensaje) {
  await supabase.from('doc_biblioteca')
    .update({ estado_procesamiento: 'error', error_detalle: mensaje.slice(0, 2000) })
    .eq('id', documentoId);
}

async function bufferToBase64(arrayBuffer) {
  return Buffer.from(arrayBuffer).toString('base64');
}

async function procesarDocumento(jwt, documentoId) {
  const supabase = clienteComoUsuario(jwt);

  const { data: doc, error: errDoc } = await supabase
    .from('doc_biblioteca').select('*').eq('id', documentoId).single();
  if (errDoc || !doc) {
    throw new Error(errDoc?.message || 'Documento no encontrado o sin acceso');
  }

  // Verificar rol ADMIN/OT antes de gastar la llamada a Gemini (la RPC de staging
  // vuelve a exigir esto al crear el lote, pero conviene fallar rápido y barato).
  const { data: esEditor, error: errRol } = await supabase
    .rpc('importar_es_editor', { p_proyecto_id: doc.proyecto_id });
  if (errRol || !esEditor) {
    throw new Error('Requiere rol ADMIN u OT en el proyecto para procesar documentos con IA');
  }

  await supabase.from('doc_biblioteca')
    .update({ estado_procesamiento: 'procesando', error_detalle: null })
    .eq('id', documentoId);

  const { data: blob, error: errDownload } = await supabase.storage
    .from('documentos').download(doc.storage_path);
  if (errDownload) throw new Error(`No se pudo descargar el PDF: ${errDownload.message}`);

  const pdfBase64 = await bufferToBase64(await blob.arrayBuffer());

  await supabase.from('doc_biblioteca')
    .update({ estado_procesamiento: 'extrayendo' })
    .eq('id', documentoId);

  const { fluidos, clases, nPaginas } = await extraerDeGemini(pdfBase64);

  const fuenteBase = { documento_id: documentoId, titulo: doc.titulo };
  const loteIds = [];

  if (fluidos.length > 0) {
    const filas = fluidos.map((f) => ({
      payload: { codigo: f.codigo, descripcion: f.descripcion ?? null },
      fuente: { ...fuenteBase, paginas: f.paginas ?? [], contexto: f.contexto ?? null },
      confianza: typeof f.confianza === 'number' ? f.confianza : null,
    }));
    const { data: loteId, error: errLote } = await supabase.rpc('importar_crear_lote_ia', {
      p_proyecto_id: doc.proyecto_id,
      p_tabla_destino: 'cat_fluido_servicio',
      p_documento_id: documentoId,
      p_filas: filas,
    });
    if (errLote) throw new Error(`Error creando lote de fluidos: ${errLote.message}`);
    loteIds.push(loteId);
  }

  if (clases.length > 0) {
    const filas = clases.map((c) => ({
      payload: {
        codigo: c.codigo,
        descripcion: c.descripcion ?? null,
        fluido_codigo: c.fluido_codigo ?? null,
        presion_max: c.presion_max ?? null,
        temp_max: c.temp_max ?? null,
      },
      fuente: { ...fuenteBase, paginas: c.paginas ?? [], contexto: c.contexto ?? null },
      confianza: typeof c.confianza === 'number' ? c.confianza : null,
    }));
    const { data: loteId, error: errLote } = await supabase.rpc('importar_crear_lote_ia', {
      p_proyecto_id: doc.proyecto_id,
      p_tabla_destino: 'cat_clase_piping',
      p_documento_id: documentoId,
      p_filas: filas,
    });
    if (errLote) throw new Error(`Error creando lote de clases: ${errLote.message}`);
    loteIds.push(loteId);
  }

  if (loteIds.length === 0) {
    await supabase.from('doc_biblioteca')
      .update({
        estado_procesamiento: 'error',
        error_detalle: 'Gemini no encontró fluidos ni clases de piping en el documento.',
        n_paginas: nPaginas,
      })
      .eq('id', documentoId);
    return { loteIds: [], nPaginas };
  }

  await supabase.from('doc_biblioteca')
    .update({
      estado_procesamiento: 'lote_generado',
      n_paginas: nPaginas,
      metadata: { ...(doc.metadata ?? {}), lotes_ia: loteIds },
    })
    .eq('id', documentoId);

  return { loteIds, nPaginas };
}

const server = createServer(async (req, res) => {
  const origin = req.headers.origin || '';
  const headers = corsHeaders(origin);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, headers);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { ...headers, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.method === 'POST' && req.url === '/procesar') {
    const auth = req.headers.authorization || '';
    const jwt = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!jwt) {
      res.writeHead(401, { ...headers, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Falta el header Authorization: Bearer <token>' }));
      return;
    }

    let body = '';
    for await (const chunk of req) body += chunk;
    let documentoId;
    try {
      documentoId = JSON.parse(body).documento_id;
    } catch {
      res.writeHead(400, { ...headers, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Body inválido, se espera { "documento_id": "uuid" }' }));
      return;
    }
    if (!documentoId) {
      res.writeHead(400, { ...headers, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Falta documento_id' }));
      return;
    }

    try {
      const resultado = await procesarDocumento(jwt, documentoId);
      res.writeHead(200, { ...headers, 'Content-Type': 'application/json' });
      res.end(JSON.stringify(resultado));
    } catch (e) {
      console.error('[ia-worker] error procesando documento', documentoId, e);
      try {
        await marcarError(clienteComoUsuario(jwt), documentoId, e.message);
      } catch { /* best effort */ }
      res.writeHead(500, { ...headers, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  res.writeHead(404, headers);
  res.end();
});

server.listen(PORT, () => {
  console.log(`[ia-worker] escuchando en :${PORT}`);
});
