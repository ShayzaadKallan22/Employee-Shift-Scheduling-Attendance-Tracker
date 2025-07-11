/**
 * @author MOYO CT, 221039267
 * @version mobile_app
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';

const NotificationDetails = ({ route }) => {
  const { notification } = route.params;
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      <View style={styles.appBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
          <Icon name="arrow-back-outline" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>Notification</Text>
      </View>

     
      <View style={styles.content}>
        <Text style={styles.title}>{notification.type}</Text>
        <Text style={styles.date}>{notification.sent_time.split('T')[0]}</Text>
        <Text style={styles.message}>{notification.message}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    zIndex: 1,
  },
  iconButton: {
    padding: 8,
  },
  appBarTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 90,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 10,
  },
  date: {
    color: '#aaaaaa',
    fontSize: 12,
    marginBottom: 20,
  },
  message: {
    color: '#ffffff',
    fontSize: 16,
    lineHeight: 24,
  },
});

export default NotificationDetails;