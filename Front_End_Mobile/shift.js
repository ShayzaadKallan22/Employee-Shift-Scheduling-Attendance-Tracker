/**
 * @author MOYO CT, 221039267
 * @version mobile_app
 */
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, SafeAreaView } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { Picker } from '@react-native-picker/picker';
import { useNavigation } from '@react-navigation/native';
import { Calendar } from 'react-native-calendars';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import BottomNav from './BottomNav';
import config from './config';

const API_URL = config.API_URL;

const Shift = () => {
  const navigation = useNavigation();  
  const [activeTab, setActiveTab] = useState('Schedule');
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [assignedDate, setAssignedDate] = useState(null);
  const [swapDate, setSwapDate] = useState(null);
  const [showAssignedCalendar, setShowAssignedCalendar] = useState(false);
  const [showSwapCalendar, setShowSwapCalendar] = useState(false);
  const [colleagues, setColleagues] = useState([]);
  const [selectedColleague, setSelectedColleague] = useState('');
  const [colleagueRequests, setColleagueRequests] = useState([]);
  const [requestingEmployeeId, setRequestingEmployeeId] = useState('');
  const [myRequests, setMyRequests] = useState([]);
  const [empShiftDates, setShiftDates] = useState([]);
  const [colleagueShiftDates, setCollShiftDates] = useState([]);
  const [minDate, setMinDate] = useState(new Date());
  const [maxDate, setMaxDate] = useState(new Date());
  const [isLoading, setIsLoading] = useState(false);
  const [empShiftDateStrings, setEmpShiftDateStrings] = useState([]);
  const [colleagueShiftDateStrings, setColleagueShiftDateStrings] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [shifts, setShifts] = useState([]);

  //Helper function to sort dates
  const sortByDate = (requests) =>
    [...requests].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  //Load employee ID from async storage.
  useEffect(() => {
    const loadEmpID = async () => {
      const id = await AsyncStorage.getItem('employee_id');
      setRequestingEmployeeId(id);
    };
    loadEmpID();
  }, []);

  //Fetch employee shifts for upcoming schedule
  useEffect(() => {
    const fetchShifts = async () => {
      try {
        const employee_id = await AsyncStorage.getItem('employee_id');
        if (!employee_id) throw new Error('Employee id could not be found');
        
        const res = await axios.get(`${API_URL}/api/schedule/employee/${employee_id}/shifts`);
        const shiftData = res.data.map(({date_, start_time, end_time, event_title, event_description}) => ({
          date: new Date(date_).getDate().toString().padStart(2,'0'),
          fullDate: new Date(date_).toLocaleDateString('en-CA'),
          start: start_time,
          end: end_time,
          eventName: event_title,
          eventDesc: event_description,
          hasEvent: !!event_title, //Simple flag to check if event exists
          eventType: event_title ? (event_description?.length > 50 ? 'detailed' : 'standard') : 'none' //Categorize events
        }));
        setShifts(shiftData);
        console.log(shiftData);
      } catch(err) {
        Alert.alert('Failed to fetch shifts:', err);
      }
    };
    fetchShifts();
  }, []);

  //Fetch employee shift dates for swaps
  useEffect(() => {
    const fetchEmpShiftDates = async () => {
      if (!requestingEmployeeId) return;
      setIsLoading(true);
      try {
        const response = await fetch(`${API_URL}/api/shift-swap/employee-shift-dates/${requestingEmployeeId}`);
        if (!response.ok) throw new Error('Failed to fetch employee shift dates');
        const data = await response.json();
        
        const dates = data
          .map(dateStr => {
            if (!dateStr || typeof dateStr !== 'string') return null;
            const date = new Date(dateStr + 'T00:00:00Z');
            return isNaN(date.getTime()) ? null : date;
          })
          .filter(Boolean);
        
        setShiftDates(dates);
        setEmpShiftDateStrings(data);

        if (dates.length > 0) {
          setMinDate(new Date(Math.min(...dates.map(date => date.getTime()))));
          setMaxDate(new Date(Math.max(...dates.map(date => date.getTime()))));
          setAssignedDate(dates[0]);
        }
      } catch (error) {
        Alert.alert('Error fetching employee shift dates:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchEmpShiftDates();
  }, [requestingEmployeeId]);

  //Fetch employee colleagues with same role.
  useEffect(() => {
    if (!requestingEmployeeId) return;
    
    const fetchColleagues = async () => {
      try {
        const response = await fetch(`${API_URL}/api/shift-swap/colleagues/${requestingEmployeeId}`);
        if (!response.ok) {
          const errText = await response.text();
          Alert.alert('Backend error:', errText);
          throw new Error(`Status ${response.status}`);
        }
        
        const data = await response.json();
        if (!Array.isArray(data)) throw new Error('Invalid response format'); 
        setColleagues(data.map(e => ({ label: e.name, value: e.employee_id })));
      } catch (error) {
        Alert.alert('Failed to fetch colleagues', error);
      }
    };

    fetchColleagues();
  }, [requestingEmployeeId]);

  //Get shift ID
  const getShiftId = async (employeeId, date) => {
    try {
      const response = await fetch(
        `${API_URL}/api/shift-swap/shiftID?employee_id=${employeeId}&date=${date}`
      );
      if (!response.ok) throw new Error('No shift found');
      const data = await response.json();
      return data.shift_id;
    } catch (error) {
      Alert.alert('Shift fetch error:', error);
      return null;
    }
  };

  //Fetch colleague shift dates
  useEffect(() => {
    const fetchColleagueShiftDates = async () => {
      if (!selectedColleague) return;
      
      try {
        const response = await fetch(`${API_URL}/api/shift-swap/colleague-shift-dates/${selectedColleague}`);
        if (!response.ok) throw new Error('Failed to fetch colleague shift dates');
        const data = await response.json();

        const parsedDates = data
          .map(dateStr => {
            if (!dateStr || typeof dateStr !== 'string') return null;
            const date = new Date(dateStr + 'T00:00:00Z');
            return isNaN(date.getTime()) ? null : date;
          })
          .filter(Boolean);

        setCollShiftDates(parsedDates);
        setColleagueShiftDateStrings(data);

        if (parsedDates.length > 0 && !swapDate) {
          setSwapDate(parsedDates[0]);
        }
      } catch (error) {
        Alert.alert('Error fetching colleague shift dates:', error);
      }
    };
    
    fetchColleagueShiftDates();
  }, [selectedColleague]);

  //Mark colleague's assigned shift dates on the calendar
  const markedColleagueDates = colleagueShiftDateStrings.reduce((acc, dateStr) => {
    acc[dateStr] = {
      selected: true,
      selectedColor: '#007bff',
      customStyles: {
        text: { color: 'white' },
        container: { backgroundColor: '#007bff' },
      }
    };
    return acc;
  }, {});

  //Mark employee assigned shift dates on the Calendar
  const markedAssignedDates = empShiftDateStrings.reduce((acc, dateStr) => {
    acc[dateStr] = {
      selected: true,
      selectedColor: '#007bff',
      customStyles: {
        text: { color: 'white' },
        container: { backgroundColor: '#007bff' },
      }
    };
    return acc;
  }, {});

  //Mark dates for schedule calendar
  const markedDates = shifts.reduce((acc, shift) => {
  const hasEvent = shift.hasEvent;
  
  acc[shift.fullDate] = {
    marked: true,
    dotColor: hasEvent ? '#ff6b6b' : '#007bff', //Different colors for events
    selected: shift.fullDate === selectedDate,
    selectedColor: hasEvent ? '#ff6b6b' : '#007bff',
    selectedTextColor: '#fff',
    
    //Styling for events
    customStyles: {
      container: {
        backgroundColor: hasEvent ? 'rgba(255, 107, 107, 0.1)' : 'transparent',
        borderRadius: 8,
        borderWidth: hasEvent ? 1 : 0,
        borderColor: hasEvent ? '#ff6b6b' : 'transparent',
      },
      text: {
        color: hasEvent ? '#ff6b6b' : '#ffffff',
        fontWeight: hasEvent ? '600' : 'normal',
      }
    }
  };
  return acc;
}, {});

  //Handle swap request submission.
  const handleSubmitRequest = async () => {
    try {
      const assignedDateStr = assignedDate.toISOString().split('T')[0];
      const swapDateStr = swapDate.toISOString().split('T')[0];

      //Check if the selected assigned date is valid.
      const isValidAssignedDate = empShiftDates.some(date => 
        date.toISOString().split('T')[0] === assignedDateStr
      );

      //Check if swap date is valid
      const isValidSwapDate = colleagueShiftDates.some(date => 
        date.toISOString().split('T')[0] === swapDateStr
      );

      if (!isValidAssignedDate || !isValidSwapDate) {
        Alert.alert('Invalid Dates', 'Please select valid dates.');
        return;
      }

      //Fetch the original and requested shift IDs.
      const originalShiftId = await getShiftId(requestingEmployeeId, assignedDateStr);
      const requestedShiftId = await getShiftId(selectedColleague, swapDateStr);

      if (!originalShiftId || !requestedShiftId) {
        Alert.alert('Could not find matching shifts for selected dates');
        return;
      }

      //Create swap request payload to send to API.
      const payload = {
        original_shift_id: originalShiftId,
        requested_shift_id: requestedShiftId,
        requesting_employee_id: requestingEmployeeId,
        approving_employee_id: selectedColleague,
        assigned_Date: assignedDateStr,  
        swap_Date: swapDateStr 
      };

      //Create shift swap request.
      const res = await fetch(`${API_URL}/api/shift-swap/create`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
      });

      const result = await res.json();
      Alert.alert('Shift-Swap submitted successfully.', result.message);
      setShowRequestForm(false);
    } catch (error) {
      Alert.alert('Failed to submit shift-swap request');
      //console.error(error);
    }
  };

  //Fetch colleague requests
  useEffect(() => {
    const fetchColleagueRequests = async () => {
      if (!requestingEmployeeId || activeTab !== 'Swap') return;

      try {
        const res = await fetch(`${API_URL}/api/shift-swap/colleague-requests/${requestingEmployeeId}`);
        if (!res.ok) throw new Error('Failed to fetch colleague requests');
        const data = await res.json();
        setColleagueRequests(data);
      } catch (error) {
        Alert.alert('Failed to fetch colleague requests:', error);
      }
    };

    fetchColleagueRequests();
  }, [activeTab, requestingEmployeeId]);

  //Fetch employee requests
  useEffect(() => {
    const fetchMyRequests = async () => {
      if (!requestingEmployeeId || activeTab !== 'Swap') return;

      try {
        const res = await fetch(`${API_URL}/api/shift-swap/my-requests/${requestingEmployeeId}`);
        if (!res.ok) throw new Error('Failed to fetch my requests');
        const data = await res.json();
        setMyRequests(data);
      } catch (error) {
        Alert.alert('Failed to fetch my requests:', error);
      }
    };

    fetchMyRequests();
  }, [activeTab, requestingEmployeeId]);

  //Respond to colleague requests
  const respondToRequest = async (swap_id, action) => {
    try {
      const res = await fetch(`${API_URL}/api/shift-swap/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ swap_id, action })
      });
      const data = await res.json();
      Alert.alert(data.message);
      
      setColleagueRequests(prev =>
        prev.map(req =>
          req.id === swap_id
            ? { ...req, status: action === 'approved' ? 'Confirmed' : 'Declined' }
            : req
        )
      );
    } catch (error) {
      Alert.alert('Failed to update request');
      //console.error(error);
    }
  };

  const renderRequestCard = (request, isMyRequest = false) => (
    <View key={request.id} style={styles.requestCard}>
      <View style={styles.requestHeader}>
        <Text style={styles.requestTitle}>Request #{request.id}</Text>
        <View style={[
          styles.statusBadge,
          (request.status === 'Confirmed' || request.status === 'approved') && styles.confirmedBadge,
          request.status === 'Declined' && styles.declinedBadge,
          request.status === 'rejected' && styles.declinedBadge
        ]}>
          <Text style={styles.statusText}>
            {request.status === 'approved' ? 'Confirmed' : 
             request.status === 'rejected' ? 'Declined' : request.status}
          </Text>
        </View>
      </View>

      {/* Show different text based on whether it's my request or a request to me */}
      {isMyRequest ? (
        <>
          <Text style={styles.requestText}>Requested from: {request.colleague || 'Unknown'}</Text>
          <Text style={styles.requestText}>My current shift: {request.assignedDate ? new Date(request.assignedDate).toLocaleDateString('en-CA') : 'N/A'}</Text>
          <Text style={styles.requestText}>Requested shift: {request.swapDate ? new Date(request.swapDate).toLocaleDateString('en-CA') : 'N/A'}</Text>
        </>
      ) : (
        <>
          <Text style={styles.requestText}>Requested by: {request.colleague || 'Unknown'}</Text>
          <Text style={styles.requestText}>Their current shift: {request.assignedDate ? new Date(request.assignedDate).toLocaleDateString('en-CA') : 'N/A'}</Text>
          <Text style={styles.requestText}>Requesting your shift: {request.swapDate ? new Date(request.swapDate).toLocaleDateString('en-CA') : 'N/A'}</Text>
        </>
      )}

      {/* Only show action buttons for requests that need my approval (not my own requests) */}
      {!isMyRequest && activeTab === 'Swap' && request.status === 'pending' && (
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.declineButton]}
            onPress={() => respondToRequest(request.id, 'rejected')}>
            <Text style={styles.buttonText}>Decline</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionButton, styles.confirmButton]}
            onPress={() => respondToRequest(request.id, 'approved')}>
            <Text style={styles.buttonText}>Approve</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Show status message for my own requests */}
      {isMyRequest && (
        <Text style={[
          styles.requestText, 
          request.status === 'pending' && styles.pendingStatus,
          request.status === 'approved' && styles.confirmedStatus,
          (request.status === 'rejected' || request.status === 'Declined') && styles.declinedStatus
        ]}>
          Status: {request.status === 'pending' ? 'Waiting for approval' : 
                  request.status === 'approved' ? 'Approved!' : 'Declined'}
        </Text>
      )}
    </View>
  );

  const selectedShift = shifts.find(shift => shift.fullDate === selectedDate);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.header}>Shifts</Text>
        
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'Schedule' && styles.activeTab]}
            onPress={() => setActiveTab('Schedule')}>
            <Text style={[styles.tabText, activeTab === 'Schedule' && styles.activeTabText]}>Schedule</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'Swap' && styles.activeTab]}
            onPress={() => setActiveTab('Swap')}>
            <Text style={[styles.tabText, activeTab === 'Swap' && styles.activeTabText]}>Swap</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'Schedule' ? (
          <View style={styles.scheduleContainer}>
            <Calendar
              onDayPress={day => setSelectedDate(day.dateString)}
              markedDates={markedDates}
              markingType={'custom'}
              theme={{
                calendarBackground: '#1a1a1a',
                dayTextColor: '#ffffff',
                monthTextColor: '#ffffff',
                textDisabledColor: '#555',
                arrowColor: '#ffffff',
                selectedDayTextColor: '#ffffff',
                selectedDayBackgroundColor: '#007bff',
                todayTextColor: '#ff6b6b',
                dotStyle: {
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                }
              }}

              dayComponent={({date, state, marking}) => {
                const shift = shifts.find(s => s.fullDate === date.dateString);
                const hasEvent = shift?.eventName;
                
                return (
                   <TouchableOpacity 
                      style={styles.dayContainer}
                      onPress={() => setSelectedDate(date.dateString)}
                      disabled={state === 'disabled'}
                    >
                    <Text style={[
                      styles.dayText,
                      state === 'disabled' && styles.disabledDayText,
                      marking?.selected && styles.selectedDayText,
                      hasEvent && styles.eventDayText
                    ]}>
                      {date.day}
                    </Text>
                    
                    {/* Event Indicator Badge */}
                    {hasEvent && (
                      <View style={[
                        styles.eventBadge,
                        marking?.selected && styles.eventBadgeSelected
                      ]}>
                        <Text style={styles.eventBadgeText}>●</Text>
                      </View>
                    )}
                    
                    {/* Shift dot indicator */}
                    {marking?.marked && (
                      <View style={[
                        styles.dot,
                        { backgroundColor: marking.dotColor }
                      ]} />
                    )}
                  </TouchableOpacity>
                );
              }}
            />

            {selectedDate && (
              <View style={styles.shiftDetails}>
                <Text style={styles.detailHeader}>Shift Details</Text>
                {selectedShift ? (
                  <>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Start Time:</Text>
                      <Text style={styles.detailValue}>{selectedShift.start?.split(':').slice(0, 2).join(':')}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>End Time:</Text>
                      <Text style={styles.detailValue}>{selectedShift.end?.split(':').slice(0, 2).join(':')}</Text>
                    </View>
                     <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Event:</Text>
                      <Text style={styles.detailValue}>{selectedShift.eventName}</Text>
                    </View>

                    <TouchableOpacity 
                      style={styles.requestSwapButton}
                      onPress={() => {
                        setActiveTab('Swap');
                        setShowRequestForm(true);
                      }}>
                      <Text style={styles.requestSwapText}>Request Swap for This Shift</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <Text style={styles.noShiftText}>No shift scheduled</Text>
                )}
              </View>
            )}
          </View>
        ) : (
          <>
            {!showRequestForm ? (
              <>
                <TouchableOpacity 
                  style={styles.newRequestButton}
                  onPress={() => setShowRequestForm(true)}>
                  <Icon name="swap-horizontal" size={20} color="#ffffff" />
                  <Text style={styles.newRequestText}>Request Swap</Text>
                </TouchableOpacity>
                <ScrollView style={styles.requestsContainer}>
                  {/* Requests assigned to me (I need to approve) */}
                  <Text style={styles.sectionTitle}>Requests Waiting for My Approval</Text>
                  {sortByDate(colleagueRequests.filter(r => r.status === 'pending')).map(request => 
                    renderRequestCard(request, false)
                  )}
                  
                  {/* Requests I made (waiting for others to approve) */}
                  <Text style={styles.sectionTitle}>My Pending Requests</Text>
                  {sortByDate(myRequests.filter(r => r.status === 'pending')).map(request => 
                    renderRequestCard(request, true)
                  )}

                  {/* Historical requests (approved/rejected) */}
                  <Text style={styles.sectionTitle}>Request History</Text>
                  {sortByDate([
                    ...colleagueRequests.filter(r => r.status !== 'pending'),
                    ...myRequests.filter(r => r.status !== 'pending')
                  ]).map(request => 
                    renderRequestCard(request, request.requesting_employee_id === requestingEmployeeId)
                  )}
                </ScrollView>
              </>
            ) : (
              <ScrollView contentContainerStyle={styles.requestFormContainer} keyboardShouldPersistTaps="handled">
                <View style={styles.requestForm}>
                  <Text style={styles.formTitle}>New Swap Request</Text>
                  
                  <Text style={styles.label}>Colleague:</Text>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={selectedColleague}
                      onValueChange={(itemValue) => setSelectedColleague(itemValue)}
                      style={styles.picker}
                      dropdownIconColor="#ffffff">
                      <Picker.Item label="Select a colleague..." value="" />
                      {colleagues.map(c => (
                        <Picker.Item key={c.value} label={c.label} value={c.value} />
                      ))}
                    </Picker>
                  </View>

                  <Text style={styles.label}>Assigned Date:</Text>
                  <TouchableOpacity
                    style={styles.dateInput}
                    onPress={() => setShowAssignedCalendar(!showAssignedCalendar)}
                  >
                    <Text style={styles.dateText}>
                      {assignedDate ? assignedDate.toLocaleDateString('en-CA') : 'Select a date'}
                    </Text>
                  </TouchableOpacity>

                  {showAssignedCalendar && (
                    <View style={{ borderRadius: 10, overflow: 'hidden', marginBottom: 20 }}>
                      <Calendar
                        markedDates={markedAssignedDates} 
                        markingType="custom"
                        onDayPress={(day) => {
                          const selected = day.dateString;
                          if (empShiftDateStrings.includes(selected)) {
                            setAssignedDate(new Date(selected));
                            setShowAssignedCalendar(false);
                          } else {
                            Alert.alert('Invalid Date', 'Please select a date you have a shift scheduled');
                          }
                        }}
                        enableSwipeMonths={true}
                        theme={{
                          backgroundColor: '#ffffff',
                          calendarBackground: '#ffffff',
                          selectedDayBackgroundColor: '#007bff',
                          selectedDayTextColor: '#ffffff',
                          todayTextColor: '#00adf5',
                          dayTextColor: '#2d4150',
                          arrowColor: '#007bff',
                          monthTextColor: '#007bff',
                        }}
                      />
                    </View>
                  )}

                  <Text style={styles.label}>Swap Date:</Text>
                  <TouchableOpacity
                    style={styles.dateInput}
                    onPress={() => setShowSwapCalendar(!showSwapCalendar)}
                  >
                    <Text style={styles.dateText}>
                      {swapDate ? swapDate.toLocaleDateString('en-CA') : 'Select a date'}
                    </Text>
                  </TouchableOpacity>

                  {showSwapCalendar && (
                    <View style={{ borderRadius: 10, overflow: 'hidden', marginBottom: 20 }}>
                      <Calendar
                        markedDates={markedColleagueDates}
                        markingType="custom"
                        onDayPress={(day) => {
                          const selected = day.dateString;
                          if (colleagueShiftDateStrings.includes(selected)) {
                            setSwapDate(new Date(selected));
                            setShowSwapCalendar(false);
                          } else {
                            Alert.alert('Invalid Date', 'Please select a date your colleague has a shift');
                          }
                        }}
                        enableSwipeMonths={true}
                        theme={{
                          backgroundColor: '#ffffff',
                          calendarBackground: '#ffffff',
                          selectedDayBackgroundColor: '#007bff',
                          selectedDayTextColor: '#ffffff',
                          todayTextColor: '#00adf5',
                          dayTextColor: '#2d4150',
                          arrowColor: '#007bff',
                          monthTextColor: '#007bff',
                        }}
                      />
                    </View>
                  )}

                  <View style={styles.formButtons}>
                    <TouchableOpacity 
                      style={[styles.submitButton, styles.cancelButton]}
                      onPress={() => setShowRequestForm(false)}>
                      <Text style={styles.buttonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.submitButton}
                      onPress={handleSubmitRequest}>
                      <Text style={styles.buttonText}>Submit Request</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            )}
          </>
        )}

        <BottomNav />
      </View>
    </SafeAreaView>
  );
};

{/* Styles */}
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  container: {
    flex: 1,
    padding: 20,
    paddingBottom: 0,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 20,
    textAlign: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  tabButton: {
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    flex: 1,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomColor: '#007bff',
  },
  tabText: {
    color: '#aaaaaa',
    fontWeight: 'bold',
  },
  activeTabText: {
    color: '#ffffff',
  },
  scheduleContainer: {
    flex: 1,
    marginBottom: 80,
  },
  shiftDetails: {
    backgroundColor: '#2c2c2c',
    borderRadius: 10,
    padding: 20,
    marginTop: 15,
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
  requestSwapButton: {
    backgroundColor: '#007bff',
    padding: 12,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 15,
  },
  requestSwapText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  newRequestButton: {
    flexDirection: 'row',
    backgroundColor: '#007bff',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  newRequestText: {
    color: '#ffffff',
    fontWeight: 'bold',
    marginLeft: 10,
  },
  requestsContainer: {
    flex: 1,
    marginBottom: 80,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginVertical: 15,
  },
  requestCard: {
    backgroundColor: '#2c2c2c',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  requestTitle: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  requestFormContainer: {
    flexGrow: 1,
    paddingBottom: 100,
  },
  requestText: {
    color: '#ffffff',
    marginBottom: 5,
  },
  statusBadge: {
    backgroundColor: '#FFA500',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  confirmedBadge: {
    backgroundColor: '#4CAF50',
  },
  declinedBadge: {
    backgroundColor: '#FF4444',
  },
  statusText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
  },
  actionButton: {
    padding: 8,
    borderRadius: 5,
    marginLeft: 10,
    minWidth: 80,
    alignItems: 'center',
  },
  confirmButton: {
    backgroundColor: '#4CAF50',
  },
  declineButton: {
    backgroundColor: '#FF4444',
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  requestForm: {
    backgroundColor: '#2c2c2c',
    borderRadius: 10,
    padding: 20,
  },
  formTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  label: {
    color: '#ffffff',
    marginBottom: 8,
  },
  pickerContainer: {
    backgroundColor: '#3e3e3e',
    borderRadius: 5,
    marginBottom: 15,
    overflow: 'hidden',
  },
  picker: {
    color: '#ffffff',
    height: 50,
  },
  formButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  submitButton: {
    backgroundColor: '#007bff',
    padding: 12,
    borderRadius: 5,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#3e3e3e',
    borderWidth: 1,
    borderColor: '#007bff',
  },
  dateInput: {
    backgroundColor: '#3e3e3e',
    color: '#ffffff',
    borderRadius: 5,
    padding: 12,
    marginBottom: 15,
    justifyContent: 'center',
  },
  dateText: {
    color: '#ffffff',
  },
  pendingStatus: {
    color: '#FFA500',
    fontWeight: 'bold',
    marginTop: 10
  },
  confirmedStatus: {
    color: '#4CAF50',
    fontWeight: 'bold',
    marginTop: 10
  },
  declinedStatus: {
    color: '#FF4444',
    fontWeight: 'bold',
    marginTop: 10
  },
  dayContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    width: 40,
    position: 'relative',
  },
  dayText: {
    fontSize: 16,
    color: '#ffffff',
    textAlign: 'center',
  },
  disabledDayText: {
    color: '#555',
  },
  selectedDayText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  eventDayText: {
    fontWeight: '600',
  },
  
  //Event Badge Styles
  eventBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#ff6b6b',
    borderRadius: 6,
    width: 12,
    height: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1a1a1a',
  },
  eventBadgeSelected: {
    borderColor: '#ffffff',
    backgroundColor: '#ff5252',
  },
  eventBadgeText: {
    color: '#fff',
    fontSize: 6,
    fontWeight: 'bold',
  },
  //Dot indicator
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    position: 'absolute',
    bottom: 4,
  },
});

export default Shift;