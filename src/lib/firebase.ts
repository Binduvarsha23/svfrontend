// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCX_fxc65-7rS-scU3q_xuYIzFH-W5Ntrk",
  authDomain: "vault-917be.firebaseapp.com",
  projectId: "vault-917be",
  storageBucket: "vault-917be.firebasestorage.app",
  messagingSenderId: "51340642059",
  appId: "1:51340642059:web:009ea0c42db76113fc440e",
  measurementId: "G-RD7FH68GDC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
