/**
 * @author MOYO CT, 221039267
 * @version mobile_app
 */
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import BottomNav from './BottomNav';
import config from './config';

const API_URL = config.API_URL;

const ClockInScreen = () => {
  const navigation = useNavigation();
  const [shifts, setShifts] = useState([]);
  const [attendanceStatus, setAttendanceStatus] = useState(null);
  const [lastClockIn, setLastClockIn] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const employeeId = await AsyncStorage.getItem('employee_id');
        if (!employeeId) return;
        
        //Fetch upcoming shifts
        const shiftsRes = await axios.get(`${API_URL}/api/shifts/upcoming/${employeeId}`);
        setShifts(shiftsRes.data);
        
        //Fetch attendance status
        const statusRes = await axios.get(`${API_URL}/api/profile/create/${employeeId}`);
        setAttendanceStatus(statusRes.data.status);
        setLastClockIn(shiftsRes.data.start_time);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

  //Navigate to Scan Screen
  const handleClockIn = async () => {
    navigation.replace('ScanScreen');
  };

  //Clear tokens and sessions from async storage.
  const handleLogout = async () => {
    try {
      await AsyncStorage.clear();
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  const renderStatusCard = () => {
    if (!attendanceStatus) return null;
    //Configure user status. 
    const statusConfig = {
      'Working ': { color: '#4CAF50', icon: 'checkmark-circle', message: 'You are currently clocked in.' },
      'Not Working': { color: '#FF9800', icon: 'time-outline', message: 'You are currently clocked out.' },
      'Late': { color: '#FF5722', icon: 'alert-circle', message: 'You were late to your last shift.' },
      'On Leave': { color: '#2196F3', icon: 'airplane-outline', message: 'You are currently on leave.' },
      'default': { color: '#9E9E9E', icon: 'help-circle', message: 'Attendance status unknown.' }
    };
    
    const config = statusConfig[attendanceStatus] || statusConfig.default;
    
    return (
      <View style={[styles.statusCard, { backgroundColor: '#2c2c2c', borderLeftWidth: 5, borderLeftColor: config.color }]}>
        <View style={styles.statusHeader}>
          <Icon name={config.icon} size={24} color={config.color} />
          <Text style={[styles.statusTitle, { color: config.color }]}>{attendanceStatus}</Text>
        </View>
        <Text style={styles.statusMessage}>{config.message}</Text>
        {lastClockIn && (
          <Text style={styles.statusTime}>
            Last action: {new Date(lastClockIn).toLocaleString()}
          </Text>
        )}
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={handleLogout}>
          <Icon name="log-out-outline" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Image source={require('./assets/AzaniaNLWhite.png')} style={styles.logo} resizeMode="contain" />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/*Attendance Status Card */}
        {!loading && renderStatusCard()}

        <Text style={styles.sectionTitle}>LOG ATTENDANCE</Text>
        <TouchableOpacity 
         style={[
          styles.clockInButton, 
          attendanceStatus === 'On Leave' && styles.disabledButton
        ]} 
        onPress={handleClockIn}
        disabled={attendanceStatus === 'On Leave'}
       >
       <Text style={styles.clockInText}>
         {attendanceStatus === 'Working ' ? 'CLOCK-OUT' : 'CLOCK-IN'}
       </Text>
       <Icon name="qr-code-outline" size={24} color="#ffffff" />
       </TouchableOpacity>

        <Text style={styles.sectionTitle}>SHIFTS</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.tableHeaderText}>Date</Text>
            <Text style={styles.tableHeaderText}>Time</Text>
            <Text style={styles.tableHeaderText}>Status</Text>
          </View>
          {shifts.length > 0 ? (
            shifts.map((shift, index) => (
              <View key={index} style={[
                styles.tableRow,
                index % 2 === 0 ? styles.evenRow : styles.oddRow
              ]}>
                <Text style={styles.tableCell}>{new Date(shift.date_).toLocaleDateString()}</Text>
                <Text style={styles.tableCell}>{shift.start_time?.split(':').slice(0, 2).join(':')}</Text>
                <Text style={[styles.tableCell, styles.statusCell]}>
                  <Icon 
                    name={shift.status_ === 'scheduled' ? 'time-outline' : 'checkmark-done-outline'} 
                    size={16} 
                    color={shift.status_ === 'scheduled' ? '#FF9800' : '#4CAF50'} 
                  />
                  {shift.status_ === 'scheduled' ? ' Upcoming' : ' Completed'}
                </Text>
              </View>
            ))
          ) : (
            <View style={styles.tableRow}>
              <Text style={styles.tableCell}>No upcoming shifts</Text>
              <Text style={styles.tableCell}>-</Text>
              <Text style={styles.tableCell}>-</Text>
            </View>
          )}
        </View>
      </ScrollView>

      <BottomNav />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 50,
  },
  logo: {
    width: 200,
    height: 100,
    position: 'absolute',
    top: 20, 
    left: '55%',
    transform: [{ translateX: -100 }],
  },
  content: {
    padding: 20,
    paddingBottom: 100,
  },
  statusCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  statusMessage: {
    color: '#ffffff',
    fontSize: 14,
    marginBottom: 4,
  },
  statusTime: {
    color: '#aaaaaa',
    fontSize: 12,
    fontStyle: 'italic',
  },
  sectionTitle: {
    fontWeight: 'bold',
    fontSize: 16,
    marginVertical: 10,
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  clockInButton: {
    flexDirection: 'row',
    backgroundColor: '#007bff',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginVertical: 10,
    shadowColor: '#007bff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  clockInText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  table: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#007bff',
    padding: 15,
  },
  tableHeaderText: {
    flex: 1,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#ffffff',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 15,
  },
  evenRow: {
    backgroundColor: '#2c2c2c',
  },
  oddRow: {
    backgroundColor: '#3e3e3e',
  },
  tableCell: {
    flex: 1,
    textAlign: 'center',
    color: '#ffffff',
  },
  statusCell: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    backgroundColor: '#9E9E9E',
    shadowColor: '#9E9E9E',
    opacity: 0.7,
},
});

export default ClockInScreen;