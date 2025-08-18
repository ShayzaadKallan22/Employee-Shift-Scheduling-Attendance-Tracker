/**
 * @author MOYO CT, 221039267
 * @version mobile_app
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import config from './config';

const API_URL = config.API_URL;

const ChatScreen = ({ route }) => {
  const { otherId, otherName } = route.params;
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loggedInUserId, setLoggedInUserId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const flatListRef = useRef(null);
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  
  //Debug state
  const [debugInfo, setDebugInfo] = useState({
    apiStatus: 'idle',
    lastError: null
  });

  const fetchMessages = async () => {
    try {
      setIsLoading(true);
      setDebugInfo(prev => ({...prev, apiStatus: 'loading'}));
      
      const employeeId = await AsyncStorage.getItem('employee_id');
      if (!employeeId) {
        console.log('No employee ID found');
        return;
      }
      
      const empIdNum = parseInt(employeeId, 10);
      setLoggedInUserId(empIdNum);
      const otherIdNum = parseInt(otherId, 10);

      console.log(`Fetching conversation between ${empIdNum} and ${otherIdNum}`);
      const res = await axios.get(`${API_URL}/api/conversation/${empIdNum}/${otherIdNum}`);
      
      //Mark messages as read when fetching
      await markMessagesAsRead(empIdNum, otherIdNum);

      setDebugInfo(prev => ({
        ...prev,
        apiStatus: 'success',
        lastResponse: res.data
      }));

      console.log('Fetched messages:', res.data);
      setMessages(res.data);
    } catch (err) {
      console.error('Fetch error:', err);
      setDebugInfo(prev => ({
        ...prev,
        apiStatus: 'error',
        lastError: err.message
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const markMessagesAsRead = async (userId, otherUserId) => {
    try {
      await axios.patch(`${API_URL}/api/conversation/mark-read`, {
        receiver_id: userId,
        sender_id: otherUserId
      });
      console.log('Messages marked as read');
    } catch (err) {
      console.error('Error marking messages as read:', err);
    }
  };

  const sendMessage = async () => {
    if (!text.trim()) return;

    try {
      const senderIdStr = await AsyncStorage.getItem('employee_id');
      if (!senderIdStr) {
        console.error('No sender ID found');
        return;
      }

      const sender_id = parseInt(senderIdStr, 10);
      const receiver_id = parseInt(otherId, 10);

      //Create optimistic message
      const tempMessage = {
        message_id: `temp_${Date.now()}`,
        sender_id,
        receiver_id,
        content: text,
        sent_time: new Date().toISOString(),
        isOptimistic: true,
        read_status: 'unread'
      };

      console.log('Adding optimistic message:', tempMessage);
      setMessages(prev => [...prev, tempMessage]);
      setText('');

      //Send to server
      const payload = {
        sender_id,
        receiver_id,
        content: text
      };

      const response = await axios.post(`${API_URL}/api/conversation/reply`, payload);
      console.log('Server response:', response.data);

      //Replace optimistic message with server response
      if (response.data) {
        setMessages(prev => [
          ...prev.filter(msg => !msg.isOptimistic),
          {
            ...response.data,
            message_id: response.data.message_id || Date.now(),
            sent_time: response.data.sent_time || new Date().toISOString()
          }
        ]);
      }
    } catch (err) {
      console.error('Send error:', err);
      setMessages(prev => prev.filter(msg => !msg.isOptimistic));
    }
  };

  useEffect(() => {
    if (isFocused) {
      navigation.setOptions({ title: otherName });
      fetchMessages();
      
      const interval = setInterval(fetchMessages, 5000);
      return () => clearInterval(interval);
    }
  }, [isFocused]);

  useEffect(() => {
    if (messages.length > 0) {
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages]);

  const renderItem = ({ item }) => {
    const isOwnMessage = loggedInUserId && parseInt(item.sender_id, 10) === loggedInUserId;
    const isRead = item.read_status === 'read';

    return (
      <View
        style={[
          styles.messageBubble,
          isOwnMessage ? styles.myMessage : styles.theirMessage
        ]}
      >
        <Text style={styles.messageText}>{item.content}</Text>
        <View style={styles.messageFooter}>
          <Text style={styles.messageTime}>
            {item.sent_time?.split('T')[1]?.slice(0, 5) || 'now'}
          </Text>
          {isOwnMessage && (
            <Text style={styles.readStatus}>
              {isRead ? '✓✓' : '✓'}
            </Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007bff" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderItem}
          keyExtractor={(item) => item.message_id.toString()}
          contentContainerStyle={styles.messagesContainer}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No messages yet. Start chatting!</Text>
          }
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />
      )}

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Type a message..."
          placeholderTextColor="#aaa"
          multiline
        />
        <TouchableOpacity 
          style={styles.sendButton} 
          onPress={sendMessage}
          disabled={!text.trim()}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  messagesContainer: {
    padding: 10
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 12,
    marginVertical: 4
  },
  myMessage: {
    backgroundColor: '#007bff',
    alignSelf: 'flex-end',
    marginLeft: '20%'
  },
  theirMessage: {
    backgroundColor: '#2c2c2c',
    alignSelf: 'flex-start',
    marginRight: '20%'
  },
  messageText: {
    color: '#fff',
    fontSize: 16
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 4
  },
  messageTime: {
    color: '#ccc',
    fontSize: 10,
    marginRight: 6
  },
  readStatus: {
    color: '#aaa',
    fontSize: 10
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#333',
    backgroundColor: '#1a1a1a'
  },
  input: {
    flex: 1,
    backgroundColor: '#2c2c2c',
    color: '#fff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100
  },
  sendButton: {
    backgroundColor: '#007bff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    justifyContent: 'center',
    borderRadius: 20,
    marginLeft: 10,
    opacity: 1
  },
  sendButtonDisabled: {
    opacity: 0.5
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: 'bold'
  },
  emptyText: {
    color: '#aaa',
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16
  }
});

export default ChatScreen;