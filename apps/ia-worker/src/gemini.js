const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001';
const EMBEDDING_DIMS = 768; // debe calzar con lukeapp.doc_chunks.embedding vector(768)

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
    paginas_texto: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          numero_pagina: { type: 'INTEGER' },
          texto: { type: 'STRING' },
        },
        required: ['numero_pagina', 'texto'],
      },
    },
  },
  required: ['fluidos', 'clases', 'paginas_texto'],
};

const PROMPT = `Eres un ingeniero de proyecto revisando un documento técnico de piping industrial (minería, refinería o celulosa) — puede ser una especificación de materiales, un procedimiento de fabricación/soldadura, un estándar, etc.

Extrae del documento adjunto:
1. Todos los códigos de FLUIDOS/SERVICIOS mencionados explícitamente (ej: AG = Agua de proceso, CT = Concentrado), con su descripción. Si el documento no define fluidos, devuelve un arreglo vacío.
2. Todas las CLASES DE PIPING mencionadas explícitamente (ej: A1, C1), con su descripción, el código de fluido/servicio asociado si se menciona (fluido_codigo), y la presión máxima de diseño (presion_max) y temperatura máxima de diseño (temp_max) si se indican — como valores numéricos simples, sin unidades. Si el documento no define clases de piping, devuelve un arreglo vacío.
3. El TEXTO COMPLETO de cada página del documento en "paginas_texto" (numero_pagina empezando en 1, texto plano sin encabezados/pies de página repetidos ni marcas de agua de control documental — solo el contenido técnico sustantivo de cada página). Esto se usa para indexar el documento y permitir búsquedas posteriores, así que sé fiel y completo con el contenido técnico (requisitos, normas citadas, procedimientos, tablas descritas en texto), aunque no haya fluidos ni clases de piping en esta página.

Para cada propuesta de fluido o clase indica:
- "paginas": número(s) de página del PDF donde aparece la definición (empezando en 1).
- "contexto": una cita textual breve (máx. 200 caracteres) que respalde el dato.
- "confianza": 0.0 a 1.0, qué tan seguro estás de que el código y los datos son correctos y están completos.

No inventes códigos que no estén explícitamente en el documento. Responde solo con el JSON solicitado.`;

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
      maxOutputTokens: 65536, // tope del modelo
      // Esta tarea es extracción/transcripción, no razonamiento — sin esto, gemini-2.5-flash
      // gasta gran parte del presupuesto de salida en "thinking" y trunca el JSON a medio
      // camino en documentos largos con tablas densas (visto con un doc de 21 páginas:
      // 35k tokens de thinking, MAX_TOKENS, JSON cortado).
      thinkingConfig: { thinkingBudget: 0 },
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
    paginasTexto: Array.isArray(parsed.paginas_texto) ? parsed.paginas_texto : [],
    nPaginas: typeof parsed.n_paginas_documento === 'number' ? parsed.n_paginas_documento : null,
  };
}

export async function embedTexto(texto) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${EMBEDDING_MODEL}`,
      content: { parts: [{ text: texto }] },
      outputDimensionality: EMBEDDING_DIMS,
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Gemini embeddings error ${res.status}: ${errText.slice(0, 300)}`);
  }
  const data = await res.json();
  const values = data?.embedding?.values;
  if (!Array.isArray(values)) throw new Error('Gemini no devolvió un embedding válido');
  return values;
}
