const MessageList = ({ messages, loading, error, hasMore, onLoadMore, onEdit, onDelete, onSaveEdit, editingMessage, userId }) => {
  if (loading) return <p>Loading messages...</p>;
  if (error) return <p>Error: {error}</p>;

  return (
    <div style={{ height: '400px', overflowY: 'auto', border: '1px solid #ccc', padding: '10px' }}>
      {messages.map(message => (
        <div key={message.id} style={{ marginBottom: '10px' }}>
          {editingMessage?.id === message.id ? (
            <div>
              <input
                value={editingMessage.content}
                onChange={(e) => onEdit({ ...editingMessage, content: e.target.value })}
              />
              <button onClick={() => onSaveEdit(message.id, editingMessage.content)}>Save</button>
              <button onClick={() => onEdit(null)}>Cancel</button>
            </div>
          ) : (
            <div>
              <strong>{message.userId}:</strong> {message.content}
              {message.userId === userId && (
                <>
                  <button onClick={() => onEdit({ id: message.id, content: message.content })}>Edit</button>
                  <button onClick={() => onDelete(message.id)}>Delete</button>
                </>
              )}
            </div>
          )}
        </div>
      ))}
      {hasMore && <button onClick={onLoadMore}>Load More</button>}
    </div>
  );
};

export default MessageList;