// App.js
import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert, Vibration, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { Audio } from 'expo-av';
import { loginWorker, sendLocationUpdate, logoutWorker } from './api';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('OFFLINE'); 
  const [workerName, setWorkerName] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Audio Player
  const soundRef = useRef(new Audio.Sound());
  const isAlarmPlaying = useRef(false);

  // 1. Check if already logged in when app opens
  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    const id = await AsyncStorage.getItem('tracking_id');
    const name = await AsyncStorage.getItem('worker_name');
    if (id && name) {
      setWorkerName(name);
      setIsLoggedIn(true);
      startTracking();
    }
  };

  // 2. ALARM SYSTEM (Sound + Vibration)
  const triggerAlarm = async () => {
    if (isAlarmPlaying.current) return;
    
    console.log("🚨 CRITICAL ALARM TRIGGERED");
    isAlarmPlaying.current = true;
    
    // Vibrate pattern: 1s ON, 1s OFF, repeat
    Vibration.vibrate([1000, 1000, 1000], true);

    try {
      await soundRef.current.unloadAsync();
      // Using a standard alarm sound URL
      await soundRef.current.loadAsync({ uri: 'https://www.soundjay.com/mechanical/sounds/smoke-detector-1.mp3' });
      await soundRef.current.setIsLoopingAsync(true);
      await soundRef.current.playAsync();
    } catch (e) {
      console.log("Audio Error:", e);
    }
  };

  const stopAlarm = async () => {
    if (!isAlarmPlaying.current) return;
    
    isAlarmPlaying.current = false;
    Vibration.cancel();
    try {
      await soundRef.current.stopAsync();
    } catch (e) {}
  };

  // 3. TRACKING LOOP (GPS)
  const startTracking = async () => {
    setStatus('SAFE'); 
    
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Allow location access to use this app.');
      return;
    }

    // Update every 5 seconds or if moved 5 meters
    Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 5000,
        distanceInterval: 5,
      },
      async (location) => {
        const { latitude, longitude } = location.coords;
        // Send to Python Backend
        const result = await sendLocationUpdate(latitude, longitude);
        
        if (result && result.safety_check) {
          const safetyStatus = result.safety_check.status; // from routes.py
          
          if (safetyStatus === 'critical') {
            setStatus('CRITICAL');
            triggerAlarm();
          } else if (safetyStatus === 'alert') {
            setStatus('WARNING');
            stopAlarm();
          } else {
            setStatus('SAFE');
            stopAlarm();
          }
        }
      }
    );
  };

  // 4. LOGIN HANDLER
  const handleLogin = async () => {
    setLoading(true);
    try {
      const data = await loginWorker(email, password);
      setWorkerName(data.user.name);
      setIsLoggedIn(true);
      startTracking();
    } catch (e) {
      Alert.alert('Login Failed', 'Check your email/password and ensure the server is running.');
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    stopAlarm();
    await logoutWorker();
    setIsLoggedIn(false);
    setEmail('');
    setPassword('');
  };

  // 5. RENDER SCREENS
  if (!isLoggedIn) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>RiskMan Login</Text>
        <TextInput 
          style={styles.input} 
          placeholder="Email" 
          autoCapitalize="none"
          value={email} onChangeText={setEmail} 
        />
        <TextInput 
          style={styles.input} 
          placeholder="Password" 
          secureTextEntry 
          value={password} onChangeText={setPassword} 
        />
        <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff"/> : <Text style={styles.btnText}>Login</Text>}
        </TouchableOpacity>
      </View>
    );
  }

  // Determine Background Color based on Risk
  const getBgColor = () => {
    if (status === 'CRITICAL') return '#ef4444'; // Red
    if (status === 'WARNING') return '#f59e0b'; // Orange
    return '#10b981'; // Green
  };

  return (
    <View style={[styles.container, { backgroundColor: getBgColor() }]}>
      <Text style={styles.statusText}>{status === 'CRITICAL' ? 'DANGER!' : status}</Text>
      
      {status === 'CRITICAL' && (
        <Text style={styles.subText}>EVACUATE IMMEDIATELY</Text>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Worker: {workerName}</Text>
        <Text style={styles.cardInfo}>Tracking Active • GPS On</Text>
        <TouchableOpacity style={[styles.btn, {marginTop: 20, backgroundColor: '#333'}]} onPress={handleLogout}>
          <Text style={styles.btnText}>Stop Tracking</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#f8fafc',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
    color: '#334155',
  },
  input: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  btn: {
    backgroundColor: '#2563eb',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  statusText: {
    fontSize: 48,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 10,
  },
  subText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 40,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    padding: 20,
    borderRadius: 15,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  cardInfo: {
    color: '#64748b',
  }
});