import { useState } from 'react';
import { useAuth } from '../hooks/useAuth.jsx';
import { useSocket } from '../hooks/useSocket.jsx';
import RoomList from '../components/chat/RoomList';
import MessageList from '../components/chat/MessageList';
import MessageInput from '../components/chat/MessageInput';
import { useRooms } from '../hooks/useRooms.jsx';
import { useMessages } from '../hooks/useMessages.jsx';

const ChatPage = () => {
  const { user, logout } = useAuth();
  const { rooms, loading: roomsLoading, error: roomsError } = useRooms();
  const [selectedRoom, setSelectedRoom] = useState(null);
  const { messages, setMessages, loading: messagesLoading, error: messagesError, addMessage, editMessage, deleteMessage, fetchMore, hasMore } = useMessages(selectedRoom?.id);
  const [newMessage, setNewMessage] = useState('');
  const [editingMessage, setEditingMessage] = useState(null);

  const handleSocketMessage = (message) => {
    if (message.data.roomId !== selectedRoom?.id) return;
    if (message.event === 'message.created') {
      setMessages(prev => [message.data, ...prev]);
    } else if (message.event === 'message.updated') {
      setMessages(prev => prev.map(msg => msg.id === message.data.id ? message.data : msg));
    } else if (message.event === 'message.deleted') {
      setMessages(prev => prev.filter(msg => msg.id !== message.data.id));
    }
  };

  useSocket(selectedRoom?.id, handleSocketMessage);

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    try {
      await addMessage(newMessage);
      setNewMessage('');
    } catch (err) {
      alert('Failed to send message');
    }
  };

  const handleEditMessage = async (messageId, content) => {
    try {
      await editMessage(messageId, content);
      setEditingMessage(null);
    } catch (err) {
      alert('Failed to edit message');
    }
  };

  const handleDeleteMessage = async (messageId) => {
    try {
      await deleteMessage(messageId);
    } catch (err) {
      alert('Failed to delete message');
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <div style={{ width: '300px', borderRight: '1px solid #ccc', padding: '10px' }}>
        <h2>Rooms</h2>
        <button onClick={logout}>Logout</button>
        <RoomList rooms={rooms} onSelectRoom={setSelectedRoom} loading={roomsLoading} error={roomsError} />
      </div>
      <div style={{ flex: 1, padding: '10px' }}>
        {selectedRoom ? (
          <>
            <h2>{selectedRoom.name}</h2>
            <MessageList
              messages={messages}
              loading={messagesLoading}
              error={messagesError}
              hasMore={hasMore}
              onLoadMore={fetchMore}
              onEdit={setEditingMessage}
              onDelete={handleDeleteMessage}
              onSaveEdit={handleEditMessage}
              editingMessage={editingMessage}
              userId={user.id}
            />
            <MessageInput value={newMessage} onChange={setNewMessage} onSend={handleSendMessage} />
          </>
        ) : (
          <p>Select a room to start chatting</p>
        )}
      </div>
    </div>
  );
};

export default ChatPage;