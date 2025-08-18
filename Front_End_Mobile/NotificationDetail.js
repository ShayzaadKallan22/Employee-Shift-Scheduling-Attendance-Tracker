/**
 * @author MOYO CT, 221039267
 * @version mobile_app
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Linking } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';

const NotificationDetails = ({ route }) => {
  const { notification } = route.params;
  const navigation = useNavigation();

  //Format type for display (e.g., "leave_request" to "Leave Request")
  const formatNotificationType = (type) => {
    if (!type) return '';
    
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  //Handle different notification types
  const handleActionPress = () => {
    switch(notification.type.toLowerCase()) {
      case 'leave_request':
        navigation.navigate('Leave Requests', { 
          notificationId: notification.notification_id 
        });
        break;
      case 'shift_swap':
        navigation.navigate('Shift', { 
          shiftId: notification.metadata?.shift_id 
        });
        break;
      case 'payroll':
        navigation.navigate('Payslip', { 
          payslipId: notification.metadata?.payslip_id 
        });
        break;
      case 'url':
        if (notification.metadata?.url) {
          Linking.openURL(notification.metadata.url);
        }
        break;
      default:
        break;
    }
  };

  //Get appropriate action button details
  const getActionDetails = () => {
    switch(notification.type.toLowerCase()) {
      case 'leave_request':
        return { text: 'View Leave Request', icon: 'calendar-outline' };
      case 'shift_swap':
        return { text: 'Review Shift Swap', icon: 'time-outline' };
      case 'payroll':
        return { text: 'View Payslip', icon: 'document-text-outline' };
      case 'url':
        return { text: 'Open Link', icon: 'link-outline' };
      default:
        return null;
    }
  };

  const actionDetails = getActionDetails();
  const displayType = formatNotificationType(notification.type);

  return (
    <View style={styles.container}>
      {/* App Bar with Back Button */}
      <View style={styles.appBar}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={styles.iconButton}
          hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
        >
          <Icon name="arrow-back-outline" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}></Text>
      </View>

      {/* Notification Content */}
      <View style={styles.content}>
        <View style={styles.notificationHeader}>
          <Text style={styles.title}>{displayType}</Text>
          <Text style={styles.date}>
            {new Date(notification.sent_time).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </Text>
        </View>

        <View style={styles.messageContainer}>
          <Text style={styles.message}>{notification.message}</Text>
        </View>

        {/* Action Button */}
        {actionDetails && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleActionPress}
            activeOpacity={0.7}
          >
            <Icon 
              name={actionDetails.icon} 
              size={20} 
              color="#ffffff" 
              style={styles.actionIcon} 
            />
            <Text style={styles.actionText}>{actionDetails.text}</Text>
          </TouchableOpacity>
        )}
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
    paddingTop: Platform.OS === 'ios' ? 50 : 12,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  iconButton: {
    padding: 8,
    marginRight: 16,
  },
  appBarTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  notificationHeader: {
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  date: {
    fontSize: 14,
    color: '#aaaaaa',
    opacity: 0.7,
  },
  messageContainer: {
    marginBottom: 32,
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    color: '#ffffff',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginTop: 20,
    backgroundColor: '#007bff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionIcon: {
    marginRight: 10,
  },
  actionText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default NotificationDetails;