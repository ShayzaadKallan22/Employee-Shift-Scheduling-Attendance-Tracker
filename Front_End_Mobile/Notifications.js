/**
 * @author MOYO CT, 221039267
 * @version mobile_app
 */
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNotifications } from './NotificationContext';
import BottomNav from './BottomNav';
import config from './config';

const API_URL = config.API_URL;

const Notifications = () => {

  const navigation = useNavigation();
  const [notifications, setNotifications] = useState([]);
  const [activeTab, setActiveTab] = useState('All'); 
  
  const {fetchUnreadCount} = useNotifications();

  const fetchNotifications = async () => {
       
    const employeeId = await AsyncStorage.getItem('employee_id');
    if(!employeeId) return;

    try{
      const res = await axios.get(`${API_URL}/api/${employeeId}`);
      setNotifications(res.data);

      if(!res.data || res.data.length === 0){
          console.log('There are no notifcations for this employee:', res.data);
      }
    }catch(err){
      console.error('Failed to fetch all notifications:', err);
    }
  };

  useEffect (()=> {
        fetchNotifications();
  }, []);
  
  const markAsRead = async(notificationId) =>{
    try{
      await axios.put(`${API_URL}/api/read/${notificationId}`);
      fetchNotifications();
      fetchUnreadCount();
    }catch(error){
      console.error('Failed to mark notifcation as read:', error);
    }
  };

   useEffect(() => {
    fetchUnreadCount();
  }, []);
  //Filter notifications based on active tab
  const filteredNotifications = Array.isArray(notifications)
  ? notifications.filter(notification => {
      if (activeTab === 'All') return true;
      if (activeTab === 'Read') return notification.read_status === 'read';
      if (activeTab === 'Unread') return notification.read_status === 'unread';
    })
  : [];

  return (
  <View style={styles.container}>
    <View style={styles.appBar}>
      <Text style={styles.appBarTitle}>Notifications</Text>
    </View>
    <View style={styles.tabContainer}>
      {['All', 'Read', 'Unread'].map(tab => (
        <TouchableOpacity
          key={tab}
          style={[
            styles.tabButton,
            activeTab === tab && styles.activeTab
          ]}
          onPress={() => setActiveTab(tab)}>
          <Text
            style={[
              styles.tabText,
              activeTab === tab && styles.activeTabText
            ]}>
            {tab}
          </Text>
        </TouchableOpacity>
      ))}
    </View>

    <ScrollView style={styles.notificationsContainer}>
      {filteredNotifications.length === 0 ? (
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
            ]}>
            <View style={styles.notificationHeader}>
              <Text style={styles.notificationType}>{notification.type}</Text>
              <Text style={styles.notificationDate}>
                {notification.sent_time?.split('T')[0]}
              </Text>
            </View>
            <Text style={styles.notificationDescription}>
              {notification.message}
            </Text>
            {notification.read_status === 'unread' && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>New</Text>
              </View>
            )}
          </TouchableOpacity>
        ))
      )}
    </ScrollView>

    <BottomNav />
  </View>
  );
};
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  appBar: {
    paddingTop: 45,
    paddingBottom: 15,
    paddingHorizontal: 20,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  appBarTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 100,
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 10,
    paddingHorizontal: 10,
  },
  tabButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#555',
  },
  activeTab: {
    backgroundColor: '#007bff',
    borderColor: '#007bff',
  },
  tabText: {
    color: '#aaaaaa',
    fontWeight: '600',
  },
  activeTabText: {
    color: '#ffffff',
  },
  notificationsContainer: {
    flex: 1,
    paddingHorizontal: 15,
    marginTop: 5,
  },
  noNotifications: {
    color: '#aaaaaa',
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
  },
  notificationCard: {
    backgroundColor: '#2c2c2c',
    borderRadius: 10,
    padding: 15,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: 'transparent',
    elevation: 2,
  },
  unreadNotification: {
    borderLeftColor: '#007bff',
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  notificationType: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  notificationDate: {
    color: '#aaaaaa',
    fontSize: 12,
  },
  notificationDescription: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 20,
  },
  unreadBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#007bff',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  unreadBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  
});

export default Notifications;