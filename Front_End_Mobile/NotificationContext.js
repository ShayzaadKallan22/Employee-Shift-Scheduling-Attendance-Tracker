/**
 * @author MOYO CT, 221039267
 * @version mobile_app
 */
import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import config from './config';

const API_URL = config.API_URL;

//Create a context for notifications.
const NotificationContext = createContext();

//Provider component to wrap the app and provide notification context.
export const NotificationProvider = ({ children }) => {
  const [unreadCount, setUnreadCount] = useState(0);

  //Fetch the number of of unread notifications.
  const fetchUnreadCount = async () => {
    const employeeId = await AsyncStorage.getItem('employee_id');
    if (!employeeId) return;

    try {
      const res = await axios.get(`${API_URL}/api/${employeeId}`);
      const unread = res.data.filter(n => n.read_status === 'unread').length;
      //Set the number of unread notifications.
      setUnreadCount(unread);
    } catch (err) {
      Alert.alert('Failed to fetch unread notifications:', err);
    }
  };

  //Update the count if it changes 
  const updateUnreadCount = (count) => {
    setUnreadCount(count);
  };

  return (
    <NotificationContext.Provider value={{ unreadCount, fetchUnreadCount, updateUnreadCount }}>
      {children}
    </NotificationContext.Provider>
  );
};

//For debugging purposes.
export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};