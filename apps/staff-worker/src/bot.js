import { supabase } from './index.js';
import { normalizarRut, normalizarTelefono } from './buk.js';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

// Estructura en memoria para mantener sesiones temporales del bot (para resolver homónimos o confirmaciones)
const sesionesPendientes = new Map();
const SESION_TTL_MS = 5 * 60 * 1000; // 5 minutos

function limpiarSesionesExpiradas() {
  const ahora = Date.now();
  for (const [phone, session] of sesionesPendientes.entries()) {
    if (ahora > session.expiracion) {
      sesionesPendientes.delete(phone);
    }
  }
}

/**
 * Determina el rol del usuario en base a su teléfono de WhatsApp
 * Retorna: { rol: 'ADMIN'|'OT'|'SUPERVISOR'|'CAPATAZ'|'OPERARIO', proyectoId, usuarioId, personalId, nombre }
 */
async function determinarRolUsuario(phone) {
  // 1. Buscar si es un usuario del sistema registrado en el proyecto
  const { data: usuario, error: errUser } = await supabase
    .from('usuarios')
    .select('id, nombre, email, membresias(rol, proyecto_id)')
    .eq('telefono', phone)
    .maybeSingle();

  if (usuario && usuario.membresias && usuario.membresias.length > 0) {
    // Tomamos la primera membresía activa del usuario
    const mem = usuario.membresias[0];
    return {
      rol: mem.rol, // ADMIN, OT, SUPERVISOR, QAQC, LOGISTICA
      proyectoId: mem.proyecto_id,
      usuarioId: usuario.id,
      personalId: null,
      nombre: usuario.nombre
    };
  }

  // 2. Si no es un usuario registrado en el sistema, buscamos en cat_personal
  const { data: pers, error: errPers } = await supabase
    .from('cat_personal')
    .select('id, nombre, cargo, proyecto_id, especialidad')
    .eq('activo', true)
    .eq('telefono', phone)
    .maybeSingle();

  if (pers) {
    const esCapataz = (pers.cargo || '').toLowerCase().includes('capataz');
    return {
      rol: esCapataz ? 'CAPATAZ' : 'OPERARIO',
      proyectoId: pers.proyecto_id,
      usuarioId: null,
      personalId: pers.id,
      nombre: pers.nombre,
      especialidad: pers.especialidad
    };
  }

  // 3. Desconocido
  return null;
}

/**
 * Clasifica la intención del mensaje conversacional usando Gemini
 */
