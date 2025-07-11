/**
 * @author MOYO CT, 221039267
 * @version mobile_app
 */

import React, { useState, useEffect } from 'react';
import {View, Text, TouchableOpacity, StyleSheet, ScrollView, Image,} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const API_URL = 'http://192.168.1.187:3000/api';

const ClockInScreen = () => {
  const navigation = useNavigation();
  const [shifts, setShifts] = useState([]);

  useEffect(()=>{
    //Fetch the upcoming shifts.
    const fetchShifts = async () =>{
      try{
        const employeeId = await AsyncStorage.getItem('employee_id');
        if(!employeeId) return;
        //fetch the api response.
        const res = await axios.get(`${API_URL}/shifts/upcoming/${employeeId}`);
        setShifts(res.data);
      }catch(error){
        console.error('Error fetching shifts:', error);
      }
    };
    fetchShifts();
  }, []);
  
  const handleClockIn = async () => {
    //Navigate to the scan screen.
    navigation.replace('ScanScreen');
  };

  const handleLogout = async () => {
   if (item.name === 'Logout') {
                //Handle logout
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'Login' }],
                });
  };
  }
  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={handleLogout}>
          <Icon name="log-out-outline" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Image source={require('./assets/AzaniaNLWhite.png')} style={styles.logo} resizeMode="contain" />
      </View>

      
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>LOG ATTENDANCE</Text>
        <TouchableOpacity style={styles.clockInButton} onPress={handleClockIn}>
          <Text style={styles.clockInText}>CLOCK-IN</Text>
          <Icon name="qr-code-outline" size={24} color="#ffffff" />
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>UPCOMING SHIFT</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.tableHeaderText}>Date</Text>
            <Text style={styles.tableHeaderText}>Time</Text>
          </View>
          {shifts.length > 0 ? (
            shifts.map((shift, index) => (
             <View key={index} style={styles.tableRow}>
               <Text style={styles.tableCell}>{new Date(shift.date_).toLocaleDateString()}</Text>
               <Text style={styles.tableCell}>{shift.start_time?.split(':').slice(0, 2).join(':')}</Text>
             </View>
            ))
          ) : (
            <View style={styles.tableRow}>
              <Text style={styles.tableCell}>No upcoming shifts</Text>
              <Text style={styles.tableCell}>-</Text>
            </View>
          )}
        </View>
      </ScrollView>

     
<View style={styles.bottomNav}>
  <TouchableOpacity 
    onPress={() => navigation.navigate('BurgerMenu')}
    style={styles.navButton} >
    <Icon name="menu-outline" size={28} color='#ffffff'/>
  </TouchableOpacity>
  
  <TouchableOpacity 
    onPress={() => navigation.navigate('ShiftSchedule')}
    style={styles.navButton} >
    <Icon name="calendar-outline" size={28} color='#ffffff'/>
  </TouchableOpacity>
  
  <TouchableOpacity 
    onPress={() => navigation.navigate('ClockIn')}
    style={styles.navButton} >
    <Icon name="home" size={28} color='#ffffff'/>
  </TouchableOpacity>
  
  <TouchableOpacity 
    onPress={() => navigation.navigate('Notifications')}
    style={styles.navButton} >
    <Icon name="notifications-outline" size={28} color='#ffffff'/>
  </TouchableOpacity>
  
  <TouchableOpacity 
    onPress={() => navigation.navigate('Profile')}
    style={styles.navButton} >
    <Icon name="person-outline" size={28} color='#ffffff'/>
  </TouchableOpacity>
</View>
    </View>
  );
};

export default ClockInScreen;


const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 0,
    marginHorizontal: 20,
  },
  logo: {
    width: 200,
    height: 100,
    alignSelf: 'center',
    marginTop: 50,
    right:80,
  },
  imagePlaceholder: {
    alignItems: 'center',
    width: 300,
    height: 200,
    borderRadius: 8,
    marginTop: 100,
    marginHorizontal: 10,
  },
  content: {
    alignItems: 'center',
    paddingVertical: 20,
    marginTop: 60,
  },
  sectionTitle: {
    fontWeight: 'bold',
    fontSize: 14,
    marginVertical: 10,
    color: '#ffffff',
  },
  clockInButton: {
    flexDirection: 'row',
    backgroundColor: '#007bff', 
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'space-between',
    width: 200,
    marginVertical: 20,
  },
  clockInText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 5,
    alignItems: 'center',
    color: '#ffffff',
  },
  table: {
    width: '90%',
    borderRadius: 15,
    overflow: 'hidden',
    backgroundColor: '#2c2c2c',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#007bff',
    padding: 10,
  },
  tableHeaderText: {
    flex: 1,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#ffffff',
  },
  tableRow: {
    flexDirection: 'row',
    backgroundColor: '#3e3e3e',
    padding: 10,
  },
  tableCell: {
    flex: 1,
    textAlign: 'center',
    color: '#ffffff',
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderColor: '#444',
    backgroundColor: '#1e1e1e',
  },
  navButton: {
    padding: 10,  
    alignItems: 'center',
    justifyContent: 'center',
  }
});
