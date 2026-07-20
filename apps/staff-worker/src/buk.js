import { supabase } from './index.js';

/**
 * Normaliza un RUT chileno:
 * - Convierte a mayúsculas.
 * - Elimina puntos, guiones y espacios.
 * - Ej: "12.345.678-k" -> "12345678K"
 */
export function normalizarRut(rut) {
  if (!rut || typeof rut !== 'string') return '';
  return rut.toUpperCase().replace(/[^0-9K]/g, '');
}

/**
 * Normaliza un número de teléfono a formato internacional simple o estándar local
 */
export function normalizarTelefono(telefono) {
  if (!telefono) return null;
  let t = telefono.toString().replace(/[^0-9+]/g, '');
  // Si no empieza con +, asumimos código país de Chile (+56) si tiene 9 dígitos
  if (t.length === 9 && !t.startsWith('+')) {
    t = '+56' + t;
  }
  return t;
}

/**
 * Busca un proyecto_id en base al código de centro de costo de Buk
 */
async function buscarProyectoPorCentroCosto(centroCosto) {
  if (!centroCosto) return null;

  // Intentamos buscar coincidencia exacta con el código del proyecto
  // Ej: centroCosto = 'EIMI00413' -> proyecto.codigo = 'EIMI00413'
  let { data: proyecto } = await supabase
    .from('proyectos')
    .select('id')
    .eq('codigo', centroCosto.trim())
    .maybeSingle();

  if (proyecto) return proyecto.id;

  // Si no hay coincidencia exacta, intentamos buscar si el código del proyecto está contenido
  // Ej: centroCosto = 'Obra Andina - EIMI00413' -> busca si hay un proyecto cuyo código esté en esa cadena
  let { data: proyectos } = await supabase
    .from('proyectos')
    .select('id, codigo')
    .eq('estado', 'activo');

  if (proyectos) {
    const ccUpper = centroCosto.toUpperCase();
    const proyectoEncontrado = proyectos.find((p) => 
      p.codigo && ccUpper.includes(p.codigo.toUpperCase())
    );
    if (proyectoEncontrado) return proyectoEncontrado.id;
  }

  // Devolver null si no se asocia a ningún proyecto activo
  return null;
}

/**
 * Procesa los eventos de Webhook enviados por Buk:
 * - employee.created / employee.hired (Contratación)
 * - employee.updated (Actualización)
 * - employee.terminated (Despido)
 */
export async function procesarEventoBuk(payload) {
  const { event, data } = payload;
  if (!event || !data) {
    throw new Error('Estructura de webhook de Buk inválida');
  }

  console.log(`[staff-worker] Procesando evento Buk: ${event} para empleado: ${data.rut}`);

  const rut = normalizarRut(data.rut);
  if (!rut) {
    throw new Error('El empleado no posee un RUT válido');
  }

  const nombreCompleto = `${data.first_name || ''} ${data.last_name || ''}`.trim();
  const telefono = normalizarTelefono(data.phone || data.mobile);
  const cargo = data.job_position || data.cargo;
  const centroCosto = data.cost_center || data.centro_costo;
  
  // Buscar proyecto asociado
  const proyectoId = await buscarProyectoPorCentroCosto(centroCosto);
  if (!proyectoId) {
    console.warn(`[staff-worker] No se encontró ningún proyecto asociado al centro de costo: ${centroCosto}. Saltando sincronización de este empleado.`);
    return { estado: 'omitido', razon: `Centro de costo '${centroCosto}' no mapea a ningún proyecto activo` };
  }

  // Si el evento es un despido o término de contrato
  if (event === 'employee.terminated' || data.status === 'terminated' || data.status === 'inactive') {
    // Marcamos al trabajador como inactivo para no perder el histórico en terreno
    const { data: updated, error } = await supabase
      .from('cat_personal')
      .update({
        activo: false,
        estado: 'desvinculado',
        actualizado_en: new Date().toISOString()
      })
      .eq('proyecto_id', proyectoId)
      .eq('rut', rut)
      .select();

    if (error) {
      throw new Error(`Error al desvincular trabajador: ${error.message}`);
    }

    return { estado: 'desvinculado', trabajador: updated };
  }

  // De lo contrario, es contratación o actualización. Hacemos upsert.
  // Primero buscamos si ya existe el trabajador en el proyecto
  const { data: trabajadorExistente } = await supabase
    .from('cat_personal')
    .select('id, estampa')
    .eq('proyecto_id', proyectoId)
    .eq('rut', rut)
    .maybeSingle();

  const payloadTrabajador = {
    proyecto_id: proyectoId,
    rut,
    nombre: nombreCompleto,
    telefono,
    cargo,
    centro_costo: centroCosto,
    activo: true,
    estado: 'activo',
    especialidad: inferirEspecialidad(cargo),
    actualizado_en: new Date().toISOString()
  };

  let resultado;

  if (trabajadorExistente) {
    // Actualizamos
    const { data: updated, error } = await supabase
      .from('cat_personal')
      .update(payloadTrabajador)
      .eq('id', trabajadorExistente.id)
      .select();

    if (error) {
      throw new Error(`Error al actualizar trabajador: ${error.message}`);
    }
    resultado = { accion: 'actualizado', trabajador: updated[0] };
  } else {
    // Insertamos
    // Como la estampa es requerida a nivel BD si tiene restricción UNIQUE (aunque quitamos NOT NULL),
    // si no existe estampa la dejamos temporalmente en base a las iniciales del nombre o vacía.
    payloadTrabajador.estampa = `SIN_ESTAMPA_${rut}`;
    
    const { data: inserted, error } = await supabase
      .from('cat_personal')
      .insert(payloadTrabajador)
      .select();

    if (error) {
      throw new Error(`Error al insertar nuevo trabajador: ${error.message}`);
    }
    resultado = { accion: 'creado', trabajador: inserted[0] };
  }

  return resultado;
}

