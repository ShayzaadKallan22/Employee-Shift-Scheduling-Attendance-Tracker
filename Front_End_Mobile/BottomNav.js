/**
 * @author MOYO CT, 221039267
 * @version mobile_app
 */
import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useNotifications } from './NotificationContext';

const BottomNav = () => {
  const navigation = useNavigation();
  const { unreadCount } = useNotifications();

  return (
    <View style={styles.bottomNav}>
      <TouchableOpacity onPress={() => navigation.navigate('BurgerMenu')} style={styles.navButton}>
        <Icon name="menu-outline" size={26} color="#ffffff" />
        <Text style={styles.navText}>Menu</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate('Shift')} style={styles.navButton}>
        <Icon name="calendar-outline" size={26} color="#ffffff" />
        <Text style={styles.navText}>Shifts</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate('ClockIn')} style={styles.navButton}>
        <Icon name="home" size={26} color="#ffffff" />
        <Text style={styles.navText}>Home</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate('Notifications')} style={styles.navButton}>
        <View>
          <Icon name="notifications-outline" size={26} color="#ffffff" />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        <Text style={styles.navText}>Alerts</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={styles.navButton}>
        <Icon name="person-outline" size={26} color="#ffffff" />
        <Text style={styles.navText}>Profile</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderColor: '#444',
    backgroundColor: '#1e1e1e',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
  },
  navButton: {
    padding: 5,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  navText: {
    color: '#ffffff',
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
  },
  badge: {
    position: 'absolute',
    right: -5,
    top: -5,
    backgroundColor: '#007bff',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default BottomNav;