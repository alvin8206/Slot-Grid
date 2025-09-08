// This file configures the Firebase services for the application.

// Declare firebase as a global variable to inform TypeScript that it's
// loaded from the CDN in index.html.
declare const firebase: any;

// Your web app's Firebase configuration.
// IMPORTANT: Replace the placeholder values with your actual Firebase project settings.
const firebaseConfig = {
  apiKey: "AIzaSyAGcCnAu3h0XHPQ-l4j7k1BZ9WoeL1RTqU",
  authDomain: "quick-calendar-4d270.firebaseapp.com",
  projectId: "quick-calendar-4d270",
  storageBucket: "quick-calendar-4d270.firebasestorage.app",
  messagingSenderId: "937639505647",
  appId: "1:937639505647:web:37d8bdb48df93f6379f51a",
  measurementId: "G-462BLX9PY5"
};

let app;
let auth;
let db;
let googleProvider;

// A flag to check if Firebase is configured. This helps the app run
// in local-only mode if the config is just placeholders.
export const isFirebaseConfigured = firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY";

if (isFirebaseConfigured) {
  // Initialize Firebase
  app = firebase.initializeApp(firebaseConfig);
  auth = firebase.auth();
  db = firebase.firestore();
  googleProvider = new firebase.auth.GoogleAuthProvider();
}

export { app, auth, db, googleProvider };
