// App.js
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from './LoginScreen';
import ClockInScreen from './ClockInScreen';
import ScanScreen from './ScanScreen';
import BurgerMenuScreen from './BurgerMenu';
import LeaveRequest from './LeaveRequest';
import Notifications from './Notifications';
import ProfileScreen from './Profile';
import ShiftSwap from './ShiftSwap';
import ShiftSchedule from './ShiftSchedule';
import Payslip from './Payslip';
import ForgotPassword from './forgotPassword';
import ResetPassword from './resetPassword';
import NotificationDetail from './NotificationDetail';
{/*import * as Font from 'expo-font';
import AppLoading from 'expo-app-loading';
import { Ionicons } from '@expo/vector-icons';*/}

const Stack = createNativeStackNavigator();

export default function App() {

  {/*const [fontsLoaded, setFontsLoaded] = useState(false);

  const loadFonts = () =>
    Font.loadAsync({
      ...Ionicons.font,
    });

  if (!fontsLoaded) {
    return (
      <AppLoading
        startAsync={loadFonts}
        onFinish={() => setFontsLoaded(true)}
        onError={console.warn}
      />
    );
  }*/}

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="forgotPassword" component={ForgotPassword} />
        <Stack.Screen name="ResetPassword" component={ResetPassword} />
        <Stack.Screen name="ClockIn" component={ClockInScreen} />
        <Stack.Screen name= "ScanScreen" component={ScanScreen} />
        <Stack.Screen name= "BurgerMenu" component={BurgerMenuScreen} />
        <Stack.Screen name= "Leave Requests" component={LeaveRequest} />
        <Stack.Screen name= "Notifications" component={Notifications} />
        <Stack.Screen name="NotificationDetails" component={NotificationDetail} />
        <Stack.Screen name= "Profile" component={ProfileScreen} />
        <Stack.Screen name= "Home" component={ClockInScreen} />
        <Stack.Screen name= "Shift Swap" component={ShiftSwap} />
        <Stack.Screen name= "ShiftSchedule" component={ShiftSchedule} />
        <Stack.Screen name= "Payslip" component={Payslip} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
