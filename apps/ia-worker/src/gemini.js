const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_MODEL_PRO = process.env.GEMINI_MODEL_PRO || 'gemini-1.5-pro';
const EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001';
const EMBEDDING_DIMS = 768; // debe calzar con lukeapp.doc_chunks.embedding vector(768)

const SCHEMA_CATALOGO = {
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

const SCHEMA_TEXTO = {
  type: 'OBJECT',
  properties: {
    n_paginas_documento: { type: 'INTEGER' },
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
  required: ['paginas_texto'],
};

const PROMPT_CATALOGO = `Eres un ingeniero de proyecto revisando un documento técnico de un proyecto industrial (minería, refinería o celulosa). El documento puede ser de cualquier tipo: una especificación de materiales de piping, un procedimiento de fabricación/soldadura, un estándar, un diccionario de codificación de paquetes de trabajo (AWP/CWP/WBS), un cronograma, un listado de equipos, etc. NO asumas que el documento trata sobre fluidos o piping — la mayoría de los documentos de un proyecto NO lo hacen.

Extrae del documento adjunto:

1. FLUIDOS/SERVICIOS: únicamente si el documento define formalmente un CATÁLOGO o TABLA DE CÓDIGOS de fluidos/servicios de proceso para líneas de cañerías — es decir, un código corto y deliberado (típicamente 1 a 4 letras/números, ej: "AG", "CT", "ND", "PW") asignado explícitamente a un fluido o servicio, normalmente en una tabla o lista de definiciones de una especificación de materiales de cañerías.
   NO propongas un fluido solo porque la palabra "agua", "aire", "pulpa", "reactivos", "ácido", etc. aparece mencionada en texto libre, en la descripción de un paquete de trabajo, en un plano, o en cualquier otro contexto que no sea la definición formal de un código de catálogo. Si tienes dudas sobre si algo es un código de catálogo real, NO lo incluyas.
   Documentos como diccionarios AWP/CWP, cronogramas, listados de equipos, MTOs, o especificaciones de fabricación/soldadura NUNCA definen códigos de fluidos — en esos casos el arreglo de fluidos debe quedar vacío.

2. CLASES DE PIPING: únicamente si el documento define formalmente un CATÁLOGO de clases de piping (ej: "A1", "C1"), normalmente con su rating, material, servicio asociado, presión/temperatura máxima de diseño. Igual criterio estricto que para fluidos: solo códigos de catálogo formalmente definidos, nunca menciones incidentales. Si se menciona, incluye el código de fluido/servicio asociado (fluido_codigo) y presión/temperatura máxima de diseño (presion_max/temp_max) como valores numéricos simples, sin unidades.

Para cada propuesta de fluido o clase (si las hay) indica:
- "paginas": número(s) de página del PDF donde aparece la definición formal del código (empezando en 1).
- "contexto": una cita textual breve (máx. 200 caracteres) que muestre la definición formal del código, no una mención incidental.
- "confianza": 0.0 a 1.0. Usa menos de 0.5 si tienes cualquier duda sobre si es realmente un código de catálogo formal.

No inventes códigos que no estén explícitamente definidos como tales en el documento. Responde solo con el JSON solicitado.`;

const PROMPT_TEXTO = `Extrae el TEXTO COMPLETO de cada página del documento en "paginas_texto" (numero_pagina empezando en 1, texto plano sin encabezados/pies de página repetidos ni marcas de agua de control documental — solo el contenido técnico sustantivo de cada página). Esto se usa para indexar el documento y permitir búsquedas posteriores en un sistema RAG para un bot de preguntas y respuestas, así que sé fiel, detallado y completo con el contenido técnico (requisitos, normas citadas, procedimientos, tablas descritas en texto, códigos de paquetes de trabajo, etc.). Responde solo con el JSON solicitado.`;

async function subirArchivoAGemini(pdfBase64) {
  const fileBuffer = Buffer.from(pdfBase64, 'base64');
  const metadata = {
    file: {
      mimeType: 'application/pdf',
      displayName: 'documento_ingenieria.pdf',
    },
  };

  console.log('[ia-worker] Iniciando subida a Gemini Files API...');
  const initRes = await fetch(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: {
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': fileBuffer.length.toString(),
        'X-Goog-Upload-Header-Content-Type': 'application/pdf',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metadata),
    }
  );

  if (!initRes.ok) {
    const errText = await initRes.text().catch(() => '');
    throw new Error(`Error iniciando subida a Gemini Files: ${initRes.status} ${errText}`);
  }

  const uploadUrl = initRes.headers.get('x-goog-upload-url');
  if (!uploadUrl) {
    throw new Error('No se recibió la URL de subida (x-goog-upload-url) de Gemini');
  }

  console.log('[ia-worker] Transmitiendo bytes del PDF a la API de archivos...');
  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Command': 'upload, finalize',
      'X-Goog-Upload-Offset': '0',
      'Content-Length': fileBuffer.length.toString(),
    },
    body: fileBuffer,
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text().catch(() => '');
    throw new Error(`Error transmitiendo archivo a Gemini Files: ${uploadRes.status} ${errText}`);
  }

  const uploadData = await uploadRes.json();
  const fileUri = uploadData.file.uri;
  const fileName = uploadData.file.name;

  // Polling si está en procesamiento
  let status = uploadData.file.state;
  while (status === 'PROCESSING') {
    console.log('[ia-worker] El archivo PDF se está indexando en los servidores de Google...');
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const pollRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${GEMINI_API_KEY}`
    );
    if (pollRes.ok) {
      const pollData = await pollRes.json();
      status = pollData.state;
    }
  }

  if (status === 'FAILED') {
    throw new Error('El procesamiento del archivo falló en los servidores de Google');
  }

  console.log('[ia-worker] Archivo subido con éxito y listo para su uso:', fileName);
  return { fileUri, fileName };
}

async function eliminarArchivoDeGemini(fileName) {
  try {
    console.log('[ia-worker] Eliminando archivo temporal de los servidores de Google:', fileName);
    await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${GEMINI_API_KEY}`,
      {
        method: 'DELETE',
      }
    );
  } catch (err) {
    console.warn('[ia-worker] No se pudo eliminar el archivo temporal de Gemini:', err.message);
  }
}

