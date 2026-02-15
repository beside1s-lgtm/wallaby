
'use client';

import { initializeApp, getApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, type User, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

// 환경 변수에서 Firebase 설정값을 가져옵니다.
// NEXT_PUBLIC_ 접두사가 붙어야 브라우저에서 안전하게 읽을 수 있습니다.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp;
let db: Firestore;
let auth: Auth;

if (typeof window !== 'undefined') {
  // 필수 설정값이 있는지 검사합니다.
  const missingKeys = Object.entries(firebaseConfig)
    .filter(([key, value]) => !value && key !== 'storageBucket' && key !== 'messagingSenderId')
    .map(([key]) => `NEXT_PUBLIC_FIREBASE_${key.replace(/[A-Z]/g, letter => `_${letter}`).toUpperCase()}`);

  if (missingKeys.length > 0) {
    console.error("❌ [설정 오류] Firebase 키가 누락되었습니다. 호스팅 관리 화면(환경 변수 설정)에서 다음 항목을 추가해주세요:", missingKeys.join(", "));
    
    if (process.env.NODE_ENV === 'production') {
        console.warn("⚠️ 앱 호스팅 대시보드에서 환경 변수를 설정해야 앱이 정상 작동합니다.");
    }
  }
  
  try {
    // 설정값이 부족하더라도 시도는 해보되, 실패 시 에러를 잡습니다.
    app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    db = getFirestore(app);
    auth = getAuth(app);
  } catch (error) {
    console.error("❌ Firebase 초기화 실패:", error);
    app = null as any;
    db = null as any;
    auth = null as any;
  }
} else {
  // 서버 사이드 렌더링 환경 처리
  app = null as any;
  db = null as any;
  auth = null as any;
}

let authUser: User | null = null;

const signIn = async (): Promise<User> => {
    if (!auth) {
        const errorMsg = "로그인 서버(Firebase Auth)가 연결되지 않았습니다. 환경 변수 설정을 확인해 주세요.";
        console.error(errorMsg);
        // 사용자에게 직접 경고창을 띄워 인지시킵니다.
        alert(errorMsg);
        throw new Error(errorMsg);
    }
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
