const ActiveUsersCard = ({ activeUsers }) => {
  return (
    <div style={{ border: '1px solid #ccc', padding: '10px', width: '200px' }}>
      <h2>Active Users</h2>
      <p>{activeUsers}</p>
    </div>
  );
};

export default ActiveUsersCard;