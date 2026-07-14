const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    n_paginas_documento: { type: 'INTEGER' },
    fluidos: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          codigo: { type: 'STRING' },
          descripcion: { type: 'STRING' },
          paginas: { type: 'ARRAY', items: { type: 'INTEGER' } },
          contexto: { type: 'STRING' },
          confianza: { type: 'NUMBER' },
        },
        required: ['codigo', 'confianza'],
      },
    },
    clases: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          codigo: { type: 'STRING' },
          descripcion: { type: 'STRING' },
          fluido_codigo: { type: 'STRING' },
          presion_max: { type: 'NUMBER' },
          temp_max: { type: 'NUMBER' },
          paginas: { type: 'ARRAY', items: { type: 'INTEGER' } },
          contexto: { type: 'STRING' },
          confianza: { type: 'NUMBER' },
        },
        required: ['codigo', 'confianza'],
      },
    },
  },
  required: ['fluidos', 'clases'],
};

const PROMPT = `Eres un ingeniero de proyecto revisando una especificación técnica de piping industrial (minería, refinería o celulosa).

Extrae del documento adjunto:
1. Todos los códigos de FLUIDOS/SERVICIOS mencionados explícitamente (ej: AG = Agua de proceso, CT = Concentrado), con su descripción.
2. Todas las CLASES DE PIPING mencionadas explícitamente (ej: A1, C1), con su descripción, el código de fluido/servicio asociado si se menciona (fluido_codigo), y la presión máxima de diseño (presion_max) y temperatura máxima de diseño (temp_max) si se indican — como valores numéricos simples, sin unidades.

Para cada propuesta (fluido o clase) indica:
- "paginas": número(s) de página del PDF donde aparece la definición (empezando en 1).
- "contexto": una cita textual breve (máx. 200 caracteres) que respalde el dato.
- "confianza": 0.0 a 1.0, qué tan seguro estás de que el código y los datos son correctos y están completos.

No inventes códigos que no estén explícitamente en el documento. Si no hay clases o fluidos definidos, devuelve arreglos vacíos. Responde solo con el JSON solicitado.`;

export async function extraerDeGemini(pdfBase64) {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY no configurada en el servidor');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const body = {
    contents: [
      {
        parts: [
          { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } },
          { text: PROMPT },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0.1,
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Gemini API error ${res.status}: ${errText.slice(0, 500)}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    const bloqueo = data?.candidates?.[0]?.finishReason;
    throw new Error(`Gemini no devolvió contenido estructurado (finishReason=${bloqueo ?? 'desconocido'})`);
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('La respuesta de Gemini no es JSON válido');
  }
  return {
    fluidos: Array.isArray(parsed.fluidos) ? parsed.fluidos : [],
    clases: Array.isArray(parsed.clases) ? parsed.clases : [],
    nPaginas: typeof parsed.n_paginas_documento === 'number' ? parsed.n_paginas_documento : null,
  };
}
