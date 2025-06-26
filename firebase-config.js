// Firebase 설정
const firebaseConfig = {
    apiKey: "AIzaSyAxw0xYVu-rvRxOCLInMkqIJeuRIt35qU4",
    authDomain: "ncc2-c4bfa.firebaseapp.com",
    projectId: "ncc2-c4bfa",
    storageBucket: "ncc2-c4bfa.firebasestorage.app",
    messagingSenderId: "386144165760",
    appId: "1:386144165760:web:09492a8eed4a1b710deb65"
};

// Firebase 초기화
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

console.log('Firebase 연결 완료');
