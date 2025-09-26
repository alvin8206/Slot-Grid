// This file configures the Firebase services for the application.
// Firebase SDK is loaded via CDN in index.html (compat build).

// Declare firebase as a global variable to inform TypeScript that it's loaded from the CDN.
declare const firebase: any;

// Make window typings aware of the App Check debug token property.
declare global {
  interface Window {
    FIREBASE_APPCHECK_DEBUG_TOKEN: boolean | string | undefined;
  }
}

// Your web app's Firebase configuration.
const firebaseConfig = {
  apiKey: "AIzaSyAMnMroWsCKPquFMEKTA_rq2LDyISSuVhs",
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
let appCheck: any; // NEW: Add handle for App Check

// 只要 config 有 key 就視為已設定（避免把合法的 "AIzaSy..." 當作占位）
export const isFirebaseConfigured: boolean = !!firebaseConfig.apiKey;

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

    // NEW: Initialize Firebase App Check
    try {
      if (firebase.appCheck) {
        // --- IMPORTANT: App Check Debug Token for Development ---
        // To test App Check in a local or sandboxed environment (like AI Studio),
        // reCAPTCHA verification can fail. We enable debug mode to bypass this.
        // The SDK will automatically generate a debug token and print it to the
        // browser console. For production, this line should be set to `false`.
        window.self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
        // --------------------------------------------------------

        appCheck = firebase.appCheck(app);
        
        // IMPORTANT: Replace this placeholder with your actual reCAPTCHA v3 site key.
        appCheck.activate(
          '6Lde-dUrAAAAAFt-cqE994VwH89tGiRDigp4105w',
          true // isTokenAutoRefreshEnabled
        );
        console.log("Firebase App Check with reCAPTCHA v3 activated in debug mode.");
      } else {
        console.warn("Firebase App Check SDK not found. Skipping initialization.");
      }
    } catch (e) {
      console.error("Firebase App Check initialization failed:", e);
    }


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

export { app, auth, db, googleProvider, appCheck };
