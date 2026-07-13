// Tipos de dominio de negocio compartidos entre apps

/** Roles del sistema (igual que v1) */
export type Rol = 'ADMIN' | 'OT' | 'QAQC' | 'LOGISTICA' | 'SUPERVISOR'

/** Industrias soportadas */
export type Industria = 'mineria' | 'refineria' | 'celulosa'

/** Estado de membresía */
export type EstadoMembresia = 'activo' | 'inactivo' | 'pendiente'

/** Estado de proyecto */
export type EstadoProyecto = 'activo' | 'en_pausa' | 'cerrado' | 'borrador'

/** Estados del importador */
export type EstadoLote =
  | 'cargado'
  | 'validado'
  | 'diff_listo'
  | 'aprobado'
  | 'aplicado'
  | 'rechazado'

/** Acciones de una fila importada */
export type AccionFila = 'nueva' | 'modificada' | 'ausente' | 'sin_cambio' | 'error'

/** Tipos de evidencia */
export type TipoEvidencia =
  | 'FOTO'
  | 'PDF_ISO'
  | 'PDF_PID'
  | 'FOTO_EVIDENCIA'
  | 'PDF_PROTOCOLO'
  | 'OTRO'
