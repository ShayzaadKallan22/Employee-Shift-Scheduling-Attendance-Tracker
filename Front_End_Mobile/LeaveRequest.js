/**
 * @author MOYO CT, 221039267
 * @version mobile_app
 */

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView,SafeAreaView, Modal, RefreshControl } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, ActivityIndicator } from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import moment from 'moment';
import BottomNav from './BottomNav';
import config from './config';
import * as DocumentPicker from 'expo-document-picker';

const API_URL = config.API_URL;

const LeaveRequest = () => {
  const navigation = useNavigation();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sickNote, setSickNote] = useState(null);
  const [leaveType, setLeaveType] = useState('Annual');
  const [leaveStatus, setLeaveStatus] = useState('');
  const [pendingRequests, setPendingRequests] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [tempRequest, setTempRequest] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [leaveBalances, setLeaveBalances] = useState({
    Annual: { remaining: null, max: 20, used: null },
    Sick: { remaining: null, max: 30, used: null },
    Family: { remaining: null, max: 15, used: null }
  });
  const [leaveHistory, setLeaveHistory] = useState([]);
  const [expandedLeaveTypes, setExpandedLeaveTypes] = useState({});
  const [uploadingNote, setUploadingNote] = useState(false);
  const [refreshing, setRefreshing] = useState(false);


//   const handleApiError = (error, navigation) => {
//   console.error('API Error:', error);
//   if (error.response?.status === 403) {
//     Alert.alert(
//       'Session Expired', 
//       'Your session has expired. Please login again.',
//       [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
//     );
//   } else {
//     Alert.alert(
//       'Error',
//       error.response?.data?.message || 'An error occurred'
//     );
//   }
// };

  useEffect(() => {
  const fetchRemainingDays = async () => {
    if (!leaveType) return;
    
    try {
      const employeeId = await AsyncStorage.getItem('employee_id');
      if (!employeeId) {
        console.log('No employee ID found');
        return;
      }

      console.log('Employee ID:', employeeId); // Debug log
      const numericId = employeeId.replace('EMP-', '');
      console.log('Numeric ID:', numericId); // Debug log

      const leaveTypeMap = {
        'Annual': 1,
        'Sick': 2,
        'Family': 3
      };
      
      for (const [type, id] of Object.entries(leaveTypeMap)) {
        console.log(`Fetching ${type} leave (ID: ${id})`); //Debug log
        
        try {
          const response = await axios.get(
            `${API_URL}/api/leaves/remaining/${employeeId}/${id}`,
            { headers: { 'Content-Type': 'application/json' } }
          );
          
          console.log(`${type} leave response:`, response.data); //Debug log
          
          if (response.data) {
            setLeaveBalances(prev => ({
              ...prev,
              [type]: {
                remaining: response.data.remainingDays || null,
                max: response.data.maxBalance || prev[type].max,
                used: response.data.usedDays || null
              }
            }));
          }
        } catch (error) {
          console.error(`Error fetching ${type} leave:`, error);
          if (error.response) {
            console.error('Response data:', error.response.data);
            console.error('Status code:', error.response.status);
          }
        }
      }
    } catch (error) {
      console.error('General error in fetchRemainingDays:', error);
    }
  };

  fetchRemainingDays();
}, [leaveType]);

  //Fetch leave balances for each type
