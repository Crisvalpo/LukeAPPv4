import { createServer } from 'node:http';
import WebSocket from 'ws';
// @supabase/supabase-js instancia un RealtimeClient internamente (aunque no se use)
// y requiere `WebSocket` global. Node < 22 no lo trae nativo — se polyfillea con `ws`.
if (!globalThis.WebSocket) globalThis.WebSocket = WebSocket;
import { createClient } from '@supabase/supabase-js';
import { extraerDeGemini, embedTexto } from './gemini.js';

const MIN_CHARS_CHUNK = 30; // paginas casi vacias (portada, separadores) no se indexan

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

// Indexa el texto de cada pagina como un chunk de doc_chunks con su embedding,
// para busqueda semantica (RAG). Un chunk por pagina es suficiente granularidad
// para especificaciones tecnicas tipicas (paginas de ~1-4 mil caracteres).
async function guardarChunks(supabase, documentoId, proyectoId, paginasTexto, onProgreso) {
  // Limpiar chunks de un procesamiento anterior del mismo documento antes de reindexar
  await supabase.from('doc_chunks').delete().eq('documento_id', documentoId);

  const chunksParaInsertar = [];
  let nroChunk = 0;

  // Procesamos los embeddings en paralelo de a 8 páginas a la vez para máxima velocidad
  const CONCURRENCY_LIMIT = 8;
  for (let i = 0; i < paginasTexto.length; i += CONCURRENCY_LIMIT) {
    const lote = paginasTexto.slice(i, i + CONCURRENCY_LIMIT);
    
    if (onProgreso) {
      await onProgreso(`Generando embeddings: pág. ${i + 1} a ${Math.min(i + CONCURRENCY_LIMIT, paginasTexto.length)} de ${paginasTexto.length}...`);
    }

    await Promise.all(
      lote.map(async (pagina) => {
        const texto = (pagina.texto ?? '').trim();
        if (texto.length < MIN_CHARS_CHUNK) return;

        try {
          const embedding = await embedTexto(texto);
          chunksParaInsertar.push({
            documento_id: documentoId,
            proyecto_id: proyectoId,
            nro_chunk: ++nroChunk,
            pagina_inicio: pagina.numero_pagina,
            pagina_fin: pagina.numero_pagina,
            contenido: texto,
            embedding,
          });
        } catch (e) {
          console.error('[ia-worker] falló embedding página', pagina.numero_pagina, e.message);
        }
      })
    );
    
    // Delay preventivo para no saturar rate limits
    await new Promise((resolve) => setTimeout(resolve, 80));
  }

  if (chunksParaInsertar.length > 0) {
    if (onProgreso) {
      await onProgreso(`Guardando indexación semántica en base de datos...`);
    }
    // Ordenar por número de chunk
    chunksParaInsertar.sort((a, b) => a.nro_chunk - b.nro_chunk);
    
    const { error } = await supabase.from('doc_chunks').insert(chunksParaInsertar);
    if (error) {
      throw new Error(`Error insertando chunks indexados: ${error.message}`);
    }
  }

  return chunksParaInsertar.length;
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

  const {
    fluidos, clases, diametrosNps, esquemasPintura, aislacionesExt, porcentajesNde, tiposPrueba, tiposUnion,
    revestimientosInt, referencias_externas, codigo_documento, paginasTexto, nPaginas,
  } = await extraerDeGemini(pdfBase64, async (progresoMsg) => {
    await supabase.from('doc_biblioteca')
      .update({ error_detalle: progresoMsg })
      .eq('id', documentoId);
  });

  const fuenteBase = { documento_id: documentoId, titulo: doc.titulo };
  const loteIds = [];

  const catalogosAProponer = [
    {
      tablaDestino: 'cat_fluido_servicio',
      items: fluidos,
      mapPayload: (f) => ({
        codigo: f.codigo,
        descripcion: f.descripcion ?? null,
        nombre: f.nombre ?? null,
        color_nombre: f.color_nombre ?? null,
        color_ral: f.color_ral ?? null,
      }),
    },
    {
      tablaDestino: 'cat_clase_piping',
      items: clases,
      mapPayload: (c) => ({
        codigo: c.codigo,
        descripcion: c.descripcion ?? null,
        fluido_codigo: c.fluido_codigo ?? null,
        presion_max: c.presion_max ?? null,
        temp_max: c.temp_max ?? null,
        material: c.material ?? null,
        presion_psi: c.presion_psi ?? null,
        aplicacion: c.aplicacion ?? null,
      }),
    },
    {
      tablaDestino: 'cat_diametros_nps',
      items: diametrosNps,
      mapPayload: (n) => ({
        nps: n.nps,
        nps_mm: n.nps_mm ?? null,
        tipo_material: n.tipo_material ?? null,
        unidad_medida: n.unidad_medida ?? null,
      }),
    },
    {
      tablaDestino: 'cat_esquema_pintura',
      items: esquemasPintura,
      mapPayload: (p) => ({
        codigo: p.codigo,
        descripcion: p.descripcion ?? null,
        capas: p.capas ?? null,
        sistema_aplicacion: p.sistema_aplicacion ?? null,
        preparacion_superficie: p.preparacion_superficie ?? null,
        espesor_total_um: p.espesor_total_um ?? null,
        detalle_capas: p.detalle_capas ?? null,
      }),
    },
    {
      tablaDestino: 'cat_aislacion_ext',
      items: aislacionesExt,
      mapPayload: (a) => ({
        codigo: a.codigo,
        descripcion: a.descripcion ?? null,
        restriccion_pintura: a.restriccion_pintura ?? null,
      }),
    },
    {
      tablaDestino: 'cat_porcentaje_nde',
      items: porcentajesNde,
      mapPayload: (p) => ({
        codigo: p.codigo,
        porcentaje: p.porcentaje ?? null,
        descripcion: p.descripcion ?? null,
        metodo: p.metodo ?? null,
        aplicacion: p.aplicacion ?? null,
        norma: p.norma ?? null,
      }),
    },
    {
      tablaDestino: 'cat_tipo_prueba',
      items: tiposPrueba,
      mapPayload: (t) => ({
        codigo: t.codigo,
        descripcion: t.descripcion ?? null,
        aplicacion: t.aplicacion ?? null,
        condicion_diseno: t.condicion_diseno ?? null,
        medio_fluido: t.medio_fluido ?? null,
      }),
    },
    {
      tablaDestino: 'cat_tipo_union',
      items: tiposUnion,
      mapPayload: (t) => ({
        codigo: t.codigo,
        descripcion: t.descripcion ?? null,
        acronimo: t.acronimo ?? null,
        tipo_uniones: t.tipo_uniones ?? null,
        metodo_trabajo: t.metodo_trabajo ?? null,
        nde_requerido: t.nde_requerido ?? null,
        aplicacion: t.aplicacion ?? null,
      }),
    },
    {
      tablaDestino: 'cat_revestimiento_int',
      items: revestimientosInt,
      mapPayload: (r) => ({
        codigo: r.codigo,
        descripcion: r.descripcion ?? null,
        especificacion: r.especificacion ?? null,
      }),
    },
  ];

  for (const { tablaDestino, items, mapPayload } of catalogosAProponer) {
    if (items.length === 0) continue;
    const filas = items.map((item) => ({
      payload: mapPayload(item),
      fuente: { ...fuenteBase, paginas: item.paginas ?? [], contexto: item.contexto ?? null },
      confianza: typeof item.confianza === 'number' ? item.confianza : null,
    }));
    const { data: loteId, error: errLote } = await supabase.rpc('importar_crear_lote_ia', {
      p_proyecto_id: doc.proyecto_id,
      p_tabla_destino: tablaDestino,
      p_documento_id: documentoId,
      p_filas: filas,
    });
    if (errLote) throw new Error(`Error creando lote de ${tablaDestino}: ${errLote.message}`);
    loteIds.push(loteId);
  }

  // Guardar referencias externas detectadas
  if (referencias_externas && referencias_externas.length > 0) {
    const refsParaInsertar = referencias_externas
      .filter((ref) => ref.codigo_documento && ref.codigo_documento.trim() !== '')
      .map((ref) => ({
        proyecto_id: doc.proyecto_id,
        documento_id: documentoId,
        codigo_documento: ref.codigo_documento.toUpperCase().trim(),
        titulo: ref.titulo ? ref.titulo.trim() : null,
        catalogo_sugerido: ref.catalogo_sugerido ? ref.catalogo_sugerido.trim() : null,
        pagina: ref.paginas?.[0] ?? null,
        cita: ref.contexto ? ref.contexto.trim() : null,
        estado: 'pendiente'
      }));

    if (refsParaInsertar.length > 0) {
      const { error: errRef } = await supabase
        .from('documento_referencias')
        .upsert(refsParaInsertar, { onConflict: 'proyecto_id,documento_id,codigo_documento' });
      if (errRef) {
        console.error('[ia-worker] error insertando referencias:', errRef.message);
      }
    }
  }

  const nChunks = await guardarChunks(supabase, documentoId, doc.proyecto_id, paginasTexto, async (msg) => {
    await supabase.from('doc_biblioteca')
      .update({ error_detalle: msg })
      .eq('id', documentoId);
  });

  if (loteIds.length === 0 && nChunks === 0) {
    await supabase.from('doc_biblioteca')
      .update({
        estado_procesamiento: 'error',
        error_detalle: 'Gemini no encontró catálogos técnicos (fluidos, clases, NPS, pintura, aislación, NDE, prueba, unión) ni texto indexable en el documento.',
        n_paginas: nPaginas ?? paginasTexto.length,
      })
      .eq('id', documentoId);
    return { loteIds: [], nChunks, nPaginas };
  }

  // Con lotes de staging hay algo que aprobar; sin lotes pero con chunks, el
  // documento ya quedo indexado para busqueda semantica (nada que aprobar).
  await supabase.from('doc_biblioteca')
    .update({
      codigo: codigo_documento ? codigo_documento.toUpperCase().trim() : null,
      estado_procesamiento: loteIds.length > 0 ? 'lote_generado' : 'procesado',
      n_paginas: nPaginas ?? paginasTexto.length,
      n_chunks: nChunks,
      error_detalle: null,
      metadata: { ...(doc.metadata ?? {}), ...(loteIds.length > 0 ? { lotes_ia: loteIds } : {}) },
    })
    .eq('id', documentoId);

  return { loteIds, nChunks, nPaginas };
}

