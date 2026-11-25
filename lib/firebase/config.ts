import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import {
  connectFirestoreEmulator,
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";

// Firebase web config. These values are public by design — access is controlled
// by Firebase Auth + Firestore Security Rules, not by hiding the config.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Reuse the existing app during Next.js hot reloads / multiple imports.
const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth: Auth = getAuth(app);

// Persistent IndexedDB cache: reads are served from local storage first (so
// revisiting a page is instant), the SDK revalidates in the background, and the
// app keeps working offline. On the server there's no IndexedDB, and a hot-reload
// re-import would re-init — both fall back to the already-started instance.
function initDb(): Firestore {
  if (typeof window === "undefined") return getFirestore(app);
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    return getFirestore(app);
  }
}

export const db: Firestore = initDb();

// Optional local development against the Firebase Emulator Suite (never set in
// production): `NEXT_PUBLIC_FIREBASE_EMULATOR=1` points Auth + Firestore at the
// emulators so the app and `firestore.rules` can be tested without touching
// real data. See README → "Local emulators".
if (process.env.NEXT_PUBLIC_FIREBASE_EMULATOR === "1" && typeof window !== "undefined") {
  const flagged = globalThis as typeof globalThis & { __lifeosEmulators?: boolean };
  if (!flagged.__lifeosEmulators) {
    flagged.__lifeosEmulators = true;
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
  }
}
export default app;