async function clasificarIntencionConGemini(mensaje, perfilUsuario) {
  if (!GEMINI_API_KEY) {
    return { intent: 'DESCONOCIDO', data: {} };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  
  const systemInstruction = `
    Eres un despachador de comandos para la gestión de personal en terreno de un monorepo industrial.
    Clasifica el mensaje del usuario de acuerdo a las siguientes intenciones (intent):
    
    1. "CREAR_PERSONAL": El usuario desea registrar a un nuevo trabajador.
       Campos requeridos en 'data': rut (normalizado), nombre, cargo, telefono (opcional), centro_costo (opcional).
       Ejemplo: "crear trabajador Carlos Ruiz rut 12.345.678-9 de cargo Soldador en obra Andina"
       -> {"intent": "CREAR_PERSONAL", "data": {"rut": "123456789", "nombre": "Carlos Ruiz", "cargo": "Soldador", "telefono": null, "centro_costo": "Andina"}}
       
    2. "CREAR_CUADRILLA": El usuario (Supervisor/Capataz) desea crear una nueva cuadrilla activa.
       Campos requeridos en 'data': cuadrilla_nombre, especialidad (piping, civiles, mecanica, estructuras).
       Ejemplo: "crear cuadrilla Piping Frente Norte especialidad piping"
       -> {"intent": "CREAR_CUADRILLA", "data": {"cuadrilla_nombre": "Piping Frente Norte", "especialidad": "piping"}}
       
    3. "AGREGAR_A_CUADRILLA": El Capataz o Supervisor desea añadir un operario a su cuadrilla enviando un mensaje que empieza con + o indicando "agregar".
       Campos requeridos en 'data': operario_identificador (RUT o Nombre).
       Ejemplo: "+ 12.345.678-K" -> {"intent": "AGREGAR_A_CUADRILLA", "data": {"operario_identificador": "12345678K"}}
       Ejemplo: "Agregar a Juan Perez" -> {"intent": "AGREGAR_A_CUADRILLA", "data": {"operario_identificador": "Juan Perez"}}
       
    4. "REMOVER_DE_CUADRILLA": El Capataz o Supervisor desea quitar un operario enviando un mensaje que empieza con - o indicando "remover" o "quitar".
       Campos requeridos en 'data': operario_identificador (RUT o Nombre).
       Ejemplo: "- 12345678K" -> {"intent": "REMOVER_DE_CUADRILLA", "data": {"operario_identificador": "12345678K"}}
       Ejemplo: "remover a Juan Perez" -> {"intent": "REMOVER_DE_CUADRILLA", "data": {"operario_identificador": "Juan Perez"}}

    5. "AUTOASIGNACION": El trabajador desea autoasignarse a un capataz.
       Campos requeridos en 'data': capataz_nombre.
       Ejemplo: "Voy con el capataz Pérez" -> {"intent": "AUTOASIGNACION", "data": {"capataz_nombre": "Pérez"}}
       
    6. "DESCONOCIDO": Si el mensaje no calza con ninguna acción, saludos comunes o consultas generales.
       -> {"intent": "DESCONOCIDO", "data": {}}

    Tu rol actual del usuario emisor es: ${perfilUsuario?.rol || 'OPERARIO'} con nombre ${perfilUsuario?.nombre || 'Desconocido'}.
  `;

  const schema = {
    type: 'OBJECT',
    properties: {
      intent: { 
        type: 'STRING', 
        enum: ['CREAR_PERSONAL', 'CREAR_CUADRILLA', 'AGREGAR_A_CUADRILLA', 'REMOVER_DE_CUADRILLA', 'AUTOASIGNACION', 'DESCONOCIDO']
      },
      data: {
        type: 'OBJECT',
        properties: {
          rut: { type: 'STRING' },
          nombre: { type: 'STRING' },
          cargo: { type: 'STRING' },
          telefono: { type: 'STRING' },
          centro_costo: { type: 'STRING' },
          cuadrilla_nombre: { type: 'STRING' },
          especialidad: { type: 'STRING' },
          operario_identificador: { type: 'STRING' },
          capataz_nombre: { type: 'STRING' }
        }
      }
    },
    required: ['intent', 'data']
  };

  const body = {
    contents: [{ parts: [{ text: mensaje }] }],
    systemInstruction: { parts: [{ text: systemInstruction }] },
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: schema,
      temperature: 0.1
    }
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const resultData = await res.json();
      const text = resultData?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        return JSON.parse(text.trim());
      }
    }
  } catch (err) {
    console.error('[staff-worker] Error al clasificar con Gemini:', err.message);
  }

  // Fallback simple por Regex
  return fallBackClasificador(mensaje);
}

