import { useState, useEffect } from 'react';
import apiClient from '../services/apiClient';
import ActiveUsersCard from '../components/dashboard/ActiveUsersCard';
import MessageVolumeChart from '../components/dashboard/MessageVolumeChart';
import SystemHealthPanel from '../components/dashboard/SystemHealthPanel';

const DashboardPage = () => {
  const [activeUsers, setActiveUsers] = useState(0);
  const [messageVolume, setMessageVolume] = useState([]);
  const [systemHealth, setSystemHealth] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [activeRes, volumeRes, healthRes] = await Promise.all([
        apiClient.get('/dashboard/active-users'),
        apiClient.get('/dashboard/message-volume'),
        apiClient.get('/dashboard/system-health')
      ]);
      setActiveUsers(activeRes.data.activeUsers);
      setMessageVolume(volumeRes.data.points.map(point => ({
        timestamp: new Date(point.timestamp * 1000).toLocaleString(),
        count: point.count
      })));
      setSystemHealth(healthRes.data.services);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Poll every 10 seconds
    return () => clearInterval(interval);
  }, []);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error}</p>;

  return (
    <div style={{ padding: '20px' }}>
      <h1>Dashboard</h1>
      <div style={{ display: 'flex', gap: '20px' }}>
        <ActiveUsersCard activeUsers={activeUsers} />
        <MessageVolumeChart data={messageVolume} />
      </div>
      <SystemHealthPanel services={systemHealth} />
    </div>
  );
};

export default DashboardPage;