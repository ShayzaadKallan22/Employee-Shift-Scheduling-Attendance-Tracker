/**
 * @author MOYO CT, 221039267
 * @version mobile_app
 */
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import Icon from 'react-native-vector-icons/Ionicons';

import config from './config';

const API_URL = config.API_URL;

const ResetPassword = () => {

  const navigation = useNavigation();
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [secureEntry, setSecureEntry] = useState(true);
  //Check if the reset token and new password have been entered and are valid.
  const handleReset = async () => {
    if (!token || !newPassword) {
      Alert.alert('Validation Error', 'Please enter both token and new password.');
      return;
    }

    setLoading(true);
    try {
      //Get api response 
      const res = await axios.post(`${API_URL}/api/reset-password`, {
        token,
        newPassword,
      });

      Alert.alert('Success', res.data.message || 'Password reset successful.');
      navigation.replace('Login');
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || 'Reset failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Reset Password</Text>
      <View style={styles.inputContainer}>
      <Icon name="refresh-circle" size={20} color="#aaaaaa" style={styles.inputIcon} />
      <TextInput
        style={styles.input}
        placeholder="Reset Token"
        placeholderTextColor="#aaa"
        value={token}
        onChangeText={setToken}
        />
       </View>

      <View style={styles.inputContainer}>
      <Icon name="lock-closed-outline" size={20} color="#aaaaaa" style={styles.inputIcon} />
      <TextInput
        style={styles.input}
        placeholder="New Password"
        placeholderTextColor="#aaa"
        value={newPassword}
        onChangeText={setNewPassword}
        secureTextEntry={secureEntry}
        />
        <TouchableOpacity 
          onPress={() => setSecureEntry(!secureEntry)}
          style={styles.eyeIcon}>
          <Icon 
            name={secureEntry ? "eye-off-outline" : "eye-outline"} 
            size={20} 
            color="#aaaaaa" 
          />
        </TouchableOpacity>
      </View>
       
      <TouchableOpacity style={styles.button} onPress={handleReset} disabled={loading}>
        <Text style={styles.buttonText}>Submit</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate('Login')}>
         <Text style={styles.backToLoginText}>Back to Login</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    color: '#fff',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3e3e3e',
    borderRadius: 8,
    marginBottom: 15,
    paddingHorizontal: 15,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: '#ffffff',
    height: 50,
    fontSize: 16,
  },
  eyeIcon: {
    padding: 10,
  },
  button: {
    backgroundColor: '#007bff',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  backToLoginText: {
  color: '#007bff',
  fontSize: 14,
  textAlign: 'center',
  marginTop: 20,
  left: 110,
},
});

export default ResetPassword;
