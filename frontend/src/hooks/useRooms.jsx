import { useState, useEffect } from 'react';
import apiClient from '../services/apiClient';

export const useRooms = () => {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRooms = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/rooms');
      setRooms(response.data.rooms);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  return { rooms, loading, error, refetch: fetchRooms };
};