// packages/shared — punto de entrada
// Los tipos se generan automáticamente en F0.6 (supabase gen types typescript)
// Por ahora se exportan los tipos base manuales

// Re-exportar tipos de dominio (se expanden en F0.6)
export type * from './types/database'
export type * from './types/domain'
