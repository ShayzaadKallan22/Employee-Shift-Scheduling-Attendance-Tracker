/**
 * @author CT MOYO, 221039267
 * @version mobile_app
 */
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, TextInput, SafeAreaView } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'http://192.168.149.179:3000/api';

const ProfileScreen = () => {

  const navigation = useNavigation(); 
  const [isEditing, setIsEditing] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchEmpProfile = async () =>{
    try {
    //Get employee ID from AsyncStorage, stored when employee
    const employee_id = await AsyncStorage.getItem('employee_id');
    if (!employee_id) {
      throw new Error('Employee ID not found');
    }
    //const id = employeeId.replace('EMP-','');
   
       const res = await fetch(`${API_URL}/profile/create/${employee_id}`);
       if(!res.ok){
        const text = await res.text();
        console.error(`Server error: ${res.status}`, text);
        throw new Error(`Failed to fetch profile data. Status: ${res.status}`);
       }

       const data = await res.json();
       setProfileData(data);
   }catch(err){
     console.error('Error fetching profile data:', err);
   }finally{
    setLoading(false);
   }
  };

  useEffect(()=> {
    fetchEmpProfile();
  }, []);

  

  const handleSave = async () => {
    setIsEditing(false);
    if(!profileData || !profileData.name){
      console.error('Invalid profile data');
      return;
    }

    const employee_id = profileData.employeeId.replace('EMP-', '');

    try{
      const res = await fetch(`${API_URL}/profile/update/${employee_id}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(profileData),
      });

       const updated = await res.json();
       setProfileData(updated);
       console.log('Saved:', profileData);
    }catch(err){
       console.error('Error saving profile:', err);
    }
    
  };
  
  //Generate employee initials from their name.
  const getInitials = (name) => {
     if (!name) return '';
        const empName = name.trim().split(' ');
        if (empName.length === 1) return empName[0][0].toUpperCase();
           return (empName[0][0] + empName[1][0]).toUpperCase();
  };
  //Handle profile data change.
  const handleChange =(key, value)=>{
    setProfileData(prev => ({ ...prev, [key]: value}));
  };

  useEffect(()=>{
    if(profileData){
      const storeProfileData = async () => {
        try{
          //Store the profile data.
          await AsyncStorage.setItem('User_name', profileData.name);
          await AsyncStorage.setItem('User_role', profileData.role);
        }catch(err){
          console.error('Error storing profile data:', err);
        }
      };
      storeProfileData();
    }
  }, [profileData]);

  
if(loading){
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.header}>Loading...</Text>
      </View>
    </SafeAreaView>
  );
}
  const ProfileField = ({ label, value, editable, onChangeText, keyboardType = 'default', style }) => (
  <View style={styles.infoRow}>
    <Text style={styles.label}>{label}:</Text>
    {editable ? (
      <TextInput
        style={[styles.value, styles.editableField]}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}/>
    ) : (
      <Text style={[styles.value, style]}>{value}</Text>
    )}
  </View>
);
  return (
  <SafeAreaView style={styles.safeArea}>
    <View style={styles.container}>
      <Text style={styles.header}>My Profile</Text>

      <View style={styles.profilePictureContainer}>
        <View style={styles.initialsContainer}>
          <Text style={styles.initialsText}>
             {getInitials(profileData.name)}
          </Text>
        </View>

        <TouchableOpacity
           style={styles.editPictureButton}
           onPress={() => console.log('Change photo pressed')}>
          <Icon name="camera-outline" size={20} color="#ffffff" />
        </TouchableOpacity>
      </View>

      <View style={styles.profileCard}>
        <ProfileField label="Name" value={profileData.name} editable={false} />
        <ProfileField
          label="Email"
          value={profileData.email}
          editable={isEditing}
          onChangeText={(text) => handleChange('email', text)}
          keyboardType="email-address" />
        <ProfileField
          label="Cell Number"
          value={profileData.cellNumber}
          editable={isEditing}
          onChangeText={(text) => handleChange('cellNumber', text)}
          keyboardType="phone-pad" />
        <ProfileField label="Role" value={profileData.role} editable={false} />
        <ProfileField
          label="Status"
          value={profileData.status}
          editable={false}
          style={styles.activeStatus} />

        <View style={styles.divider} />

        <TouchableOpacity
          style={[styles.saveButton, !isEditing && styles.editButton]}
          onPress={isEditing ? handleSave : () => setIsEditing(true)}
        >
          <Text style={styles.saveButtonText}>
            {isEditing ? 'Save Changes' : 'Edit Profile'}
          </Text>
        </TouchableOpacity>
      </View>

      </View>
      <View style={styles.bottomNav}>
        <TouchableOpacity 
          onPress={() => navigation.navigate('BurgerMenu')}
          style={styles.navButton} >
          <Icon name="menu-outline" size={28} color='#ffffff'/>
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => navigation.navigate('ShiftSchedule')}
          style={styles.navButton} >
          <Icon name="calendar-outline" size={28} color='#ffffff'/>
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => navigation.navigate('ClockIn')}
          style={styles.navButton} >
          <Icon name="home" size={28} color='#ffffff'/>
        </TouchableOpacity>
        
        <TouchableOpacity 
          onPress={() => navigation.navigate('Notifications')}
          style={styles.navButton} >
          <Icon name="notifications-outline" size={28} color='#ffffff'/>
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => navigation.navigate('Profile')}
          style={styles.navButton} >
          <Icon name="person-outline" size={28} color='#ffffff'/>
        </TouchableOpacity>
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
    marginBottom: 20,
    textAlign: 'center',
  },
  profilePictureContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  initialsContainer: {
  width: 100,
  height: 100,
  borderRadius: 50,
  backgroundColor: '#007AFF',
  justifyContent: 'center',
  alignItems: 'center',
},
initialsText: {
  fontSize: 36,
  color: '#fff',
  fontWeight: 'bold',
},
  editPictureButton: {
    position: 'absolute',
    right: 10,
    bottom: 0,
    backgroundColor: '#007bff',
    borderRadius: 20,
    padding: 8,
  },
  profileContainer: {
    backgroundColor: '#2c2c2c',
    borderRadius: 10,
    padding: 15,
  },
  name: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 20,
    textAlign: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  label: {
    color: '#aaaaaa',
    fontSize: 16,
    fontWeight: 'bold',
  },
  value: {
    color: '#ffffff',
    fontSize: 16,
  },
  editableField: {
    borderBottomWidth: 1,
    borderBottomColor: '#007bff',
    padding: 5,
    minWidth: 150,
    textAlign: 'right',
  },
  activeStatus: {
    color: '#4CAF50',
  },
  divider: {
    height: 1,
    backgroundColor: '#444',
    marginVertical: 20,
  },
  saveButton: {
    backgroundColor: '#007bff',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: '#333333',
    borderWidth: 1,
    borderColor: '#007bff',
  },
  saveButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
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

export default ProfileScreen;