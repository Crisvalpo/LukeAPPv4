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

const PROMPT = `Eres un ingeniero de proyecto revisando un documento técnico de un proyecto industrial (minería, refinería o celulosa). El documento puede ser de cualquier tipo: una especificación de materiales de piping, un procedimiento de fabricación/soldadura, un estándar, un diccionario de codificación de paquetes de trabajo (AWP/CWP/WBS), un cronograma, un listado de equipos, etc. NO asumas que el documento trata sobre fluidos o piping — la mayoría de los documentos de un proyecto NO lo hacen.

Extrae del documento adjunto:

1. FLUIDOS/SERVICIOS: únicamente si el documento define formalmente un CATÁLOGO o TABLA DE CÓDIGOS de fluidos/servicios de proceso para líneas de cañerías — es decir, un código corto y deliberado (típicamente 1 a 4 letras/números, ej: "AG", "CT", "ND", "PW") asignado explícitamente a un fluido o servicio, normalmente en una tabla o lista de definiciones de una especificación de materiales de cañerías.
   NO propongas un fluido solo porque la palabra "agua", "aire", "pulpa", "reactivos", "ácido", etc. aparece mencionada en texto libre, en la descripción de un paquete de trabajo, en un plano, o en cualquier otro contexto que no sea la definición formal de un código de catálogo. Si tienes dudas sobre si algo es un código de catálogo real, NO lo incluyas.
   Documentos como diccionarios AWP/CWP, cronogramas, listados de equipos, MTOs, o especificaciones de fabricación/soldadura NUNCA definen códigos de fluidos — en esos casos el arreglo de fluidos debe quedar vacío.

2. CLASES DE PIPING: únicamente si el documento define formalmente un CATÁLOGO de clases de piping (ej: "A1", "C1"), normalmente con su rating, material, servicio asociado, presión/temperatura máxima de diseño. Igual criterio estricto que para fluidos: solo códigos de catálogo formalmente definidos, nunca menciones incidentales. Si se menciona, incluye el código de fluido/servicio asociado (fluido_codigo) y presión/temperatura máxima de diseño (presion_max/temp_max) como valores numéricos simples, sin unidades.

3. El TEXTO COMPLETO de cada página del documento en "paginas_texto" (numero_pagina empezando en 1, texto plano sin encabezados/pies de página repetidos ni marcas de agua de control documental — solo el contenido técnico sustantivo de cada página). Esto se usa para indexar el documento y permitir búsquedas posteriores, así que sé fiel y completo con el contenido técnico (requisitos, normas citadas, procedimientos, tablas descritas en texto, códigos de paquetes de trabajo, etc.), independientemente de si hay fluidos o clases de piping en esta página — la gran mayoría de los documentos no los tendrán, y eso es normal.

Para cada propuesta de fluido o clase (si las hay) indica:
- "paginas": número(s) de página del PDF donde aparece la definición formal del código (empezando en 1).
- "contexto": una cita textual breve (máx. 200 caracteres) que muestre la definición formal del código, no una mención incidental.
- "confianza": 0.0 a 1.0. Usa menos de 0.5 si tienes cualquier duda sobre si es realmente un código de catálogo formal.

No inventes códigos que no estén explícitamente definidos como tales en el documento. Responde solo con el JSON solicitado.`;

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
  let textToParse = text.trim();
  if (textToParse.startsWith('```')) {
    textToParse = textToParse.replace(/^```(json)?\s*/i, '').replace(/```$/, '').trim();
  }

  try {
    parsed = JSON.parse(textToParse);
  } catch (errFirst) {
    try {
      // Reemplazar saltos de línea y tabuladores crudos que rompen el parser JSON
      const cleaned = textToParse.replace(/[\u0000-\u001F]+/g, (match) => {
        if (match === '\n') return '\\n';
        if (match === '\r') return '\\r';
        if (match === '\t') return '\\t';
        return '';
      });
      parsed = JSON.parse(cleaned);
    } catch (errSecond) {
      console.error('[ia-worker] Fallo crítico parseando JSON. Texto de Gemini:', textToParse);
      throw new Error(`La respuesta de Gemini no es JSON válido: ${errFirst.message}`);
    }
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
