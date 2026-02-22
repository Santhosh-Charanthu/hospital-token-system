import { getApp, getApps, initializeApp } from "firebase/app";
import { getMessaging, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyCiboh5YtIxPy-YqzJkafV2mFCqNoFjaR0",
  authDomain: "hospital-token-system-cccb1.firebaseapp.com",
  projectId: "hospital-token-system-cccb1",
  storageBucket: "hospital-token-system-cccb1.firebasestorage.app",
  messagingSenderId: "20421799593",
  appId: "1:20421799593:web:4738f29f1003f7c861c3b8",
  measurementId: "G-MNZ76R5HGR",
};

// Initialize Firebase
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const getFirebaseMessaging = async () => {
  const supported = await isSupported();
  if (!supported) throw new Error("FCM not supported");
  return getMessaging(app);
};
