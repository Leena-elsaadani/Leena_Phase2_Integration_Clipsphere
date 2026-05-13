const MessageInput = ({ value, onChange, onSend }) => {
  return (
    <div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Type a message..."
        style={{ width: '80%' }}
        onKeyPress={(e) => e.key === 'Enter' && onSend()}
      />
      <button onClick={onSend}>Send</button>
    </div>
  );
};

export default MessageInput;