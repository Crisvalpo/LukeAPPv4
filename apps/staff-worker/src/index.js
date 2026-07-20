import { createServer } from 'node:http';
import { createClient } from '@supabase/supabase-js';
import { procesarEventoBuk, procesarMarcajeAsistencia } from './buk.js';
import { procesarMensajeWhatsapp } from './bot.js';

const PORT = Number(process.env.PORT || 3030);
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUK_WEBHOOK_SECRET = process.env.BUK_WEBHOOK_SECRET || 'buk_secret_local_dev';
const WA_BRIDGE_SECRET = process.env.WA_BRIDGE_SECRET || 'wa_secret_local_dev';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en el entorno del staff-worker');
}

// Cliente de Supabase con Service Role para saltarse RLS en operaciones del sistema (webhooks)
export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  db: { schema: 'lukeapp' },
  auth: { persistSession: false },
});

const server = createServer(async (req, res) => {
  const { method, url } = req;

  // Headers CORS básicos por si el panel web o herramientas locales le consultan
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-wa-bridge-secret, x-buk-signature',
  };

  if (method === 'OPTIONS') {
    res.writeHead(204, headers);
    res.end();
    return;
  }

  // 1. Health check
  if (method === 'GET' && url === '/health') {
    res.writeHead(200, headers);
    res.end(JSON.stringify({ ok: true, service: 'staff-worker' }));
    return;
  }

  // Leer body para los endpoints POST
  let body = '';
  try {
    for await (const chunk of req) {
      body += chunk;
    }
  } catch (err) {
    res.writeHead(500, headers);
    res.end(JSON.stringify({ error: 'Error leyendo payload' }));
    return;
  }

  // 2. Webhook de Buk (Sincronización de personal/contratos)
  if (method === 'POST' && url === '/api/webhooks/buk') {
    // Validación de firma de Buk (si se provee)
    const signature = req.headers['x-buk-signature'];
    if (BUK_WEBHOOK_SECRET && signature !== BUK_WEBHOOK_SECRET) {
      res.writeHead(401, headers);
      res.end(JSON.stringify({ error: 'Firma de webhook de Buk inválida o ausente' }));
      return;
    }

    try {
      const payload = JSON.parse(body);
      const resultado = await procesarEventoBuk(payload);
      res.writeHead(200, headers);
      res.end(JSON.stringify({ ok: true, resultado }));
    } catch (err) {
      console.error('[staff-worker] Error procesando webhook de Buk:', err);
      res.writeHead(400, headers);
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // 3. Webhook de Asistencia Diaria
  if (method === 'POST' && url === '/api/webhooks/asistencia') {
    // Opcional: validar secreto
    const signature = req.headers['x-buk-signature'];
    if (BUK_WEBHOOK_SECRET && signature !== BUK_WEBHOOK_SECRET) {
      res.writeHead(401, headers);
      res.end(JSON.stringify({ error: 'Firma de asistencia inválida o ausente' }));
      return;
    }

    try {
      const payload = JSON.parse(body);
      const resultado = await procesarMarcajeAsistencia(payload);
      res.writeHead(200, headers);
      res.end(JSON.stringify({ ok: true, resultado }));
    } catch (err) {
      console.error('[staff-worker] Error procesando marcaje de asistencia:', err);
      res.writeHead(400, headers);
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // 4. Webhook de WhatsApp (proveniente del wa-bridge)
  if (method === 'POST' && url === '/api/webhooks/whatsapp') {
    const waSecret = req.headers['x-wa-bridge-secret'];
    if (WA_BRIDGE_SECRET && waSecret !== WA_BRIDGE_SECRET) {
      res.writeHead(401, headers);
      res.end(JSON.stringify({ error: 'Secreto de WhatsApp Bridge inválido o ausente' }));
      return;
    }

    try {
      const payload = JSON.parse(body);
      // Estructura esperada: { phone, message, senderPn, jid }
      const resultado = await procesarMensajeWhatsapp(payload);
      res.writeHead(200, headers);
      res.end(JSON.stringify({ ok: true, resultado }));
    } catch (err) {
      console.error('[staff-worker] Error procesando mensaje de WhatsApp:', err);
      res.writeHead(400, headers);
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // 5. Proxy de WhatsApp Bridge: Status
  if (method === 'GET' && url === '/api/bot/status') {
    try {
      const resp = await fetch('http://localhost:4000/personal/status');
      const data = await resp.json();
      res.writeHead(resp.status, headers);
      res.end(JSON.stringify(data));
    } catch (err) {
      res.writeHead(502, headers);
      res.end(JSON.stringify({ error: `Error conectando al puente de WhatsApp: ${err.message}` }));
    }
    return;
  }

  // 6. Proxy de WhatsApp Bridge: QR
  if (method === 'GET' && url === '/api/bot/qr') {
    try {
      const resp = await fetch('http://localhost:4000/personal/qr');
      const data = await resp.json();
      res.writeHead(resp.status, headers);
      res.end(JSON.stringify(data));
    } catch (err) {
      res.writeHead(502, headers);
      res.end(JSON.stringify({ error: `Error obteniendo el QR: ${err.message}` }));
    }
    return;
  }

  // 7. Proxy de WhatsApp Bridge: Restart/Desvincular
  if (method === 'POST' && url === '/api/bot/restart') {
    try {
      const resp = await fetch('http://localhost:4000/personal/restart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body
      });
      const data = await resp.json();
      res.writeHead(resp.status, headers);
      res.end(JSON.stringify(data));
    } catch (err) {
      res.writeHead(502, headers);
      res.end(JSON.stringify({ error: `Error al reiniciar la sesión: ${err.message}` }));
    }
    return;
  }

  // Ruta no encontrada
  res.writeHead(404, headers);
  res.end(JSON.stringify({ error: 'Not Found' }));
});

server.listen(PORT, () => {
  console.log(`[staff-worker] escuchando en puerto :${PORT}`);
});
