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

// 🆕 Firestore와 Storage 초기화
const db = firebase.firestore();
const storage = firebase.storage();

console.log('Firebase 연결 완료 (Firestore + Storage)');

// 🆕 Storage 참조 생성 헬퍼 함수
function getStorageRef(path) {
    return storage.ref(path);
}

// 🆕 이미지 업로드 헬퍼 함수
async function uploadImageToStorage(file, folder) {
    try {
        // 파일 크기 체크 (5MB 제한)
        if (file.size > 5 * 1024 * 1024) {
            throw new Error('이미지 크기는 5MB 이하로 선택해주세요.');
        }
        
        // 허용된 이미지 타입 체크
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            throw new Error('JPG, PNG, GIF, WebP 형식의 이미지만 업로드 가능합니다.');
        }
        
        // 고유한 파일명 생성
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substr(2, 9);
        const fileExtension = file.name.split('.').pop();
        const fileName = `${folder}/${timestamp}_${randomId}.${fileExtension}`;
        
        // Storage 참조 생성
        const storageRef = storage.ref().child(fileName);
        
        console.log('이미지 업로드 시작:', fileName);
        
        // 이미지 업로드
        const snapshot = await storageRef.put(file);
        
        // 다운로드 URL 가져오기
        const downloadURL = await snapshot.ref.getDownloadURL();
        
        console.log('이미지 업로드 완료:', downloadURL);
        
        return {
            url: downloadURL,
            path: fileName,
            size: file.size,
            type: file.type,
            originalName: file.name
        };
        
    } catch (error) {
        console.error('이미지 업로드 오류:', error);
        throw error;
    }
}

// 🆕 이미지 삭제 헬퍼 함수
async function deleteImageFromStorage(imagePath) {
    try {
        if (!imagePath) return;
        
        const storageRef = storage.ref().child(imagePath);
        await storageRef.delete();
        
        console.log('이미지 삭제 완료:', imagePath);
        
    } catch (error) {
        console.error('이미지 삭제 오류:', error);
        // 이미지 삭제 실패는 치명적이지 않으므로 에러를 던지지 않음
    }
}
