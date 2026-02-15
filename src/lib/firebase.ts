'use client';

import { initializeApp, getApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, type User, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// 필수 설정값이 누락되었는지 확인합니다.
const isConfigValid = !!firebaseConfig.apiKey && !!firebaseConfig.projectId;

let app: FirebaseApp;
let db: Firestore;
let auth: Auth;

if (typeof window !== 'undefined') {
  if (!isConfigValid) {
    console.error("Firebase 설정값이 누락되었습니다. 환경 변수 설정을 확인해주세요.");
  }
  
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  db = getFirestore(app);
  auth = getAuth(app);
} else {
  // SSR 환경을 위한 더미 초기화
  app = null as any;
  db = null as any;
  auth = null as any;
}

let authUser: User | null = null;

const signIn = async (): Promise<User> => {
    if (!auth) throw new Error("Firebase Auth가 초기화되지 않았습니다.");
    return new Promise((resolve, reject) => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            unsubscribe(); 
            if (user) {
                authUser = user;
                resolve(user);
            } else {
                signInAnonymously(auth)
                    .then((userCredential) => {
                        authUser = userCredential.user;
                        resolve(userCredential.user);
                    })
                    .catch(reject);
            }
        }, reject);
    });
};

export { app, db, auth, signIn, authUser };