/**
 * Procesa los marcajes de asistencia diaria.
 * Payload esperado: { rut, fecha, hora_entrada, hora_salida, estado }
 */
export async function procesarMarcajeAsistencia(payload) {
  const { rut: rawRut, fecha, hora_entrada, hora_salida, estado = 'presente' } = payload;
  const rut = normalizarRut(rawRut);

  if (!rut || !fecha) {
    throw new Error('Faltan datos obligatorios (rut, fecha)');
  }

  console.log(`[staff-worker] Procesando marcaje de asistencia para RUT: ${rut} en fecha: ${fecha}`);

  // Buscamos al trabajador en cat_personal
  const { data: trabajador, error: errTrabajador } = await supabase
    .from('cat_personal')
    .select('id, proyecto_id')
    .eq('rut', rut)
    .eq('activo', true)
    .maybeSingle();

  if (errTrabajador || !trabajador) {
    throw new Error(`Trabajador activo con RUT ${rut} no encontrado en la plataforma`);
  }

  // Realizamos upsert del marcaje de asistencia diaria
  const { data: asistencia, error: errAsistencia } = await supabase
    .from('log_asistencia')
    .upsert({
      proyecto_id: trabajador.proyecto_id,
      trabajador_id: trabajador.id,
      fecha,
      hora_entrada: hora_entrada || null,
      hora_salida: hora_salida || null,
      estado,
      actualizado_en: new Date().toISOString()
    }, {
      onConflict: 'proyecto_id,trabajador_id,fecha'
    })
    .select();

  if (errAsistencia) {
    throw new Error(`Error al registrar asistencia: ${errAsistencia.message}`);
  }

  return { ok: true, asistencia: asistencia[0] };
}

/**
 * Utilidad simple para inferir la especialidad en base al cargo/puesto de trabajo
 */
function inferirEspecialidad(cargo) {
  if (!cargo) return 'general';
  const c = cargo.toLowerCase();
  if (c.includes('soldador') || c.includes('pipe') || c.includes('tubero') || c.includes('cañer')) {
    return 'piping';
  }
  if (c.includes('estruct') || c.includes('montador') || c.includes('fierr')) {
    return 'estructuras';
  }
  if (c.includes('civil') || c.includes('albañil') || c.includes('concre')) {
    return 'civiles';
  }
  if (c.includes('mecanic') || c.includes('equip')) {
    return 'mecanica';
  }
  return 'general';
}
