/**
 * @author MOYO CT, 221039267
 * @version mobile_app
 */

import { useNavigation } from '@react-navigation/native';
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, Alert, Platform
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import axios from 'axios';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
    const initialize = async () => {
      const id = await AsyncStorage.getItem('employee_id');
      if (!id) {
        Alert.alert('Error', 'Employee ID not found');
        return;
      }
      setEmployeeId(id);
      //Fetch all payslips first to find the most recent one
      fetchAllPayslips(id);
    };
    initialize();
  }, []);

  const fetchAllPayslips = async (id) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/payroll/${id}`);
      console.log('API Response:', res.data);
      
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        //Find the most recent payslip
        const sortedPayslips = res.data.sort((a, b) => 
          new Date(b.payment_date) - new Date(a.payment_date)
        );
        const mostRecentPayslip = sortedPayslips[0];
        const mostRecentDate = dayjs(mostRecentPayslip.payment_date).format('YYYY-MM-DD');
        
        console.log('Most recent payslip date:', mostRecentDate);
        setSelectedDate(mostRecentDate);
        setPayslip(mostRecentPayslip);
      } else {
        console.log('No payslips found');
        const latestTuesday = getLatestTuesday();
        setSelectedDate(latestTuesday);
        setPayslip(null);
      }
    } catch (err) {
      console.error('Error fetching payslips:', err);
      Alert.alert('Failed to load payslips.');
      setPayslip(null);
    } finally {
      setLoading(false);
    }
  };

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
      console.log('Looking for date:', dateToFetch);
      
      if (res.data && Array.isArray(res.data)) {
        const payslipForDate = res.data.find(p => {
          const formattedDate = dayjs(p.payment_date).format('YYYY-MM-DD');
          return formattedDate === dateToFetch;
        });

        console.log('Found payslip:', payslipForDate);

        if (payslipForDate) {
          setPayslip(payslipForDate);
        } else {
          console.log('No payslip found for date:', dateToFetch);
          setPayslip(null);
        }
      } else {
        console.log('Invalid response data:', res.data);
        setPayslip(null);
      }
    } catch (err) {
      console.error('Error fetching payslips:', err);
      Alert.alert('Failed to load payslips.');
      setPayslip(null);
    } finally {
      setLoading(false);
    }
  };

  //Handle date selection from calendar
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

  //Download and share payslip PDF
  const downloadPayslip = async (payrollId) => {
    if (!employeeId) return alert('Employee not found.');

    try {
      const url = `${API_URL}/api/payroll/${employeeId}/pdf/${payrollId}`;
      const fileUri = FileSystem.documentDirectory + `payslip-${payrollId}.pdf`;

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
      alert('Failed to download payslip.');
    }
  };

  //Mark selected date on calendar
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

  //Disable all days except Tuesdays
  const disableNonTuesdays = (dateStr) => {
    const date = dayjs(dateStr);
    return date.day() !== 2;
  };

  //Calculate gross pay from base and overtime
  const calculateGrossPay = () => {
    if (!selectedPayslip) return 0;
    const baseAmount = parseFloat(selectedPayslip.base_hours || 0) * parseFloat(selectedPayslip.base_hourly_rate || 0);
    const overtimeAmount = parseFloat(selectedPayslip.overtime_hours || 0) * parseFloat(selectedPayslip.overtime_hourly_rate || 0);
    return (baseAmount + overtimeAmount).toFixed(2);
  };

  //Main render
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0f0f0f' }}>
      <View style={styles.appBar}>
        <View style={styles.appBarContent}>
          <Icon name="document-text-outline" size={24} color="#fff" />
          <Text style={styles.appBarTitle}>Payslip</Text>
        </View>
      </View>

      <View style={styles.calendarContainer}>
        <Calendar
          onDayPress={onDateChange}
          markedDates={getMarkedDates()}
          theme={{
            calendarBackground: '#1a1a1a',
            dayTextColor: '#e0e0e0',
            monthTextColor: '#ffffff',
            arrowColor: '#007bff',
            selectedDayBackgroundColor: '#007bff',
            selectedDayTextColor: '#fff',
            textDisabledColor: '#3a3a3a',
            todayTextColor: '#007bff'
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
                  borderRadius: 20,
                  padding: 8,
                  width: 36,
                  height: 36,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Text style={{
                  color: isDisabled ? '#3a3a3a' : isSelected ? '#fff' : '#e0e0e0',
                  textAlign: 'center',
                  fontSize: 14,
                  fontWeight: isSelected ? '600' : '400'
                }}>
                  {date.day}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <Icon name="hourglass-outline" size={40} color="#007bff" />
              <Text style={styles.loadingText}>Loading payslip...</Text>
            </View>
          ) : !payslip ? (
            <View style={styles.emptyContainer}>
              <Icon name="document-outline" size={60} color="#3a3a3a" />
              <Text style={styles.emptyText}>No payslip found</Text>
              <Text style={styles.emptySubtext}>Select a different Tuesday to view payslips</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[
                styles.payslipCard,
                selectedPayslip?.payroll_id === payslip.payroll_id && styles.selectedPayslipCard,
              ]}
              onPress={() => {
                if (selectedPayslip?.payroll_id === payslip.payroll_id) {
                  setSelectedPayslip(null);
                } else {
                  setSelectedPayslip(payslip);
                }
              }}
            >
              <View style={styles.payslipCardHeader}>
                <View style={styles.payslipIconContainer}>
                  <Icon name="receipt-outline" size={24} color="#007bff" />
                </View>
                <View style={styles.payslipCardInfo}>
                  <Text style={styles.payslipCardTitle}>Payslip #{payslip.payroll_id}</Text>
                  <Text style={styles.payslipCardPeriod}>{payslip.period}</Text>
                </View>
                <Icon 
                  name={selectedPayslip?.payroll_id === payslip.payroll_id ? "chevron-up" : "chevron-down"} 
                  size={24} 
                  color="#007bff" 
                />
              </View>
              
              <View style={styles.payslipCardAmount}>
                <Text style={styles.amountLabel}>Total Payment</Text>
                <Text style={styles.amountValue}>R {parseFloat(payslip.total_amount).toFixed(2)}</Text>
              </View>
            </TouchableOpacity>
          )}

          {selectedPayslip && (
            <View style={styles.detailsCard}>
              <View style={styles.detailsHeader}>
                <Icon name="information-circle-outline" size={24} color="#007bff" />
                <Text style={styles.detailsTitle}>Payment Details</Text>
              </View>

              <View style={styles.divider} />

              {/* Employee Information Section */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>EMPLOYEE INFORMATION</Text>
                <View style={styles.infoRow}>
                  <Icon name="person-outline" size={18} color="#007bff" />
                  <Text style={styles.infoLabel}>Name</Text>
                  <Text style={styles.infoValue}>
                    {selectedPayslip.first_name} {selectedPayslip.last_name}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Icon name="calendar-outline" size={18} color="#007bff" />
                  <Text style={styles.infoLabel}>Payment Date</Text>
                  <Text style={styles.infoValue}>
                    {dayjs(selectedPayslip.payment_date).format('DD MMM YYYY')}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Icon 
                    name={selectedPayslip._status === 'Paid' ? "checkmark-circle-outline" : "time-outline"} 
                    size={18} 
                    color={selectedPayslip._status === 'Paid' ? "#28a745" : "#ffc107"} 
                  />
                  <Text style={styles.infoLabel}>Status</Text>
                  <View style={[
                    styles.statusBadge, 
                    selectedPayslip._status === 'Paid' ? styles.statusPaid : styles.statusPending
                  ]}>
                    <Text style={[
                      styles.statusText,
                      selectedPayslip._status === 'Paid' ? styles.statusPaidText : styles.statusPendingText
                    ]}>
                      {selectedPayslip._status}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.divider} />

              {/* Earnings Breakdown Section */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>EARNINGS BREAKDOWN</Text>
                
                <View style={styles.earningsRow}>
                  <View style={styles.earningsLeft}>
                    <Icon name="time-outline" size={18} color="#e0e0e0" />
                    <Text style={styles.earningsLabel}>Regular Hours</Text>
                  </View>
                  <View style={styles.earningsRight}>
                    <Text style={styles.earningsHours}>{selectedPayslip.base_hours} hrs</Text>
                    <Text style={styles.earningsRate}>@ R{parseFloat(selectedPayslip.base_hourly_rate).toFixed(2)}/hr</Text>
                  </View>
                  <Text style={styles.earningsAmount}>
                    R{(parseFloat(selectedPayslip.base_hours) * parseFloat(selectedPayslip.base_hourly_rate)).toFixed(2)}
                  </Text>
                </View>

                <View style={styles.earningsRow}>
                  <View style={styles.earningsLeft}>
                    <Icon name="timer-outline" size={18} color="#ffc107" />
                    <Text style={styles.earningsLabel}>Overtime Hours</Text>
                  </View>
                  <View style={styles.earningsRight}>
                    <Text style={styles.earningsHours}>{selectedPayslip.overtime_hours} hrs</Text>
                    <Text style={styles.earningsRate}>@ R{parseFloat(selectedPayslip.overtime_hourly_rate).toFixed(2)}/hr</Text>
                  </View>
                  <Text style={styles.earningsAmount}>
                    R{(parseFloat(selectedPayslip.overtime_hours) * parseFloat(selectedPayslip.overtime_hourly_rate)).toFixed(2)}
                  </Text>
                </View>
              </View>

              <View style={styles.divider} />

              {/* Summary Section */}
              <View style={styles.summarySection}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Gross Pay</Text>
                  <Text style={styles.summaryValue}>R{calculateGrossPay()}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Deductions</Text>
                  <Text style={styles.summaryValue}>R0.00</Text>
                </View>
                <View style={[styles.summaryRow, styles.totalRow]}>
                  <Text style={styles.totalLabel}>NET PAY</Text>
                  <Text style={styles.totalValue}>R{parseFloat(selectedPayslip.total_amount).toFixed(2)}</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.downloadButton}
                onPress={() => downloadPayslip(selectedPayslip.payroll_id)}
              >
                <Icon name="download-outline" size={22} color="#ffffff" />
                <Text style={styles.downloadText}>Download PDF</Text>
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
    borderBottomColor: '#2a2a2a'
  },
  appBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appBarTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 10,
  },
  calendarContainer: {
    backgroundColor: '#1a1a1a',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 100,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    color: '#aaa',
    fontSize: 16,
    marginTop: 15,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: '#aaa',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
  },
  emptySubtext: {
    color: '#666',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  payslipCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  selectedPayslipCard: {
    borderColor: '#007bff',
    borderWidth: 2,
  },
  payslipCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  payslipIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#0a2540',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  payslipCardInfo: {
    flex: 1,
  },
  payslipCardTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  payslipCardPeriod: {
    color: '#aaaaaa',
    fontSize: 14,
  },
  payslipCardAmount: {
    backgroundColor: '#0f0f0f',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#007bff',
  },
  amountLabel: {
    color: '#aaaaaa',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  amountValue: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '700',
  },
  detailsCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  detailsTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
    marginLeft: 10,
  },
  divider: {
    height: 1,
    backgroundColor: '#2a2a2a',
    marginVertical: 20,
  },
  section: {
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#007bff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 15,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  infoLabel: {
    color: '#aaaaaa',
    fontSize: 14,
    marginLeft: 10,
    flex: 1,
  },
  infoValue: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusPaid: {
    backgroundColor: '#1a3a2a',
  },
  statusPending: {
    backgroundColor: '#3a3020',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  statusPaidText: {
    color: '#28a745',
  },
  statusPendingText: {
    color: '#ffc107',
  },
  earningsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f0f0f',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  earningsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  earningsLabel: {
    color: '#e0e0e0',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 10,
  },
  earningsRight: {
    alignItems: 'flex-end',
    marginRight: 15,
  },
  earningsHours: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  earningsRate: {
    color: '#aaaaaa',
    fontSize: 11,
    marginTop: 2,
  },
  earningsAmount: {
    color: '#007bff',
    fontSize: 16,
    fontWeight: '700',
    minWidth: 80,
    textAlign: 'right',
  },
  summarySection: {
    backgroundColor: '#0f0f0f',
    borderRadius: 12,
    padding: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryLabel: {
    color: '#aaaaaa',
    fontSize: 14,
  },
  summaryValue: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 2,
    borderTopColor: '#007bff',
    marginBottom: 0,
  },
  totalLabel: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
  totalValue: {
    color: '#007bff',
    fontSize: 24,
    fontWeight: '700',
  },
  downloadButton: {
    flexDirection: 'row',
    backgroundColor: '#007bff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    shadowColor: '#007bff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  downloadText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
    marginLeft: 10,
  },
});

export default Payslip;