function fallBackClasificador(mensaje) {
  const m = mensaje.trim();
  if (m.startsWith('+')) {
    return { intent: 'AGREGAR_A_CUADRILLA', data: { operario_identificador: m.slice(1).trim() } };
  }
  if (m.startsWith('-')) {
    return { intent: 'REMOVER_DE_CUADRILLA', data: { operario_identificador: m.slice(1).trim() } };
  }
  // Fallback para autoasignación
  const capataz = m.match(/(?:con\s+el\s+capataz|con|capataz|voy\s+con)\s+([a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+)/i);
  if (capataz && capataz[1]) {
    return { intent: 'AUTOASIGNACION', data: { capataz_nombre: capataz[1].trim() } };
  }
  return { intent: 'DESCONOCIDO', data: {} };
}

/**
 * Endpoint de interacción WhatsApp
 */
export async function procesarMensajeWhatsapp(payload) {
  limpiarSesionesExpiradas();

  const { phone, message } = payload;
  if (!phone || !message) {
    throw new Error('Faltan datos obligatorios (phone, message)');
  }

  const rawMessage = message.trim();
  
  // 1. Determinar el rol del usuario emisor
  const perfil = await determinarRolUsuario(phone);
  if (!perfil) {
    return {
      respuesta: 'Lo siento, tu número no está registrado. Contacta al encargado de oficina técnica para autorizar tu número en la plataforma.',
      enviarWhatsapp: true
    };
  }

  // 2. Revisar si hay un homónimo/sesión pendiente a resolver
  const sesion = sesionesPendientes.get(phone);
  if (sesion && Date.now() < sesion.expiracion) {
    const num = parseInt(rawMessage.replace(/[^0-9]/g, ''), 10);
    if (num && num > 0 && num <= sesion.opciones.length) {
      const opcion = sesion.opciones[num - 1];
      sesionesPendientes.delete(phone); // Limpiar sesión
      
      if (sesion.accion === 'RESOLVER_CAPATAZ_AUTOASIGNACION') {
        return await aplicarAsignacion(
          perfil, 
          opcion.cuadrillaId, 
          opcion.capatazNombre, 
          opcion.capatazTelefono, 
          opcion.especialidad
        );
      }
      
      if (sesion.accion === 'RESOLVER_OPERARIO_AGREGAR') {
        return await aplicarAsignacion(
          opcion.operario, 
          sesion.cuadrillaId, 
          perfil.nombre, 
          phone, 
          sesion.especialidad
        );
      }
    }
  }

  // 3. Clasificar intención
  const { intent, data } = await clasificarIntencionConGemini(rawMessage, perfil);

  console.log(`[staff-worker] Intención clasificada: ${intent} para el rol: ${perfil.rol}`);

  switch (intent) {
    case 'CREAR_PERSONAL':
      // Validar permisos
      if (perfil.rol !== 'ADMIN' && perfil.rol !== 'OT') {
        return {
          respuesta: '⚠️ Acceso denegado: Solo los usuarios con rol ADMINISTRADOR u OFICINA TÉCNICA (OT) pueden registrar nuevo personal.',
          enviarWhatsapp: true
        };
      }
      return await botCrearPersonal(data, perfil.proyectoId);

    case 'CREAR_CUADRILLA':
      // Validar permisos
      if (perfil.rol !== 'ADMIN' && perfil.rol !== 'SUPERVISOR' && perfil.rol !== 'CAPATAZ') {
        return {
          respuesta: '⚠️ Acceso denegado: Solo los Administradores, Supervisores o Capataces pueden crear cuadrillas.',
          enviarWhatsapp: true
        };
      }
      return await botCrearCuadrilla(data, perfil);

    case 'AGREGAR_A_CUADRILLA':
      if (perfil.rol !== 'ADMIN' && perfil.rol !== 'SUPERVISOR' && perfil.rol !== 'CAPATAZ') {
        return {
          respuesta: '⚠️ Acceso denegado: No tienes permisos para añadir personal a cuadrillas.',
          enviarWhatsapp: true
        };
      }
      return await botAgregarA_Cuadrilla(data, perfil);

    case 'REMOVER_DE_CUADRILLA':
      if (perfil.rol !== 'ADMIN' && perfil.rol !== 'SUPERVISOR' && perfil.rol !== 'CAPATAZ') {
        return {
          respuesta: '⚠️ Acceso denegado: No tienes permisos para remover personal de cuadrillas.',
          enviarWhatsapp: true
        };
      }
      return await botRemoverDeCuadrilla(data, perfil);

    case 'AUTOASIGNACION':
      return await botAutoasignacion(data.capataz_nombre, perfil);

    default:
      return {
        respuesta: `Hola ${perfil.nombre} (${perfil.rol}). No he comprendido tu solicitud. Puedes enviarme mensajes como:\n` +
          (perfil.rol === 'ADMIN' || perfil.rol === 'OT' ? '- "Crear personal RUT 12345678-K Juan Perez Soldador en Andina"\n' : '') +
          (perfil.rol === 'SUPERVISOR' || perfil.rol === 'CAPATAZ' ? '- "Crear cuadrilla Soldadura Sur especialidad piping"\n- "+ [RUT o Nombre]" para agregar operarios\n- "- [RUT o Nombre]" para remover operarios\n' : '') +
          '- "Voy con el capataz Pérez" (para autoasignarte).',
        enviarWhatsapp: true
      };
  }
}

// ================================================================
// LÓGICA DE ACCIONES DEL BOT
// ================================================================

async function botCrearPersonal(data, proyectoId) {
  const rut = normalizarRut(data.rut);
  if (!rut || !data.nombre || !data.cargo) {
    return {
      respuesta: '⚠️ Faltan datos obligatorios para crear personal. Formato requerido: RUT, Nombre y Cargo.',
      enviarWhatsapp: true
    };
  }

  // Verificar si ya existe
  const { data: existente } = await supabase
    .from('cat_personal')
    .select('id')
    .eq('proyecto_id', proyectoId)
    .eq('rut', rut)
    .maybeSingle();

  if (existente) {
    return {
      respuesta: `El trabajador con RUT ${rut} ya se encuentra registrado en el proyecto.`,
      enviarWhatsapp: true
    };
  }

  const { error } = await supabase
    .from('cat_personal')
    .insert({
      proyecto_id: proyectoId,
      rut,
      nombre: data.nombre,
      cargo: data.cargo,
      telefono: normalizarTelefono(data.telefono),
      centro_costo: data.centro_costo || null,
      activo: true,
      estado: 'activo',
      estampa: `SIN_ESTAMPA_${rut}`
    });

  if (error) {
    return { respuesta: `Error al registrar en base de datos: ${error.message}`, enviarWhatsapp: true };
  }

  return {
    respuesta: `✅ Personal registrado con éxito:\n- Nombre: ${data.nombre}\n- RUT: ${rut}\n- Cargo: ${data.cargo}`,
    enviarWhatsapp: true
  };
}

async function botCrearCuadrilla(data, perfil) {
  const { cuadrilla_nombre, especialidad = 'general' } = data;
  if (!cuadrilla_nombre) {
    return {
      respuesta: '⚠️ Falta el nombre de la cuadrilla. Ejemplo: "Crear cuadrilla Piping Norte"',
      enviarWhatsapp: true
    };
  }

  // Buscamos si ya existe el nombre
  const { data: existente } = await supabase
    .from('list_cuadrillas')
    .select('id')
    .eq('proyecto_id', perfil.proyectoId)
    .eq('nombre', cuadrilla_nombre)
    .maybeSingle();

  if (existente) {
    return {
      respuesta: `Ya existe una cuadrilla activa llamada "${cuadrilla_nombre}" en el proyecto.`,
      enviarWhatsapp: true
    };
  }

  const payload = {
    proyecto_id: perfil.proyectoId,
    nombre: cuadrilla_nombre,
    especialidad: especialidad,
    activo: true
  };

  // Si el emisor es Capataz, se asigna como el capataz de la cuadrilla
  if (perfil.rol === 'CAPATAZ') {
    payload.capataz_id = perfil.personalId;
  }
  // Si el emisor es Supervisor del sistema, se asocia como supervisor_id
  if (perfil.rol === 'SUPERVISOR' || perfil.rol === 'ADMIN') {
    payload.supervisor_id = perfil.usuarioId;
  }

  const { error } = await supabase
    .from('list_cuadrillas')
    .insert(payload);

  if (error) {
    return { respuesta: `Error creando cuadrilla: ${error.message}`, enviarWhatsapp: true };
  }

  return {
    respuesta: `✅ Cuadrilla "${cuadrilla_nombre}" creada con éxito (Especialidad: ${especialidad}).`,
    enviarWhatsapp: true
  };
}

async function botAgregarA_Cuadrilla(data, emisor) {
  const identificador = data.operario_identificador;
  if (!identificador) {
    return { respuesta: '⚠️ Indica el RUT o el Nombre del operario que deseas agregar. Ejemplo: "+ 12345678K" o "+ Juan Perez".', enviarWhatsapp: true };
  }

  // 1. Obtener la cuadrilla que lidera o supervisa el emisor
  let cuadrilla;
  if (emisor.rol === 'CAPATAZ') {
    const { data: cuad } = await supabase
      .from('list_cuadrillas')
      .select('id, nombre, especialidad')
      .eq('proyecto_id', emisor.proyectoId)
      .eq('capataz_id', emisor.personalId)
      .eq('activo', true)
      .maybeSingle();
    cuadrilla = cuad;
  } else {
    // Si es Supervisor/Admin, buscamos la primera cuadrilla que tenga asignada
    const { data: cuad } = await supabase
      .from('list_cuadrillas')
      .select('id, nombre, especialidad')
      .eq('proyecto_id', emisor.proyectoId)
      .eq('supervisor_id', emisor.usuarioId)
      .eq('activo', true)
      .limit(1)
      .maybeSingle();
    cuadrilla = cuad;
  }

  if (!cuadrilla) {
    return {
      respuesta: '⚠️ No tienes una cuadrilla activa asignada en el sistema. Debes crear una primero.',
      enviarWhatsapp: true
    };
  }

  // 2. Buscar al operario en cat_personal
  const rut = normalizarRut(identificador);
  let query = supabase
    .from('cat_personal')
    .select('id, nombre, cargo, especialidad, proyecto_id, telefono')
    .eq('proyecto_id', emisor.proyectoId)
    .eq('activo', true);

  if (rut) {
    query = query.eq('rut', rut);
  } else {
    query = query.ilike('nombre', `%${identificador}%`);
  }

  const { data: operarios, error } = await query;
  if (error || !operarios || operarios.length === 0) {
    return { respuesta: `No se encontró a ningún operario activo con identificador "${identificador}".`, enviarWhatsapp: true };
  }

  // Si hay homónimos
  if (operarios.length > 1) {
    const opciones = operarios.map((op) => ({
      operario: {
        id: op.id,
        nombre: op.nombre,
        cargo: op.cargo,
        especialidad: op.especialidad,
        proyecto_id: op.proyecto_id
      }
    }));

    sesionesPendientes.set(emisor.telefono, {
      expiracion: Date.now() + SESION_TTL_MS,
      accion: 'RESOLVER_OPERARIO_AGREGAR',
      cuadrillaId: cuadrilla.id,
      especialidad: cuadrilla.especialidad,
      opciones
    });

    let msg = `Encontré varios operarios coincidentes. Responde con el número de la opción:\n`;
    operarios.forEach((op, idx) => {
      msg += `${idx + 1}. ${op.nombre} (${op.cargo} • ${op.especialidad || 'general'})\n`;
    });
    return { respuesta: msg.trim(), enviarWhatsapp: true };
  }

  // Asignar al operario único
  const operario = operarios[0];
  const capatazNombre = emisor.nombre;
  return await aplicarAsignacion(operario, cuadrilla.id, capatazNombre, null, cuadrilla.especialidad);
}

async function botRemoverDeCuadrilla(data, emisor) {
  const identificador = data.operario_identificador;
  if (!identificador) {
    return { respuesta: '⚠️ Indica el RUT o el Nombre del operario que deseas remover. Ejemplo: "- 12345678K" o "- Juan Perez".', enviarWhatsapp: true };
  }

  // 1. Buscar cuadrilla del emisor
  let cuadrillaId;
  if (emisor.rol === 'CAPATAZ') {
    const { data: cuad } = await supabase
      .from('list_cuadrillas')
      .select('id')
      .eq('proyecto_id', emisor.proyectoId)
      .eq('capataz_id', emisor.personalId)
      .eq('activo', true)
      .maybeSingle();
    cuadrillaId = cuad?.id;
  } else {
    const { data: cuad } = await supabase
      .from('list_cuadrillas')
      .select('id')
      .eq('proyecto_id', emisor.proyectoId)
      .eq('supervisor_id', emisor.usuarioId)
      .eq('activo', true)
      .limit(1)
      .maybeSingle();
    cuadrillaId = cuad?.id;
  }

  if (!cuadrillaId) {
    return { respuesta: '⚠️ No tienes una cuadrilla activa en la que remover personal.', enviarWhatsapp: true };
  }

  // 2. Buscar al operario en cat_personal
  const rut = normalizarRut(identificador);
  let query = supabase
    .from('cat_personal')
    .select('id, nombre')
    .eq('proyecto_id', emisor.proyectoId)
    .eq('activo', true);

  if (rut) {
    query = query.eq('rut', rut);
  } else {
    query = query.ilike('nombre', `%${identificador}%`);
  }

  const { data: operarios } = await query;
  if (!operarios || operarios.length === 0) {
    return { respuesta: `No encontré ningún operario activo con identificador "${identificador}"`, enviarWhatsapp: true };
  }

  const operarioId = operarios[0].id;
  const fechaHoy = new Date().toISOString().split('T')[0];

  // 3. Eliminar asignación diaria
  const { error } = await supabase
    .from('rel_cuadrilla_trabajadores')
    .delete()
    .eq('proyecto_id', emisor.proyectoId)
    .eq('cuadrilla_id', cuadrillaId)
    .eq('trabajador_id', operarioId)
    .eq('fecha', fechaHoy);

  if (error) {
    return { respuesta: `Error al remover de la base de datos: ${error.message}`, enviarWhatsapp: true };
  }

  return {
    respuesta: `✕ Se ha removido con éxito a ${operarios[0].nombre} de tu cuadrilla para el día de hoy.`,
    enviarWhatsapp: true
  };
}

async function botAutoasignacion(capatazNombre, operario) {
  if (!capatazNombre) {
    return { respuesta: '⚠️ Envía el nombre o apellido del capataz al que te sumas. Ejemplo: "Voy con el capataz Pérez".', enviarWhatsapp: true };
  }

  // Buscar capataces
  const { data: capataces } = await supabase
    .from('cat_personal')
    .select('id, nombre, cargo, telefono')
    .eq('proyecto_id', operario.proyectoId)
    .eq('activo', true)
    .ilike('nombre', `%${capatazNombre}%`);

  if (!capataces || capataces.length === 0) {
    return { respuesta: `No encontré a ningún capataz activo llamado "${capatazNombre}".`, enviarWhatsapp: true };
  }

  const capatacesIds = capataces.map(c => c.id);
  const { data: cuadrillas } = await supabase
    .from('list_cuadrillas')
    .select('id, nombre, capataz_id, especialidad')
    .eq('proyecto_id', operario.proyectoId)
    .eq('activo', true)
    .in('capataz_id', capatacesIds);

  if (!cuadrillas || cuadrillas.length === 0) {
    return { respuesta: `El capataz "${capatazNombre}" no registra ninguna cuadrilla activa hoy.`, enviarWhatsapp: true };
  }

  // Múltiples opciones/cuadrillas
  if (cuadrillas.length > 1) {
    const opciones = cuadrillas.map((cuad) => {
      const capataz = capataces.find(c => c.id === cuad.capataz_id);
      return {
        cuadrillaId: cuad.id,
        capatazNombre: capataz.nombre,
        capatazTelefono: capataz.telefono,
        especialidad: cuad.especialidad
      };
    });

    sesionesPendientes.set(operario.telefono, {
      expiracion: Date.now() + SESION_TTL_MS,
      accion: 'RESOLVER_CAPATAZ_AUTOASIGNACION',
      opciones
    });

    let msg = `Encontré varias cuadrillas activas. Responde con el número de tu opción:\n`;
    cuadrillas.forEach((cuad, idx) => {
      const cap = capataces.find(c => c.id === cuad.capataz_id);
      msg += `${idx + 1}. Cuadrilla: ${cuad.nombre} (Capataz: ${cap.nombre} • Especialidad: ${cuad.especialidad})\n`;
    });
    return { respuesta: msg.trim(), enviarWhatsapp: true };
  }

  const cuadrilla = cuadrillas[0];
  const cap = capataces.find(c => c.id === cuadrilla.capataz_id);
  return await aplicarAsignacion(operario, cuadrilla.id, cap.nombre, cap.telefono, cuadrilla.especialidad);
}

/**
 * Inserta el registro de asignación diaria en rel_cuadrilla_trabajadores aplicando las validaciones de especialidad.
 */
async function aplicarAsignacion(operario, cuadrillaId, capatazNombre, capatazTelefono, especialidadCuadrilla) {
  const cargo = (operario.cargo || '').toLowerCase();
  const espTrabajador = (operario.especialidad || 'general').toLowerCase();
  const espCuadrilla = (especialidadCuadrilla || 'general').toLowerCase();
  const esSoldador = cargo.includes('soldador') || cargo.includes('weld');

  // Si no es soldador (no es recurso transversal) y tiene especialidad definida, debe coincidir
  if (!esSoldador && espTrabajador !== 'general' && espCuadrilla !== 'general' && espTrabajador !== espCuadrilla) {
    return {
      respuesta: `⚠️ Traspaso bloqueado: Eres especialista en "${operario.especialidad}" pero la cuadrilla del capataz ${capatazNombre} es de "${especialidadCuadrilla}". Los Maestros y Ayudantes deben coincidir con la especialidad de la cuadrilla.`,
      enviarWhatsapp: true
    };
  }

  const fechaHoy = new Date().toISOString().split('T')[0];
  
  // Realizar upsert de la asignación diaria
  const { error } = await supabase
    .from('rel_cuadrilla_trabajadores')
    .upsert({
      proyecto_id: operario.proyecto_id,
      cuadrilla_id: cuadrillaId,
      trabajador_id: operario.id,
      fecha: fechaHoy,
      metodo: 'bot_whatsapp'
    }, {
      onConflict: 'proyecto_id,trabajador_id,fecha'
    });

  if (error) {
    return { respuesta: `Error al guardar asignación diaria: ${error.message}`, enviarWhatsapp: true };
  }

  // Notificar al capataz si se tiene su número
  if (capatazTelefono) {
    console.log(`[SIMULACIÓN NOTIFICACIÓN] Enviando WhatsApp al Capataz (${capatazTelefono}): "Aviso: El ${operario.cargo || 'operario'} ${operario.nombre} se acaba de integrar a tu cuadrilla hoy."`);
  }

  return {
    respuesta: `✅ ¡Listo ${operario.nombre}! Asignado con éxito a la cuadrilla de ${capatazNombre} para el día de hoy (${fechaHoy}).`,
    enviarWhatsapp: true
  };
}
