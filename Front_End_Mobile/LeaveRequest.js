/**
 * @author MOYO CT, 221039267
 * @version mobile_app
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView,SafeAreaView, Modal, TextInput } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, ActivityIndicator } from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import moment from 'moment';

const API_URL = 'http://192.168.1.187:3000/api';

const LeaveRequest = () => {

  const navigation = useNavigation();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [leaveType, setLeaveType] = useState('Annual');
  const [leaveStatus, setLeaveStatus] = useState('');
  const [pendingRequests, setPendingRequests] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [tempRequest, setTempRequest] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const leaveTypes = ['Annual', 'Sick', 'Family'];
  //const leaveStatuses = ['Pending', 'Cancelled', 'Approved', 'Rejected'];
  
 //Confirm leave start sate
  const handleConfirmStart = (date) => {
  setStartDate(moment(date).format('YYYY-MM-DD'));
  setShowStartPicker(false);
};
//Confirm leave end date
const handleConfirmEnd = (date) => {
  setEndDate(moment(date).format('YYYY-MM-DD'));
  setShowEndPicker(false);
};
 //Submit leave request
 const handleSubmit = async () => {
  if (!startDate || !endDate || !leaveType) {
    Alert.alert('Error', 'Please complete all the required fields.');
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
   

    const leaveTypeId = leaveTypeMap[leaveType];
    //Replace the EMP with an empty character if the employee id comes with the EMP.
    const numericId = employeeId.replace('EMP-', '');
    
    //Send request to the API to handle.
    const response = await axios.post(`${API_URL}/leave/request`, {
      employee_id: parseInt(numericId, 10),
      leave_type_id: leaveTypeId,
      start_date: startDate,
      end_date: endDate      
    });
    setLeaveStatus(response.data.status);
    //Add the new request to pendingRequests with the response data
    const newRequest = {
      id: response.data.leave_id.toString(),
      startDate,
      endDate,
      leaveType,
      leaveStatus: response.data.status
    };

    setPendingRequests([...pendingRequests, newRequest]);
    setStartDate('');
    setEndDate('');
    setLeaveType('');
    setLeaveStatus('');

    //Pop up if leave request was was submitted succesfully
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
  const handleCancelRequest = (id) => {
    setTempRequest(pendingRequests.find(req => req.id === id));
    setShowModal(true);
  };

  const confirmCancel = async () => {
    if(!tempRequest) return;

    try{
      
      //Cancel leave request.
      await axios.delete(`${API_URL}/leave/cancel/${tempRequest.id}`);
    
      setPendingRequests(pendingRequests.filter(req => req.id !== tempRequest.id));
      setShowModal(false);
      setTempRequest(null);

      Alert.alert('Leave request cancelled.');
    }catch( err){
     console.error('Failed to cancel leave.:', err);
     Alert.alert(
        'Error',
        err.response?.data?.message || 'Failed to cancel leave request.'
       );
    }
  };

  return (
  <SafeAreaView style={{ flex: 1, backgroundColor: '#1a1a1a' }}>
    <View style={styles.appBar}>
      <Text style={styles.appBarTitle}>Request Leave</Text>
    </View>

    <ScrollView 
      style={styles.container} 
      contentContainerStyle={{ paddingBottom: 120 }} 
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
          minimumDate={new Date()}/>
        <DateTimePickerModal
          isVisible={showEndPicker}
          mode="date"
          onConfirm={handleConfirmEnd}
          onCancel={() => setShowEndPicker(false)}
          minimumDate={startDate ? new Date(startDate) : new Date()}/>

        <Text style={styles.label}>Leave Type:</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={leaveType}
            onValueChange={(itemValue) => setLeaveType(itemValue)}
            style={styles.picker}
            dropdownIconColor="#ffffff" >
            {leaveTypes.map(type => (
              <Picker.Item key={type} label={type} value={type} />
            ))}
          </Picker>
        </View>

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
              <Text style={styles.requestText}>Status: {request.leaveStatus}</Text>
              {request.leaveStatus === 'Pending' && (
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
    </ScrollView>

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
    padding: 20,
    marginBottom: 20,
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
  },
  picker: {
    color: '#ffffff',
    height: 50,
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
    marginBottom: 10,
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
  },
});

export default LeaveRequest;