/**
 * @author MOYO CT, 221039267
 * @version mobile_app
 */
import React, { useEffect, useState } from 'react';
import {View,Text,Alert,TouchableOpacity,StyleSheet, ActivityIndicator} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import config from './config';

const API_URL = config.API_URL;

export default function ScanScreen() {

  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  
  //Request camera permissions.
  useEffect(() => {
    if (!permission || permission.status !== 'granted') {
      requestPermission();
    }
  }, [permission]);

  const handleScanQRCode = async ({data}) => {
    setLoading(true);
    if (scanned) return;
    setScanned(true);
    
    try{  
      //Fetch the employeeId from async storage.
      const employeeId = await AsyncStorage.getItem('employee_id');
      if(!employeeId){
        throw new Error('Employee ID not found');
      }
      //Fetch the api response 
      const response = await fetch(`${API_URL}/api/qr/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json'},
      body: JSON.stringify({code_value: data, employee_id: employeeId}),
      });
      
      const result = await response.json();
      //Check the api response and handle...
      if(response.ok){
        Alert.alert('Success', result.message, [
          {
            text: 'OK',
            onPress: () => { 
              setLoading(false); //Stop spinner 
              navigation.navigate('ClockIn');  //navigate after user clicks OK.
            }
          }
        ]);
      } else{
        Alert.alert('Failed', result.message || 'Invalid QR code');
        setScanned(false);
        setLoading(false);
      }
    }catch(error){
      Alert.alert('Error', 'Could not scan the QR Code');
      console.error(error);
      setScanned(false);
      setLoading(false);
    }
    //setLoading(false);
  };
   if(!permission)
      return <Text> Requesting camera permission...</Text>;
    if(!permission.granted)
      return <Text>Camera access denied!</Text>;

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => navigation.navigate('ClockIn')} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.header}>Scan QR Code</Text>
      </View>
        <View style={styles.cameraContainer}>
        {loading && (
         <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#ffffff" />
          <Text style={{color: '#fff', marginTop: 10}}>Processing QR code...</Text>
         </View>
        )}
        {(scanned || loading) && (
          <View style={styles.cameraOverlay} />
        )}
        <CameraView
          style={StyleSheet.absoluteFillObject}
          cameraType="back"
          onBarcodeScanned={handleScanQRCode}
          barcodeScannerSettings={{barcodeTypes: ['qr'],}}/>
      </View>

      {scanned &&(
      <TouchableOpacity
        style={styles.scanButton}
        onPress={() => setScanned(false)}>
        <Text style={styles.scanText}>Tap to Scan Again</Text>
        <Icon name="camera-outline" size={20} color="#fff" style={{ marginLeft: 8 }} />
      </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    paddingTop: 50,
    paddingHorizontal: 20,
  },
  header: {
    textAlign: 'center',
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    alignSelf: 'center',
    marginBottom: 10,
    marginLeft: 50,
  },
  cameraContainer: {
    height: 350,
    overflow: 'hidden',
    borderRadius: 15,
    marginBottom: 16,
    backgroundColor: '#ccc',
    margin: 10,
  },
  scanButton: {
    flexDirection: 'row',
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    alignSelf: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  scanText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    zIndex: 1,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#000',
  },
  backButton: {
    marginRight: 10,
  },
});