const LeaveTypes = React.useMemo(() => [
  { 
    label: 'Annual', 
    value: 'Annual', 
    remaining: leaveBalances.Annual?.remaining, 
    max: leaveBalances.Annual?.max ?? 20 
  },
  { 
    label: 'Sick', 
    value: 'Sick', 
    remaining: leaveBalances.Sick?.remaining, 
    max: leaveBalances.Sick?.max ?? 30 
  },
  { 
    label: 'Family', 
    value: 'Family', 
    remaining: leaveBalances.Family?.remaining, 
    max: leaveBalances.Family?.max ?? 15 
  }
], [leaveBalances]);


  useEffect(() => {
  fetchLeaveHistory();
  //fetchRemainingDays();
  }, []);

  //Add pull-to-refresh functionality
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchLeaveHistory();
      await fetchRemainingDays();
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      setRefreshing(false);
    }
  };

  //Check if a date is a Friday, Saturday, Sunday, or Monday (0 = Sunday, 1 = Monday, etc.)
  const isValidWorkDay = (date) => {
    const day = date.getDay();
    return day === 0 || day === 1 || day === 5 || day === 6; // Sunday, Monday, Friday, Saturday
  };

  //Confirm leave start date with validation
  const handleConfirmStart = (date) => {
    if (!isValidWorkDay(date)) {
      Alert.alert('Invalid Day', 'You can only select Fridays, Saturdays, Sundays, or Mondays as start date');
      return;
    }
    setStartDate(moment(date).format('YYYY-MM-DD'));
    setShowStartPicker(false);
  };

  //Confirm leave end date with validation
  const handleConfirmEnd = (date) => {
    if (!isValidWorkDay(date)) {
      Alert.alert('Invalid Day', 'You can only select Fridays, Saturdays, Sundays, or Mondays as end date');
      return;
    }
    
    //Also validate that end date is after start date
    if (startDate && moment(date).isBefore(moment(startDate))) {
      Alert.alert('Invalid Date', 'End date must be after start date');
      return;
    }
    
    setEndDate(moment(date).format('YYYY-MM-DD'));
    setShowEndPicker(false);
  };

  //Custom function to get the next valid work day (Friday, Saturday, Sunday, or Monday)
  const getNextValidWorkDay = (date) => {
    const newDate = new Date(date);
    while (!isValidWorkDay(newDate)) {
      newDate.setDate(newDate.getDate() + 1);
    }
    return newDate;
  };

  //Handle picking a sick note
  const handlePickSickNote = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });

    if (!result.canceled) {
      //Check if the selected file is a PDF
      if (!result.assets[0].name.toLowerCase().endsWith('.pdf')) {
        Alert.alert('Invalid file', 'Only PDF files are allowed.');
        return;
      }
      setSickNote(result.assets[0]);
    }
  };

  //Submit leave request
  const handleSubmit = async () => {
    if (!startDate || !endDate || !leaveType) {
      Alert.alert('Error', 'Please complete all the required fields.');
      return;
    }

    //Additional validation for work days
    const startDay = new Date(startDate).getDay();
    const endDay = new Date(endDate).getDay();
    
    if (!isValidWorkDay(new Date(startDate)) || !isValidWorkDay(new Date(endDate))) {
      Alert.alert('Invalid Days', 'Leave can only be requested for Fridays, Saturdays, Sundays, or Mondays');
      return;
    }

    setIsLoading(true);

    try {
      //Get employee ID from AsyncStorage.
      const employeeId = await AsyncStorage.getItem('employee_id');
      if (!employeeId) {
        throw new Error('Employee ID not found');
      }

      //Map leave type to leave_type_id 
      const leaveTypeMap = {
        'Annual': 1,
        'Sick': 2,
        'Family': 3
      };

      const leaveTypeId = Number(leaveTypeMap[leaveType]);
      //Replace the EMP with an empty character if the employee id comes with the EMP.
      //const numericId = employeeId.replace('EMP-', '');
      
      //Send request to the API to handle.
      const formData = new FormData();
      formData.append('employee_id', employeeId);
      formData.append('leave_type_id', leaveTypeId.toString());
      formData.append('start_date', startDate);
      formData.append('end_date', endDate);

      if (leaveType === 'Sick' && sickNote) {
        formData.append('sick_note', {
          uri: sickNote.uri,
          name: sickNote.name,
          type: 'application/pdf'
        });
      }
      
      //Debugging: Log FormData entries
      console.log('FormData entries:');
      for (let [key, value] of formData.entries()) {
        console.log(key, value);
      }

      const response = await axios.post(`${API_URL}/api/leaves/request`, formData, {
        headers: { 
          'Content-Type': 'multipart/form-data'
          //'Authorization': `Bearer ${await AsyncStorage.getItem('token')}`
        },
      });

      console.log('Full response:', response.data);
      
      //Add the new request to pendingRequests with the response data
      const newRequest = {
        id: response.data.leave_id.toString(),
        startDate,
        endDate,
        leaveType,
        leaveStatus: response.data.status_
      };

      setPendingRequests([...pendingRequests, newRequest]);
      setStartDate('');
      setEndDate('');
      setLeaveType('Annual');
      setLeaveStatus(response.data.status_);
      
      //Pop up if leave request was was submitted successfully
      Alert.alert('Success', 'Leave request submitted successfully');
    } catch (error) {
      console.error('Error submitting leave request:', error);
      Alert.alert(
        'Error', 
        error.response?.data?.message || 'Failed to submit leave request'
      );
    } finally {
      setIsLoading(false);
    }
  };

  //Handle uploading sick note.
  const handleUploadSickNote = async (leaveId) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        //Check file size (5MB limit)
        if (result.assets[0].size > 5 * 1024 * 1024) {
          Alert.alert('File too large', 'Sick note must be less than 5MB');
          return;
        }

        setUploadingNote(true);
        
        const formData = new FormData();
        formData.append('sick_note', {
          uri: result.assets[0].uri,
          name: result.assets[0].name,
          type: 'application/pdf'
        });

        const response = await axios.post(
          `${API_URL}/api/leaves/${leaveId}/upload-sick-note`, 
          formData, 
          { 
            headers: { 
              'Content-Type': 'multipart/form-data'
              //'Authorization': `Bearer ${await AsyncStorage.getItem('token')}`
            } 
          }
        );

        if (response.data.success) {
          Alert.alert('Success', 'Sick note uploaded successfully');
          //Refresh the leave history
          await fetchLeaveHistory();
        } else {
          Alert.alert('Error', response.data.message || 'Failed to upload sick note');
        }
      }
    } catch (error) {
      console.error('Error uploading sick note:', error);
      Alert.alert(
        'Error', 
        error.response?.data?.message || 
        'Failed to upload sick note. Please try again.'
      );
    } finally {
      setUploadingNote(false);
    }
  };

  //Handle cancelling a leave request
  const handleCancelRequest = (id) => {
    setTempRequest(pendingRequests.find(req => req.id === id));
    setShowModal(true);
  };

  const confirmCancel = async () => {
    if(!tempRequest) return;

    try {
      //Cancel leave request.
      await axios.delete(`${API_URL}/api/leaves/cancel/${tempRequest.id}`,
       {
        headers: {
          //'Authorization': `Bearer ${await AsyncStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      }
      );
    
      setPendingRequests(pendingRequests.filter(req => req.id !== tempRequest.id));
      setShowModal(false);
      setTempRequest(null);

      Alert.alert('Leave request cancelled.');
    } catch(err) {
      console.error('Failed to cancel leave:', err);
      Alert.alert(
        'Error',
        err.response?.data?.message || 'Failed to cancel leave request.'
      );
    }
  };

  const leaveTypes = [
    { label: 'Annual', value: 'Annual', remaining: leaveBalances.Annual.remaining, max: leaveBalances.Annual.max },
    { label: 'Sick', value: 'Sick', remaining: leaveBalances.Sick.remaining, max: leaveBalances.Sick.max },
    { label: 'Family', value: 'Family', remaining: leaveBalances.Family.remaining, max: leaveBalances.Family.max }
  ];

  const toggleLeaveType = (leaveType) => {
    setExpandedLeaveTypes(prev => ({
        ...prev,
        [leaveType]: !prev[leaveType]
    }));
  };

  const fetchLeaveHistory = async () => {
  try {
    const employeeId = await AsyncStorage.getItem('employee_id');
    if (!employeeId) return;
    
    //const numericId = employeeId.replace('EMP-', '');
    const token = await AsyncStorage.getItem('token');
    
    const response = await axios.get(
      `${API_URL}/api/leaves/history/${employeeId}`,
      {
        headers: {
          'Content-Type': 'application/json'
          //'Authorization': `Bearer ${token}`
        }
      }
    );

    //Debug the response
    console.log('Leave History Response:', response.data);
    
    if (response.data && Array.isArray(response.data)) {
      setLeaveHistory(response.data);
    } else {
      console.warn('Unexpected leave history data format:', response.data);
      setLeaveHistory([]);
    }
  } catch (error) {
    console.error('Error fetching leave history:', error);
    Alert.alert(
      'Error', 
      error.response?.data?.message || 'Failed to load leave history'
    );
    setLeaveHistory([]);
  }
};

  const renderLeaveHistory = () => {
  if (!leaveHistory || leaveHistory.length === 0) {
    return (
      <View style={styles.historyContainer}>
        <Text style={styles.sectionHeader}>Leave History</Text>
        <Text style={styles.noRequests}>No leave history found</Text>
      </View>
    );
  }

  //Group leaves by type
  const leavesByType = leaveHistory.reduce((acc, leave) => {
    const type = leave.leave_type || leave.name_; //Handle different API response formats
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(leave);
    return acc;
  }, {});

    return (
      <View style={styles.historyContainer}>
        <Text style={styles.sectionHeader}>Leave History</Text>
        {Object.entries(leavesByType).map(([type, leaves]) => (
          <View key={type} style={styles.leaveTypeContainer}>
            <TouchableOpacity 
              style={styles.leaveTypeHeader}
              onPress={() => toggleLeaveType(type)}
            >
              <Text style={styles.leaveTypeTitle}>
                {type} ({leaves.length})
              </Text>
              <Icon 
                name={expandedLeaveTypes[type] ? 'chevron-up' : 'chevron-down'} 
                size={20} 
                color="#ffffff" 
              />
            </TouchableOpacity>
            
            {expandedLeaveTypes[type] && (
              <View style={styles.leaveList}>
                {leaves.map(leave => (
                  <View key={leave.leave_id} style={[
                    styles.historyCard,
                    leave.status_ === 'approved' && styles.approvedCard,
                    leave.status_ === 'rejected' && styles.rejectedCard, 
                    leave.status_ === 'pending' && styles.pendingCard
                  ]}>
                    <View style={styles.historyCardHeader}>
                      <Text style={styles.historyCardTitle}>
                        {moment(leave.start_date).format('MMM D')} - {moment(leave.end_date).format('MMM D, YYYY')}
                      </Text>
                      <Text style={[
                        styles.historyCardStatus,
                        leave.status_ === 'approved' && { color: '#4CAF50' },
                        leave.status_ === 'rejected' && { color: '#F44336' }, 
                        leave.status_ === 'pending' && { color: '#FFC107' }
                      ]}>
                        {leave.status_.charAt(0).toUpperCase() + leave.status_.slice(1)}
                      </Text>
                    </View>
                    <Text style={styles.historyCardText}>
                      {leave.days_taken} day(s)
                    </Text>
                    <Text style={styles.historyCardText}>
                      Requested on: {moment(leave.created_at).format('MMM D, YYYY h:mm a')}
                    </Text>
                    
                    {leave.leave_type === 'Sick Leave' && (
                      <View style={styles.sickNoteContainer}>
                        {!leave.sick_note && leave.status_ === 'approved' ? (
                          <TouchableOpacity 
                            style={styles.uploadButton}
                            onPress={() => handleUploadSickNote(leave.leave_id)}
                            disabled={uploadingNote}
                          >
                            {uploadingNote ? (
                              <ActivityIndicator color="#007bff" />
                            ) : (
                              <>
                                <Icon name="cloud-upload" size={16} color="#007bff" />
                                <Text style={styles.uploadButtonText}>Upload Sick Note</Text>
                              </>
                            )}
                          </TouchableOpacity>
                        ) : leave.sick_note ? (
                          <View style={styles.uploadedNote}>
                            <Icon name="checkmark-circle" size={16} color="#4CAF50" />
                            <Text style={styles.uploadedNoteText}>Sick note uploaded</Text>
                          </View>
                        ) : null}
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#1a1a1a' }}>
      <View style={styles.appBar}>
        <Text style={styles.appBarTitle}>Request Leave</Text>
      </View>

      <ScrollView 
        style={styles.container} 
        contentContainerStyle={{ paddingBottom: 120 }} 
         refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#007bff']}
            tintColor="#007bff"
          />
        }
        showsVerticalScrollIndicator={false}>
        <View style={styles.formContainer}>
          <Text style={styles.label}>Start Date:</Text>
          <TouchableOpacity onPress={() => setShowStartPicker(true)} style={styles.input}>
            <Text style={styles.inputText}>{startDate || 'Select start date'}</Text>
          </TouchableOpacity>

          <Text style={styles.label}>End Date:</Text>
          <TouchableOpacity onPress={() => setShowEndPicker(true)} style={styles.input}>
            <Text style={styles.inputText}>{endDate || 'Select end date'}</Text>
          </TouchableOpacity>
          
          <DateTimePickerModal
            isVisible={showStartPicker}
            mode="date"
            onConfirm={handleConfirmStart}
            onCancel={() => setShowStartPicker(false)}
            minimumDate={getNextValidWorkDay(new Date())}
          />
          
          <DateTimePickerModal
            isVisible={showEndPicker}
            mode="date"
            onConfirm={handleConfirmEnd}
            onCancel={() => setShowEndPicker(false)}
            minimumDate={startDate ? new Date(startDate) : getNextValidWorkDay(new Date())}
          />

          <Text style={styles.label}>Leave Type:</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={leaveType}
              onValueChange={(itemValue) => setLeaveType(itemValue)}
              style={styles.picker}
              dropdownIconColor="#ffffff" 
              mode="dropdown">
              {LeaveTypes.map(type => (
                <Picker.Item 
                  key={type.value} 
                  label={`${type.label} (${type.remaining !== null ? type.remaining : '...'}/${type.max} days)`} 
                  value={type.value}
                />
              ))}
            </Picker>
          </View>
          
          {leaveType === 'Sick' && (
            <TouchableOpacity onPress={handlePickSickNote} style={[styles.input, { borderColor: '#007bff', borderWidth: 1 }]}>
              <Text style={styles.inputText}>
                {sickNote ? `Selected: ${sickNote.name}` : 'Upload PDF Sick Note (if required)'}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity 
            style={[styles.submitButton, isLoading && styles.disabledButton]} 
            onPress={handleSubmit}
            disabled={isLoading}>
            {isLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.submitText}>Submit Request</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionHeader}>Leave Requests</Text>
        <View style={styles.requestsContainer}>
          {pendingRequests.length === 0 ? (
            <Text style={styles.noRequests}>No pending leave requests</Text>
          ) : (
            pendingRequests.map(request => (
              <View key={request.id} style={styles.requestCard}>
                <Text style={styles.requestTitle}>Request #{request.id.slice(-4)}</Text>
                <Text style={styles.requestText}>Start Date: {request.startDate}</Text>
                <Text style={styles.requestText}>End Date: {request.endDate}</Text>
                <Text style={styles.requestText}>Type: {request.leaveType}</Text>
                <Text style={[styles.requestText, { color: 
                  request.leaveStatus === 'approved' ? '#4CAF50' :
                  request.leaveStatus === 'pending' ? '#FFC107' :
                  request.leaveStatus === 'rejected' ? '#F44336' : '#ffffff',
                },]}>
                  Status:{' '} {request.leaveStatus ? request.leaveStatus.charAt(0).toUpperCase() + request.leaveStatus.slice(1) : 'unknown'}
                </Text>

                {request.leaveStatus === 'pending' && (
                  <TouchableOpacity 
                    style={styles.cancelButton}
                    onPress={() => handleCancelRequest(request.id)} >
                    <Text style={styles.cancelText}>Cancel Request</Text>
                    <Icon name="trash-outline" size={16} color="#ff4444" />
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}
        </View>
        <Modal visible={showModal} transparent animationType="fade">
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalText}>Are you sure you want to cancel this leave request?</Text>
              <Text style={styles.modalDetails}>Start Date: {tempRequest?.startDate}</Text>
              <Text style={styles.modalDetails}>End Date: {tempRequest?.endDate}</Text>

              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.cancelModalButton]}
                  onPress={() => setShowModal(false)}>
                  <Text style={styles.modalButtonText}>No, Keep It</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.confirmModalButton]}
                  onPress={confirmCancel}>
                  <Text style={styles.modalButtonText}>Yes, Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
        {renderLeaveHistory()}
      </ScrollView>
      <BottomNav />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 20,
    textAlign: 'center',
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
    marginLeft: 100,
  },
  formContainer: {
    backgroundColor: '#2c2c2c',
    borderRadius: 10,
    padding: 30,
    marginBottom: 30,
    width: '100%',
    left: 0,
    right: 0,
  },
  label: {
    color: '#ffffff',
    marginBottom: 5,
  },
  input: {
    backgroundColor: '#3e3e3e',
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
  },
  inputText: {
    color: '#ffffff',
  },
  pickerContainer: {
    backgroundColor: '#3e3e3e',
    borderRadius: 5,
    marginBottom: 20,
    overflow: 'hidden',
    width: '100%',
  },
  picker: {
    color: '#ffffff',
    height: 50,
    width: '100%',
  },
  leaveBalanceContainer: {
    backgroundColor: '#3e3e3e',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
  },
  leaveBalanceText: {
    color: '#ffffff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 5,
  },
  leaveBalanceSubText: {
    color: '#aaaaaa',
    fontSize: 14,
    textAlign: 'center',
  },
  submitButton: {
    backgroundColor: '#007bff',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
  },
  submitText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginVertical: 20,
    textAlign: 'center',
  },
  requestsContainer: {
    flex: 1,
  },
  noRequests: {
    color: '#aaaaaa',
    textAlign: 'center',
    marginTop: 20,
  },
  requestCard: {
    backgroundColor: '#2c2c2c',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
  },
  requestTitle: {
    color: '#ffffff',
    fontWeight: 'bold',
    marginBottom: 5,
  },
  requestText: {
    color: '#ffffff',
    marginBottom: 3,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    alignSelf: 'flex-end',
  },
  cancelText: {
    color: '#ff4444',
    marginRight: 5,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  modalContent: {
    backgroundColor: '#2c2c2c',
    borderRadius: 10,
    padding: 20,
    width: '80%',
  },
  modalText: {
    color: '#ffffff',
    fontSize: 16,
    marginBottom: 15,
    textAlign: 'center',
  },
  modalDetails: {
    color: '#aaaaaa',
    marginBottom: 5,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalButton: {
    padding: 10,
    borderRadius: 5,
    width: '48%',
    alignItems: 'center',
  },
  cancelModalButton: {
    backgroundColor: '#3e3e3e',
  },
  confirmModalButton: {
    backgroundColor: '#ff4444',
  },
  modalButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: '#555555',
    opacity: 0.7,
  },
  historyContainer: {
    marginTop: 20,
    paddingHorizontal: 15,
  },
  leaveTypeContainer: {
    marginBottom: 15,
    backgroundColor: '#2c2c2c',
    borderRadius: 10,
    overflow: 'hidden',
  },
  leaveTypeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
  },
  leaveTypeTitle: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  leaveList: {
    borderTopWidth: 1,
    borderTopColor: '#3e3e3e',
  },
  historyCard: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#3e3e3e',
  },
  approvedCard: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
  },
  rejectedCard: {
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
  },
  pendingCard: {
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
  },
  historyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  historyCardTitle: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  historyCardStatus: {
    fontWeight: 'bold',
  },
  historyCardText: {
    color: '#aaaaaa',
    marginBottom: 3,
  },
  uploadButton: {
    marginTop: 10,
    padding: 8,
    backgroundColor: 'rgba(0, 123, 255, 0.2)',
    borderRadius: 5,
    alignItems: 'center',
  },
  uploadButtonText: {
    color: '#007bff',
    fontWeight: 'bold',
  },
  sickNoteContainer: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  uploadedNote: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  uploadedNoteText: {
    color: '#4CAF50',
    marginLeft: 5,
    fontSize: 14,
  },
});

export default LeaveRequest;