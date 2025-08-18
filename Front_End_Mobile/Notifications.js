/**
 * @author MOYO CT
 * @version mobile_app
 */

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNotifications } from './NotificationContext';
import BottomNav from './BottomNav';
import config from './config';

const API_URL = config.API_URL;

const MessagesAndNotifications = () => {
  const navigation = useNavigation();
  const [activeMainTab, setActiveMainTab] = useState('Notifications');
  const [loggedInUserId, setLoggedInUserId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  //State
  const [notifications, setNotifications] = useState([]);
  const [activeNotificationTab, setActiveNotificationTab] = useState('Unread');
  const { fetchUnreadCount } = useNotifications();
  const [conversations, setConversations] = useState([]);
  const [activeMessageTab, setActiveMessageTab] = useState('Unread');

  //Fetch list of conversations for the current user
    const fetchConversations = async () => {
      setIsLoading(true);
      const employeeId = await AsyncStorage.getItem('employee_id');
      if (!employeeId) {
        setIsLoading(false);
        return;
      }

      try {
        //Get all unique conversation partners
        const partnersRes = await axios.get(`${API_URL}/api/conversation/partners/${employeeId}`);
        
        console.log('Partners response:', partnersRes.data); // Debug log
        
        //Get the last message for each conversation
        const conversationsWithLastMessage = await Promise.all(
          partnersRes.data.map(async partner => {
            try {
              const res = await axios.get(
                `${API_URL}/api/conversation/${employeeId}/${partner.employee_id}`
              );
              const messages = res.data;
              
              //Debug log to check partner data
              console.log('Partner data:', partner);
              
              //If no messages, return null
              const firstName = partner.first_name || '';
              const lastName = partner.last_name || '';
              const fullName = `${firstName} ${lastName}`.trim();
              const displayName = fullName || `User ${partner.employee_id}`;
              
              return {
                otherId: partner.employee_id,
                otherName: displayName,
                lastMessage: messages.length > 0 ? messages[messages.length - 1].content : '',
                lastTime: messages.length > 0 ? messages[messages.length - 1].sent_time : '',
                unread: messages.some(msg => 
                  msg.receiver_id == employeeId && msg.read_status === 'unread'
                )
              };
            } catch (error) {
              console.error('Error fetching conversation details:', error);
              return null;
            }
          })
        );

        //Filter out any null values from failed requests
        const validConversations = conversationsWithLastMessage.filter(conv => conv !== null);
        console.log('Final conversations:', validConversations); // Debug log
        setConversations(validConversations);
      } catch (err) {
        console.error('Failed to fetch conversations:', err);
      } finally {
        setIsLoading(false);
      }
    };

  //Fetch Notifications
  const fetchNotifications = async () => {
    const employeeId = await AsyncStorage.getItem('employee_id');
    if (!employeeId) return;

    try {
      const res = await axios.get(`${API_URL}/api/${employeeId}`);
      setNotifications(res.data || []);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  };

  //Mark Notification as Read
  const markAsRead = async (notificationId) => {
    try {
      await axios.put(`${API_URL}/api/read/${notificationId}`);
      fetchNotifications();
      fetchUnreadCount();
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  //Effects
  useEffect(() => {
    const init = async () => {
      const employeeId = await AsyncStorage.getItem('employee_id');
      if (employeeId) {
        setLoggedInUserId(parseInt(employeeId));
        fetchNotifications();
        fetchConversations();
        fetchUnreadCount();
      }
    };
    init();
  }, []);

  //Filtering
  const filteredNotifications = notifications.filter(n => {
    if (activeNotificationTab === 'All') return true;
    return n.read_status === activeNotificationTab.toLowerCase();
  });

  const filteredConversations = conversations.filter(conv => {
    if (activeMessageTab === 'All') return true;
    return activeMessageTab === 'Unread' ? conv.unread : !conv.unread;
  });

  const formatNotificationType = (type) => {
    if (!type) return '';
    let formatted = type.replace(/_/g, ' ');
    formatted = formatted.toLowerCase();
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  };

  return (
    <View style={styles.container}>
      {/* Main Tabs */}
      <View style={styles.mainTabContainer}>
        {['Notifications', 'Messages'].map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.mainTabButton, activeMainTab === tab && styles.mainActiveTab]}
            onPress={() => setActiveMainTab(tab)}
          >
            <Text style={[styles.mainTabText, activeMainTab === tab && styles.mainActiveTabText]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Sub Tabs */}
      <View style={styles.tabContainer}>
        {['All', 'Read', 'Unread'].map(tab => (
          <TouchableOpacity
            key={tab}
            style={[
              styles.tabButton,
              (activeMainTab === 'Notifications' && activeNotificationTab === tab) ||
              (activeMainTab === 'Messages' && activeMessageTab === tab)
                ? styles.activeTab
                : null
            ]}
            onPress={() => {
              if (activeMainTab === 'Notifications') {
                setActiveNotificationTab(tab);
              } else {
                setActiveMessageTab(tab);
              }
            }}
          >
            <Text style={[
              styles.tabText,
              (activeMainTab === 'Notifications' && activeNotificationTab === tab) ||
              (activeMainTab === 'Messages' && activeMessageTab === tab)
                ? styles.activeTabText
                : null
            ]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content Area */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007bff" />
        </View>
      ) : (
        <ScrollView style={styles.notificationsContainer}>
          {activeMainTab === 'Notifications' ? (
            filteredNotifications.length === 0 ? (
              <Text style={styles.noNotifications}>No notifications found</Text>
            ) : (
              filteredNotifications.map(notification => (
                <TouchableOpacity
                  key={notification.notification_id}
                  onPress={() => {
                    if (notification.read_status === 'unread') {
                      markAsRead(notification.notification_id);
                    }
                    navigation.navigate('NotificationDetails', { notification });
                  }}
                  style={[
                    styles.notificationCard,
                    notification.read_status === 'unread' && styles.unreadNotification
                  ]}
                >
                  <View style={styles.notificationHeader}>
                    <Text style={styles.notificationType}>
                      {formatNotificationType(notification.type)}
                    </Text>
                    <Text style={styles.notificationDate}>
                      {notification.sent_time?.split('T')[0]}
                    </Text>
                  </View>
                  <Text style={styles.notificationDescription}>{notification.message}</Text>
                </TouchableOpacity>
              ))
            )
          ) : (
            filteredConversations.length === 0 ? (
              <Text style={styles.noNotifications}>No conversations found</Text>
            ) : (
              filteredConversations.map(conv => (
                <TouchableOpacity
                  key={conv.otherId}
                  style={[styles.notificationCard, conv.unread && styles.unreadNotification]}
                  onPress={() =>
                    navigation.navigate('ChatScreen', {
                      otherId: conv.otherId,
                      otherName: conv.otherName
                    })
                  }
                >
                  <View style={styles.notificationHeader}>
                    <Text style={styles.notificationType}>{conv.otherName}</Text>
                    <Text style={styles.notificationDate}>
                      {conv.lastTime?.split('T')[0]}
                    </Text>
                  </View>
                  <Text style={styles.notificationDescription} numberOfLines={1}>
                    {conv.lastMessage}
                  </Text>
                </TouchableOpacity>
              ))
            )
          )}
        </ScrollView>
      )}
      <BottomNav />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a1a' },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  mainTabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#1a1a1a',
    paddingVertical: 10,
    borderBottomColor: '#333',
    borderBottomWidth: 1
  },
  mainTabButton: { paddingVertical: 6, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: '#555' },
  mainActiveTab: { backgroundColor: '#007bff', borderColor: '#007bff' },
  mainTabText: { color: '#aaaaaa', fontWeight: '600' },
  mainActiveTabText: { color: '#fff' },
  tabContainer: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 10, paddingHorizontal: 10 },
  tabButton: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#555' },
  activeTab: { backgroundColor: '#007bff', borderColor: '#007bff' },
  tabText: { color: '#aaaaaa', fontWeight: '600' },
  activeTabText: { color: '#ffffff' },
  notificationsContainer: { flex: 1, paddingHorizontal: 15, marginTop: 5 },
  noNotifications: { color: '#aaaaaa', textAlign: 'center', marginTop: 50, fontSize: 16 },
  notificationCard: {
    backgroundColor: '#2c2c2c',
    borderRadius: 10,
    padding: 15,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: 'transparent'
  },
  unreadNotification: { borderLeftColor: '#007bff' },
  notificationHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  notificationType: { color: '#ffffff', fontWeight: 'bold', fontSize: 16 },
  notificationDate: { color: '#aaaaaa', fontSize: 12 },
  notificationDescription: { color: '#ffffff', fontSize: 14, lineHeight: 20 }
});

export default MessagesAndNotifications;