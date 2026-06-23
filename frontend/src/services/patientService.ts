import axios from 'axios';
//meta for what we use it ? 
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const getRecentPatients = async (token: string) => {
  try {
    const response = await axios.get(`${API_URL}/patients/recent`, {
      headers: {
        'Authorization': `Bearer ${token}`, // هنا يكمن الحل!
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  } catch (error) {
    console.error("خطأ في جلب البيانات:", error);
    throw error;
  }
};