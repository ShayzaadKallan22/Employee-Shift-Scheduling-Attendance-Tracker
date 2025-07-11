/**
 * @author MOYO CT, 221039267
 * @version mobile_app
 */
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, SafeAreaView } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { Picker } from '@react-native-picker/picker';
import { useNavigation } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'http://192.168.1.187:3000/api';

const ShiftSwap = () => {

  const navigation = useNavigation();  
  const [activeTab, setActiveTab] = useState('My Requests');
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [assignedDate, setAssignedDate] = useState(new Date());
  const [swapDate, setSwapDate] = useState(new Date());
  const [showAssignedPicker, setShowAssignedPicker] = useState(false);
  const [showSwapPicker, setShowSwapPicker] = useState(false);
  const [colleagues, setColleagues] = useState([]);
  const [selectedColleague, setSelectedColleague] = useState('');
  const [colleagueRequests, setColleagueRequests] = useState([]);
  const [requestingEmployeeId, setRequestingEmployeeId] = useState('');
  const [myRequests, setMyRequests] = useState([]);
  const [requestHistory, setRequestHistory] = useState([]);
  const [assignedDateFormatted, setAssignedDateFormatted] = useState('');
  const [swapDateFormatted, setSwapDateFormatted] = useState('');

  const sortByDate = (requests) =>
  [...requests].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
 
  useEffect(()=>{
    //fetch the employeeId from AyncStorage
    const loadEmpID = async () => {
      const id = await AsyncStorage.getItem('employee_id');
      setRequestingEmployeeId(id);
    };
    loadEmpID();
  },[]);
  //Check the requesting employee's id.
  useEffect(() => {
    if(!requestingEmployeeId) return;
  //Fetch the colleague names based on the requesting employee's role.
  const fetchColleagues = async () => {
    try {
      const response = await fetch(`${API_URL}/shift-swap/colleagues/${requestingEmployeeId}`);
      //Check if the api response is ok.
      if (!response.ok) {
         const errText = await response.text();
         console.error('Backend error:', errText);
         throw new Error(`Status ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Colleagues fetched:', data);

      if (!Array.isArray(data)) throw new Error('Invalid response format'); 
          setColleagues(data.map(e => ({ label: e.name, value: e.employee_id })));
       
    } catch (error) {
      console.error('Failed to fetch colleagues', error);
    }
  };

  fetchColleagues();
  }, [requestingEmployeeId]);
  
  const getShiftId = async (employeeId, date) => {
  try {
    const response = await fetch(
      `${API_URL}/shift-swap/shiftID?employee_id=${employeeId}&date=${date}`
    );
    if (!response.ok) throw new Error('No shift found');
    const data = await response.json();
    return data.shift_id;
   } catch (error) {
    console.error('Shift fetch error:', error);
    return null;
   }
  };

  const handleSubmitRequest = async () => {
    //Handle request submission.
    try{
       //Get employee ID from AsyncStorage, stored when employee
      //const requestingEmployeeId = await AsyncStorage.getItem('employee_id');
      //if (!requestingEmployeeId) {
         //throw new Error('Employee ID not found');
     // }

      const formatDate = (date) => {
         return date.toISOString().split('T')[0];
      };
      useEffect(() => {
        setAssignedDateFormatted(formatDate(assignedDate));
      }, [assignedDate]);

      useEffect(() => {
        setSwapDateFormatted(formatDate(swapDate));
      }, [swapDate]);

      const originalShiftId = await getShiftId(requestingEmployeeId, assignedDateFormatted);
      const requestedShiftId = await getShiftId(selectedColleague, swapDateFormatted);

      if (!originalShiftId || !requestedShiftId) {
        Alert.alert('Could not find matching shifts for selected dates');
        return;
      }
      const payload={
        original_shift_id:originalShiftId,
        requested_shift_id:requestedShiftId,
        requesting_employee_id: requestingEmployeeId,
        approving_employee_id: selectedColleague,
        assigned_Date: formatDate(assignedDate),
        swap_Date: formatDate(swapDate)
      };
      const res = await fetch(`${API_URL}/shift-swap/create`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
      });

      const result = await res.json();
      Alert.alert('Shift-Swap submitted succesfully.', result.message);
      setShowRequestForm(false);
    } catch (error) {
    Alert.alert('Failed to submit swap request');
    console.error(error);
    }
  };
  
  //Fetch all colleague requests.
  useEffect(() => {
  const fetchColleagueRequests = async () => {
    if (!requestingEmployeeId || activeTab !== 'Colleague Requests') return;

    try {
      const res = await fetch(`${API_URL}/shift-swap/colleague-requests/${requestingEmployeeId}`);
      if (!res.ok) throw new Error('Failed to fetch colleague requests');
      const data = await res.json();
      setColleagueRequests(data);
    } catch (error) {
      console.error('Failed to fetch colleague requests:', error);
    }
  };

  fetchColleagueRequests();
}, [activeTab, requestingEmployeeId]);

//Fetch all employee shift swap requests
useEffect(() => {
  const fetchMyRequests = async () => {
    if (!requestingEmployeeId || activeTab !== 'My Requests') return;

    try {
      const res = await fetch(`${API_URL}/shift-swap/my-requests/${requestingEmployeeId}`);
      if (!res.ok) throw new Error('Failed to fetch my requests');
      const data = await res.json();
      setMyRequests(data);
    } catch (error) {
      console.error('Failed to fetch my requests:', error);
    }
  };

  fetchMyRequests();
}, [activeTab, requestingEmployeeId]);
  
  //Respond to colleague requests
  const respondToRequest = async (swap_id, action) => {
  try {
    const res = await fetch(`${API_URL}/shift-swap/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ swap_id, action })
    });
    const data = await res.json();
    Alert.alert(data.message);
    //Update local state.
    setColleagueRequests(prev =>
      prev.map(req =>
        req.id === swap_id
          ? { ...req, status: action === 'approved' ? 'Confirmed' : 'Declined' }
          : req
      )
    );

    } catch (error) {
    Alert.alert('Failed to update request');
    console.error(error);
    }
  };

  const renderRequestCard = (request) => (
    <View key={request.id} style={styles.requestCard}>
      <View style={styles.requestHeader}>
        <Text style={styles.requestTitle}>Request #{request.id}</Text>
        <View style={[
          styles.statusBadge,
          request.status === 'Confirmed' && styles.confirmedBadge,
          request.status === 'Declined' && styles.declinedBadge,
          request.status === 'approved' && styles.confirmedBadge
        ]}>
          <Text style={styles.statusText}>{request.status}</Text>
        </View>
      </View>
      <Text style={styles.requestText}>Colleague: {request.colleague || 'Unknown'}</Text>
      <Text style={styles.requestText}>Swap Date: {request.swapDate?.split('T')[0] ||  'N/A'}</Text>
      <Text style={styles.requestText}>Asigned  Date: {request.assignedDate?.split('T')[0] ||  'N/A'}</Text>
      
      {activeTab === 'Colleague Requests' && request.status === 'pending' && (
        <View style={styles.actionButtons}>
          <TouchableOpacity 
          style={[styles.actionButton, styles.declineButton]}
          onPress={() => respondToRequest(request.id, 'rejected')}>
            <Text style={styles.buttonText}>Decline</Text>
          </TouchableOpacity>
          <TouchableOpacity 
          style={[styles.actionButton, styles.confirmButton]}
          onPress={() => respondToRequest(request.id, 'approved')}>
            <Text style={styles.buttonText}>Confirm</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
    <View style={styles.container}>
      <Text style={styles.header}>Shift Swap</Text>
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'My Requests' && styles.activeTab]}
          onPress={() => setActiveTab('My Requests')}>
          <Text style={[styles.tabText, activeTab === 'My Requests' && styles.activeTabText]}>My Requests</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'Colleague Requests' && styles.activeTab]}
          onPress={() => setActiveTab('Colleague Requests')}>
          <Text style={[styles.tabText, activeTab === 'Colleague Requests' && styles.activeTabText]}>Colleague Requests</Text>
        </TouchableOpacity>
      </View>
      {!showRequestForm ? (
        <>
          <TouchableOpacity 
            style={styles.newRequestButton}
            onPress={() => setShowRequestForm(true)}>
            <Icon name="swap-horizontal" size={20} color="#ffffff" />
            <Text style={styles.newRequestText}>Request Swap</Text>
          </TouchableOpacity>
          <ScrollView style={styles.requestsContainer}>
            {activeTab === 'My Requests' && (
              <>
                <Text style={styles.sectionTitle}>Pending Requests</Text>
                {sortByDate(myRequests.filter(r => r.status === 'pending')).map(renderRequestCard)}
                
                <Text style={styles.sectionTitle}>Request History</Text>
                {sortByDate(myRequests.filter(r => r.status !== 'pending')).map(renderRequestCard)}
              </>
            )}
            {activeTab === 'Colleague Requests' && (
              <>
                <Text style={styles.sectionTitle}>Pending Requests</Text>
                {sortByDate(colleagueRequests.filter(r => r.status === 'pending')).map(renderRequestCard)}
                
                <Text style={styles.sectionTitle}>Request History</Text>
                {sortByDate(colleagueRequests.filter(r => r.status !== 'pending')).map(renderRequestCard)}
              </>
            )}
          </ScrollView>
        </>
      ) : (
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
            onPress={() => setShowAssignedPicker(true)}
            style={styles.dateInput}>
            <Text style={styles.dateText}>{assignedDate.toISOString().split('T')[0]}</Text>
            </TouchableOpacity>
            {showAssignedPicker && (
              <DateTimePicker
                value={assignedDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                onChange={(event, selectedDate) => {
                  setShowAssignedPicker(false);
                  if (selectedDate) setAssignedDate(selectedDate);
                }}
              />
            )}


          <Text style={styles.label}>Swap Date:</Text>
          <TouchableOpacity
            onPress={() => setShowSwapPicker(true)}
            style={styles.dateInput}>
            <Text style={styles.dateText}>{swapDate.toISOString().split('T')[0]}</Text>
          </TouchableOpacity>
          {showSwapPicker && (
              <DateTimePicker
              value={swapDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              onChange={(event, selectedDate) => {
                setShowSwapPicker(false);
                if (selectedDate) setSwapDate(selectedDate);
              }}
            />
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
       
      )}

      <View style={styles.bottomNav}>
        <TouchableOpacity 
          onPress={() => navigation.navigate('BurgerMenu')}
          style={styles.navButton}>
          <Icon name="menu-outline" size={28} color='#ffffff'/>
        </TouchableOpacity>
        
        <TouchableOpacity 
          onPress={() => navigation.navigate('ShiftSchedule')}
          style={styles.navButton}>
          <Icon name="calendar-outline" size={28} color='#ffffff'/>
        </TouchableOpacity>
        
        <TouchableOpacity 
          onPress={() => navigation.navigate('ClockIn')}
          style={styles.navButton}>
          <Icon name="home" size={28} color='#ffffff'/>
        </TouchableOpacity>
        
        <TouchableOpacity 
          onPress={() => navigation.navigate('Notifications')}
          style={styles.navButton}>
          <Icon name="notifications-outline" size={28} color='#ffffff'/>
        </TouchableOpacity>
        
        <TouchableOpacity 
          onPress={() => navigation.navigate('Profile')}
          style={styles.navButton}>
          <Icon name="person-outline" size={28} color='#ffffff'/>
        </TouchableOpacity>
      </View>
    </View>
    </SafeAreaView> 

  );
};

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
    marginBottom: 50,
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
  input: {
    backgroundColor: '#3e3e3e',
    color: '#ffffff',
    borderRadius: 5,
    padding: 12,
    marginBottom: 15,
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
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 15,
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
  }
});

export default ShiftSwap;