async function buscarEnBiblioteca(jwt, proyectoId, query, limite) {
  const supabase = clienteComoUsuario(jwt);
  const embedding = await embedTexto(query);
  const { data, error } = await supabase.rpc('buscar_chunks_similares', {
    p_proyecto_id: proyectoId,
    p_embedding: embedding,
    p_limite: limite ?? 8,
    p_umbral: 0.5,
  });
  if (error) throw new Error(error.message);
  return data ?? [];
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

  if (req.method === 'POST' && req.url === '/buscar') {
    const auth = req.headers.authorization || '';
    const jwt = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!jwt) {
      res.writeHead(401, { ...headers, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Falta el header Authorization: Bearer <token>' }));
      return;
    }

    let body = '';
    for await (const chunk of req) body += chunk;
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      res.writeHead(400, { ...headers, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Body inválido, se espera { proyecto_id, query }' }));
      return;
    }
    if (!parsed.proyecto_id || !parsed.query?.trim()) {
      res.writeHead(400, { ...headers, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Faltan proyecto_id o query' }));
      return;
    }

    try {
      const resultados = await buscarEnBiblioteca(jwt, parsed.proyecto_id, parsed.query, parsed.limite);
      res.writeHead(200, { ...headers, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ resultados }));
    } catch (e) {
      console.error('[ia-worker] error en busqueda', e);
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