async function llamarGemini(modelo, prompt, responseSchema, fileUriOrBase64) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${GEMINI_API_KEY}`;
  
  const part = fileUriOrBase64.startsWith('https://generativelanguage') 
    ? { fileData: { mimeType: 'application/pdf', fileUri: fileUriOrBase64 } }
    : { inlineData: { mimeType: 'application/pdf', data: fileUriOrBase64 } };

  const body = {
    contents: [
      {
        parts: [
          part,
          { text: prompt },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema,
      temperature: 0.1,
      maxOutputTokens: 65536,
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
    throw new Error(`Gemini API error (${modelo}) ${res.status}: ${errText.slice(0, 500)}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    const bloqueo = data?.candidates?.[0]?.finishReason;
    throw new Error(`Gemini no devolvió contenido estructurado para el modelo ${modelo} (finishReason=${bloqueo ?? 'desconocido'})`);
  }

  let textToParse = text.trim();
  if (textToParse.startsWith('```')) {
    textToParse = textToParse.replace(/^```(json)?\s*/i, '').replace(/```$/, '').trim();
  }

  try {
    return JSON.parse(textToParse);
  } catch (errFirst) {
    try {
      const cleaned = textToParse.replace(/[\u0000-\u001F]+/g, (match) => {
        if (match === '\n') return '\\n';
        if (match === '\r') return '\\r';
        if (match === '\t') return '\\t';
        return '';
      });
      return JSON.parse(cleaned);
    } catch (errSecond) {
      console.error(`[ia-worker] Fallo crítico parseando JSON (${modelo}). Texto original:`, textToParse);
      throw new Error(`La respuesta de Gemini para ${modelo} no es JSON válido: ${errFirst.message}`);
    }
  }
}

