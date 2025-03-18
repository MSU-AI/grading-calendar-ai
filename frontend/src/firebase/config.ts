import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: "AIzaSyBCStWgpFwe5aTJvZO1V1t_dIG3NOxfYts",
  authDomain: "gradingai.firebaseapp.com",
  projectId: "gradingai",
  storageBucket: "gradingai.appspot.com",
  messagingSenderId: "742137383656",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Get Auth instance
export const auth = getAuth(app);
export const functions = getFunctions(app);
