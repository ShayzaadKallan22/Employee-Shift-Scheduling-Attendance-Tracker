/**
 * @author MOYO CT, 221039267
 * @version mobile_app
 */

import { StatusBar } from 'expo-status-bar';
import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, StyleSheet, Image } from "react-native";
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';
import axios from 'axios';

//API URL for API connection and database connection.
import config from './config';

const API_URL = config.API_URL;

//LoginScreen component
const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [secureEntry, setSecureEntry] = useState(true);

  //Initialize navigator to allow use navigation.
  const navigation = useNavigation();
  //Handle employee login...
  const handleLogin = async () => {
  if (!email || !password) {
    Alert.alert("Validation Error", "Please enter both email and password.");
    return;
  }

  setLoading(true);

  try {
    //console.time('Login API Call');
    const response = await axios.post(`${API_URL}/auth/login`, { email, password });
    //console.timeEnd('Login API Call');

    // console.log("Login API raw response:", response.data);
    // Alert.alert("Login response", JSON.stringify(response.data, null, 2));

    //Safely extract response fields
    const user = response.data?.user;

    if (!user) {
      return;
      //throw new Error("Invalid response from server: missing token or user");
    }

    //Store values safely
    if (user.id) await AsyncStorage.setItem("employee_id", String(user.id));
    if (user.role_id) await AsyncStorage.setItem("role_id", String(user.role_id));
    if (user.email) await AsyncStorage.setItem("email", user.email);

    //Navigate only after everything succeeds
    navigation.replace("ClockIn");
  } catch (error) {
    //console.error("Login error:", error); // debug
    Alert.alert(
      "Login Failed",
      error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        "An unknown error occurred"
    );
  } finally {
    setLoading(false);
  }
};

  //Navigate to the forgot password page.
  const handleForgotPassword = async () => {
    navigation.replace('forgotPassword');
  };

   return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Image 
        source={require('./assets/AzaniaNLWhite.png')} 
        style={styles.logo}
        resizeMode="contain"
      />
      <View style={styles.formContainer}>
        <Text style={styles.title}>Welcome Back!</Text>
        <Text style={styles.subtitle}>Login to your account</Text>
        <View style={styles.inputContainer}>
          <Icon name="mail-outline" size={20} color="#aaaaaa" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#aaaaaa"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>
        
        <View style={styles.inputContainer}>
          <Icon name="lock-closed-outline" size={20} color="#aaaaaa" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#aaaaaa"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={secureEntry}/>
          <TouchableOpacity 
            onPress={() => setSecureEntry(!secureEntry)}
            style={styles.eyeIcon}>
            <Icon 
              name={secureEntry ? "eye-off-outline" : "eye-outline"} 
              size={20} 
              color="#aaaaaa" />
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity 
          onPress={handleForgotPassword} 
          style={styles.forgotPassword}>
          <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.loginButton}
          onPress={handleLogin}
          disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.loginButtonText}>Login</Text>
          )}
        </TouchableOpacity>
      </View>
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
  logo: {
    width: 200,
    height: 100,
    alignSelf: 'center',
    marginBottom: 40,
  },
  formContainer: {
    backgroundColor: '#2c2c2c',
    borderRadius: 15,
    padding: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  title: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
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
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 20,
  },
  forgotPasswordText: {
    color: '#007bff',
    fontSize: 14,
  },
  loginButton: {
    backgroundColor: '#007bff',
    borderRadius: 8,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },

});

export default LoginScreen;