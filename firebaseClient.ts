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
  storageBucket: "slot-grid.appspot.com",
  messagingSenderId: "521092974332",
  appId: "1:521092974332:web:934fc2ceb87e0b55abb979"
};


let app;
let auth;
let db;
let googleProvider;

// A flag to check if Firebase is configured. This helps the app run
// in local-only mode if the config is just placeholders.
// FIX: The previous logic incorrectly identified all valid web API keys (which start with "AIzaSy") as placeholders.
// The logic is now corrected to simply check if an API key exists.
export const isFirebaseConfigured = !!firebaseConfig.apiKey;

if (isFirebaseConfigured) {
  // Initialize Firebase
  try {
    app = firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();
    googleProvider = new firebase.auth.GoogleAuthProvider();
  } catch(e) {
      console.error("Firebase initialization failed:", e);
      // Fallback to local-only mode if initialization fails
      // isFirebaseConfigured = false; // This would hide the button again, so maybe just log the error.
  }
} else {
    console.warn("Firebase is not configured. Please replace placeholder values in firebaseClient.ts. App will run in local-only mode.");
}


export { app, auth, db, googleProvider };