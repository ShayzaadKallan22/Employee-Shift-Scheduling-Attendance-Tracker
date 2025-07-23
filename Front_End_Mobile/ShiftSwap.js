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
//import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import config from './config';

const API_URL = config.API_URL;

const ShiftSwap = () => {

  const navigation = useNavigation();  
  const [activeTab, setActiveTab] = useState('My Requests');
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
  //For debugging...
  const [empShiftDateStrings, setEmpShiftDateStrings] = useState([]);
  const [colleagueShiftDateStrings, setColleagueShiftDateStrings] = useState([]);
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

  //Fetch the requesting employee's shift dates.
  useEffect(() => {
    const fetchEmpShiftDates = async () => {
        if(!requestingEmployeeId) return;
        setIsLoading(true);
        try{
          const response = await fetch(`${API_URL}/api/shift-swap/employee-shift-dates/${requestingEmployeeId}`);
          if(!response.ok) throw new Error('Failed to fetch employee', requestingEmployeeId, 'shift dates');
          const data = await response.json();
          console.log('Emp dates:', data);
          const dates = data
          .map(dateStr => {
             if (!dateStr || typeof dateStr !== 'string') return null;
             const date = new Date(dateStr + 'T00:00:00Z');
           return isNaN(date.getTime()) ? null : date;
          })
          .filter(Boolean);
          setShiftDates(dates);

          setEmpShiftDateStrings(data); //debugging returned data.

          //Set min and max dates for the date picker.
         if (dates.length > 0) {
             setMinDate(new Date(Math.min(...dates.map(date => date.getTime()))));
             setMaxDate(new Date(Math.max(...dates.map(date => date.getTime()))));
             setAssignedDate(dates[0]); //default to first shift date
          }
        } catch (error) {
             console.error('Error fetching employee shift dates:', error);
        }finally {
          setIsLoading(false);
        }
   };
  
  fetchEmpShiftDates();
  }, [requestingEmployeeId]);
  
  //Check the requesting employee's id.
  useEffect(() => {
    if(!requestingEmployeeId) return;
  //Fetch the colleague names based on the requesting employee's role.
  const fetchColleagues = async () => {
    try {
      const response = await fetch(`${API_URL}/api/shift-swap/colleagues/${requestingEmployeeId}`);
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

  //Fetch the employees shift IDs
  const getShiftId = async (employeeId, date) => {
  try {
    const response = await fetch(
      `${API_URL}/api/shift-swap/shiftID?employee_id=${employeeId}&date=${date}`
    );
    if (!response.ok) throw new Error('No shift found');
    const data = await response.json();
    return data.shift_id;
   } catch (error) {
    console.error('Shift fetch error:', error);
    return null;
   }
  };
  
  //Fetch colleague shift dates.
  useEffect(() => {
  const fetchColleagueShiftDates = async () => {
    if (!selectedColleague) return;
    
    try {
      const response = await fetch(`${API_URL}/api/shift-swap/colleague-shift-dates/${selectedColleague}`);
      if (!response.ok) throw new Error('Failed to fetch colleague shift dates');
      const data = await response.json();
      console.log('Raw colleague shift date strings from backend:', data);

      const parsedDates = data
      .map(dateStr => {
        //Skip empty strings or invalid dates
        if (!dateStr || typeof dateStr !== 'string') return null;

        const date = new Date(dateStr + 'T00:00:00Z');
        return isNaN(date.getTime()) ? null : date;
      })
      .filter(Boolean); //Remove all nulls

    console.log('Parsed colleague shift Dates:', parsedDates);
      setCollShiftDates(parsedDates);
      setColleagueShiftDateStrings(data);

     if (parsedDates.length > 0 && !swapDate) {
      setSwapDate(parsedDates[0]);
    }
    } catch (error) {
      console.error('Error fetching colleague shift dates:', error);
    }
  };
  
  fetchColleagueShiftDates();
  }, [selectedColleague]);
  
  //Mark colleague's assigned shift dates on the calender.
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

//Mark employee assigned shift dates on the Calender.
const markedAssignedDates = empShiftDateStrings.reduce((acc, dateStr) =>  {
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

  const handleSubmitRequest = async () => {
    //Handle request submission.
    try{
       //Get employee ID from AsyncStorage, stored when employee
      //const requestingEmployeeId = await AsyncStorage.getItem('employee_id');
      //if (!requestingEmployeeId) {
         //throw new Error('Employee ID not found');
     // }
      const assignedDateStr = assignedDate.toISOString().split('T')[0];
      const swapDateStr = swapDate.toISOString().split('T')[0];

      console.log('Employee Shift Dates:', empShiftDates);
      console.log('Selected Assigned Date:', assignedDate.toISOString().split('T')[0]);
      console.log('Colleague Shift Dates:', colleagueShiftDates);
      console.log('Selected Swap Date:', swapDate.toISOString().split('T')[0]);

      const isValidAssignedDate = empShiftDates.some(date => 
      date.toISOString().split('T')[0] === assignedDateStr
      );

      const isValidSwapDate = colleagueShiftDates.some(date => 
      date.toISOString().split('T')[0] === swapDateStr
      );

      if(!isValidAssignedDate || !isValidSwapDate){
        Alert.alert('Invalid Dates', 'Please select valid dates.');
        return;
      }
      //Fetch shift ID's for both requesting and approving employees.
      const originalShiftId = await getShiftId(requestingEmployeeId, assignedDateStr);
      const requestedShiftId = await getShiftId(selectedColleague, swapDateStr);

      if (!originalShiftId || !requestedShiftId) {
        Alert.alert('Could not find matching shifts for selected dates');
        return;
      }
      const payload={
        original_shift_id:originalShiftId,
        requested_shift_id:requestedShiftId,
        requesting_employee_id: requestingEmployeeId,
        approving_employee_id: selectedColleague,
        assigned_Date: assignedDateStr,  
        swap_Date: swapDateStr 
      };
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
    console.error(error);
    }
  };
  
  //Fetch all colleague requests.
  useEffect(() => {
  const fetchColleagueRequests = async () => {
    if (!requestingEmployeeId || activeTab !== 'Colleague Requests') return;

    try {
      const res = await fetch(`${API_URL}/api/shift-swap/colleague-requests/${requestingEmployeeId}`);
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
    if (!employee_id || activeTab !== 'My Requests') return;

    try {
      const res = await fetch(`${API_URL}/api/shift-swap/my-requests/${employee_id}`);
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
    const res = await fetch(`${API_URL}/api/shift-swap/respond`, {
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
      <Text style={styles.requestText}>Swap Date: {request.swapDate ? new Date(request.swapDate).toLocaleDateString('en-CA') : 'N/A'}</Text>
      <Text style={styles.requestText}>Assigned  Date: {request.assignedDate ? new Date(request.assignedDate).toLocaleDateString('en-CA') : 'N/A'}</Text>
      
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
                       setShowAssignedCalendar(false); //Close calender 
                  } else {
                       Alert.alert('Invalid Date', 'Please select a date you have a shift scheduled, that is the highlighted dates on the calendar.');
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

{/*assignedDate && (
  <Text style={styles.dateText}>Selected: {assignedDate.toLocaleDateString('en-CA')}</Text>
)*/}


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
                  setShowSwapCalendar(false); //Close calender 
               } else {
                  Alert.alert('Invalid Date', 'Please select a date your colleague has a shift, that is the highlighted dates on the calendar.');
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

{/*swapDate && (
  <Text style={styles.dateText}>Selected: {swapDate.toLocaleDateString('en-CA')}</Text>
)*/}

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