// This file configures the Firebase services for the application.

// Declare firebase as a global variable to inform TypeScript that it's
// loaded from the CDN in index.html.
declare const firebase: any;

// Your web app's Firebase configuration.
// IMPORTANT: Replace the placeholder values with your actual Firebase project settings.
const firebaseConfig = {
  apiKey: "AIzaSyAMnMroWsCKPquFMEKTA_rq2LDyISSuVhs",
  authDomain: "slot-grid.firebaseapp.com",
  projectId: "slot-grid",
  storageBucket: "slot-grid.firebasestorage.app",
  messagingSenderId: "521092974332",
  appId: "1:521092974332:web:934fc2ceb87e0b55abb979"
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
