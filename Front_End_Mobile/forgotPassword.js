/**
 * @author MOYO CT, 221039267
 * @version mobile_app
 */
import React, {useState} from 'react';
import {View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, ActivityIndicator} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import axios from 'axios';
import config from './config';

const API_URL = config.API_URL;

const ForgotPassword = () => {

    const navigation = useNavigation();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () =>{
      //Check if the email address was entered.
        if(!email){
            Alert.alert("Validation Error", "Please enter your email address.");
            return;
        }

        setLoading(true);

        try{
          //Send the email to the api for validation.
            await axios.post(`${API_URL}/api/forgot-password`, {email});
            Alert.alert("Success", "If your email exists, a reset link has been sent.");

            navigation.replace('ResetPassword');
        }catch(err){
            console.error('Something went wrong:', err);
        }finally{
            setLoading(false);
        }
    };

    return (
    <View style={styles.container}>
      <Text style={styles.title}>Forgot Password</Text>
      <Text style={styles.subtitle}>Enter your email to receive a password reset link.</Text>

      <View style={styles.inputContainer}>
        <Icon name="mail-outline" size={20} color="#aaaaaa" style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder="email"
          placeholderTextColor="#aaaaaa"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"/>
      </View>

      <TouchableOpacity 
        style={styles.button}
        onPress={handleSubmit}
        disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send Reset Link</Text>}
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
    paddingHorizontal: 25,
  },
  title: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    color: '#aaaaaa',
    fontSize: 14,
    marginBottom: 30,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    backgroundColor: '#3e3e3e',
    borderRadius: 8,
    paddingHorizontal: 15,
    alignItems: 'center',
    marginBottom: 20,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: '#fff',
    height: 50,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#007bff',
    borderRadius: 8,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  backToLoginText: {
  color: '#007bff',
  fontSize: 14,
  textAlign: 'center',
  marginTop: 5,
  left: 110,
}
});

export default ForgotPassword;