export async function extraerDeGemini(pdfBase64, onProgreso) {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY no configurada en el servidor');

  let fileName = null;
  let fileUri = null;

  try {
    if (onProgreso) {
      await onProgreso('Subiendo PDF a la API de archivos de Google...');
    }
    const uploadInfo = await subirArchivoAGemini(pdfBase64);
    fileUri = uploadInfo.fileUri;
    fileName = uploadInfo.fileName;

    if (onProgreso) {
      await onProgreso('Fase 1: Extrayendo Catálogo con Gemini Pro...');
    }
    console.log('[ia-worker] Iniciando Fase 1: Extracción de fluidos y clases con Gemini Pro...');
    let catalogo;
    try {
      catalogo = await llamarGemini(GEMINI_MODEL_PRO, PROMPT_CATALOGO, SCHEMA_CATALOGO, fileUri);
    } catch (err) {
      console.warn('[ia-worker] Gemini Pro falló para la extracción del catálogo. Intentando fallback con Flash...', err.message);
      if (onProgreso) {
        await onProgreso('Fase 1 (Fallback): Extrayendo Catálogo con Gemini Flash...');
      }
      catalogo = await llamarGemini(GEMINI_MODEL, PROMPT_CATALOGO, SCHEMA_CATALOGO, fileUri);
    }

    // Determinar número de páginas
    let nPaginas = catalogo?.n_paginas_documento;
    if (typeof nPaginas !== 'number' || nPaginas <= 0) {
      try {
        console.log('[ia-worker] Determinando número de páginas del PDF con Gemini...');
        const responseNum = await llamarGemini(
          GEMINI_MODEL,
          '¿Cuántas páginas tiene exactamente este documento PDF? Responde únicamente con un número entero dentro del esquema JSON.',
          {
            type: 'OBJECT',
            properties: { paginas: { type: 'INTEGER' } },
            required: ['paginas'],
          },
          fileUri
        );
        nPaginas = responseNum?.paginas || 1;
      } catch (errNum) {
        console.warn('[ia-worker] No se pudo determinar el número de páginas con Gemini, asumiendo 1.', errNum.message);
        nPaginas = 1;
      }
    }

    console.log(`[ia-worker] Iniciando Fase 2: Extracción de texto por lotes para RAG (Total páginas: ${nPaginas})...`);
    const paginasTexto = [];
    const TAMANIO_LOTE = 5;

    for (let i = 1; i <= nPaginas; i += TAMANIO_LOTE) {
      const inicio = i;
      const fin = Math.min(i + TAMANIO_LOTE - 1, nPaginas);
      console.log(`[ia-worker] Extrayendo páginas ${inicio} a ${fin} de ${nPaginas}...`);

      if (onProgreso) {
        await onProgreso(`Fase 2: Extrayendo texto páginas ${inicio}-${fin} de ${nPaginas}...`);
      }

      const promptLote = `Extrae el TEXTO COMPLETO de las páginas desde la ${inicio} hasta la ${fin} (inclusive) de este documento en el arreglo "paginas_texto". Para cada página, especifica el "numero_pagina" real (empezando en 1) and el "texto" plano (sin marcas de agua ni encabezados repetitivos). Sé detallado y completo. Responde sólo con el JSON solicitado.`;

      try {
        const resLote = await llamarGemini(GEMINI_MODEL, promptLote, SCHEMA_TEXTO, fileUri);
        if (resLote && Array.isArray(resLote.paginas_texto)) {
          paginasTexto.push(...resLote.paginas_texto);
        }
      } catch (errLote) {
        console.error(`[ia-worker] Error en lote ${inicio}-${fin}:`, errLote.message, '- Intentando fallback individual...');
        // Fallback: procesar página por página del lote para no perder todo el lote
        for (let p = inicio; p <= fin; p++) {
          try {
            if (onProgreso) {
              await onProgreso(`Fase 2 (Fallback): Página ${p} de ${nPaginas}...`);
            }
            const promptIndiv = `Extrae el TEXTO COMPLETO de la página ${p} de este documento en el arreglo "paginas_texto". Especifica el "numero_pagina" real (que es ${p}) y el "texto" plano. Responde sólo con el JSON solicitado.`;
            const resIndiv = await llamarGemini(GEMINI_MODEL, promptIndiv, SCHEMA_TEXTO, fileUri);
            if (resIndiv && Array.isArray(resIndiv.paginas_texto)) {
              paginasTexto.push(...resIndiv.paginas_texto);
            }
          } catch (errIndiv) {
            console.error(`[ia-worker] Fallo crítico extrayendo página individual ${p}:`, errIndiv.message);
          }
        }
      }

      // Pequeña pausa para no saturar rate limits
      if (i + TAMANIO_LOTE <= nPaginas) {
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
    }

    // Ordenar las páginas por número de página para consistencia
    paginasTexto.sort((a, b) => (a.numero_pagina || 0) - (b.numero_pagina || 0));

    return {
      fluidos: Array.isArray(catalogo.fluidos) ? catalogo.fluidos : [],
      clases: Array.isArray(catalogo.clases) ? catalogo.clases : [],
      paginasTexto,
      nPaginas,
    };
  } finally {
    if (fileName) {
      await eliminarArchivoDeGemini(fileName);
    }
  }
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
