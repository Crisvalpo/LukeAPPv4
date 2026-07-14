// Supabase Storage (S3-compatible) rechaza ciertos caracteres en la key del objeto
// (ej: [ ] # % ?). Los nombres reales de archivos de ingenieria los usan seguido
// (ej: "...0003[0] - PARA FABRICACION...pdf"), asi que la key se sanea siempre;
// el nombre original se preserva aparte (columna nombre_original) para mostrar en la UI.
const COMBINING_MARKS = new RegExp(String.fromCharCode(0x5b, 0x5c, 0x75, 0x30, 0x33, 0x30, 0x30, 0x2d, 0x5c, 0x75, 0x30, 0x33, 0x36, 0x66, 0x5d), 'g');

export function sanitizarNombreArchivo(nombre: string): string {
  const normalizado = nombre.normalize('NFD').replace(COMBINING_MARKS, '');
  const puntoIdx = normalizado.lastIndexOf('.');
  const base = puntoIdx > 0 ? normalizado.slice(0, puntoIdx) : normalizado;
  const ext = puntoIdx > 0 ? normalizado.slice(puntoIdx) : '';
  const baseLimpia = base.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/_+/g, '_');
  return `${baseLimpia}${ext.replace(/[^a-zA-Z0-9.]/g, '')}`;
}
