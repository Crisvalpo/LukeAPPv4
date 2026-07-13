// App principal — placeholder F0.1
// La implementación real comienza en F1.x (dashboard multi-proyecto, importador, maestros)
// Vista inicial: cartera completa de proyectos del usuario (o todos si es GERENCIA)

function App() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0f172a',
      color: '#e2e8f0',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>LukeAPP Dashboard</h1>
        <p style={{ color: '#94a3b8' }}>Dashboard multi-proyecto — en construcción (Fase 1)</p>
        <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '1rem' }}>
          Cartera de proyectos · Importador Excel · Maestros LIST · Revisiones ISO/PID
        </p>
      </div>
    </div>
  )
}

export default App
