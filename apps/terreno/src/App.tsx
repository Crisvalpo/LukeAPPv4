// App principal — placeholder F0.1
// La implementación real comienza en F2.x (PWA offline con PowerSync)

function App() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#1a1f2e',
      color: '#e2e8f0',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>LukeAPP Terreno</h1>
        <p style={{ color: '#94a3b8' }}>PWA offline-first — en construcción (Fase 2)</p>
        <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '1rem' }}>
          Módulo de registro de montaje industrial · Funcional sin red
        </p>
      </div>
    </div>
  )
}

export default App
