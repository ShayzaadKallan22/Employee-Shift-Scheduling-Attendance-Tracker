/**
 * @author MOYO CT, 221039267
 * @version mobile_app
 */

import { useNavigation } from '@react-navigation/native';
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, Alert, PermissionsAndroid, Platform
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import axios from 'axios';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
//import * as MediaLibrary from 'expo-media-library';
import AsyncStorage from '@react-native-async-storage/async-storage';
//import FileViewer from 'react-native-file-viewer';
import { Calendar } from 'react-native-calendars';
import dayjs from 'dayjs';
import BottomNav from './BottomNav';
import config from './config';

const API_URL = config.API_URL;

const Payslip = () => {
  const navigation = useNavigation();
  const [selectedDate, setSelectedDate] = useState(null);
  const [employeeId, setEmployeeId] = useState(null);
  const [payslip, setPayslip] = useState(null);
  const [selectedPayslip, setSelectedPayslip] = useState(null);
  const [loading, setLoading] = useState(true);


  const getLatestTuesday = () => {
    const today = dayjs();
    let day = today.day();
    let diff = day >= 2 ? day - 2 : 7 - (2 - day);
    return today.subtract(diff, 'day').format('YYYY-MM-DD');
  };

  useEffect(() => {
   //Fetch payslip for selected Tuesday.
    const initialize = async () => {
      const id = await AsyncStorage.getItem('employee_id');
      if (!id) {
        Alert.alert('Error', 'Employee ID not found');
        return;
      }
      setEmployeeId(id);
      const latestTuesday = getLatestTuesday();
      setSelectedDate(latestTuesday);
      fetchPayslips(id, latestTuesday);
    };
    initialize();
  }, []);

  const fetchPayslips = async (id, dateToFetch) => {
    if (!dateToFetch || !id) {
      Alert.alert('No Date or Employee ID', 'Please select a Tuesday and ensure employee is logged in.');
      setPayslip(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/payroll/${id}`);
     if (res.data && Array.isArray(res.data)) {
      //Filter payslips for the selected date
      const payslipForDate = res.data.find(p =>
        dayjs(p.payment_date).format('YYYY-MM-DD') === dateToFetch
      );

      if (payslipForDate) {
        setPayslip(payslipForDate);
      } else {
        setPayslip(null);
      }
    } else {
      setPayslip(null);
    }
  } catch (err) {
    //console.error('Error fetching payslips:', err);
    Alert.alert('Failed to load payslips.');
    setPayslip(null);
  } finally {
    setLoading(false);
  }
};
  const onDateChange = (dayObj) => {
    const date = dayjs(dayObj.dateString);
    if (date.day() !== 2) {
      Alert.alert('Invalid Date', 'Please select a Tuesday.');
      return;
    }
    setSelectedDate(date.format('YYYY-MM-DD'));
    setSelectedPayslip(null);
    if (employeeId) {
      fetchPayslips(employeeId, date.format('YYYY-MM-DD'));
    }
  };

  const downloadPayslip = async (payrollId) => {
  if (!employeeId) return alert('Employee not found.');

  try {
    const url = `${API_URL}/api/payroll/${employeeId}/pdf/${payrollId}`;
    const fileUri = FileSystem.documentDirectory + `payslip-${payrollId}.pdf`;

    //Download the file using Expo FileSystem
    const downloadResult = await FileSystem.downloadAsync(url, fileUri);

    if (downloadResult.status != 200) {
      alert('Failed to download payslip.');
      return;
    }

    alert('Payslip downloaded.');

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri);
    } else {
      alert('Sharing is not available on this device');
    }
  } catch (error) {
    //console.error('Download failed:', error);
    alert('Failed to download payslip.');
  }
};

  const getMarkedDates = () => {
    if (!selectedDate) return {};
    return {
      [selectedDate]: {
        selected: true,
        selectedColor: '#007bff',
        selectedTextColor: '#fff'
      }
    };
  };
  
  //Disable all non - tuesday dates.
  const disableNonTuesdays = (dateStr) => {
    const date = dayjs(dateStr);
    return date.day() !== 2;
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#1a1a1a' }}>
      <View style={styles.appBar}>
        <Text style={styles.appBarTitle}>View Payslip</Text>
      </View>

      <Calendar
        onDayPress={onDateChange}
        markedDates={getMarkedDates()}
        theme={{
          calendarBackground: '#1a1a1a',
          dayTextColor: '#fff',
          monthTextColor: '#fff',
          arrowColor: '#fff',
          selectedDayBackgroundColor: '#007bff',
          selectedDayTextColor: '#fff',
          textDisabledColor: '#444'
        }}
        disableAllTouchEventsForDisabledDays
        dayComponent={({ date, state }) => {
          const isDisabled = disableNonTuesdays(date.dateString);
          const isSelected = selectedDate === date.dateString;

          return (
            <TouchableOpacity
              disabled={isDisabled}
              onPress={() => !isDisabled && onDateChange(date)}
              style={{
                backgroundColor: isSelected ? '#007bff' : 'transparent',
                borderRadius: 18,
                padding: 6,
              }}>
              <Text style={{
                color: isDisabled ? '#555' : isSelected ? '#fff' : '#fff',
                textAlign: 'center'
              }}>
                {date.day}
              </Text>
            </TouchableOpacity>
          );
        }}/>

      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {loading ? (
          <Text style={{ color: '#aaa', textAlign: 'center', marginTop: 20 }}>
             Loading payslip...
          </Text>
          ) : !payslip ? (
          <Text style={{ color: '#aaa', textAlign: 'center', marginTop: 20 }}>
             No payslip found.
          </Text>
          ) : (
         <TouchableOpacity
            style={[
              styles.payslipItem,
              selectedPayslip?.payroll_id === payslip.payroll_id && styles.selectedPayslip,
            ]}
            onPress={() => {
              if (selectedPayslip?.payroll_id === payslip.payroll_id) {
                 setSelectedPayslip(null); //If payslip summary has already been displayed, hide summary.
              } else {
                 setSelectedPayslip(payslip); //If payslip has been selected show summary.
              }
            }}
          >
          <Text style={styles.payslipTitle}>Payslip {payslip.id}</Text>
          <Text style={styles.payslipPeriod}>{payslip.period}</Text>
          </TouchableOpacity>
         )}

    {selectedPayslip && (
      <View style={styles.detailsContainer}>
        <Text style={styles.detailsHeader}>Payslip Summary</Text>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Employee:</Text>
          <Text style={styles.detailValue}>
            {selectedPayslip.first_name} {selectedPayslip.last_name}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Wage:</Text>
          <Text style={styles.detailValue}>{selectedPayslip.total_amount}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Base Hours:</Text>
          <Text style={styles.detailValue}>{selectedPayslip.base_hours}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Overtime Hours:</Text>
          <Text style={styles.detailValue}>{selectedPayslip.overtime_hours}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Date Paid:</Text>
          <Text style={styles.detailValue}>
            {dayjs(selectedPayslip.payment_date).format('YYYY-MM-DD')}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Status:</Text>
          <Text style={styles.detailValue}>{selectedPayslip._status}</Text>
        </View>

        <TouchableOpacity
          style={styles.downloadButton}
          onPress={() => downloadPayslip(selectedPayslip.payroll_id)}
        >
          <Icon name="download-outline" size={20} color="#ffffff" />
          <Text style={styles.downloadText}>Download Payslip</Text>
        </TouchableOpacity>
      </View>
    )}
  </ScrollView>
</View>

 <BottomNav />
</SafeAreaView>
  );
};

const styles = StyleSheet.create({
  appBar: {
    paddingTop: 45, 
    paddingBottom: 15, 
    paddingHorizontal: 20,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1, 
    borderBottomColor: '#333'
  },
  appBarTitle: {
    fontSize: 22, 
    fontWeight: '600', 
    color: '#fff', 
    marginLeft: 100,
  },
  payslipList: {
    flex: 1, 
    marginBottom: 20,
  },
  payslipItem: {
    backgroundColor: '#2c2c2c', 
    borderRadius: 8, 
    padding: 15, 
    marginBottom: 10,
  },
  selectedPayslip: {
    borderLeftWidth: 4, 
    borderLeftColor: '#007bff',
  },
  payslipTitle: {
    color: '#ffffff', 
    fontSize: 16, 
    fontWeight: 'bold', 
    marginBottom: 5,
  },
  payslipPeriod: {
    color: '#aaaaaa', 
    fontSize: 14,
  },
  detailsContainer: {
    backgroundColor: '#2c2c2c', 
    borderRadius: 8, 
    padding: 20, 
    marginBottom: 50,
  },
  detailsHeader: {
    color: '#ffffff', 
    fontSize: 18, 
    fontWeight: 'bold', 
    marginBottom: 15, 
    textAlign: 'center',
  },
  scrollContent: {
  paddingHorizontal: 20,
  paddingBottom: 100, 
  },
  detailRow: {
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginBottom: 10,
  },
  detailLabel: {
    color: '#aaaaaa', 
    fontSize: 14,
  },
  detailValue: {
    color: '#ffffff', 
    fontSize: 14, 
    fontWeight: 'bold', 
    textAlign: 'right', 
    flex: 1, 
    marginLeft: 10,
  },
  downloadButton: {
    flexDirection: 'row', 
    backgroundColor: '#007bff',
    borderRadius: 5, 
    padding: 12, 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginTop: 15,
  },
  downloadText: {
    color: '#ffffff', 
    fontWeight: 'bold', 
    marginLeft: 10,
  },
  
});

export default Payslip;