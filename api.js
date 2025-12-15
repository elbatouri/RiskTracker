// api.js
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from './config';

// 1. Log in the worker
export const loginWorker = async (email, password) => {
  try {
    console.log(`Attempting login to: ${API_URL}/api/auth/login`);
    const response = await axios.post(`${API_URL}/api/auth/login`, {
      email,
      password
    });
    
    if (response.data.success) {
      // Save the tracking_id which identifies this worker in the database
      await AsyncStorage.setItem('tracking_id', response.data.tracking_id.toString());
      await AsyncStorage.setItem('worker_name', response.data.user.name);
      return response.data;
    }
    throw new Error(response.data.error || 'Login failed');
  } catch (error) {
    console.error("Login Error:", error);
    throw error;
  }
};

// 2. Send GPS coordinates
export const sendLocationUpdate = async (lat, lng) => {
  try {
    const trackingId = await AsyncStorage.getItem('tracking_id');
    if (!trackingId) throw new Error("No active tracking session");

    // Sends data to the endpoint in project/routes.py
    const response = await axios.post(`${API_URL}/track/update/${trackingId}`, {
      lat,
      lng
    });
    
    // Returns status like { "safety_check": { "status": "critical" } }
    return response.data; 
  } catch (error) {
    console.error("API Update Error:", error);
    return null;
  }
};

// 3. Logout
export const logoutWorker = async () => {
  await AsyncStorage.multiRemove(['tracking_id', 'worker_name']);
};