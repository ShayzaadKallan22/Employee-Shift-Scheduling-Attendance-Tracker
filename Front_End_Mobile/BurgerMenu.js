/**
 * @author MOYO CT, 221039267
 * @version mobile_app
 */

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'http://192.168.1.187:3000/api';

const BurgerMenuScreen = () => {
  const navigation = useNavigation();
  const [menuData, setMenuData] = useState(null);
  const [isLoading, setLoading] = useState(true);

  const menuItems = [
    { name: 'Leave Requests', icon: 'walk-outline' },
    { name: 'Shift Swap', icon: 'swap-horizontal-outline' },
    { name: 'Payslip', icon: 'document-text-outline' },
    { name: 'Logout', icon: 'log-out-outline' },
  ];

  const fetchEmpData = async () => {
    try {
      const employee_id = await AsyncStorage.getItem('employee_id');
      if (!employee_id) {
        throw new Error('Employee ID not found.');
      }

      const res = await fetch(`${API_URL}/menu/respond/${employee_id}`);
      if (!res.ok) {
        const text = await res.text();
        console.error(`Server error: ${res.status}`, text);
        throw new Error(`Failed to fetch employee menu data. Status: ${res.status}`);
      }

      const data = await res.json();
      setMenuData(data);
    } catch (err) {
      console.error('Error fetching menu data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmpData();
  }, []);

  if (isLoading) {
    return (
      <View style={styles.screen}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007bff" />
          <Text style={styles.loadingText}>Loading user data...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back-outline" size={26} color="#ffffff" />
        </TouchableOpacity>
        <Image
          source={require('./assets/AzaniaNLWhite.png')}
          style={styles.logo}
          resizeMode="contain"/>
      </View>

      <View style={styles.userCard}>
        <Text style={styles.userName}>{menuData?.name || 'Employee'}</Text>
        <Text style={styles.userRole}>{menuData?.role || 'Role'}</Text>
      </View>

      <View style={styles.menuContainer}>
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={() => {
              if (item.name === 'Logout') {
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'Login' }],
                });
              }  else {
                  switch (item.name) {
                    case 'Leave Requests':
                      navigation.navigate('Leave Requests');
                      break;
                    case 'Shift Swap':
                      navigation.navigate('Shift Swap');
                      break;
                    case 'Payslip':
                      navigation.navigate('Payslip');
                      break;
                    default:
                      navigation.navigate(item.name.replace(' ', ''));
                  }
              }
            }}>
            <Icon name={item.icon} size={22} color="#ffffff" style={styles.menuIcon} />
            <Text style={styles.menuText}>{item.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#cccccc',
    fontSize: 16,
    marginTop: 10,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 10,
    backgroundColor: '#1a1a1a',
  },
  backButton: {
    marginRight: 10,
    padding: 6,
    borderRadius: 10,
    backgroundColor: '#2a2a2a',
  },
  logo: {
    height: 60,
    flex: 1,
    alignSelf: 'center',
  },
  userCard: {
    backgroundColor: '#2c2c2c',
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 20,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  userName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  userRole: {
    fontSize: 16,
    color: '#aaaaaa',
  },
  menuContainer: {
    marginTop: 30,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 25,
    backgroundColor: '#222',
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 10,
  },
  menuIcon: {
    marginRight: 15,
  },
  menuText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '500',
  },
});

export default BurgerMenuScreen;