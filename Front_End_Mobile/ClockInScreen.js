/**
 * @author MOYO CT, 221039267
 * @version mobile_app
 */
import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, 
  Animated, Easing, Alert, ActivityIndicator, Modal, TextInput 
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as Location from 'expo-location';
import BottomNav from './BottomNav';
import config from './config';

const API_URL = config.API_URL;

//Main ClockInScreen component
const ClockInScreen = () => {
  const navigation = useNavigation();
  const [shifts, setShifts] = useState([]);
  const [attendanceStatus, setAttendanceStatus] = useState(null);
  const [lastClockIn, setLastClockIn] = useState(null);
  const [loading, setLoading] = useState(true);
  const [clockingIn, setClockingIn] = useState(false);
  const [nextShift, setNextShift] = useState(null);
  const [countdown, setCountdown] = useState('');
  const [locationStatus, setLocationStatus] = useState('Checking location...');
  const countdownIntervalRef = useRef(null);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancelReason, setCancelReason] = useState('sick');
  const [cancelNotes, setCancelNotes] = useState('');
  const [strikeCount, setStrikeCount] = useState(0);
  const [endTime, setEndTime] = useState(null);
  //Animation values
  const pulseAnim = new Animated.Value(1);
  const buttonScale = new Animated.Value(1);

  //Use end_date field if date_ is incorrect
  const findNextShift = (shifts, attendanceStatus) => {
    // console.log('=== DEBUGGING NEXT SHIFT ===');
    // console.log('Attendance Status:', attendanceStatus);
    // console.log('Number of shifts:', shifts.length);
    // console.log('All shifts:', shifts);
    
    if (attendanceStatus === 'Working') {
      //console.log('Employee is working, no countdown shown');
      return null; //Don't show countdown when already working
    }
    
    const now = new Date();
    // console.log('Current time:', now.toISOString());
    // console.log('Current local time:', now.toString());
    
    const upcomingShifts = shifts.filter(shift => {
     
      const dateField = shift.end_date || shift.date_;
      const dateOnly = dateField.split('T')[0]; // Get YYYY-MM-DD part
      const timeOnly = shift.start_time; // Get HH:MM:SS part
      
      //Create datetime string in local timezone
      const shiftDateTime = new Date(dateOnly + 'T' + timeOnly);
      
      // console.log(`Shift ${shift.shift_id}:`);
      // console.log('  Raw date_:', shift.date_);
      // console.log('  Raw end_date:', shift.end_date);
      // console.log('  Using date field:', dateField);
      // console.log('  Raw start_time:', shift.start_time);
      // console.log('  Date only:', dateOnly);
      // console.log('  Time only:', timeOnly);
      // console.log('  Combined string:', dateOnly + 'T' + timeOnly);
      // console.log('  Parsed datetime:', shiftDateTime.toISOString());
      // console.log('  Parsed local time:', shiftDateTime.toString());
      // console.log('  Is future?', shiftDateTime > now);
      // console.log('  Time diff (ms):', shiftDateTime - now);
      
      return shiftDateTime > now;
    });
    
    // console.log('Upcoming shifts found:', upcomingShifts.length);
    // console.log('Next shift:', upcomingShifts[0]);
    // console.log('=== END DEBUG ===');
    
    return upcomingShifts.length > 0 ? upcomingShifts[0] : null;
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const employeeId = await AsyncStorage.getItem('employee_id');
        if (!employeeId) return;
        
        //Fetch attendance status first
        const statusRes = await axios.get(`${API_URL}/api/shifts/status/${employeeId}`);
        const status = statusRes.data.status;
        setAttendanceStatus(status);
        setLastClockIn(statusRes.data.last_clock_in); // FIXED: Use correct property name
        // console.log('Attendance status:', statusRes.data);
        
        //Fetch upcoming shifts
        const shiftsRes = await axios.get(`${API_URL}/api/shifts/upcoming/${employeeId}`);
        // console.log('Shifts:', shiftsRes.data);
        setShifts(shiftsRes.data);
        
        //Find next shift after both status and shifts are fetched
        const nextShiftToSet = findNextShift(shiftsRes.data, status);
        setNextShift(nextShiftToSet);
        // console.log('Next shift set:', nextShiftToSet);

        const count = await axios.get(`${API_URL}/api/shifts/countStrikes/${employeeId}`);

        setStrikeCount(count.data.strike_count);
        //console.log('Strike count:', strikeCount);
        
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    
    //Start pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    //Check location permissions
    checkLocationPermission();
    
    //Clean up interval on unmount
     return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, []);

  //Countdown effect with corrected date parsing
  useEffect(() => {
    //Clear any existing interval first
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }

    if (!nextShift) {
      setCountdown('No upcoming shifts');
      return;
    }

    const updateCountdown = () => {
      const now = new Date();
      
      //Use same parsing logic as findNextShift
      const dateField = nextShift.end_date || nextShift.date_;
      const dateOnly = dateField.split('T')[0]; // Get YYYY-MM-DD part
      const timeOnly = nextShift.start_time; // Get HH:MM:SS part
      const shiftTime = new Date(dateOnly + 'T' + timeOnly);
      const end_Time = nextShift.end_time;
      const diff = shiftTime - now;
      
      // console.log('Countdown update:');
      // console.log('  Current time:', now.toString());
      // console.log('  Shift time:', shiftTime.toString());
      // console.log('  Difference (ms):', diff);
      
      if (diff <= 0) {
        setCountdown('Shift started');
        setEndTime(end_Time);
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
        }
        return;
      }
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      const countdownText = `${hours}h ${minutes}m ${seconds}s`;
      setCountdown(countdownText);
      // console.log('  Countdown:', countdownText);
    };
    
    //Update immediately
    updateCountdown();
    countdownIntervalRef.current = setInterval(updateCountdown, 1000);
    
    // console.log('Countdown started for shift:', nextShift);
    
    //Cleanup function
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [nextShift]); //This effect runs when nextShift changes

  //Update next shift when attendance status changes
  useEffect(() => {
    if (shifts.length > 0 && attendanceStatus !== null) {
      const nextShiftToSet = findNextShift(shifts, attendanceStatus);
      setNextShift(nextShiftToSet);
      // console.log('Next shift updated due to status change:', nextShiftToSet);
    }
  }, [attendanceStatus, shifts]);

  //Check location permissions
  const checkLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationStatus('Location permission denied');
        return;
      }
      setLocationStatus('Location ready');
    } catch (error) {
      //console.error('Error checking location permission:', error);
      setLocationStatus('Location error');
    }
  };

  //Get current location with verification
  const getCurrentLocation = async () => {
    try {
      setLocationStatus('Getting location...');
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeout: 5000,
      });
      
      setLocationStatus('Location verified');
      return location;
    } catch (error) {
      //console.error('Error getting location:', error);
      Alert.alert('Location Error', 'Could not get your location. Please ensure location services are enabled.');
      setLocationStatus('Location error');
      throw new Error('Could not get location');
    }
  };

  //Verify if location is within allowed range.
  const verifyLocation = (location) => {
  
    return true;
    
    // const workplaceCoords = { latitude: -26.2041, longitude: 28.0473 }; //UJ APK
    // const distance = calculateDistance(
    //   location.coords.latitude,
    //   location.coords.longitude,
    //   workplaceCoords.latitude,
    //   workplaceCoords.longitude
    // );
    // return distance <= 100; // Within 100 meters
  };

  //Calculate distance between two coordinates (Haversine formula)
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c * 1000; //Distance in meters
    return distance;
  };

  const deg2rad = (deg) => {
    return deg * (Math.PI/180);
  };

  //Navigate to Scan Screen with location verification
  const handleClockIn = async () => {
    if (attendanceStatus === 'On Leave') {
      Alert.alert('Cannot Clock In', 'You are currently on leave.');
      return;
    }

    setClockingIn(true);
    
    try {
      //Get and verify location
      const location = await getCurrentLocation();
      const isLocationValid = verifyLocation(location);
      
      //If location invalid, alert user and stop from clocking in
      if (!isLocationValid) {
        Alert.alert(
          'Location Error', 
          'You must be at the workplace to clock in/out.'
        );
        setClockingIn(false);
        return;
      }
      
      //Animate button press
      Animated.sequence([
        Animated.timing(buttonScale, {
          toValue: 0.95,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(buttonScale, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start(() => {
        navigation.replace('ScanScreen');
      });
      
    } catch (error) {
      Alert.alert('Error', 'Could not verify your location. Please try again.');
      setClockingIn(false);
    }
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
      Alert.alert('Error during logout:', error);
    }
  };

  const canCancelShift = async ()=> {

    if(!nextShift || attendanceStatus === 'Working') return false;

    const now = new Date();
    const dateField = nextShift.end_date || nextShift.date_;
    const dateOnly = dateField.split('T')[0];
    const timeOnly = nextShift.start_time;
    const shiftTime = new Date(dateOnly + 'T' + timeOnly);

    //Check if shift is today and within 3 hours window.
    const isToday = shiftTime.toDateString() === now.toDateString();
    if(!isToday) return false;  
    const timeDiff = shiftTime - now;
    const threeHoursInMs = 3 * 60 * 60 * 1000;

    return isToday && timeDiff > threeHoursInMs && timeDiff > 0;
  }

  //Handle notification to manager
  const handleNotifyManager = async () => {

    if(!canCancelShift()) {
      Alert.alert('Cannot cancel', 'You can only cancel your shift 3 hours before your shift start time.');
      return;
    }
    // const employeeId = await AsyncStorage.getItem('employee_id');
    // if(!employeeId) {
    //   Alert.alert('Error', 'Unable to identify user.');
    //   return;
    // }
    //  const count = await axios.get(`${API_URL}/api/shifts/countStrikes/${employeeId}`);

    //  setStrikeCount(count.data.strike_count);
    //  console.log('Strike count:', count.data.strike_count);

    // if(strikeCount >= 3){
    //   Alert.alert('Cannot cancel', 'You have reached the maximum number of allowed cancellations.');
    //   setCancelModalVisible(false);
    // }
    setCancelModalVisible(true);
  };

  const confirmCancelShift = async () => {
    setCancelModalVisible(false);
    try{

      if(!cancelReason){
        Alert.alert('Please select a reason for cancellation.');
        return;
      }
      if(!cancelNotes){
        Alert.alert('Please provide additional notes for cancellation.');
        return;
      }

      const employeeId = await AsyncStorage.getItem('employee_id');
      const res = await axios.post(`${API_URL}/api/shifts/cancel`, {
        employee_id: employeeId,
        shift_id: nextShift.shift_id,
        date: new Date().toISOString().split('T')[0],
        reason: cancelReason,
        notes: cancelNotes
      });

      Alert.alert('Notification sent', 'Manager has been notified of your absence.');
      
      setCancelModalVisible(false);
      //fetchData(); //Refresh data to reflect any changes

      //Reset reason and notes
      setCancelReason('sick');
      setCancelNotes('');
    }catch (error){
      console.error('Error notifying manager:', error);
      Alert.alert('Error', 'Could not notify manager. Please try again later.');
    }
  };

  //Render the cancel shift button.
  const renderNotifyManagerButton = () => {
     if (!canCancelShift()) {
    return null;
  }

  return (
    <TouchableOpacity 
      style={styles.notifyButton}
      onPress={handleNotifyManager}
    >
      <Icon name="alert-circle-outline" size={20} color="#FF9800" />
      <Text style={styles.notifyButtonText}>Notify Manager (Cancel Today's Shift)</Text>
    </TouchableOpacity>
    );
  };

  const renderStatusCard = () => {
    if (!attendanceStatus) return null;
    
    const statusConfig = {
      'Working': { 
        color: '#4CAF50', 
        icon: 'checkmark-circle-outline', 
        message: 'You are currently clocked in.',
        pulse: true
      },
      'Not Working': { 
        color: '#489cf7ff',
        icon: 'time-outline', 
        message: 'You are currently clocked out.',
        pulse: false
      },
      'Late': { 
        color: '#FF5722', 
        icon: 'alert-circle', 
        message: 'You were late to your last shift.',
        pulse: true
      },
      'On Leave': { 
        color: '#FF9800', 
        icon: 'airplane-outline', 
        message: 'You are currently on leave.',
        pulse: false
      },
      'default': { 
        color: '#9E9E9E', 
        icon: 'help-circle', 
        message: 'Attendance status unknown.',
        pulse: false
      }
    };
    
    const config = statusConfig[attendanceStatus] || statusConfig.default;
    
    return (
      <View style={[styles.statusCard, { backgroundColor: '#2c2c2c', borderLeftWidth: 5, borderLeftColor: config.color }]}>
        <View style={styles.statusHeader}>
          <Animated.View style={config.pulse ? { transform: [{ scale: pulseAnim }] } : null}>
            <Icon name={config.icon} size={24} color={config.color} />
          </Animated.View>
          <Text style={[styles.statusTitle, { color: config.color }]}>{attendanceStatus}</Text>
        </View>
        <Text style={styles.statusMessage}>{config.message}</Text>
        {lastClockIn && (
          <Text style={styles.statusTime}>
            Last attendance: {new Date(lastClockIn).toLocaleString()}
          </Text>
        )}
      </View>
    );
  };

  const renderNextShiftCountdown = () => {
    //Always render countdown card when not loading.
    if (loading) return null;
    if (!nextShift) {
      return (
        <View style={styles.countdownCard}>
          <View style={styles.countdownHeader}>
            <Icon name="calendar-outline" size={20} color="#aaaaaa" />
            <Text style={[styles.countdownTitle, { color: '#aaaaaa' }]}>Next Shift</Text>
          </View>
          <Text style={[styles.countdownText, { color: '#aaaaaa' }]}>
            No upcoming shifts scheduled
          </Text>
        </View>
      );
    }
    if(attendanceStatus === 'Working') {
     return (
        <View style={styles.countdownCard}>
          <View style={styles.countdownHeader}>
            <Icon name="calendar-outline" size={20} color="#4CAF50" />
            <Text style={[styles.countdownTitle, { color: '#4CAF50' }]}>Shift started</Text>
          </View>
          <Text style={[styles.countdownText, { color: '#4CAF50' }]}>
            Ends at: 
          </Text>
          <Text style={[styles.countdownTimer , { color: '#4CAF50' }]}>{endTime}</Text>
        </View>
      );
    }
    
    return (
      <View style={styles.countdownCard}>
        <View style={styles.countdownHeader}>
          <Icon name="time-outline" size={20} color="#489cf7ff" />
          <Text style={styles.countdownTitle}>Next Shift</Text>
        </View>
        <Text style={styles.countdownText}>
          {new Date(nextShift.date_).toLocaleDateString()} at {nextShift.start_time?.split(':').slice(0, 2).join(':')}
        </Text>
        <Text style={styles.countdownTimer}>{countdown}</Text>
        <Text style={styles.countdownLabel}>Starts in</Text>
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
         {/* Location Status */}
        <View style={styles.locationStatus}>
          <Icon 
            name={locationStatus.includes('verified') ? 'location' : 'location'} 
            size={16} 
            color={locationStatus.includes('verified') ? '#4CAF50' : '#FF4444'} 
          />
          {/* <Text style={[
            styles.locationStatusText,
            locationStatus.includes('error') && styles.locationError
          ]}>
            {locationStatus} */}
          {/* </Text> */}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Attendance Status Card */}
        {!loading && renderStatusCard()}

        {/* Next Shift Countdown - Always render when not loading */}
        {renderNextShiftCountdown()}

        <Text style={styles.sectionTitle}>LOG ATTENDANCE</Text>
        
        {/* Location Status */}
        {/* <View style={styles.locationStatus}>
          <Icon 
            name={locationStatus.includes('error') ? 'location-off' : 'location'} 
            size={16} 
            color={locationStatus.includes('error') ? '#FF4444' : '#4CAF50'} 
          />
          <Text style={[
            styles.locationStatusText,
            locationStatus.includes('error') && styles.locationError
          ]}>
            {locationStatus}
          </Text>
        </View> */}

        {/* Notify Manager Button- Only shown if shift is upcoming and within cancellation window */}
        {/* {renderNotifyManagerButton()} */}
        <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
          <TouchableOpacity 
            style={[
              styles.clockInButton, 
              attendanceStatus === 'On Leave' && styles.disabledButton,
              clockingIn && styles.clockingInButton
            ]} 
            onPress={handleClockIn}
            disabled={attendanceStatus === 'On Leave' || clockingIn}
          >
            {clockingIn ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Text style={styles.clockInText}>
                  {attendanceStatus === 'Working' ? 'CLOCK-OUT' : 'CLOCK-IN'}
                </Text>
                <Icon name="qr-code-outline" size={24} color="#ffffff" />
              </>
            )}
          </TouchableOpacity>
        </Animated.View>

         {renderNotifyManagerButton()}
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
                  {shift.status_ === 'scheduled' ? 'Upcoming' : 'Completed'}
                </Text>
              </View>
            ))
          ) : (
            <View style={[styles.tableRow, styles.evenRow]}>
              <Text style={[styles.tableCell, styles.noShiftsText]}>No upcoming shifts</Text>
            </View>
          )}
        </View>
      </ScrollView>

      <BottomNav />

    {/* Cancel Shift Modal */}
    <Modal
      animationType="slide"
      transparent={true}
      visible={cancelModalVisible}
      onRequestClose={() => setCancelModalVisible(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Cancel Shift</Text>
          
          <Text style={styles.modalLabel}>Reason for cancellation:</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={cancelReason}
              style={styles.picker}
              onValueChange={(itemValue) => setCancelReason(itemValue)}
            >
              <Picker.Item label="Sick" value="sick" />
              <Picker.Item label="Emergency" value="emergency" />
              <Picker.Item label="Personal Reasons" value="personal" />
              <Picker.Item label="Transport Issues" value="transport" />
              <Picker.Item label="Other" value="other" />
            </Picker>
          </View>
          
          <Text style={styles.modalLabel}>Additional notes:</Text>
          <TextInput
            style={styles.notesInput}
            multiline={true}
            numberOfLines={3}
            value={cancelNotes}
            onChangeText={setCancelNotes}
            placeholder="Provide any additional details..."
            placeholderTextColor="#888"
          />
          
          <View style={styles.modalButtons}>
            <TouchableOpacity 
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => setCancelModalVisible(false)}
            >
              <Text style={styles.modalButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.modalButton, styles.submitButton]}
              onPress={confirmCancelShift}
            >
              <Text style={styles.modalButtonText}>Notify Manager</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
    {/* End of Cancel Shift Modal */}

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
  countdownCard: {
    backgroundColor: '#2c2c2c',
    borderRadius: 12,
    padding: 1,
    marginBottom: 20,
    alignItems: 'center',
  },
  countdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  countdownTitle: {
    color: '#489cf7ff',
    fontSize: 15,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  countdownText: {
    color: '#ffffff',
    fontSize: 12,
    marginBottom: 4,
  },
  notifyButton: {
    flexDirection: 'row',
    backgroundColor: '#333',
    borderWidth: 1,
    borderColor: '#FF9800',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },
  notifyButtonText: {
    color: '#FF9800',
    fontWeight: 'bold',
    marginLeft: 10,
  },
  countdownTimer: {
    color: '#489cf7ff',
    fontSize: 15,
    fontWeight: 'bold',
    marginVertical: 4,
  },
  countdownLabel: {
    color: '#ffffff',
    fontSize: 12,
  },
  sectionTitle: {
    fontWeight: 'bold',
    fontSize: 15,
    marginVertical: 5,
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  locationStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
    padding: 10,
    backgroundColor: '#2c2c2c',
    borderRadius: 8,
  },
  locationStatusText: {
    color: '#4CAF50',
    marginLeft: 8,
    fontSize: 14,
  },
  locationError: {
    color: '#FF4444',
  },
  clockInButton: {
    flexDirection: 'row',
    backgroundColor: '#007bff',
    padding: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginVertical: 10,
    shadowColor: '#007bff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  clockingInButton: {
    backgroundColor: '#007bff',
  },
  clockInText: {
    fontWeight: 'bold',
    color: '#ffffff',
    marginLeft: 10,
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
  noShiftsText: {
    textAlign: 'center',
    flex: 3, 
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
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#2c2c2c',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalLabel: {
    color: '#ffffff',
    marginBottom: 8,
    fontWeight: '500',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 8,
    marginBottom: 16,
    backgroundColor: '#3c3c3c',
  },
  picker: {
    color: '#ffffff',
    height: 50,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 8,
    padding: 12,
    color: '#ffffff',
    backgroundColor: '#3c3c3c',
    textAlignVertical: 'top',
    marginBottom: 20,
    minHeight: 100,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#666',
  },
  submitButton: {
    backgroundColor: '#FF9800',
  },
  modalButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
});

export default ClockInScreen;