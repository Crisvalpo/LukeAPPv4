// Tipos base — placeholder hasta F0.6 (supabase gen types typescript)
// Se reemplaza con el output generado automáticamente

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  lukeapp: {
    Tables: Record<string, unknown>
    Views: Record<string, unknown>
    Functions: Record<string, unknown>
    Enums: Record<string, unknown>
  }
}
