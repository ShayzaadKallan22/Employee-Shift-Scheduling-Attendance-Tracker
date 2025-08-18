/**
 * @author MOYO CT, 221039267
 * @version mobile_app
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { NotificationProvider } from './NotificationContext';
import * as SplashScreen from 'expo-splash-screen';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Splash from './Splash';
import LoginScreen from './LoginScreen';
import ClockInScreen from './ClockInScreen';
import ScanScreen from './ScanScreen';
import BurgerMenuScreen from './BurgerMenu';
import LeaveRequest from './LeaveRequest';
import Notifications from './Notifications';
import ProfileScreen from './Profile';
import Shift from './shift';
import Payslip from './Payslip';
import ForgotPassword from './forgotPassword';
import ResetPassword from './resetPassword';
import NotificationDetail from './NotificationDetail';
import ChatScreen from './Chat';

const Stack = createNativeStackNavigator();

//If app is ready, run app , else run the splash.
function MainApp() {
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        await SplashScreen.preventAutoHideAsync();
      } catch (e) {
        console.warn(e);
      } finally {
        setAppIsReady(true);
      }
    }

    prepare();
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) {
      await SplashScreen.hideAsync();
    }
  }, [appIsReady]);

  if (!appIsReady) {
    return null;
  }

  return (
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Splash" screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Splash" component={Splash} />
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="forgotPassword" component={ForgotPassword} />
          <Stack.Screen name="ResetPassword" component={ResetPassword} />
          <Stack.Screen name="ClockIn" component={ClockInScreen} />
          <Stack.Screen name="ScanScreen" component={ScanScreen} />
          <Stack.Screen name="BurgerMenu" component={BurgerMenuScreen} />
          <Stack.Screen name="Leave Requests" component={LeaveRequest} />
          <Stack.Screen name="Notifications" component={Notifications} />
          <Stack.Screen name="NotificationDetails" component={NotificationDetail} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen name="Home" component={ClockInScreen} />
          <Stack.Screen name="Shift" component={Shift} />
          <Stack.Screen name="Payslip" component={Payslip} />
          <Stack.Screen name="ChatScreen" component={ChatScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </View>
  );
}
//Wrap main ap with the notification provider
export default function App() {
  return (
    <NotificationProvider>
      <MainApp />
    </NotificationProvider>
  );
}