const RoomList = ({ rooms, onSelectRoom, loading, error }) => {
  if (loading) return <p>Loading rooms...</p>;
  if (error) return <p>Error: {error}</p>;

  return (
    <ul>
      {rooms.map(room => (
        <li key={room.id} onClick={() => onSelectRoom(room)} style={{ cursor: 'pointer' }}>
          {room.name}
        </li>
      ))}
    </ul>
  );
};

export default RoomList;