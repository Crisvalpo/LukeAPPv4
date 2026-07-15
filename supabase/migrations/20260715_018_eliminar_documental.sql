-- 1. Política de DELETE en lukeapp.doc_biblioteca para usuarios con membresía activa en el proyecto
CREATE POLICY "doc_biblioteca_delete" ON lukeapp.doc_biblioteca
  FOR DELETE TO authenticated
  USING (lukeapp.tiene_membresia(proyecto_id));

-- 2. Modificar la clave foránea en import_lotes para que admita ON DELETE CASCADE al borrar documentos
ALTER TABLE lukeapp.import_lotes 
  DROP CONSTRAINT IF EXISTS import_lotes_documento_id_fkey,
  ADD CONSTRAINT import_lotes_documento_id_fkey 
    FOREIGN KEY (documento_id) 
    REFERENCES lukeapp.doc_biblioteca(id) 
    ON DELETE CASCADE;
