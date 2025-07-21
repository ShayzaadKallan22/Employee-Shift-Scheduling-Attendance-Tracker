/**
 * @author MOYO CT, 221039267
 * @version mobile_app
 */

import React, {useEffect, useRef} from 'react';
import {View, StyleSheet, Animated, Text, Easing, Dimensions} from 'react-native';
import Svg, {Polygon} from 'react-native-svg';


const AnimatedPolygon = Animated.createAnimatedComponent(Polygon);
export default function Splash({navigation}){
    const dashOffset = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    //Triangle stroke animation loop
    Animated.loop(
      Animated.timing(dashOffset, {
        toValue: 136,
        duration: 2500,
        useNativeDriver: false,
        easing: Easing.inOut(Easing.cubic),
      })
    ).start();

    //Fade in the whole splash screen
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();

    //Navigate after splash
    const timer = setTimeout(() => {
      navigation.replace('Login');
    }, 4000);

    return () => clearTimeout(timer);
  }, []);

  const strokeDashoffset = dashOffset.interpolate({
    inputRange: [0, 136],
    outputRange: [0, 136],
  });

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={styles.triangleWrapper}>
        <Svg width={90} height={90} viewBox="-3 -4 39 39">
          <AnimatedPolygon
            points="16,0 32,32 0,32"
            fill="none"
            stroke="#ffffff"
            strokeWidth="2"
            strokeDasharray="17"
            strokeDashoffset={strokeDashoffset}
          />
        </Svg>
      </View>
      <Text style={styles.appName}>Azania App</Text>
      <Text style={styles.loadingText}>Preparing your experience...</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#202628',
    alignItems: 'center',
    justifyContent: 'center',
  },
  triangleWrapper: {
    marginBottom: 25,
  },
  appName: {
    fontSize: 28,
    color: '#ffffff',
    fontWeight: '600',
    letterSpacing: 1,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: '#bbbbbb',
    fontStyle: 'italic',
  },
});