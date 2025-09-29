/**
 * @author MOYO CT, 221039267
 * @version mobile_app
 */
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Alert} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import Ionicon from 'react-native-vector-icons/Ionicons';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import config from './config';

const API_URL = config.API_URL;

//ChatScreen component to handle messaging between two employees.
const ChatScreen = ({ route }) => {
  const { otherId, otherName } = route.params;
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loggedInUserId, setLoggedInUserId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const flatListRef = useRef(null);
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  
  //Debug state
  const [debugInfo, setDebugInfo] = useState({
    apiStatus: 'idle',
    lastError: null
  });

  //Track last message ID to detect new messages.
  const lastMessageID = useRef(null);
  const pollInterval = useRef(null);

  const fetchMessages = async (silent = false) => {
    try {
      if (!silent) {
        setIsLoading(true);
      }
      
      const employeeId = await AsyncStorage.getItem('employee_id');
      if (!employeeId) {
        // console.log('No employee ID found');
        return;
      }
      
      const empIdNum = parseInt(employeeId, 10);
      setLoggedInUserId(empIdNum);
      const otherIdNum = parseInt(otherId, 10);

      const res = await axios.get(`${API_URL}/api/conversation/${empIdNum}/${otherIdNum}`);
      
      //Check if there are new messages
      const latestMessage = res.data[res.data.length - 1];
      const hasNewMessages = latestMessage && latestMessage.message_id !== lastMessageID.current;

      if (hasNewMessages) {
        //Only update if there are new messages
        setMessages(res.data);
        lastMessageID.current = latestMessage.message_id;
        
        //Mark as read only when new messages arrive
        await markMessagesAsRead(empIdNum, otherIdNum);
      }

    } catch (err) {
      Alert.alert('Fetch error:', err);
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  };

 const markMessagesAsRead = async (userId, otherUserId) => {
    try {
      await axios.patch(`${API_URL}/api/conversation/mark-read`, {
        receiver_id: userId,
        sender_id: otherUserId
      });
    } catch (err) {
      Alert.alert('Error marking messages as read:', err);
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

      setMessages(prev => [...prev, tempMessage]);
      setText('');

      //Send to server
      const payload = {
        sender_id,
        receiver_id,
        content: text
      };

      const response = await axios.post(`${API_URL}/api/conversation/reply`, payload);

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
        
        //Update last message ID
        lastMessageID.current = response.data.message_id;
      }
    } catch (err) {
      Alert.alert('Send error:', err);
      setMessages(prev => prev.filter(msg => !msg.isOptimistic));
    }
  };

//   const BackButton = ({ onPress }) => (
//   <TouchableOpacity 
//     onPress={onPress}
//     style={{ marginLeft: 15, padding: 8 }}
//   >
//     <Icon name="arrow-back" size={24} color="#fff" />
//   </TouchableOpacity>
// );

useEffect(() => {
    if (isFocused) {
      navigation.setOptions({ 
        title: otherName || 'Chat',
        headerStyle: {
          backgroundColor: '#1a1a1a',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        headerLeft: () => (
          <TouchableOpacity 
            onPress={() => navigation.goBack()}
            style={{ 
              marginLeft: 15, 
              padding: 8,
              flexDirection: 'row',
              alignItems: 'center'
            }}
          >
            <Text style={{ color: '#fff', fontSize: 24, marginRight: 5 }}>←</Text>
            <Text style={{ color: '#fff', fontSize: 16 }}>Back</Text>
          </TouchableOpacity>
        ),
      });
      
      //Initial fetch
      fetchMessages();
      
      //Smart polling - silent mode to avoid UI refreshes
      pollInterval.current = setInterval(() => {
        fetchMessages(true); //silent fetch
      }, 8000); //Poll every 8 seconds
    }

    return () => {
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
      }
    };
  }, [isFocused, otherName, navigation]);

  useEffect(() => {
    if (messages.length > 0 && flatListRef.current) {
      //Smooth scroll to bottom when new messages arrive
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
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
            {item.sent_time ? new Date(item.sent_time).toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            }) : 'now'}
          </Text>
          {/* Show read status only for own messages */}
          {isOwnMessage && (
            <Text style={styles.readStatus}>
              {isRead ? '✓✓' : '✓'}
            </Text>
          )}
        </View>
      </View>
    );
  };

  //Main render
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Chat Header */}
      <View style={styles.chatHeader}>
        <Text style={styles.chatHeaderText}>
          {otherName || 'Unknown User'}
        </Text>
        <Text style={styles.chatHeaderSubtext}>
          ...
        </Text>
      </View>

      {isLoading && messages.length === 0 ? (
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
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={5}
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
          style={[styles.sendButton, !text.trim() && styles.sendButtonDisabled]} 
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
  chatHeader: {
    backgroundColor: '#2c2c2c',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    alignItems: 'center'
  },
  chatHeaderText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2
  },
  chatHeaderSubtext: {
    color: '#aaa',
    fontSize: 12
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