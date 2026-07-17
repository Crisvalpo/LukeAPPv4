import pdf from 'pdf-parse';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_MODEL_PRO = process.env.GEMINI_MODEL_PRO || 'gemini-2.5-flash';
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
    diametros_nps: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          nps: { type: 'STRING' },
          nps_mm: { type: 'NUMBER' },
          paginas: { type: 'ARRAY', items: { type: 'INTEGER' } },
          contexto: { type: 'STRING' },
          confianza: { type: 'NUMBER' },
        },
        required: ['nps', 'confianza'],
      },
    },
    esquemas_pintura: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          codigo: { type: 'STRING' },
          descripcion: { type: 'STRING' },
          capas: { type: 'INTEGER' },
          paginas: { type: 'ARRAY', items: { type: 'INTEGER' } },
          contexto: { type: 'STRING' },
          confianza: { type: 'NUMBER' },
        },
        required: ['codigo', 'confianza'],
      },
    },
    aislaciones_ext: {
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
    porcentajes_nde: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          codigo: { type: 'STRING' },
          porcentaje: { type: 'NUMBER' },
          descripcion: { type: 'STRING' },
          paginas: { type: 'ARRAY', items: { type: 'INTEGER' } },
          contexto: { type: 'STRING' },
          confianza: { type: 'NUMBER' },
        },
        required: ['codigo', 'porcentaje', 'confianza'],
      },
    },
    tipos_prueba: {
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
    tipos_union: {
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
    revestimientos_int: {
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
  },
  required: ['fluidos', 'clases', 'diametros_nps', 'esquemas_pintura', 'aislaciones_ext', 'porcentajes_nde', 'tipos_prueba', 'tipos_union', 'revestimientos_int'],
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

3. DIÁMETROS NPS: únicamente si el documento define formalmente una tabla de rangos de diámetros nominales cubiertos por una clase de piping o un listado de componentes asociados a diámetros específicos. Extrae cada diámetro nominal único mencionado (ej: "1/2\"", "2\"", "10\"", "24\"") en el campo "nps" y su equivalencia en milímetros en "nps_mm" si el documento la indica. NO propongas un diámetro por menciones incidentales fuera de una tabla o listado formal de rangos.

4. ESQUEMAS DE PINTURA: únicamente si el documento define formalmente un catálogo de esquemas de pintura o recubrimiento externo del mandante (ej: "P01", "System 1A"), normalmente en la sección de protección contra la corrosión y recubrimientos externos de las líneas. Incluye el número de capas recomendadas en "capas" si el documento lo indica.

5. AISLACIÓN EXTERIOR: únicamente si el documento define formalmente códigos y tipos de aislación térmica externa (ej: "IH" para conservación de calor, "IP" para protección de personal, "IC" para conservación de frío), normalmente en la sección de aislamiento térmico de cañerías y especificaciones de conservación de temperatura.

6. PORCENTAJE NDE (Ensayos No Destructivos): únicamente si el documento define formalmente, en la sección de control de calidad (QA/QC) y pruebas no destructivas, el código del ensayo y el porcentaje de inspección radiográfica o de ultrasonido exigido para las juntas de soldadura (ej: "100% RT" para líneas críticas, "10% RT" para categoría D). El campo "porcentaje" es obligatorio y debe ser un número entre 0 y 100.

7. TIPOS DE PRUEBA DE PRESIÓN: únicamente si el documento define formalmente, en las secciones de comisionamiento y pruebas de presión finales de las líneas, los códigos de prueba mecánica aceptados (ej: "HY" para prueba hidrostática, "PN" para neumática, "LK" para leak-test de servicio).

8. TIPOS DE UNIÓN: únicamente si el documento define formalmente, en el listado de componentes y conexiones admitidas para cada rango de diámetro de una clase, los tipos de unión estructural de las cañerías (ej: "BW" soldadura a tope, "SW" embutido soldable, "THR" roscado, "FLG" bridas).

9. REVESTIMIENTO INTERIOR: únicamente si el documento define formalmente códigos de revestimiento/recubrimiento INTERIOR de la cañería (ej: revestimiento engomado, epóxico interior, cemento centrifugado), normalmente en la sección de protección interior contra la corrosión o abrasión del fluido transportado. NO confundir con la aislación térmica EXTERIOR (categoría 5): la aislación exterior conserva temperatura por fuera de la cañería, mientras que el revestimiento interior protege la superficie interna en contacto con el fluido — son conceptos distintos, con catálogos de códigos independientes.

Para cada propuesta (si las hay) de cualquiera de los 9 catálogos anteriores indica:
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
  
  // Timeout de 30s para iniciar la sesión resumible
  const initController = new AbortController();
  const initTimeout = setTimeout(() => initController.abort(), 30000);
  
  let initRes;
  try {
    initRes = await fetch(
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
        signal: initController.signal,
      }
    );
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('La conexión inicial con Google Gemini Files API superó el tiempo de espera (30s).');
    }
    throw err;
  } finally {
    clearTimeout(initTimeout);
  }

  if (!initRes.ok) {
    const errText = await initRes.text().catch(() => '');
    throw new Error(`Error iniciando subida a Gemini Files: ${initRes.status} ${errText}`);
  }

  const uploadUrl = initRes.headers.get('x-goog-upload-url');
  if (!uploadUrl) {
    throw new Error('No se recibió la URL de subida (x-goog-upload-url) de Gemini');
  }

  console.log('[ia-worker] Transmitiendo bytes del PDF a la API de archivos...');
  
  // Timeout de 120s para transmitir el archivo grande de PDF
  const uploadController = new AbortController();
  const uploadTimeout = setTimeout(() => uploadController.abort(), 120000);
  
  let uploadRes;
  try {
    uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'X-Goog-Upload-Command': 'upload, finalize',
        'X-Goog-Upload-Offset': '0',
        'Content-Length': fileBuffer.length.toString(),
      },
      body: fileBuffer,
      signal: uploadController.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('La transmisión del PDF a Google Gemini superó el límite de tiempo de espera (120s).');
    }
    throw err;
  } finally {
    clearTimeout(uploadTimeout);
  }

  if (!uploadRes.ok) {
    const errText = await uploadRes.text().catch(() => '');
    throw new Error(`Error transmitiendo archivo a Gemini Files: ${uploadRes.status} ${errText}`);
  }

  const uploadData = await uploadRes.json();
  const fileUri = uploadData.file.uri;
  const fileName = uploadData.file.name;

  // Polling si está en procesamiento (con timeout de 60s max)
  let status = uploadData.file.state;
  let pollingAttempts = 0;
  while (status === 'PROCESSING' && pollingAttempts < 30) {
    console.log('[ia-worker] El archivo PDF se está indexando en los servidores de Google...');
    await new Promise((resolve) => setTimeout(resolve, 2000));
    pollingAttempts++;
    
    const pollController = new AbortController();
    const pollTimeout = setTimeout(() => pollController.abort(), 15000);
    
    try {
      const pollRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${GEMINI_API_KEY}`,
        { signal: pollController.signal }
      );
      if (pollRes.ok) {
        const pollData = await pollRes.json();
        status = pollData.state;
      }
    } catch (err) {
      console.warn('[ia-worker] Error temporal consultando estado de indexación en Google:', err.message);
    } finally {
      clearTimeout(pollTimeout);
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
    // ─── Fase 2: Extracción local de texto plano con pdf-parse ───
    if (onProgreso) {
      await onProgreso('Analizando y extrayendo texto del PDF localmente...');
    }
    console.log('[ia-worker] Iniciando extracción local de páginas con pdf-parse...');
    
    const fileBuffer = Buffer.from(pdfBase64, 'base64');
    const paginasTexto = [];
    let numeroPagina = 1;

    // Callback de renderizado para pdf-parse
    const renderPage = async (pageData) => {
      const textContent = await pageData.getTextContent();
      let lastY, text = '';
      for (let item of textContent.items) {
        if (lastY === item.transform[5] || !lastY) {
          text += item.str;
        } else {
          text += '\n' + item.str;
        }
        lastY = item.transform[5];
      }
      
      paginasTexto.push({
        numero_pagina: numeroPagina++,
        texto: text.trim()
      });
      
      return text;
    };

    const parsedData = await pdf(fileBuffer, { pagerender: renderPage });
    const nPaginas = parsedData.numpages || paginasTexto.length || 1;
    
    paginasTexto.sort((a, b) => (a.numero_pagina || 0) - (b.numero_pagina || 0));
    console.log(`[ia-worker] Éxito: ${nPaginas} páginas extraídas localmente en segundos.`);

    // ─── Fase 1: Subida y análisis de catálogo con Gemini ───
    if (onProgreso) {
      await onProgreso('Subiendo PDF temporal a Google para extraer catálogos...');
    }
    const uploadInfo = await subirArchivoAGemini(pdfBase64);
    fileUri = uploadInfo.fileUri;
    fileName = uploadInfo.fileName;

    if (onProgreso) {
      await onProgreso('Fase 1: Extrayendo fluidos y clases con Gemini...');
    }
    console.log('[ia-worker] Iniciando Fase 1: Extracción de fluidos y clases con Gemini...');
    let catalogo;
    try {
      catalogo = await llamarGemini(GEMINI_MODEL_PRO, PROMPT_CATALOGO, SCHEMA_CATALOGO, fileUri);
    } catch (err) {
      console.warn('[ia-worker] Gemini Pro/Flash falló para catálogo. Reintentando...', err.message);
      catalogo = await llamarGemini(GEMINI_MODEL, PROMPT_CATALOGO, SCHEMA_CATALOGO, fileUri);
    }

    return {
      fluidos: Array.isArray(catalogo?.fluidos) ? catalogo.fluidos : [],
      clases: Array.isArray(catalogo?.clases) ? catalogo.clases : [],
      diametrosNps: Array.isArray(catalogo?.diametros_nps) ? catalogo.diametros_nps : [],
      esquemasPintura: Array.isArray(catalogo?.esquemas_pintura) ? catalogo.esquemas_pintura : [],
      aislacionesExt: Array.isArray(catalogo?.aislaciones_ext) ? catalogo.aislaciones_ext : [],
      porcentajesNde: Array.isArray(catalogo?.porcentajes_nde) ? catalogo.porcentajes_nde : [],
      tiposPrueba: Array.isArray(catalogo?.tipos_prueba) ? catalogo.tipos_prueba : [],
      tiposUnion: Array.isArray(catalogo?.tipos_union) ? catalogo.tipos_union : [],
      revestimientosInt: Array.isArray(catalogo?.revestimientos_int) ? catalogo.revestimientos_int : [],
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
