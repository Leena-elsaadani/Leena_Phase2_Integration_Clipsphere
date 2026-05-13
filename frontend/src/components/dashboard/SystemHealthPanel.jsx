const SystemHealthPanel = ({ services }) => {
  return (
    <div style={{ border: '1px solid #ccc', padding: '10px', marginTop: '20px' }}>
      <h2>System Health</h2>
      <ul>
        {Object.entries(services).map(([service, status]) => (
          <li key={service}>
            {service}: <span style={{ color: status.status === 'up' ? 'green' : 'red' }}>{status.status}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SystemHealthPanel;