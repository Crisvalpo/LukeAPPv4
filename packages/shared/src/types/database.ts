export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  lukeapp: {
    Tables: {
      cat_aislacion_ext: {
        Row: {
          activo: boolean
          actualizado_en: string
          actualizado_por: string | null
          codigo: string
          creado_en: string
          creado_por: string | null
          descripcion: string | null
          id: string
          proyecto_id: string
          restriccion_pintura: string | null
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          codigo: string
          creado_en?: string
          creado_por?: string | null
          descripcion?: string | null
          id?: string
          proyecto_id: string
          restriccion_pintura?: string | null
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          codigo?: string
          creado_en?: string
          creado_por?: string | null
          descripcion?: string | null
          id?: string
          proyecto_id?: string
          restriccion_pintura?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cat_aislacion_ext_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cat_aislacion_ext_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "v_cartera_kpis"
            referencedColumns: ["id"]
          },
        ]
      }
      cat_clase_piping: {
        Row: {
          activo: boolean
          actualizado_en: string
          actualizado_por: string | null
          aplicacion: string | null
          codigo: string
          creado_en: string
          creado_por: string | null
          descripcion: string | null
          fluido_id: string | null
          id: string
          material: string | null
          presion_max: number | null
          presion_psi: number | null
          proyecto_id: string
          temp_max: number | null
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          aplicacion?: string | null
          codigo: string
          creado_en?: string
          creado_por?: string | null
          descripcion?: string | null
          fluido_id?: string | null
          id?: string
          material?: string | null
          presion_max?: number | null
          presion_psi?: number | null
          proyecto_id: string
          temp_max?: number | null
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          aplicacion?: string | null
          codigo?: string
          creado_en?: string
          creado_por?: string | null
          descripcion?: string | null
          fluido_id?: string | null
          id?: string
          material?: string | null
          presion_max?: number | null
          presion_psi?: number | null
          proyecto_id?: string
          temp_max?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cat_clase_piping_fluido_id_fkey"
            columns: ["fluido_id"]
            isOneToOne: false
            referencedRelation: "cat_fluido_servicio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cat_clase_piping_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cat_clase_piping_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "v_cartera_kpis"
            referencedColumns: ["id"]
          },
        ]
      }
      cat_cwa: {
        Row: {
          activo: boolean
          actualizado_en: string
          actualizado_por: string | null
          codigo: string
          creado_en: string
          creado_por: string | null
          descripcion: string | null
          id: string
          proyecto_id: string
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          codigo: string
          creado_en?: string
          creado_por?: string | null
          descripcion?: string | null
          id?: string
          proyecto_id: string
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          codigo?: string
          creado_en?: string
          creado_por?: string | null
          descripcion?: string | null
          id?: string
          proyecto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cat_cwa_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cat_cwa_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "v_cartera_kpis"
            referencedColumns: ["id"]
          },
        ]
      }
      cat_cwp: {
        Row: {
          activo: boolean
          actualizado_en: string
          actualizado_por: string | null
          codigo: string
          creado_en: string
          creado_por: string | null
          cwa_id: string | null
          descripcion: string | null
          id: string
          proyecto_id: string
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          codigo: string
          creado_en?: string
          creado_por?: string | null
          cwa_id?: string | null
          descripcion?: string | null
          id?: string
          proyecto_id: string
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          codigo?: string
          creado_en?: string
          creado_por?: string | null
          cwa_id?: string | null
          descripcion?: string | null
          id?: string
          proyecto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cat_cwp_cwa_id_fkey"
            columns: ["cwa_id"]
            isOneToOne: false
            referencedRelation: "cat_cwa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cat_cwp_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cat_cwp_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "v_cartera_kpis"
            referencedColumns: ["id"]
          },
        ]
      }
      cat_diametros_nps: {
        Row: {
          activo: boolean
          actualizado_en: string
          actualizado_por: string | null
          creado_en: string
          creado_por: string | null
          id: string
          nps: string
          nps_mm: number | null
          proyecto_id: string
          tipo_material: string | null
          unidad_medida: string | null
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          creado_en?: string
          creado_por?: string | null
          id?: string
          nps: string
          nps_mm?: number | null
          proyecto_id: string
          tipo_material?: string | null
          unidad_medida?: string | null
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          creado_en?: string
          creado_por?: string | null
          id?: string
          nps?: string
          nps_mm?: number | null
          proyecto_id?: string
          tipo_material?: string | null
          unidad_medida?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cat_diametros_nps_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cat_diametros_nps_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "v_cartera_kpis"
            referencedColumns: ["id"]
          },
        ]
      }
      cat_esquema_pintura: {
        Row: {
          activo: boolean
          actualizado_en: string
          actualizado_por: string | null
          capas: number | null
          codigo: string
          creado_en: string
          creado_por: string | null
          descripcion: string | null
          detalle_capas: string | null
          espesor_total_um: number | null
          id: string
          preparacion_superficie: string | null
          proyecto_id: string
          sistema_aplicacion: string | null
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          capas?: number | null
          codigo: string
          creado_en?: string
          creado_por?: string | null
          descripcion?: string | null
          detalle_capas?: string | null
          espesor_total_um?: number | null
          id?: string
          preparacion_superficie?: string | null
          proyecto_id: string
          sistema_aplicacion?: string | null
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          capas?: number | null
          codigo?: string
          creado_en?: string
          creado_por?: string | null
          descripcion?: string | null
          detalle_capas?: string | null
          espesor_total_um?: number | null
          id?: string
          preparacion_superficie?: string | null
          proyecto_id?: string
          sistema_aplicacion?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cat_esquema_pintura_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cat_esquema_pintura_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "v_cartera_kpis"
            referencedColumns: ["id"]
          },
        ]
      }
      cat_fluido_servicio: {
        Row: {
          activo: boolean
          actualizado_en: string
          actualizado_por: string | null
          codigo: string
          color_nombre: string | null
          color_ral: string | null
          creado_en: string
          creado_por: string | null
          descripcion: string | null
          id: string
          nombre: string | null
          proyecto_id: string
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          codigo: string
          color_nombre?: string | null
          color_ral?: string | null
          creado_en?: string
          creado_por?: string | null
          descripcion?: string | null
          id?: string
          nombre?: string | null
          proyecto_id: string
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          codigo?: string
          color_nombre?: string | null
          color_ral?: string | null
          creado_en?: string
          creado_por?: string | null
          descripcion?: string | null
          id?: string
          nombre?: string | null
          proyecto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cat_fluido_servicio_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cat_fluido_servicio_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "v_cartera_kpis"
            referencedColumns: ["id"]
          },
        ]
      }
      cat_iwp: {
        Row: {
          activo: boolean
          actualizado_en: string
          actualizado_por: string | null
          codigo: string
          creado_en: string
          creado_por: string | null
          cwp_id: string | null
          descripcion: string | null
          fecha_fin: string | null
          fecha_inicio: string | null
          id: string
          proyecto_id: string
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          codigo: string
          creado_en?: string
          creado_por?: string | null
          cwp_id?: string | null
          descripcion?: string | null
          fecha_fin?: string | null
          fecha_inicio?: string | null
          id?: string
          proyecto_id: string
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          codigo?: string
          creado_en?: string
          creado_por?: string | null
          cwp_id?: string | null
          descripcion?: string | null
          fecha_fin?: string | null
          fecha_inicio?: string | null
          id?: string
          proyecto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cat_iwp_cwp_id_fkey"
            columns: ["cwp_id"]
            isOneToOne: false
            referencedRelation: "cat_cwp"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cat_iwp_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cat_iwp_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "v_cartera_kpis"
            referencedColumns: ["id"]
          },
        ]
      }
      cat_personal: {
        Row: {
          activo: boolean
          actualizado_en: string
          actualizado_por: string | null
          area: string | null
          cargo: string | null
          certificacion: string | null
          creado_en: string
          creado_por: string | null
          especialidad: string | null
          estado: string | null
          estampa: string
          id: string
          nombre: string
          proyecto_id: string
          rut: string | null
          supervisor: string | null
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          area?: string | null
          cargo?: string | null
          certificacion?: string | null
          creado_en?: string
          creado_por?: string | null
          especialidad?: string | null
          estado?: string | null
          estampa: string
          id?: string
          nombre: string
          proyecto_id: string
          rut?: string | null
          supervisor?: string | null
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          area?: string | null
          cargo?: string | null
          certificacion?: string | null
          creado_en?: string
          creado_por?: string | null
          especialidad?: string | null
          estado?: string | null
          estampa?: string
          id?: string
          nombre?: string
          proyecto_id?: string
          rut?: string | null
          supervisor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cat_personal_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cat_personal_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "v_cartera_kpis"
            referencedColumns: ["id"]
          },
        ]
      }
      cat_porcentaje_nde: {
        Row: {
          activo: boolean
          actualizado_en: string
          actualizado_por: string | null
          aplicacion: string | null
          codigo: string
          creado_en: string
          creado_por: string | null
          descripcion: string | null
          id: string
          metodo: string | null
          norma: string | null
          porcentaje: number
          proyecto_id: string
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          aplicacion?: string | null
          codigo: string
          creado_en?: string
          creado_por?: string | null
          descripcion?: string | null
          id?: string
          metodo?: string | null
          norma?: string | null
          porcentaje: number
          proyecto_id: string
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          aplicacion?: string | null
          codigo?: string
          creado_en?: string
          creado_por?: string | null
          descripcion?: string | null
          id?: string
          metodo?: string | null
          norma?: string | null
          porcentaje?: number
          proyecto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cat_porcentaje_nde_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cat_porcentaje_nde_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "v_cartera_kpis"
            referencedColumns: ["id"]
          },
        ]
      }
      cat_revestimiento_int: {
        Row: {
          activo: boolean
          actualizado_en: string
          actualizado_por: string | null
          codigo: string
          creado_en: string
          creado_por: string | null
          descripcion: string | null
          especificacion: string | null
          id: string
          proyecto_id: string
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          codigo: string
          creado_en?: string
          creado_por?: string | null
          descripcion?: string | null
          especificacion?: string | null
          id?: string
          proyecto_id: string
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          codigo?: string
          creado_en?: string
          creado_por?: string | null
          descripcion?: string | null
          especificacion?: string | null
          id?: string
          proyecto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cat_revestimiento_int_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cat_revestimiento_int_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "v_cartera_kpis"
            referencedColumns: ["id"]
          },
        ]
      }
      cat_tipo_prueba: {
        Row: {
          activo: boolean
          actualizado_en: string
          actualizado_por: string | null
          aplicacion: string | null
          codigo: string
          condicion_diseno: string | null
          creado_en: string
          creado_por: string | null
          descripcion: string | null
          id: string
          medio_fluido: string | null
          proyecto_id: string
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          aplicacion?: string | null
          codigo: string
          condicion_diseno?: string | null
          creado_en?: string
          creado_por?: string | null
          descripcion?: string | null
          id?: string
          medio_fluido?: string | null
          proyecto_id: string
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          aplicacion?: string | null
          codigo?: string
          condicion_diseno?: string | null
          creado_en?: string
          creado_por?: string | null
          descripcion?: string | null
          id?: string
          medio_fluido?: string | null
          proyecto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cat_tipo_prueba_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cat_tipo_prueba_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "v_cartera_kpis"
            referencedColumns: ["id"]
          },
        ]
      }
      cat_tipo_soporte: {
        Row: {
          activo: boolean
          actualizado_en: string
          actualizado_por: string | null
          codigo: string
          creado_en: string
          creado_por: string | null
          descripcion: string | null
          id: string
          proyecto_id: string
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          codigo: string
          creado_en?: string
          creado_por?: string | null
          descripcion?: string | null
          id?: string
          proyecto_id: string
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          codigo?: string
          creado_en?: string
          creado_por?: string | null
          descripcion?: string | null
          id?: string
          proyecto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cat_tipo_soporte_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cat_tipo_soporte_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "v_cartera_kpis"
            referencedColumns: ["id"]
          },
        ]
      }
      cat_tipo_union: {
        Row: {
          acronimo: string | null
          activo: boolean
          actualizado_en: string
          actualizado_por: string | null
          aplicacion: string | null
          codigo: string
          creado_en: string
          creado_por: string | null
          descripcion: string | null
          id: string
          metodo_trabajo: string | null
          nde_requerido: string | null
          proyecto_id: string
          tipo_uniones: string | null
        }
        Insert: {
          acronimo?: string | null
          activo?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          aplicacion?: string | null
          codigo: string
          creado_en?: string
          creado_por?: string | null
          descripcion?: string | null
          id?: string
          metodo_trabajo?: string | null
          nde_requerido?: string | null
          proyecto_id: string
          tipo_uniones?: string | null
        }
        Update: {
          acronimo?: string | null
          activo?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          aplicacion?: string | null
          codigo?: string
          creado_en?: string
          creado_por?: string | null
          descripcion?: string | null
          id?: string
          metodo_trabajo?: string | null
          nde_requerido?: string | null
          proyecto_id?: string
          tipo_uniones?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cat_tipo_union_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cat_tipo_union_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "v_cartera_kpis"
            referencedColumns: ["id"]
          },
        ]
      }
      doc_biblioteca: {
        Row: {
          actualizado_en: string
          actualizado_por: string | null
          anotaciones: Json | null
          codigo: string | null
          creado_en: string
          creado_por: string | null
          descripcion: string | null
          error_detalle: string | null
          estado_procesamiento: Database["lukeapp"]["Enums"]["estado_procesamiento_doc"]
          fecha_documento: string | null
          hash: string | null
          id: string
          lote_ia_id: string | null
          metadata: Json | null
          mime_type: string | null
          n_chunks: number | null
          n_paginas: number | null
          nombre_original: string | null
          proyecto_id: string
          revision: string | null
          storage_path: string
          tamanio_bytes: number | null
          tipo_documento: Database["lukeapp"]["Enums"]["tipo_documento"]
          titulo: string
        }
        Insert: {
          actualizado_en?: string
          actualizado_por?: string | null
          anotaciones?: Json | null
          codigo?: string | null
          creado_en?: string
          creado_por?: string | null
          descripcion?: string | null
          error_detalle?: string | null
          estado_procesamiento?: Database["lukeapp"]["Enums"]["estado_procesamiento_doc"]
          fecha_documento?: string | null
          hash?: string | null
          id?: string
          lote_ia_id?: string | null
          metadata?: Json | null
          mime_type?: string | null
          n_chunks?: number | null
          n_paginas?: number | null
          nombre_original?: string | null
          proyecto_id: string
          revision?: string | null
          storage_path: string
          tamanio_bytes?: number | null
          tipo_documento: Database["lukeapp"]["Enums"]["tipo_documento"]
          titulo: string
        }
        Update: {
          actualizado_en?: string
          actualizado_por?: string | null
          anotaciones?: Json | null
          codigo?: string | null
          creado_en?: string
          creado_por?: string | null
          descripcion?: string | null
          error_detalle?: string | null
          estado_procesamiento?: Database["lukeapp"]["Enums"]["estado_procesamiento_doc"]
          fecha_documento?: string | null
          hash?: string | null
          id?: string
          lote_ia_id?: string | null
          metadata?: Json | null
          mime_type?: string | null
          n_chunks?: number | null
          n_paginas?: number | null
          nombre_original?: string | null
          proyecto_id?: string
          revision?: string | null
          storage_path?: string
          tamanio_bytes?: number | null
          tipo_documento?: Database["lukeapp"]["Enums"]["tipo_documento"]
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "doc_biblioteca_lote_ia_id_fkey"
            columns: ["lote_ia_id"]
            isOneToOne: false
            referencedRelation: "import_lotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doc_biblioteca_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doc_biblioteca_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "v_cartera_kpis"
            referencedColumns: ["id"]
          },
        ]
      }
      doc_chunks: {
        Row: {
          contenido: string
          creado_en: string
          documento_id: string
          embedding: string | null
          id: string
          metadata: Json | null
          nro_chunk: number
          pagina_fin: number | null
          pagina_inicio: number | null
          proyecto_id: string
        }
        Insert: {
          contenido: string
          creado_en?: string
          documento_id: string
          embedding?: string | null
          id?: string
          metadata?: Json | null
          nro_chunk: number
          pagina_fin?: number | null
          pagina_inicio?: number | null
          proyecto_id: string
        }
        Update: {
          contenido?: string
          creado_en?: string
          documento_id?: string
          embedding?: string | null
          id?: string
          metadata?: Json | null
          nro_chunk?: number
          pagina_fin?: number | null
          pagina_inicio?: number | null
          proyecto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doc_chunks_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "doc_biblioteca"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doc_chunks_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doc_chunks_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "v_cartera_kpis"
            referencedColumns: ["id"]
          },
        ]
      }
      doc_revision_events: {
        Row: {
          comentario: string | null
          creado_en: string
          creado_por: string | null
          entidad: string
          evento: string
          fecha_evento: string
          id: string
          proyecto_id: string
          registro_id: string
          revision: string | null
          usuario_id: string | null
        }
        Insert: {
          comentario?: string | null
          creado_en?: string
          creado_por?: string | null
          entidad: string
          evento: string
          fecha_evento?: string
          id?: string
          proyecto_id: string
          registro_id: string
          revision?: string | null
          usuario_id?: string | null
        }
        Update: {
          comentario?: string | null
          creado_en?: string
          creado_por?: string | null
          entidad?: string
          evento?: string
          fecha_evento?: string
          id?: string
          proyecto_id?: string
          registro_id?: string
          revision?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "doc_revision_events_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doc_revision_events_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "v_cartera_kpis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doc_revision_events_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      documento_referencias: {
        Row: {
          catalogo_sugerido: string | null
          cita: string | null
          codigo_documento: string
          creado_en: string
          documento_id: string
          estado: string
          id: string
          pagina: number | null
          proyecto_id: string
          resuelta_por_doc: string | null
          titulo: string | null
        }
        Insert: {
          catalogo_sugerido?: string | null
          cita?: string | null
          codigo_documento: string
          creado_en?: string
          documento_id: string
          estado?: string
          id?: string
          pagina?: number | null
          proyecto_id: string
          resuelta_por_doc?: string | null
          titulo?: string | null
        }
        Update: {
          catalogo_sugerido?: string | null
          cita?: string | null
          codigo_documento?: string
          creado_en?: string
          documento_id?: string
          estado?: string
          id?: string
          pagina?: number | null
          proyecto_id?: string
          resuelta_por_doc?: string | null
          titulo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documento_referencias_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "doc_biblioteca"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documento_referencias_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documento_referencias_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "v_cartera_kpis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documento_referencias_resuelta_por_doc_fkey"
            columns: ["resuelta_por_doc"]
            isOneToOne: false
            referencedRelation: "doc_biblioteca"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          activo: boolean
          actualizado_en: string
          actualizado_por: string | null
          creado_en: string
          creado_por: string | null
          id: string
          nombre: string
          rut: string | null
          tipo: Database["lukeapp"]["Enums"]["empresa_tipo"]
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          creado_en?: string
          creado_por?: string | null
          id?: string
          nombre: string
          rut?: string | null
          tipo?: Database["lukeapp"]["Enums"]["empresa_tipo"]
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          creado_en?: string
          creado_por?: string | null
          id?: string
          nombre?: string
          rut?: string | null
          tipo?: Database["lukeapp"]["Enums"]["empresa_tipo"]
        }
        Relationships: []
      }
      evidencias: {
        Row: {
          actualizado_en: string
          actualizado_por: string | null
          creado_en: string
          creado_por: string | null
          entidad: string
          hash: string | null
          id: string
          mime_type: string | null
          nombre_original: string | null
          proyecto_id: string
          registro_id: string
          storage_path: string
          subida_en: string | null
          subida_pendiente: boolean
          tamanio_bytes: number | null
          tipo: Database["lukeapp"]["Enums"]["tipo_evidencia"]
        }
        Insert: {
          actualizado_en?: string
          actualizado_por?: string | null
          creado_en?: string
          creado_por?: string | null
          entidad: string
          hash?: string | null
          id?: string
          mime_type?: string | null
          nombre_original?: string | null
          proyecto_id: string
          registro_id: string
          storage_path: string
          subida_en?: string | null
          subida_pendiente?: boolean
          tamanio_bytes?: number | null
          tipo: Database["lukeapp"]["Enums"]["tipo_evidencia"]
        }
        Update: {
          actualizado_en?: string
          actualizado_por?: string | null
          creado_en?: string
          creado_por?: string | null
          entidad?: string
          hash?: string | null
          id?: string
          mime_type?: string | null
          nombre_original?: string | null
          proyecto_id?: string
          registro_id?: string
          storage_path?: string
          subida_en?: string | null
          subida_pendiente?: boolean
          tamanio_bytes?: number | null
          tipo?: Database["lukeapp"]["Enums"]["tipo_evidencia"]
        }
        Relationships: [
          {
            foreignKeyName: "evidencias_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidencias_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "v_cartera_kpis"
            referencedColumns: ["id"]
          },
        ]
      }
      import_filas: {
        Row: {
          accion: Database["lukeapp"]["Enums"]["accion_fila"] | null
          aprobada: boolean | null
          clave_natural: string | null
          confianza: number | null
          creado_en: string
          diff: Json | null
          error_detalle: string | null
          fuente: Json | null
          id: string
          lote_id: string
          nro_fila: number
          payload: Json
        }
        Insert: {
          accion?: Database["lukeapp"]["Enums"]["accion_fila"] | null
          aprobada?: boolean | null
          clave_natural?: string | null
          confianza?: number | null
          creado_en?: string
          diff?: Json | null
          error_detalle?: string | null
          fuente?: Json | null
          id?: string
          lote_id: string
          nro_fila: number
          payload: Json
        }
        Update: {
          accion?: Database["lukeapp"]["Enums"]["accion_fila"] | null
          aprobada?: boolean | null
          clave_natural?: string | null
          confianza?: number | null
          creado_en?: string
          diff?: Json | null
          error_detalle?: string | null
          fuente?: Json | null
          id?: string
          lote_id?: string
          nro_fila?: number
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "import_filas_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "import_lotes"
            referencedColumns: ["id"]
          },
        ]
      }
      import_lotes: {
        Row: {
          actualizado_en: string
          actualizado_por: string | null
          archivo_storage_path: string | null
          creado_en: string
          creado_por: string | null
          documento_id: string | null
          estado: Database["lukeapp"]["Enums"]["estado_lote"]
          hash_archivo: string | null
          id: string
          origen: string
          perfil_id: string
          proyecto_id: string
          resumen: Json | null
        }
        Insert: {
          actualizado_en?: string
          actualizado_por?: string | null
          archivo_storage_path?: string | null
          creado_en?: string
          creado_por?: string | null
          documento_id?: string | null
          estado?: Database["lukeapp"]["Enums"]["estado_lote"]
          hash_archivo?: string | null
          id?: string
          origen?: string
          perfil_id: string
          proyecto_id: string
          resumen?: Json | null
        }
        Update: {
          actualizado_en?: string
          actualizado_por?: string | null
          archivo_storage_path?: string | null
          creado_en?: string
          creado_por?: string | null
          documento_id?: string | null
          estado?: Database["lukeapp"]["Enums"]["estado_lote"]
          hash_archivo?: string | null
          id?: string
          origen?: string
          perfil_id?: string
          proyecto_id?: string
          resumen?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "import_lotes_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "doc_biblioteca"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_lotes_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "import_perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_lotes_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_lotes_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "v_cartera_kpis"
            referencedColumns: ["id"]
          },
        ]
      }
      import_perfiles: {
        Row: {
          activo: boolean
          actualizado_en: string
          actualizado_por: string | null
          creado_en: string
          creado_por: string | null
          id: string
          mapeo: Json
          nombre: string
          opciones: Json | null
          proyecto_id: string
          tabla_destino: string
          version: number
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          creado_en?: string
          creado_por?: string | null
          id?: string
          mapeo: Json
          nombre: string
          opciones?: Json | null
          proyecto_id: string
          tabla_destino: string
          version?: number
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          creado_en?: string
          creado_por?: string | null
          id?: string
          mapeo?: Json
          nombre?: string
          opciones?: Json | null
          proyecto_id?: string
          tabla_destino?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "import_perfiles_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_perfiles_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "v_cartera_kpis"
            referencedColumns: ["id"]
          },
        ]
      }
      list_bim: {
        Row: {
          actualizado_en: string
          actualizado_por: string | null
          autocad_size: string | null
          creado_en: string
          creado_por: string | null
          cwp_codigo: string | null
          descripcion: string | null
          elemento_guid: string
          id: string
          linea_numero: string | null
          proyecto_id: string
          soporte_id: string | null
          spool_id: string | null
          tag: string | null
          valvula_id: string | null
        }
        Insert: {
          actualizado_en?: string
          actualizado_por?: string | null
          autocad_size?: string | null
          creado_en?: string
          creado_por?: string | null
          cwp_codigo?: string | null
          descripcion?: string | null
          elemento_guid: string
          id?: string
          linea_numero?: string | null
          proyecto_id: string
          soporte_id?: string | null
          spool_id?: string | null
          tag?: string | null
          valvula_id?: string | null
        }
        Update: {
          actualizado_en?: string
          actualizado_por?: string | null
          autocad_size?: string | null
          creado_en?: string
          creado_por?: string | null
          cwp_codigo?: string | null
          descripcion?: string | null
          elemento_guid?: string
          id?: string
          linea_numero?: string | null
          proyecto_id?: string
          soporte_id?: string | null
          spool_id?: string | null
          tag?: string | null
          valvula_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "list_bim_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_bim_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "v_cartera_kpis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_bim_soporte_id_fkey"
            columns: ["soporte_id"]
            isOneToOne: false
            referencedRelation: "list_soportes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_bim_spool_id_fkey"
            columns: ["spool_id"]
            isOneToOne: false
            referencedRelation: "list_spools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_bim_valvula_id_fkey"
            columns: ["valvula_id"]
            isOneToOne: false
            referencedRelation: "list_valvulas"
            referencedColumns: ["id"]
          },
        ]
      }
      list_equipos: {
        Row: {
          activo: boolean
          actualizado_en: string
          actualizado_por: string | null
          area: string | null
          creado_en: string
          creado_por: string | null
          descripcion: string | null
          id: string
          id_equipo: string
          proyecto_id: string
          tag: string | null
          tipo: string | null
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          area?: string | null
          creado_en?: string
          creado_por?: string | null
          descripcion?: string | null
          id?: string
          id_equipo: string
          proyecto_id: string
          tag?: string | null
          tipo?: string | null
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          area?: string | null
          creado_en?: string
          creado_por?: string | null
          descripcion?: string | null
          id?: string
          id_equipo?: string
          proyecto_id?: string
          tag?: string | null
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "list_equipos_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_equipos_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "v_cartera_kpis"
            referencedColumns: ["id"]
          },
        ]
      }
      list_esp_elem: {
        Row: {
          activo: boolean
          actualizado_en: string
          actualizado_por: string | null
          creado_en: string
          creado_por: string | null
          descripcion: string | null
          estado: string
          id: string
          id_esp_elem: string
          mec_id: string | null
          proyecto_id: string
          tipo: string | null
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          creado_en?: string
          creado_por?: string | null
          descripcion?: string | null
          estado?: string
          id?: string
          id_esp_elem: string
          mec_id?: string | null
          proyecto_id: string
          tipo?: string | null
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          creado_en?: string
          creado_por?: string | null
          descripcion?: string | null
          estado?: string
          id?: string
          id_esp_elem?: string
          mec_id?: string | null
          proyecto_id?: string
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "list_esp_elem_mec_id_fkey"
            columns: ["mec_id"]
            isOneToOne: false
            referencedRelation: "list_mec"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_esp_elem_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_esp_elem_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "v_cartera_kpis"
            referencedColumns: ["id"]
          },
        ]
      }
      list_isos: {
        Row: {
          activo: boolean
          actualizado_en: string
          actualizado_por: string | null
          creado_en: string
          creado_por: string | null
          descripcion: string | null
          estado: string | null
          id: string
          id_iso: string | null
          id_linea: string
          linea_id: string
          pdf_path: string | null
          proyecto_id: string
          revision: string | null
          sheet: string
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          creado_en?: string
          creado_por?: string | null
          descripcion?: string | null
          estado?: string | null
          id?: string
          id_iso?: string | null
          id_linea: string
          linea_id: string
          pdf_path?: string | null
          proyecto_id: string
          revision?: string | null
          sheet: string
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          creado_en?: string
          creado_por?: string | null
          descripcion?: string | null
          estado?: string | null
          id?: string
          id_iso?: string | null
          id_linea?: string
          linea_id?: string
          pdf_path?: string | null
          proyecto_id?: string
          revision?: string | null
          sheet?: string
        }
        Relationships: [
          {
            foreignKeyName: "list_isos_linea_id_fkey"
            columns: ["linea_id"]
            isOneToOne: false
            referencedRelation: "list_lineas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_isos_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_isos_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "v_cartera_kpis"
            referencedColumns: ["id"]
          },
        ]
      }
      list_juntas: {
        Row: {
          activo: boolean
          actualizado_en: string
          actualizado_por: string | null
          creado_en: string
          creado_por: string | null
          estado: string
          id: string
          id_spool: string
          linea_id: string
          material_base: string | null
          nde_id: string | null
          nps_id: string | null
          nps_texto: string | null
          numero_junta: string
          porcentaje_nde: number | null
          proceso_soldadura: string | null
          proyecto_id: string
          requiere_pmi: boolean
          requiere_pwht: boolean
          spool_id: string
          tipo_union_id: string | null
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          creado_en?: string
          creado_por?: string | null
          estado?: string
          id?: string
          id_spool: string
          linea_id: string
          material_base?: string | null
          nde_id?: string | null
          nps_id?: string | null
          nps_texto?: string | null
          numero_junta: string
          porcentaje_nde?: number | null
          proceso_soldadura?: string | null
          proyecto_id: string
          requiere_pmi?: boolean
          requiere_pwht?: boolean
          spool_id: string
          tipo_union_id?: string | null
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          creado_en?: string
          creado_por?: string | null
          estado?: string
          id?: string
          id_spool?: string
          linea_id?: string
          material_base?: string | null
          nde_id?: string | null
          nps_id?: string | null
          nps_texto?: string | null
          numero_junta?: string
          porcentaje_nde?: number | null
          proceso_soldadura?: string | null
          proyecto_id?: string
          requiere_pmi?: boolean
          requiere_pwht?: boolean
          spool_id?: string
          tipo_union_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "list_juntas_linea_id_fkey"
            columns: ["linea_id"]
            isOneToOne: false
            referencedRelation: "list_lineas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_juntas_nde_id_fkey"
            columns: ["nde_id"]
            isOneToOne: false
            referencedRelation: "cat_porcentaje_nde"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_juntas_nps_id_fkey"
            columns: ["nps_id"]
            isOneToOne: false
            referencedRelation: "cat_diametros_nps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_juntas_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_juntas_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "v_cartera_kpis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_juntas_spool_id_fkey"
            columns: ["spool_id"]
            isOneToOne: false
            referencedRelation: "list_spools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_juntas_tipo_union_id_fkey"
            columns: ["tipo_union_id"]
            isOneToOne: false
            referencedRelation: "cat_tipo_union"
            referencedColumns: ["id"]
          },
        ]
      }
      list_lineas: {
        Row: {
          activo: boolean
          actualizado_en: string
          actualizado_por: string | null
          aislacion_id: string | null
          ausente_en_revision: boolean
          clase_id: string | null
          creado_en: string
          creado_por: string | null
          cwa_id: string | null
          cwp_id: string | null
          descripcion: string | null
          fluido_id: string | null
          id: string
          id_linea: string
          iwp_id: string | null
          longitud_total: number | null
          nde_id: string | null
          nps_id: string | null
          nps_texto: string | null
          pintura_id: string | null
          proyecto_id: string
          prueba_id: string | null
          revestimiento_id: string | null
          usa_pmi: boolean
          usa_pwht: boolean
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          aislacion_id?: string | null
          ausente_en_revision?: boolean
          clase_id?: string | null
          creado_en?: string
          creado_por?: string | null
          cwa_id?: string | null
          cwp_id?: string | null
          descripcion?: string | null
          fluido_id?: string | null
          id?: string
          id_linea: string
          iwp_id?: string | null
          longitud_total?: number | null
          nde_id?: string | null
          nps_id?: string | null
          nps_texto?: string | null
          pintura_id?: string | null
          proyecto_id: string
          prueba_id?: string | null
          revestimiento_id?: string | null
          usa_pmi?: boolean
          usa_pwht?: boolean
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          aislacion_id?: string | null
          ausente_en_revision?: boolean
          clase_id?: string | null
          creado_en?: string
          creado_por?: string | null
          cwa_id?: string | null
          cwp_id?: string | null
          descripcion?: string | null
          fluido_id?: string | null
          id?: string
          id_linea?: string
          iwp_id?: string | null
          longitud_total?: number | null
          nde_id?: string | null
          nps_id?: string | null
          nps_texto?: string | null
          pintura_id?: string | null
          proyecto_id?: string
          prueba_id?: string | null
          revestimiento_id?: string | null
          usa_pmi?: boolean
          usa_pwht?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "list_lineas_aislacion_id_fkey"
            columns: ["aislacion_id"]
            isOneToOne: false
            referencedRelation: "cat_aislacion_ext"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_lineas_clase_id_fkey"
            columns: ["clase_id"]
            isOneToOne: false
            referencedRelation: "cat_clase_piping"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_lineas_cwa_id_fkey"
            columns: ["cwa_id"]
            isOneToOne: false
            referencedRelation: "cat_cwa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_lineas_cwp_id_fkey"
            columns: ["cwp_id"]
            isOneToOne: false
            referencedRelation: "cat_cwp"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_lineas_fluido_id_fkey"
            columns: ["fluido_id"]
            isOneToOne: false
            referencedRelation: "cat_fluido_servicio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_lineas_iwp_id_fkey"
            columns: ["iwp_id"]
            isOneToOne: false
            referencedRelation: "cat_iwp"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_lineas_nde_id_fkey"
            columns: ["nde_id"]
            isOneToOne: false
            referencedRelation: "cat_porcentaje_nde"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_lineas_nps_id_fkey"
            columns: ["nps_id"]
            isOneToOne: false
            referencedRelation: "cat_diametros_nps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_lineas_pintura_id_fkey"
            columns: ["pintura_id"]
            isOneToOne: false
            referencedRelation: "cat_esquema_pintura"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_lineas_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_lineas_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "v_cartera_kpis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_lineas_prueba_id_fkey"
            columns: ["prueba_id"]
            isOneToOne: false
            referencedRelation: "cat_tipo_prueba"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_lineas_revestimiento_id_fkey"
            columns: ["revestimiento_id"]
            isOneToOne: false
            referencedRelation: "cat_revestimiento_int"
            referencedColumns: ["id"]
          },
        ]
      }
      list_mec: {
        Row: {
          activo: boolean
          actualizado_en: string
          actualizado_por: string | null
          creado_en: string
          creado_por: string | null
          descripcion: string | null
          equipo_id: string | null
          estado: string
          id: string
          id_mec: string
          proyecto_id: string
          tag: string | null
          tipo: string | null
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          creado_en?: string
          creado_por?: string | null
          descripcion?: string | null
          equipo_id?: string | null
          estado?: string
          id?: string
          id_mec: string
          proyecto_id: string
          tag?: string | null
          tipo?: string | null
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          creado_en?: string
          creado_por?: string | null
          descripcion?: string | null
          equipo_id?: string | null
          estado?: string
          id?: string
          id_mec?: string
          proyecto_id?: string
          tag?: string | null
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "list_mec_equipo_id_fkey"
            columns: ["equipo_id"]
            isOneToOne: false
            referencedRelation: "list_equipos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_mec_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_mec_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "v_cartera_kpis"
            referencedColumns: ["id"]
          },
        ]
      }
      list_mto: {
        Row: {
          activo: boolean
          actualizado_en: string
          actualizado_por: string | null
          ausente_en_revision: boolean
          cantidad: number | null
          clase_id: string | null
          creado_en: string
          creado_por: string | null
          descripcion: string | null
          heat_number: string | null
          id: string
          item: string
          linea_id: string | null
          material: string | null
          norma: string | null
          nps_id: string | null
          nps_texto: string | null
          proyecto_id: string
          schedule: string | null
          spool_id: string | null
          tag: string | null
          unidad: string | null
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          ausente_en_revision?: boolean
          cantidad?: number | null
          clase_id?: string | null
          creado_en?: string
          creado_por?: string | null
          descripcion?: string | null
          heat_number?: string | null
          id?: string
          item: string
          linea_id?: string | null
          material?: string | null
          norma?: string | null
          nps_id?: string | null
          nps_texto?: string | null
          proyecto_id: string
          schedule?: string | null
          spool_id?: string | null
          tag?: string | null
          unidad?: string | null
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          ausente_en_revision?: boolean
          cantidad?: number | null
          clase_id?: string | null
          creado_en?: string
          creado_por?: string | null
          descripcion?: string | null
          heat_number?: string | null
          id?: string
          item?: string
          linea_id?: string | null
          material?: string | null
          norma?: string | null
          nps_id?: string | null
          nps_texto?: string | null
          proyecto_id?: string
          schedule?: string | null
          spool_id?: string | null
          tag?: string | null
          unidad?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "list_mto_clase_id_fkey"
            columns: ["clase_id"]
            isOneToOne: false
            referencedRelation: "cat_clase_piping"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_mto_linea_id_fkey"
            columns: ["linea_id"]
            isOneToOne: false
            referencedRelation: "list_lineas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_mto_nps_id_fkey"
            columns: ["nps_id"]
            isOneToOne: false
            referencedRelation: "cat_diametros_nps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_mto_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_mto_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "v_cartera_kpis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_mto_spool_id_fkey"
            columns: ["spool_id"]
            isOneToOne: false
            referencedRelation: "list_spools"
            referencedColumns: ["id"]
          },
        ]
      }
      list_pid: {
        Row: {
          activo: boolean
          actualizado_en: string
          actualizado_por: string | null
          creado_en: string
          creado_por: string | null
          descripcion: string | null
          estado: string | null
          id: string
          id_pid: string
          pdf_path: string | null
          proyecto_id: string
          revision: string | null
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          creado_en?: string
          creado_por?: string | null
          descripcion?: string | null
          estado?: string | null
          id?: string
          id_pid: string
          pdf_path?: string | null
          proyecto_id: string
          revision?: string | null
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          creado_en?: string
          creado_por?: string | null
          descripcion?: string | null
          estado?: string | null
          id?: string
          id_pid?: string
          pdf_path?: string | null
          proyecto_id?: string
          revision?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "list_pid_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_pid_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "v_cartera_kpis"
            referencedColumns: ["id"]
          },
        ]
      }
      list_soportes: {
        Row: {
          activo: boolean
          actualizado_en: string
          actualizado_por: string | null
          creado_en: string
          creado_por: string | null
          cwa_id: string | null
          descripcion: string | null
          estado: string
          id: string
          id_soporte: string
          linea_id: string | null
          proyecto_id: string
          sector: string | null
          tipo_soporte_id: string | null
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          creado_en?: string
          creado_por?: string | null
          cwa_id?: string | null
          descripcion?: string | null
          estado?: string
          id?: string
          id_soporte: string
          linea_id?: string | null
          proyecto_id: string
          sector?: string | null
          tipo_soporte_id?: string | null
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          creado_en?: string
          creado_por?: string | null
          cwa_id?: string | null
          descripcion?: string | null
          estado?: string
          id?: string
          id_soporte?: string
          linea_id?: string | null
          proyecto_id?: string
          sector?: string | null
          tipo_soporte_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "list_soportes_cwa_id_fkey"
            columns: ["cwa_id"]
            isOneToOne: false
            referencedRelation: "cat_cwa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_soportes_linea_id_fkey"
            columns: ["linea_id"]
            isOneToOne: false
            referencedRelation: "list_lineas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_soportes_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_soportes_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "v_cartera_kpis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_soportes_tipo_soporte_id_fkey"
            columns: ["tipo_soporte_id"]
            isOneToOne: false
            referencedRelation: "cat_tipo_soporte"
            referencedColumns: ["id"]
          },
        ]
      }
      list_spools: {
        Row: {
          activo: boolean
          actualizado_en: string
          actualizado_por: string | null
          creado_en: string
          creado_por: string | null
          estado_montaje: string | null
          id: string
          id_spool: string
          iso_id: string
          linea_id: string
          longitud: number | null
          nro_juntas: number | null
          peso: number | null
          proyecto_id: string
          sector: string | null
          tag_gestion: string | null
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          creado_en?: string
          creado_por?: string | null
          estado_montaje?: string | null
          id?: string
          id_spool: string
          iso_id: string
          linea_id: string
          longitud?: number | null
          nro_juntas?: number | null
          peso?: number | null
          proyecto_id: string
          sector?: string | null
          tag_gestion?: string | null
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          creado_en?: string
          creado_por?: string | null
          estado_montaje?: string | null
          id?: string
          id_spool?: string
          iso_id?: string
          linea_id?: string
          longitud?: number | null
          nro_juntas?: number | null
          peso?: number | null
          proyecto_id?: string
          sector?: string | null
          tag_gestion?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "list_spools_iso_id_fkey"
            columns: ["iso_id"]
            isOneToOne: false
            referencedRelation: "list_isos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_spools_linea_id_fkey"
            columns: ["linea_id"]
            isOneToOne: false
            referencedRelation: "list_lineas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_spools_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_spools_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "v_cartera_kpis"
            referencedColumns: ["id"]
          },
        ]
      }
      list_tie_ins: {
        Row: {
          activo: boolean
          actualizado_en: string
          actualizado_por: string | null
          creado_en: string
          creado_por: string | null
          descripcion: string | null
          estado: string
          id: string
          id_tie_in: string
          linea_id: string | null
          nps_id: string | null
          proyecto_id: string
          tipo: string | null
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          creado_en?: string
          creado_por?: string | null
          descripcion?: string | null
          estado?: string
          id?: string
          id_tie_in: string
          linea_id?: string | null
          nps_id?: string | null
          proyecto_id: string
          tipo?: string | null
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          creado_en?: string
          creado_por?: string | null
          descripcion?: string | null
          estado?: string
          id?: string
          id_tie_in?: string
          linea_id?: string | null
          nps_id?: string | null
          proyecto_id?: string
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "list_tie_ins_linea_id_fkey"
            columns: ["linea_id"]
            isOneToOne: false
            referencedRelation: "list_lineas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_tie_ins_nps_id_fkey"
            columns: ["nps_id"]
            isOneToOne: false
            referencedRelation: "cat_diametros_nps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_tie_ins_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_tie_ins_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "v_cartera_kpis"
            referencedColumns: ["id"]
          },
        ]
      }
      list_valvulas: {
        Row: {
          activo: boolean
          actuador: string | null
          actualizado_en: string
          actualizado_por: string | null
          clase_id: string | null
          creado_en: string
          creado_por: string | null
          estado: string
          id: string
          id_valvula: string
          linea_id: string | null
          nps_id: string | null
          nps_texto: string | null
          proyecto_id: string
          tag: string | null
          tipo: string | null
        }
        Insert: {
          activo?: boolean
          actuador?: string | null
          actualizado_en?: string
          actualizado_por?: string | null
          clase_id?: string | null
          creado_en?: string
          creado_por?: string | null
          estado?: string
          id?: string
          id_valvula: string
          linea_id?: string | null
          nps_id?: string | null
          nps_texto?: string | null
          proyecto_id: string
          tag?: string | null
          tipo?: string | null
        }
        Update: {
          activo?: boolean
          actuador?: string | null
          actualizado_en?: string
          actualizado_por?: string | null
          clase_id?: string | null
          creado_en?: string
          creado_por?: string | null
          estado?: string
          id?: string
          id_valvula?: string
          linea_id?: string | null
          nps_id?: string | null
          nps_texto?: string | null
          proyecto_id?: string
          tag?: string | null
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "list_valvulas_clase_id_fkey"
            columns: ["clase_id"]
            isOneToOne: false
            referencedRelation: "cat_clase_piping"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_valvulas_linea_id_fkey"
            columns: ["linea_id"]
            isOneToOne: false
            referencedRelation: "list_lineas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_valvulas_nps_id_fkey"
            columns: ["nps_id"]
            isOneToOne: false
            referencedRelation: "cat_diametros_nps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_valvulas_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_valvulas_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "v_cartera_kpis"
            referencedColumns: ["id"]
          },
        ]
      }
      log_guia: {
        Row: {
          actualizado_en: string
          actualizado_por: string | null
          creado_en: string
          creado_por: string | null
          destino: string | null
          fecha_emision: string | null
          id: string
          numero_guia: string
          observacion: string | null
          origen: string | null
          pdf_path: string | null
          proyecto_id: string
          tipo: string | null
          usuario_id: string | null
        }
        Insert: {
          actualizado_en?: string
          actualizado_por?: string | null
          creado_en?: string
          creado_por?: string | null
          destino?: string | null
          fecha_emision?: string | null
          id?: string
          numero_guia: string
          observacion?: string | null
          origen?: string | null
          pdf_path?: string | null
          proyecto_id: string
          tipo?: string | null
          usuario_id?: string | null
        }
        Update: {
          actualizado_en?: string
          actualizado_por?: string | null
          creado_en?: string
          creado_por?: string | null
          destino?: string | null
          fecha_emision?: string | null
          id?: string
          numero_guia?: string
          observacion?: string | null
          origen?: string | null
          pdf_path?: string | null
          proyecto_id?: string
          tipo?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "log_guia_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "log_guia_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "v_cartera_kpis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "log_guia_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      log_iso: {
        Row: {
          actualizado_en: string
          actualizado_por: string | null
          comentario: string | null
          creado_en: string
          creado_por: string | null
          evento: string
          fecha_evento: string
          id: string
          iso_id: string | null
          pdf_path: string | null
          proyecto_id: string
          revision: string | null
          usuario_id: string | null
        }
        Insert: {
          actualizado_en?: string
          actualizado_por?: string | null
          comentario?: string | null
          creado_en?: string
          creado_por?: string | null
          evento: string
          fecha_evento?: string
          id?: string
          iso_id?: string | null
          pdf_path?: string | null
          proyecto_id: string
          revision?: string | null
          usuario_id?: string | null
        }
        Update: {
          actualizado_en?: string
          actualizado_por?: string | null
          comentario?: string | null
          creado_en?: string
          creado_por?: string | null
          evento?: string
          fecha_evento?: string
          id?: string
          iso_id?: string | null
          pdf_path?: string | null
          proyecto_id?: string
          revision?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "log_iso_iso_id_fkey"
            columns: ["iso_id"]
            isOneToOne: false
            referencedRelation: "list_isos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "log_iso_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "log_iso_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "v_cartera_kpis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "log_iso_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      log_materiales: {
        Row: {
          actualizado_en: string
          actualizado_por: string | null
          cantidad: number
          creado_en: string
          creado_por: string | null
          fecha_registro: string
          guia_numero: string | null
          id: string
          mto_id: string | null
          observacion: string | null
          proyecto_id: string
          tipo_movimiento: string
          usuario_id: string | null
        }
        Insert: {
          actualizado_en?: string
          actualizado_por?: string | null
          cantidad: number
          creado_en?: string
          creado_por?: string | null
          fecha_registro?: string
          guia_numero?: string | null
          id?: string
          mto_id?: string | null
          observacion?: string | null
          proyecto_id: string
          tipo_movimiento: string
          usuario_id?: string | null
        }
        Update: {
          actualizado_en?: string
          actualizado_por?: string | null
          cantidad?: number
          creado_en?: string
          creado_por?: string | null
          fecha_registro?: string
          guia_numero?: string | null
          id?: string
          mto_id?: string | null
          observacion?: string | null
          proyecto_id?: string
          tipo_movimiento?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "log_materiales_mto_id_fkey"
            columns: ["mto_id"]
            isOneToOne: false
            referencedRelation: "list_mto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "log_materiales_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "log_materiales_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "v_cartera_kpis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "log_materiales_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      log_pid: {
        Row: {
          actualizado_en: string
          actualizado_por: string | null
          comentario: string | null
          creado_en: string
          creado_por: string | null
          evento: string
          fecha_evento: string
          id: string
          pid_id: string | null
          proyecto_id: string
          revision: string | null
          usuario_id: string | null
        }
        Insert: {
          actualizado_en?: string
          actualizado_por?: string | null
          comentario?: string | null
          creado_en?: string
          creado_por?: string | null
          evento: string
          fecha_evento?: string
          id?: string
          pid_id?: string | null
          proyecto_id: string
          revision?: string | null
          usuario_id?: string | null
        }
        Update: {
          actualizado_en?: string
          actualizado_por?: string | null
          comentario?: string | null
          creado_en?: string
          creado_por?: string | null
          evento?: string
          fecha_evento?: string
          id?: string
          pid_id?: string | null
          proyecto_id?: string
          revision?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "log_pid_pid_id_fkey"
            columns: ["pid_id"]
            isOneToOne: false
            referencedRelation: "list_pid"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "log_pid_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "log_pid_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "v_cartera_kpis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "log_pid_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      log_sdi: {
        Row: {
          actualizado_en: string
          actualizado_por: string | null
          creado_en: string
          creado_por: string | null
          descripcion: string | null
          estado: string
          fecha_emision: string | null
          fecha_respuesta: string | null
          id: string
          numero_sdi: string
          prioridad: string | null
          proyecto_id: string
          responsable_id: string | null
          respuesta: string | null
        }
        Insert: {
          actualizado_en?: string
          actualizado_por?: string | null
          creado_en?: string
          creado_por?: string | null
          descripcion?: string | null
          estado?: string
          fecha_emision?: string | null
          fecha_respuesta?: string | null
          id?: string
          numero_sdi: string
          prioridad?: string | null
          proyecto_id: string
          responsable_id?: string | null
          respuesta?: string | null
        }
        Update: {
          actualizado_en?: string
          actualizado_por?: string | null
          creado_en?: string
          creado_por?: string | null
          descripcion?: string | null
          estado?: string
          fecha_emision?: string | null
          fecha_respuesta?: string | null
          id?: string
          numero_sdi?: string
          prioridad?: string | null
          proyecto_id?: string
          responsable_id?: string | null
          respuesta?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "log_sdi_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "log_sdi_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "v_cartera_kpis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "log_sdi_responsable_id_fkey"
            columns: ["responsable_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      log_spool: {
        Row: {
          actualizado_en: string
          actualizado_por: string | null
          creado_en: string
          creado_por: string | null
          estado: string
          estampa: string | null
          fecha_registro: string
          foto_path: string | null
          id: string
          id_spool: string
          mts_montados: number | null
          observacion: string | null
          proyecto_id: string
          sector: string | null
          spool_id: string
          usuario_id: string | null
        }
        Insert: {
          actualizado_en?: string
          actualizado_por?: string | null
          creado_en?: string
          creado_por?: string | null
          estado: string
          estampa?: string | null
          fecha_registro?: string
          foto_path?: string | null
          id?: string
          id_spool: string
          mts_montados?: number | null
          observacion?: string | null
          proyecto_id: string
          sector?: string | null
          spool_id: string
          usuario_id?: string | null
        }
        Update: {
          actualizado_en?: string
          actualizado_por?: string | null
          creado_en?: string
          creado_por?: string | null
          estado?: string
          estampa?: string | null
          fecha_registro?: string
          foto_path?: string | null
          id?: string
          id_spool?: string
          mts_montados?: number | null
          observacion?: string | null
          proyecto_id?: string
          sector?: string | null
          spool_id?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "log_spool_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "log_spool_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "v_cartera_kpis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "log_spool_spool_id_fkey"
            columns: ["spool_id"]
            isOneToOne: false
            referencedRelation: "list_spools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "log_spool_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      membresias: {
        Row: {
          activo: boolean
          actualizado_en: string
          actualizado_por: string | null
          creado_en: string
          creado_por: string | null
          id: string
          invitado_por: string | null
          proyecto_id: string
          rol: Database["lukeapp"]["Enums"]["rol_usuario"]
          usuario_id: string
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          creado_en?: string
          creado_por?: string | null
          id?: string
          invitado_por?: string | null
          proyecto_id: string
          rol: Database["lukeapp"]["Enums"]["rol_usuario"]
          usuario_id: string
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          creado_en?: string
          creado_por?: string | null
          id?: string
          invitado_por?: string | null
          proyecto_id?: string
          rol?: Database["lukeapp"]["Enums"]["rol_usuario"]
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "membresias_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membresias_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "v_cartera_kpis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membresias_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      permisos_rol: {
        Row: {
          actualizado_en: string
          actualizado_por: string | null
          creado_en: string
          creado_por: string | null
          id: string
          proyecto_id: string
          puede_actualizar: boolean
          puede_agregar: boolean
          puede_eliminar: boolean
          rol: Database["lukeapp"]["Enums"]["rol_usuario"]
          tabla: string
        }
        Insert: {
          actualizado_en?: string
          actualizado_por?: string | null
          creado_en?: string
          creado_por?: string | null
          id?: string
          proyecto_id: string
          puede_actualizar?: boolean
          puede_agregar?: boolean
          puede_eliminar?: boolean
          rol: Database["lukeapp"]["Enums"]["rol_usuario"]
          tabla: string
        }
        Update: {
          actualizado_en?: string
          actualizado_por?: string | null
          creado_en?: string
          creado_por?: string | null
          id?: string
          proyecto_id?: string
          puede_actualizar?: boolean
          puede_agregar?: boolean
          puede_eliminar?: boolean
          rol?: Database["lukeapp"]["Enums"]["rol_usuario"]
          tabla?: string
        }
        Relationships: [
          {
            foreignKeyName: "permisos_rol_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permisos_rol_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "v_cartera_kpis"
            referencedColumns: ["id"]
          },
        ]
      }
      plantillas_catalogo: {
        Row: {
          activo: boolean
          actualizado_en: string
          actualizado_por: string | null
          creado_en: string
          creado_por: string | null
          dominio: string
          id: string
          industria: Database["lukeapp"]["Enums"]["industria_tipo"]
          payload: Json
          tabla: string
          version: number
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          creado_en?: string
          creado_por?: string | null
          dominio: string
          id?: string
          industria: Database["lukeapp"]["Enums"]["industria_tipo"]
          payload: Json
          tabla: string
          version?: number
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          creado_en?: string
          creado_por?: string | null
          dominio?: string
          id?: string
          industria?: Database["lukeapp"]["Enums"]["industria_tipo"]
          payload?: Json
          tabla?: string
          version?: number
        }
        Relationships: []
      }
      proyecto_config: {
        Row: {
          actualizado_en: string
          actualizado_por: string | null
          clases_con_pwht: string[] | null
          creado_en: string
          creado_por: string | null
          fila_encabezado: number
          id: string
          proyecto_id: string
          usa_awp: boolean
          usa_mecanica: boolean
          usa_pmi: boolean
          usa_pwht: boolean
          usa_sublineas: boolean
          usa_test_pack: boolean
        }
        Insert: {
          actualizado_en?: string
          actualizado_por?: string | null
          clases_con_pwht?: string[] | null
          creado_en?: string
          creado_por?: string | null
          fila_encabezado?: number
          id?: string
          proyecto_id: string
          usa_awp?: boolean
          usa_mecanica?: boolean
          usa_pmi?: boolean
          usa_pwht?: boolean
          usa_sublineas?: boolean
          usa_test_pack?: boolean
        }
        Update: {
          actualizado_en?: string
          actualizado_por?: string | null
          clases_con_pwht?: string[] | null
          creado_en?: string
          creado_por?: string | null
          fila_encabezado?: number
          id?: string
          proyecto_id?: string
          usa_awp?: boolean
          usa_mecanica?: boolean
          usa_pmi?: boolean
          usa_pwht?: boolean
          usa_sublineas?: boolean
          usa_test_pack?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "proyecto_config_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: true
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proyecto_config_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: true
            referencedRelation: "v_cartera_kpis"
            referencedColumns: ["id"]
          },
        ]
      }
      proyectos: {
        Row: {
          actualizado_en: string
          actualizado_por: string | null
          codigo: string
          contratista_id: string | null
          contrato: string | null
          creado_en: string
          creado_por: string | null
          estado: Database["lukeapp"]["Enums"]["estado_proyecto"]
          fecha_cierre: string | null
          fecha_inicio: string | null
          id: string
          industria: Database["lukeapp"]["Enums"]["industria_tipo"]
          mandante_id: string
          nombre: string
        }
        Insert: {
          actualizado_en?: string
          actualizado_por?: string | null
          codigo: string
          contratista_id?: string | null
          contrato?: string | null
          creado_en?: string
          creado_por?: string | null
          estado?: Database["lukeapp"]["Enums"]["estado_proyecto"]
          fecha_cierre?: string | null
          fecha_inicio?: string | null
          id?: string
          industria: Database["lukeapp"]["Enums"]["industria_tipo"]
          mandante_id: string
          nombre: string
        }
        Update: {
          actualizado_en?: string
          actualizado_por?: string | null
          codigo?: string
          contratista_id?: string | null
          contrato?: string | null
          creado_en?: string
          creado_por?: string | null
          estado?: Database["lukeapp"]["Enums"]["estado_proyecto"]
          fecha_cierre?: string | null
          fecha_inicio?: string | null
          id?: string
          industria?: Database["lukeapp"]["Enums"]["industria_tipo"]
          mandante_id?: string
          nombre?: string
        }
        Relationships: [
          {
            foreignKeyName: "proyectos_contratista_id_fkey"
            columns: ["contratista_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proyectos_mandante_id_fkey"
            columns: ["mandante_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      reg_dimensional_spool: {
        Row: {
          actualizado_en: string
          actualizado_por: string | null
          creado_en: string
          creado_por: string | null
          fecha_inspeccion: string
          id: string
          inspector_id: string | null
          observacion: string | null
          proyecto_id: string
          resultado: string
          spool_id: string
        }
        Insert: {
          actualizado_en?: string
          actualizado_por?: string | null
          creado_en?: string
          creado_por?: string | null
          fecha_inspeccion: string
          id?: string
          inspector_id?: string | null
          observacion?: string | null
          proyecto_id: string
          resultado: string
          spool_id: string
        }
        Update: {
          actualizado_en?: string
          actualizado_por?: string | null
          creado_en?: string
          creado_por?: string | null
          fecha_inspeccion?: string
          id?: string
          inspector_id?: string | null
          observacion?: string | null
          proyecto_id?: string
          resultado?: string
          spool_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reg_dimensional_spool_inspector_id_fkey"
            columns: ["inspector_id"]
            isOneToOne: false
            referencedRelation: "cat_personal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reg_dimensional_spool_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reg_dimensional_spool_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "v_cartera_kpis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reg_dimensional_spool_spool_id_fkey"
            columns: ["spool_id"]
            isOneToOne: false
            referencedRelation: "list_spools"
            referencedColumns: ["id"]
          },
        ]
      }
      reg_ejecucion_juntas: {
        Row: {
          actualizado_en: string
          actualizado_por: string | null
          creado_en: string
          creado_por: string | null
          estado: string
          estampa_soldador: string | null
          fecha_ejecucion: string
          id: string
          junta_id: string
          numero_rt: string | null
          observacion: string | null
          proceso: string | null
          proyecto_id: string
          sincronizado_en: string | null
          soldador_id: string | null
        }
        Insert: {
          actualizado_en?: string
          actualizado_por?: string | null
          creado_en?: string
          creado_por?: string | null
          estado: string
          estampa_soldador?: string | null
          fecha_ejecucion: string
          id?: string
          junta_id: string
          numero_rt?: string | null
          observacion?: string | null
          proceso?: string | null
          proyecto_id: string
          sincronizado_en?: string | null
          soldador_id?: string | null
        }
        Update: {
          actualizado_en?: string
          actualizado_por?: string | null
          creado_en?: string
          creado_por?: string | null
          estado?: string
          estampa_soldador?: string | null
          fecha_ejecucion?: string
          id?: string
          junta_id?: string
          numero_rt?: string | null
          observacion?: string | null
          proceso?: string | null
          proyecto_id?: string
          sincronizado_en?: string | null
          soldador_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reg_ejecucion_juntas_junta_id_fkey"
            columns: ["junta_id"]
            isOneToOne: false
            referencedRelation: "list_juntas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reg_ejecucion_juntas_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reg_ejecucion_juntas_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "v_cartera_kpis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reg_ejecucion_juntas_soldador_id_fkey"
            columns: ["soldador_id"]
            isOneToOne: false
            referencedRelation: "cat_personal"
            referencedColumns: ["id"]
          },
        ]
      }
      reg_esp_elem: {
        Row: {
          actualizado_en: string
          actualizado_por: string | null
          creado_en: string
          creado_por: string | null
          esp_elem_id: string
          estado: string
          fecha_registro: string
          id: string
          observacion: string | null
          proyecto_id: string
          responsable_id: string | null
        }
        Insert: {
          actualizado_en?: string
          actualizado_por?: string | null
          creado_en?: string
          creado_por?: string | null
          esp_elem_id: string
          estado: string
          fecha_registro: string
          id?: string
          observacion?: string | null
          proyecto_id: string
          responsable_id?: string | null
        }
        Update: {
          actualizado_en?: string
          actualizado_por?: string | null
          creado_en?: string
          creado_por?: string | null
          esp_elem_id?: string
          estado?: string
          fecha_registro?: string
          id?: string
          observacion?: string | null
          proyecto_id?: string
          responsable_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reg_esp_elem_esp_elem_id_fkey"
            columns: ["esp_elem_id"]
            isOneToOne: false
            referencedRelation: "list_esp_elem"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reg_esp_elem_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reg_esp_elem_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "v_cartera_kpis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reg_esp_elem_responsable_id_fkey"
            columns: ["responsable_id"]
            isOneToOne: false
            referencedRelation: "cat_personal"
            referencedColumns: ["id"]
          },
        ]
      }
      reg_inspeccion_visual: {
        Row: {
          actualizado_en: string
          actualizado_por: string | null
          creado_en: string
          creado_por: string | null
          fecha_inspeccion: string
          id: string
          inspector_id: string | null
          junta_id: string
          observacion: string | null
          proxima_etapa: string | null
          proyecto_id: string
          resultado: string
          sincronizado_en: string | null
          tipo_defecto: string | null
          tipo_nde: string | null
        }
        Insert: {
          actualizado_en?: string
          actualizado_por?: string | null
          creado_en?: string
          creado_por?: string | null
          fecha_inspeccion: string
          id?: string
          inspector_id?: string | null
          junta_id: string
          observacion?: string | null
          proxima_etapa?: string | null
          proyecto_id: string
          resultado: string
          sincronizado_en?: string | null
          tipo_defecto?: string | null
          tipo_nde?: string | null
        }
        Update: {
          actualizado_en?: string
          actualizado_por?: string | null
          creado_en?: string
          creado_por?: string | null
          fecha_inspeccion?: string
          id?: string
          inspector_id?: string | null
          junta_id?: string
          observacion?: string | null
          proxima_etapa?: string | null
          proyecto_id?: string
          resultado?: string
          sincronizado_en?: string | null
          tipo_defecto?: string | null
          tipo_nde?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reg_inspeccion_visual_inspector_id_fkey"
            columns: ["inspector_id"]
            isOneToOne: false
            referencedRelation: "cat_personal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reg_inspeccion_visual_junta_id_fkey"
            columns: ["junta_id"]
            isOneToOne: false
            referencedRelation: "list_juntas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reg_inspeccion_visual_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reg_inspeccion_visual_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "v_cartera_kpis"
            referencedColumns: ["id"]
          },
        ]
      }
      reg_junta_adicional: {
        Row: {
          actualizado_en: string
          actualizado_por: string | null
          creado_en: string
          creado_por: string | null
          estado: string
          fecha_ejecucion: string | null
          id: string
          nps_id: string | null
          numero_junta: string
          observacion: string | null
          proceso: string | null
          proyecto_id: string
          soldador_id: string | null
          spool_id: string
          tipo_union_id: string | null
        }
        Insert: {
          actualizado_en?: string
          actualizado_por?: string | null
          creado_en?: string
          creado_por?: string | null
          estado?: string
          fecha_ejecucion?: string | null
          id?: string
          nps_id?: string | null
          numero_junta: string
          observacion?: string | null
          proceso?: string | null
          proyecto_id: string
          soldador_id?: string | null
          spool_id: string
          tipo_union_id?: string | null
        }
        Update: {
          actualizado_en?: string
          actualizado_por?: string | null
          creado_en?: string
          creado_por?: string | null
          estado?: string
          fecha_ejecucion?: string | null
          id?: string
          nps_id?: string | null
          numero_junta?: string
          observacion?: string | null
          proceso?: string | null
          proyecto_id?: string
          soldador_id?: string | null
          spool_id?: string
          tipo_union_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reg_junta_adicional_nps_id_fkey"
            columns: ["nps_id"]
            isOneToOne: false
            referencedRelation: "cat_diametros_nps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reg_junta_adicional_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reg_junta_adicional_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "v_cartera_kpis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reg_junta_adicional_soldador_id_fkey"
            columns: ["soldador_id"]
            isOneToOne: false
            referencedRelation: "cat_personal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reg_junta_adicional_spool_id_fkey"
            columns: ["spool_id"]
            isOneToOne: false
            referencedRelation: "list_spools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reg_junta_adicional_tipo_union_id_fkey"
            columns: ["tipo_union_id"]
            isOneToOne: false
            referencedRelation: "cat_tipo_union"
            referencedColumns: ["id"]
          },
        ]
      }
      reg_montaje_soportes: {
        Row: {
          actualizado_en: string
          actualizado_por: string | null
          creado_en: string
          creado_por: string | null
          estado: string
          fecha_montaje: string
          id: string
          observacion: string | null
          proyecto_id: string
          responsable_id: string | null
          sincronizado_en: string | null
          soporte_id: string
        }
        Insert: {
          actualizado_en?: string
          actualizado_por?: string | null
          creado_en?: string
          creado_por?: string | null
          estado: string
          fecha_montaje: string
          id?: string
          observacion?: string | null
          proyecto_id: string
          responsable_id?: string | null
          sincronizado_en?: string | null
          soporte_id: string
        }
        Update: {
          actualizado_en?: string
          actualizado_por?: string | null
          creado_en?: string
          creado_por?: string | null
          estado?: string
          fecha_montaje?: string
          id?: string
          observacion?: string | null
          proyecto_id?: string
          responsable_id?: string | null
          sincronizado_en?: string | null
          soporte_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reg_montaje_soportes_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reg_montaje_soportes_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "v_cartera_kpis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reg_montaje_soportes_responsable_id_fkey"
            columns: ["responsable_id"]
            isOneToOne: false
            referencedRelation: "cat_personal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reg_montaje_soportes_soporte_id_fkey"
            columns: ["soporte_id"]
            isOneToOne: false
            referencedRelation: "list_soportes"
            referencedColumns: ["id"]
          },
        ]
      }
      reg_montaje_valvulas: {
        Row: {
          actualizado_en: string
          actualizado_por: string | null
          creado_en: string
          creado_por: string | null
          estado: string
          fecha_montaje: string
          id: string
          observacion: string | null
          proyecto_id: string
          responsable_id: string | null
          sincronizado_en: string | null
          spool_id: string | null
          torque: number | null
          valvula_id: string
        }
        Insert: {
          actualizado_en?: string
          actualizado_por?: string | null
          creado_en?: string
          creado_por?: string | null
          estado: string
          fecha_montaje: string
          id?: string
          observacion?: string | null
          proyecto_id: string
          responsable_id?: string | null
          sincronizado_en?: string | null
          spool_id?: string | null
          torque?: number | null
          valvula_id: string
        }
        Update: {
          actualizado_en?: string
          actualizado_por?: string | null
          creado_en?: string
          creado_por?: string | null
          estado?: string
          fecha_montaje?: string
          id?: string
          observacion?: string | null
          proyecto_id?: string
          responsable_id?: string | null
          sincronizado_en?: string | null
          spool_id?: string | null
          torque?: number | null
          valvula_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reg_montaje_valvulas_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reg_montaje_valvulas_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "v_cartera_kpis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reg_montaje_valvulas_responsable_id_fkey"
            columns: ["responsable_id"]
            isOneToOne: false
            referencedRelation: "cat_personal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reg_montaje_valvulas_spool_id_fkey"
            columns: ["spool_id"]
            isOneToOne: false
            referencedRelation: "list_spools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reg_montaje_valvulas_valvula_id_fkey"
            columns: ["valvula_id"]
            isOneToOne: false
            referencedRelation: "list_valvulas"
            referencedColumns: ["id"]
          },
        ]
      }
      reg_pintura_spool: {
        Row: {
          actualizado_en: string
          actualizado_por: string | null
          aplicador_id: string | null
          creado_en: string
          creado_por: string | null
          espesor_seco: number | null
          etapa: string
          fecha_aplicacion: string
          id: string
          observacion: string | null
          pintura_id: string | null
          proyecto_id: string
          resultado: string
          spool_id: string
        }
        Insert: {
          actualizado_en?: string
          actualizado_por?: string | null
          aplicador_id?: string | null
          creado_en?: string
          creado_por?: string | null
          espesor_seco?: number | null
          etapa: string
          fecha_aplicacion: string
          id?: string
          observacion?: string | null
          pintura_id?: string | null
          proyecto_id: string
          resultado?: string
          spool_id: string
        }
        Update: {
          actualizado_en?: string
          actualizado_por?: string | null
          aplicador_id?: string | null
          creado_en?: string
          creado_por?: string | null
          espesor_seco?: number | null
          etapa?: string
          fecha_aplicacion?: string
          id?: string
          observacion?: string | null
          pintura_id?: string | null
          proyecto_id?: string
          resultado?: string
          spool_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reg_pintura_spool_aplicador_id_fkey"
            columns: ["aplicador_id"]
            isOneToOne: false
            referencedRelation: "cat_personal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reg_pintura_spool_pintura_id_fkey"
            columns: ["pintura_id"]
            isOneToOne: false
            referencedRelation: "cat_esquema_pintura"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reg_pintura_spool_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reg_pintura_spool_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "v_cartera_kpis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reg_pintura_spool_spool_id_fkey"
            columns: ["spool_id"]
            isOneToOne: false
            referencedRelation: "list_spools"
            referencedColumns: ["id"]
          },
        ]
      }
      rel_pid_lineas: {
        Row: {
          creado_en: string
          creado_por: string | null
          id: string
          linea_id: string
          pid_id: string
          proyecto_id: string
        }
        Insert: {
          creado_en?: string
          creado_por?: string | null
          id?: string
          linea_id: string
          pid_id: string
          proyecto_id: string
        }
        Update: {
          creado_en?: string
          creado_por?: string | null
          id?: string
          linea_id?: string
          pid_id?: string
          proyecto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rel_pid_lineas_linea_id_fkey"
            columns: ["linea_id"]
            isOneToOne: false
            referencedRelation: "list_lineas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rel_pid_lineas_pid_id_fkey"
            columns: ["pid_id"]
            isOneToOne: false
            referencedRelation: "list_pid"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rel_pid_lineas_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rel_pid_lineas_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "v_cartera_kpis"
            referencedColumns: ["id"]
          },
        ]
      }
      rel_sdi_iso: {
        Row: {
          creado_en: string
          creado_por: string | null
          id: string
          iso_id: string
          proyecto_id: string
          sdi_id: string
        }
        Insert: {
          creado_en?: string
          creado_por?: string | null
          id?: string
          iso_id: string
          proyecto_id: string
          sdi_id: string
        }
        Update: {
          creado_en?: string
          creado_por?: string | null
          id?: string
          iso_id?: string
          proyecto_id?: string
          sdi_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rel_sdi_iso_iso_id_fkey"
            columns: ["iso_id"]
            isOneToOne: false
            referencedRelation: "list_isos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rel_sdi_iso_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rel_sdi_iso_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "v_cartera_kpis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rel_sdi_iso_sdi_id_fkey"
            columns: ["sdi_id"]
            isOneToOne: false
            referencedRelation: "log_sdi"
            referencedColumns: ["id"]
          },
        ]
      }
      usuarios: {
        Row: {
          acceso_global: boolean
          activo: boolean
          actualizado_en: string
          actualizado_por: string | null
          creado_en: string
          email: string
          estado_cuenta: string
          id: string
          mensaje_solicitud: string | null
          motivo_rechazo: string | null
          nombre: string
          proyecto_solicitado_id: string | null
          revisado_en: string | null
          revisado_por: string | null
          solicitado_en: string | null
          telefono: string | null
          telegram_id: string | null
        }
        Insert: {
          acceso_global?: boolean
          activo?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          creado_en?: string
          email: string
          estado_cuenta?: string
          id: string
          mensaje_solicitud?: string | null
          motivo_rechazo?: string | null
          nombre: string
          proyecto_solicitado_id?: string | null
          revisado_en?: string | null
          revisado_por?: string | null
          solicitado_en?: string | null
          telefono?: string | null
          telegram_id?: string | null
        }
        Update: {
          acceso_global?: boolean
          activo?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          creado_en?: string
          email?: string
          estado_cuenta?: string
          id?: string
          mensaje_solicitud?: string | null
          motivo_rechazo?: string | null
          nombre?: string
          proyecto_solicitado_id?: string | null
          revisado_en?: string | null
          revisado_por?: string | null
          solicitado_en?: string | null
          telefono?: string | null
          telegram_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_proyecto_solicitado_id_fkey"
            columns: ["proyecto_solicitado_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuarios_proyecto_solicitado_id_fkey"
            columns: ["proyecto_solicitado_id"]
            isOneToOne: false
            referencedRelation: "v_cartera_kpis"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_cartera_kpis: {
        Row: {
          codigo: string | null
          estado: Database["lukeapp"]["Enums"]["estado_proyecto"] | null
          fecha_inicio: string | null
          id: string | null
          industria: Database["lukeapp"]["Enums"]["industria_tipo"] | null
          mandante: string | null
          n_isos: number | null
          n_juntas: number | null
          n_juntas_ejecutadas: number | null
          n_lineas: number | null
          n_mto: number | null
          n_spools: number | null
          nombre: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      actualizar_miembro: {
        Args: {
          p_activo: boolean
          p_membresia_id: string
          p_rol: Database["lukeapp"]["Enums"]["rol_usuario"]
        }
        Returns: undefined
      }
      actualizar_usuario_global: {
        Args: {
          p_acceso_global: boolean
          p_activo: boolean
          p_estado_cuenta: string
          p_usuario_id: string
        }
        Returns: undefined
      }
      agregar_miembro: {
        Args: {
          p_proyecto_id: string
          p_rol: Database["lukeapp"]["Enums"]["rol_usuario"]
          p_usuario_id: string
        }
        Returns: undefined
      }
      aprobar_usuario: {
        Args: {
          p_proyecto_id: string
          p_rol: Database["lukeapp"]["Enums"]["rol_usuario"]
          p_usuario_id: string
        }
        Returns: undefined
      }
      buscar_chunks_similares: {
        Args: {
          p_embedding: string
          p_limite?: number
          p_proyecto_id: string
          p_umbral?: number
        }
        Returns: {
          chunk_id: string
          contenido: string
          documento_id: string
          nro_chunk: number
          pagina_inicio: number
          similitud: number
          titulo_doc: string
        }[]
      }
      crear_proyecto_wizard: {
        Args: {
          p_codigo: string
          p_industria: string
          p_mandante_id: string
          p_nombre: string
        }
        Returns: string
      }
      estado_catalogos_proyecto: {
        Args: { p_proyecto_id: string }
        Returns: {
          n_filas: number
          referencias_pendientes: Json
          tabla: string
        }[]
      }
      importar_a_num: { Args: { p_valor: string }; Returns: number }
      importar_aplicar_lote: { Args: { p_lote_id: string }; Returns: Json }
      importar_aprobar_filas: {
        Args: { p_aprobada: boolean; p_fila_ids: string[]; p_lote_id: string }
        Returns: number
      }
      importar_calcular_diff: {
        Args: { p_lote_id: string }
        Returns: undefined
      }
      importar_crear_lote: {
        Args: {
          p_archivo_nombre: string
          p_filas: Json
          p_hash_archivo: string
          p_mapeo: Json
          p_proyecto_id: string
          p_storage_path: string
          p_tabla_destino: string
        }
        Returns: string
      }
      importar_crear_lote_ia: {
        Args: {
          p_documento_id: string
          p_filas: Json
          p_proyecto_id: string
          p_tabla_destino: string
        }
        Returns: string
      }
      importar_diff_campo: {
        Args: {
          p_antes: string
          p_campo: string
          p_despues: string
          p_diff: Json
        }
        Returns: Json
      }
      importar_es_editor: { Args: { p_proyecto_id: string }; Returns: boolean }
      importar_num_valido: { Args: { p_valor: string }; Returns: boolean }
      mi_perfil: {
        Args: never
        Returns: {
          acceso_global: boolean
          estado_cuenta: string
          motivo_rechazo: string
          puede_administrar_accesos: boolean
          tiene_membresia_activa: boolean
        }[]
      }
      obtener_estado_catalogos: {
        Args: { p_proyecto_id: string }
        Returns: {
          filas_count: number
          tabla: string
        }[]
      }
      proyectos_publicos_registro: {
        Args: never
        Returns: {
          codigo: string
          id: string
          nombre: string
        }[]
      }
      puede_administrar_accesos: {
        Args: { p_proyecto_id?: string }
        Returns: boolean
      }
      quitar_miembro: { Args: { p_membresia_id: string }; Returns: undefined }
      rechazar_usuario: {
        Args: { p_motivo: string; p_usuario_id: string }
        Returns: undefined
      }
      solicitudes_pendientes: {
        Args: never
        Returns: {
          email: string
          id: string
          mensaje_solicitud: string
          nombre: string
          proyecto_solicitado_id: string
          solicitado_en: string
          telefono: string
        }[]
      }
      tiene_acceso_lectura: {
        Args: { p_proyecto_id: string }
        Returns: boolean
      }
      tiene_membresia: { Args: { p_proyecto_id: string }; Returns: boolean }
      tiene_permiso_escritura: {
        Args: { p_accion: string; p_proyecto_id: string; p_tabla: string }
        Returns: boolean
      }
    }
    Enums: {
      accion_fila: "nueva" | "modificada" | "ausente" | "sin_cambio" | "error"
      empresa_tipo: "mandante" | "contratista" | "subcontratista"
      estado_lote:
        | "cargado"
        | "validado"
        | "diff_listo"
        | "aprobado"
        | "aplicado"
        | "rechazado"
      estado_procesamiento_doc:
        | "pendiente"
        | "procesando"
        | "procesado"
        | "extrayendo"
        | "lote_generado"
        | "completado"
        | "error"
      estado_proyecto: "activo" | "en_pausa" | "cerrado" | "borrador"
      industria_tipo: "mineria" | "refineria" | "celulosa"
      rol_usuario:
        | "ADMIN"
        | "OT"
        | "QAQC"
        | "LOGISTICA"
        | "SUPERVISOR"
        | "GERENCIA"
      tipo_documento:
        | "adenda"
        | "especificacion_tecnica"
        | "estandar"
        | "cwp"
        | "line_list"
        | "pid"
        | "plano"
        | "procedimiento"
        | "otro"
      tipo_evidencia:
        | "FOTO"
        | "PDF_ISO"
        | "PDF_PID"
        | "FOTO_EVIDENCIA"
        | "PDF_PROTOCOLO"
        | "OTRO"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  lukeapp: {
    Enums: {
      accion_fila: ["nueva", "modificada", "ausente", "sin_cambio", "error"],
      empresa_tipo: ["mandante", "contratista", "subcontratista"],
      estado_lote: [
        "cargado",
        "validado",
        "diff_listo",
        "aprobado",
        "aplicado",
        "rechazado",
      ],
      estado_procesamiento_doc: [
        "pendiente",
        "procesando",
        "procesado",
        "extrayendo",
        "lote_generado",
        "completado",
        "error",
      ],
      estado_proyecto: ["activo", "en_pausa", "cerrado", "borrador"],
      industria_tipo: ["mineria", "refineria", "celulosa"],
      rol_usuario: [
        "ADMIN",
        "OT",
        "QAQC",
        "LOGISTICA",
        "SUPERVISOR",
        "GERENCIA",
      ],
      tipo_documento: [
        "adenda",
        "especificacion_tecnica",
        "estandar",
        "cwp",
        "line_list",
        "pid",
        "plano",
        "procedimiento",
        "otro",
      ],
      tipo_evidencia: [
        "FOTO",
        "PDF_ISO",
        "PDF_PID",
        "FOTO_EVIDENCIA",
        "PDF_PROTOCOLO",
        "OTRO",
      ],
    },
  },
} as const

