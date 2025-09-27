// This file configures the Firebase services for the application.
// Firebase SDK is loaded via CDN in index.html (compat build).

// Declare firebase as a global variable to inform TypeScript that it's loaded from the CDN.
declare const firebase: any;

// =================================================================================
// TODO: Replace these placeholder values with your actual Firebase project's configuration.
// You can find this in your Firebase project settings.
// =================================================================================
const firebaseConfig = {
  apiKey: "AIzaSyAMnMroWsCKPquFMEKTA_rq2LDyISSuVhs", // <-- PASTE YOUR REAL API KEY HERE
  authDomain: "slot-grid.firebaseapp.com",
  projectId: "slot-grid",
  storageBucket: "slot-grid.firebasestorage.app",
  messagingSenderId: "521092974332",
  appId: "1:521092974332:web:934fc2ceb87e0b55abb979"
};

// Exported handles
let app: any;
let auth: any;
let db: any;
let googleProvider: any;

// 只要 config 有 key 就視為已設定（避免把合法的 "AIzaSy..." 當作占位）
export const isFirebaseConfigured: boolean = !!firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY";

if (isFirebaseConfigured) {
  try {
    if (!firebase || !firebase.initializeApp) {
      throw new Error("Firebase CDN SDK not found. Make sure the compat build is included before this file.");
    }

    // Avoid double-initialize in hot-reload environments
    app = firebase.apps && firebase.apps.length ? firebase.app() : firebase.initializeApp(firebaseConfig);

    auth = firebase.auth();
    db = firebase.firestore();
    googleProvider = new firebase.auth.GoogleAuthProvider();
    
    // REMOVED: The entire Firebase App Check initialization block has been removed as per your request.
    // This will disable reCAPTCHA verification and should resolve the login issues caused by its misconfiguration.
    // Please be aware that this also removes a security layer that protects against abuse.

    // ---------- IMPORTANT: Firestore transport fallback ----------
    // In sandbox/iframe (e.g., AI Studio preview) the streaming channel may be blocked.
    // Force/auto-detect long-polling and disable fetch streams to avoid "offline mode" errors.
    try {
      // Prefer auto-detect if available (newer compat)
      db.settings({
        experimentalAutoDetectLongPolling: true,
        useFetchStreams: false,
      });
    } catch (e1) {
      // Fallback for older compat versions
      try {
        db.settings({
          experimentalForceLongPolling: true,
          useFetchStreams: false,
        });
      } catch (e2) {
        console.warn("[Firestore] Could not apply long-polling settings:", e2);
      }
    }
    // ------------------------------------------------------------

    // （可選）想看更詳細日誌可開啟：
    // firebase.firestore.setLogLevel && firebase.firestore.setLogLevel('debug');

  } catch (e) {
    console.error("Firebase initialization failed:", e);
  }
} else {
  console.warn("Firebase is not configured. Please replace placeholder values in firebaseClient.ts. App will run in local-only mode.");
}

export { app, auth, db, googleProvider };