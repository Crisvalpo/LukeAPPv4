import React from 'react';

const cardStyle: React.CSSProperties = {
  backgroundColor: '#1e293b',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  borderRadius: '16px',
  width: '100%',
  maxWidth: '460px',
  padding: '40px 32px',
  textAlign: 'center',
  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
};

const containerStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#0f172a',
  padding: '20px',
};

const botonSalirStyle: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.05)',
  border: '1px solid #334155',
  color: '#cbd5e1',
  fontSize: '0.85rem',
  fontWeight: 600,
  cursor: 'pointer',
  padding: '10px 20px',
  borderRadius: '8px',
  marginTop: '24px',
};

interface EstadoCuentaProps {
  onSalir: () => void;
}

export const CuentaPendiente: React.FC<EstadoCuentaProps> = ({ onSalir }) => (
  <div style={containerStyle}>
    <div style={cardStyle}>
      <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>⏳</div>
      <h2 style={{ color: '#f8fafc', margin: '0 0 12px 0' }}>Cuenta pendiente de aprobación</h2>
      <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.5 }}>
        Tu solicitud fue recibida. Un administrador debe revisarla y asignarte un proyecto antes de que puedas ingresar a la plataforma.
      </p>
      <button onClick={onSalir} style={botonSalirStyle}>Salir</button>
    </div>
  </div>
);

interface CuentaRechazadaProps extends EstadoCuentaProps {
  motivo: string | null;
}

export const CuentaRechazada: React.FC<CuentaRechazadaProps> = ({ motivo, onSalir }) => (
  <div style={containerStyle}>
    <div style={cardStyle}>
      <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>✕</div>
      <h2 style={{ color: '#f8fafc', margin: '0 0 12px 0' }}>Solicitud rechazada</h2>
      <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.5 }}>
        Tu solicitud de acceso no fue aprobada.
      </p>
      {motivo && (
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '12px 16px', marginTop: '16px', color: '#f87171', fontSize: '0.9rem', textAlign: 'left' }}>
          {motivo}
        </div>
      )}
      <button onClick={onSalir} style={botonSalirStyle}>Salir</button>
    </div>
  </div>
);

export const SinProyectos: React.FC<EstadoCuentaProps> = ({ onSalir }) => (
  <div style={containerStyle}>
    <div style={cardStyle}>
      <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>📂</div>
      <h2 style={{ color: '#f8fafc', margin: '0 0 12px 0' }}>Cuenta aprobada, sin proyectos asignados</h2>
      <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.5 }}>
        Tu cuenta fue aprobada pero todavía no tienes ningún proyecto asignado. Contacta al administrador de tu proyecto para que te agregue.
      </p>
      <button onClick={onSalir} style={botonSalirStyle}>Salir</button>
    </div>
  </div>
);
