/**
 * @author MOYO CT, 221039267
 * @version mobile_app
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Calendar } from 'react-native-calendars';
import Icon from 'react-native-vector-icons/Ionicons';
import axios from 'axios';

const API_URL = 'http://192.168.149.179:3000/api';

const ShiftSchedule = () => {

  const navigation = useNavigation();
  const [selectedDate, setSelectedDate] = useState('15');
  const [shifts, setShifts] = useState([]);

  useEffect(()=>{
    const fetchShifts = async () => {
        try{
        //Fetch the employeeeID from asyncStorage.
        const employee_id = await AsyncStorage.getItem('employee_id');

        if(!employee_id) throw new Error('Employee id could not be found:', employee_id);
        //get the API response using the employeeId.
        const res = await  axios.get(`${API_URL}/schedule/employee/${employee_id}/shifts`);
        const shiftData = res.data.map(({date_, start_time, end_time, role}) =>({
          date: new Date(date_).getDate().toString().padStart(2,'0'),
          fullDate: new Date(date_).toLocaleDateString('en-CA'),
          role: role,
          start: start_time,
          end: end_time

        }));
        setShifts(shiftData);
     }catch(err){
        console.error('Failed to fetch shifts:', err);
     }
    };
    fetchShifts();
  }, []);
  
  const markedDates = shifts.reduce((acc, shift) =>{
    acc[shift.fullDate] = {
      marked: true,
      dotColour: '#007bff',
      selected: shift.fullDate === selectedDate,
      selectedColour: '#007bff',
      selectedTextColour: '#fff'
    };
    return acc;
  }, {});

  
  const selectedShift = shifts.find(shift => shift.fullDate === selectedDate);
  return (
  <View style={styles.container}>
    
    <View style={styles.appBar}>
      <Text style={styles.appBarTitle}>Shift Schedule</Text>
    </View>

   
    <Calendar
      onDayPress={day => setSelectedDate(day.dateString)}
      markedDates={markedDates}
      theme={{
        calendarBackground: '#1a1a1a',
        dayTextColor: '#ffffff',
        monthTextColor: '#ffffff',
        textDisabledColor: '#555',
        arrowColor: '#ffffff',
        selectedDayTextColor: '#ffffff',
        selectedDayBackgroundColor: '#007bff',
      }}/>

    
    {selectedDate && (
      <View style={styles.shiftDetails}>
        <Text style={styles.detailHeader}>Shift Details</Text>
        {selectedShift ? (
          <>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Role:</Text>
              <Text style={styles.detailValue}>{selectedShift.role}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Start Time:</Text>
              <Text style={styles.detailValue}>{selectedShift.start?.split(':').slice(0, 2).join(':')}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>End Time:</Text>
              <Text style={styles.detailValue}>{selectedShift.end?.split(':').slice(0, 2).join(':')}</Text>
            </View>
          </>
        ) : (
          <Text style={styles.noShiftText}>No shift scheduled</Text>
        )}
      </View>
    )}

    <View style={styles.bottomNav}>
      <TouchableOpacity onPress={() => navigation.navigate('BurgerMenu')} style={styles.navButton}>
        <Icon name="menu-outline" size={26} color="#ffffff" />
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate('ShiftSchedule')} style={styles.navButton}>
        <Icon name="calendar-outline" size={26} color="#ffffff" />
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate('ClockIn')} style={styles.navButton}>
        <Icon name="home" size={26} color="#ffffff" />
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate('Notifications')} style={styles.navButton}>
        <Icon name="notifications-outline" size={26} color="#ffffff" />
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={styles.navButton}>
        <Icon name="person-outline" size={26} color="#ffffff" />
      </TouchableOpacity>
    </View>
  </View>
);
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    paddingTop: 0,
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
    marginLeft: 90,
  },
  shiftDetails: {
    backgroundColor: '#2c2c2c',
    borderRadius: 10,
    padding: 20,
    marginHorizontal: 15,
    marginTop: 15,
    elevation: 2,
  },
  detailHeader: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  detailLabel: {
    color: '#aaaaaa',
    fontSize: 16,
    fontWeight: 'bold',
  },
  detailValue: {
    color: '#ffffff',
    fontSize: 16,
  },
  noShiftText: {
    color: '#aaaaaa',
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 10,
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderColor: '#444',
    backgroundColor: '#1e1e1e',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  navButton: {
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ShiftSchedule;