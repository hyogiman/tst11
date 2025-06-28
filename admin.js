// 관리자 상태
let adminState = {
    isLoggedIn: false,
    currentScreen: 'overview'
};

// 관리자 로그인
async function adminLogin() {
    const adminId = document.getElementById('adminId').value;
    const adminPw = document.getElementById('adminPw').value;

    if (adminId === 'admin' && adminPw === 'admin') {
        adminState.isLoggedIn = true;
        showDashboard();
        loadDashboardData();
    } else {
        alert('잘못된 관리자 정보입니다.');
    }
}

// 대시보드 표시
function showDashboard() {
    document.getElementById('loginScreen').classList.remove('active');
    document.getElementById('overviewScreen').classList.add('active');
    document.getElementById('bottomNav').style.display = 'flex';
}

// 로그아웃
function adminLogout() {
    if (confirm('정말 로그아웃하시겠습니까?')) {
        adminState.isLoggedIn = false;
        adminState.currentScreen = 'overview';
        
        // 모든 화면 숨기기
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        
        document.getElementById('loginScreen').classList.add('active');
        document.getElementById('bottomNav').style.display = 'none';
        
        // 입력 필드 초기화
        document.getElementById('adminId').value = '';
        document.getElementById('adminPw').value = '';
        
        // 네비게이션 초기화
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.getElementById('overviewNavBtn').classList.add('active');
    }
}

// 화면 전환
function showScreen(screenName) {
    console.log('화면 전환:', screenName);
    
    // 모든 화면 숨기기
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    // 선택된 화면 표시
    const targetScreen = document.getElementById(screenName + 'Screen');
    if (targetScreen) {
        targetScreen.classList.add('active');
    }
    
    // 네비게이션 활성화 상태 변경 (해당 버튼이 있는 경우만)
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    const targetNavBtn = document.getElementById(screenName + 'NavBtn');
    if (targetNavBtn) {
        targetNavBtn.classList.add('active');
    }
    
    adminState.currentScreen = screenName;
    
    // 화면별 데이터 로드
    switch (screenName) {
        case 'overview':
            loadOverviewData();
            break;
        case 'createCode':
            loadLoginCodesList();
            break;
        case 'playerManage':
            loadPlayersData();
            break;
        case 'settings':
            loadSettingsData();
            break;
    }
}

// 대시보드 데이터 로드
async function loadDashboardData() {
    await loadOverviewData();
    await loadGameStatus();
}

// 개요 데이터 로드
async function loadOverviewData() {
    try {
        // 생성된 로그인 코드 수
        const loginCodesSnapshot = await db.collection('loginCodes').get();
        const loginCodesCount = loginCodesSnapshot.size;

        // 등록된 플레이어 수
        const registeredSnapshot = await db.collection('registeredUsers').get();
        const registeredCount = registeredSnapshot.size;

        // 활성 플레이어 수
        const activeSnapshot = await db.collection('activePlayers')
            .where('isActive', '==', true)
            .get();
        const activeCount = activeSnapshot.size;

        // 생존/사망자 수
        let aliveCount = 0;
        let deadCount = 0;
        
        activeSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.isAlive) {
                aliveCount++;
            } else {
                deadCount++;
            }
        });

        // UI 업데이트
        document.getElementById('loginCodesCount').textContent = loginCodesCount;
        document.getElementById('registeredCount').textContent = registeredCount;
        document.getElementById('activeCount').textContent = activeCount;
        document.getElementById('aliveCount').textContent = aliveCount;
        document.getElementById('deadCount').textContent = deadCount;

    } catch (error) {
        console.error('개요 데이터 로드 오류:', error);
    }
}

// 게임 상태 로드
async function loadGameStatus() {
    try {
        const gameDoc = await db.collection('gameSettings').doc('gameStatus').get();
        const isActive = gameDoc.exists ? gameDoc.data().isActive : false;

        updateGameStatusUI(isActive);
    } catch (error) {
        console.error('게임 상태 로드 오류:', error);
        updateGameStatusUI(false);
    }
}

// 게임 상태 UI 업데이트
function updateGameStatusUI(isActive) {
    const indicator = document.getElementById('gameStatusIndicator');
    const text = document.getElementById('gameStatusText');

    indicator.className = `status-indicator ${isActive ? 'status-active' : 'status-inactive'}`;
    text.textContent = isActive ? '진행 중' : '중지됨';

    // 버튼 상태 업데이트
    document.getElementById('startGameBtn').disabled = isActive;
    document.getElementById('stopGameBtn').disabled = !isActive;
}

// 게임 시작
async function startGame() {
    try {
        await db.collection('loginCodes').doc(loginCode).delete();
        showAlert('로그인 코드가 삭제되었습니다.', 'success');
        loadLoginCodesList();
        loadOverviewData();

    } catch (error) {
        console.error('로그인 코드 삭제 오류:', error);
        showAlert('로그인 코드 삭제 중 오류가 발생했습니다.', 'error');
    }
}

// 플레이어 데이터 로드 - 수정된 버전
async function loadPlayersData() {
    try {
        const registeredSnapshot = await db.collection('registeredUsers').get();
        const activeSnapshot = await db.collection('activePlayers').get();
        
        // 활성 플레이어 데이터 맵 생성
        const activePlayersMap = {};
        activeSnapshot.forEach(doc => {
            activePlayersMap[doc.id] = doc.data();
        });

        const tbody = document.getElementById('playersTable');
        tbody.innerHTML = '';

        registeredSnapshot.forEach(doc => {
            const userData = doc.data();
            const activeData = activePlayersMap[doc.id];
            
            // 상태 판단 로직 개선
            let statusText = '';
            let statusClass = '';
            let showReviveButton = false;
            
            if (activeData) {
                if (activeData.isActive) {
                    // 접속 중인 상태
                    if (activeData.isAlive) {
                        statusText = '생존';
                        statusClass = 'status-alive';
                    } else {
                        statusText = '사망';
                        statusClass = 'status-dead';
                        showReviveButton = true;
                    }
                } else {
                    // 접속하지 않은 상태
                    if (activeData.isAlive) {
                        statusText = '미접속';
                        statusClass = '';
                    } else {
                        statusText = '사망(미접속)';
                        statusClass = 'status-dead';
                        showReviveButton = true;
                    }
                }
            } else {
                // activePlayers에 기록이 없는 경우
                statusText = '미접속';
                statusClass = '';
            }

            const roleNames = {
                'detective': '탐정',
                'criminal': '범인',
                'merchant': '상인'
            };

            const row = tbody.insertRow();
            row.innerHTML = `
                <td>${doc.id}</td>
                <td>${userData.name}</td>
                <td>${roleNames[userData.role]}</td>
                <td>
                    <span class="${statusClass}" style="color: ${statusClass === 'status-alive' ? '#27ae60' : statusClass === 'status-dead' ? '#e74c3c' : '#6c757d'};">
                        ${statusText}
                    </span>
                </td>
                <td>
                    <button class="btn secondary" onclick="showPlayerDetail('${doc.id}')" style="width: auto; padding: 5px 10px; font-size: 12px;">상세</button>
                    <button class="btn danger" onclick="deletePlayer('${doc.id}')" style="width: auto; padding: 5px 10px; font-size: 12px;">삭제</button>
                    ${showReviveButton ? 
                        `<button class="btn success" onclick="revivePlayer('${doc.id}')" style="width: auto; padding: 5px 10px; font-size: 12px;">부활</button>` : ''
                    }
                </td>
            `;
        });

    } catch (error) {
        console.error('플레이어 데이터 로드 오류:', error);
    }
}

// 플레이어 상세 정보 보기
async function showPlayerDetail(playerId) {
    try {
        const userDoc = await db.collection('registeredUsers').doc(playerId).get();
        const activeDoc = await db.collection('activePlayers').doc(playerId).get();
        
        if (!userDoc.exists) return;

        const userData = userDoc.data();
        const activeData = activeDoc.exists ? activeDoc.data() : null;

        const roleNames = {
            'detective': '탐정',
            'criminal': '범인',
            'merchant': '상인'
        };

        document.getElementById('playerDetailTitle').textContent = `${userData.name} 상세 정보`;
        
        // 상태 판단 로직 개선
        let statusText = '';
        if (activeData) {
            if (activeData.isActive) {
                statusText = activeData.isAlive ? '<span class="status-alive">생존</span>' : '<span class="status-dead">사망</span>';
            } else {
                statusText = activeData.isAlive ? '<span style="color: #6c757d;">미접속</span>' : '<span class="status-dead">사망(미접속)</span>';
            }
        } else {
            statusText = '<span style="color: #6c757d;">미접속</span>';
        }
        
        let html = `
            <div class="player-detail">
                <h3>기본 정보</h3>
                <p><strong>로그인 코드:</strong> ${playerId}</p>
                <p><strong>이름:</strong> ${userData.name}</p>
                <p><strong>직위:</strong> ${userData.position}</p>
                <p><strong>역할:</strong> ${roleNames[userData.role]}</p>
                <p><strong>시크릿 코드:</strong> ${userData.secretCode}</p>
                <p><strong>상태:</strong> ${statusText}</p>
            </div>
        `;

        if (activeData && activeData.results && activeData.results.length > 0) {
            html += `
                <div class="player-detail">
                    <h3>활동 기록 (${activeData.results.length}개)</h3>
            `;

            activeData.results.forEach((result, index) => {
                let actionText = '';
                let actionColor = '#666';

                switch (result.type) {
                    case 'clue':
                    case 'evidence':
                        actionText = `단서 수집: ${result.title}`;
                        actionColor = '#3498db';
                        break;
                    case 'kill':
                        actionText = `제거 대상 확보: ${result.targetName}`;
                        if (result.executed) {
                            actionText += ' (실행됨)';
                            actionColor = '#e74c3c';
                        } else {
                            actionColor = '#f39c12';
                        }
                        break;
                    case 'money':
                        actionText = `거래 완료: +${result.amount}원`;
                        actionColor = '#27ae60';
                        break;
                }

                html += `
                    <div class="activity-item">
                        <div style="color: ${actionColor}; font-weight: 600;">${actionText}</div>
                        <div class="activity-time">${result.timestamp}</div>
                        <div style="margin-top: 5px; font-size: 13px;">${result.content}</div>
                    </div>
                `;
            });

            html += '</div>';
        }

        if (activeData && userData.role === 'merchant' && activeData.money) {
            html += `
                <div class="player-detail">
                    <h3>수익 현황</h3>
                    <p><strong>총 수익:</strong> ${activeData.money}원</p>
                </div>
            `;
        }

        if (activeData && userData.role === 'criminal' && activeData.killCount) {
            html += `
                <div class="player-detail">
                    <h3>제거 현황</h3>
                    <p><strong>제거 횟수:</strong> ${activeData.killCount}/3회</p>
                </div>
            `;
        }

        document.getElementById('playerDetailContent').innerHTML = html;
        
        // 플레이어 상세 화면으로 전환
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById('playerDetailScreen').classList.add('active');

    } catch (error) {
        console.error('플레이어 상세 정보 로드 오류:', error);
    }
}

// 플레이어 삭제
async function deletePlayer(playerId) {
    if (!confirm('정말 이 플레이어를 삭제하시겠습니까? 모든 데이터가 영구적으로 삭제됩니다.')) return;

    try {
        const batch = db.batch();
        
        // 등록된 사용자 삭제
        const userRef = db.collection('registeredUsers').doc(playerId);
        batch.delete(userRef);
        
        // 활성 플레이어 삭제 (있는 경우)
        const activeRef = db.collection('activePlayers').doc(playerId);
        batch.delete(activeRef);
        
        // 로그인 코드 미사용 상태로 변경
        const loginCodeQuery = await db.collection('loginCodes').get();
        loginCodeQuery.forEach(doc => {
            const data = doc.data();
            if (data.usedBy && data.used) {
                // 해당 플레이어가 사용한 로그인 코드를 찾아서 미사용으로 변경
                const userDoc = db.collection('registeredUsers').doc(playerId);
                userDoc.get().then(userSnapshot => {
                    if (userSnapshot.exists && doc.id === playerId) {
                        batch.update(doc.ref, {
                            used: false,
                            usedBy: firebase.firestore.FieldValue.delete(),
                            usedAt: firebase.firestore.FieldValue.delete()
                        });
                    }
                });
            }
        });

        await batch.commit();

        showAlert('플레이어가 삭제되었습니다.', 'success');
        loadPlayersData();
        loadOverviewData();

    } catch (error) {
        console.error('플레이어 삭제 오류:', error);
        showAlert('플레이어 삭제 중 오류가 발생했습니다.', 'error');
    }
}

// 플레이어 부활
async function revivePlayer(playerId) {
    if (!confirm('이 플레이어를 부활시키시겠습니까?')) return;

    try {
        // activePlayers 컬렉션에 해당 플레이어가 있는지 확인
        const activePlayerDoc = await db.collection('activePlayers').doc(playerId).get();
        
        if (activePlayerDoc.exists) {
            // 기존 문서가 있으면 부활시키되 미접속 상태로 설정
            await db.collection('activePlayers').doc(playerId).update({
                isAlive: true,
                isActive: false, // 미접속 상태로 설정
                revivedAt: firebase.firestore.FieldValue.serverTimestamp(),
                revivedBy: 'admin'
            });
        } else {
            // 문서가 없으면 새로 생성 (등록된 사용자 정보 가져와서)
            const userDoc = await db.collection('registeredUsers').doc(playerId).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                await db.collection('activePlayers').doc(playerId).set({
                    name: userData.name,
                    position: userData.position,
                    role: userData.role,
                    secretCode: userData.secretCode,
                    isAlive: true,
                    isActive: false, // 부활시키되 미접속 상태
                    results: [],
                    killCount: 0,
                    money: 0,
                    receivedInteractions: {},
                    revivedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    revivedBy: 'admin'
                });
            }
        }

        loadPlayersData();
        loadOverviewData();
        showAlert('플레이어가 부활되었습니다. (미접속 상태)', 'success');

    } catch (error) {
        console.error('플레이어 부활 오류:', error);
        showAlert('플레이어 부활 중 오류가 발생했습니다.', 'error');
    }
}

// 설정 데이터 로드
async function loadSettingsData() {
    try {
        const settingsDoc = await db.collection('gameSettings').doc('config').get();
        
        if (settingsDoc.exists) {
            const settings = settingsDoc.data();
            document.getElementById('maxKillsSetting').value = settings.maxKills || 3;
            document.getElementById('killTimerSetting').value = settings.killTimer || 180;
        }

    } catch (error) {
        console.error('설정 데이터 로드 오류:', error);
    }
}

// 설정 저장
async function saveSettings() {
    try {
        const maxKills = parseInt(document.getElementById('maxKillsSetting').value);
        const killTimer = parseInt(document.getElementById('killTimerSetting').value);

        await db.collection('gameSettings').doc('config').set({
            maxKills: maxKills,
            killTimer: killTimer,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: 'admin'
        });

        showAlert('설정이 저장되었습니다.', 'success');

    } catch (error) {
        console.error('설정 저장 오류:', error);
        showAlert('설정 저장 중 오류가 발생했습니다.', 'error');
    }
}

// 플레이어 목록으로 돌아가기
function backToPlayers() {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById('playerManageScreen').classList.add('active');
    
    // 네비게이션 상태 복원
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    document.getElementById('playerManageNavBtn').classList.add('active');
    
    adminState.currentScreen = 'playerManage';
}

// 알림 표시
function showAlert(message, type = 'success') {
    // 기존 알림 제거
    const existingAlert = document.querySelector('.alert');
    if (existingAlert) {
        existingAlert.remove();
    }

    // 새 알림 생성
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;

    // 현재 활성 화면의 맨 위에 추가
    const activeScreen = document.querySelector('.screen.active');
    if (activeScreen) {
        activeScreen.insertBefore(alert, activeScreen.firstChild);
    }

    // 3초 후 자동 제거
    setTimeout(() => {
        if (alert.parentNode) {
            alert.remove();
        }
    }, 3000);
}

// 실시간 데이터 감지 설정
function setupRealtimeListeners() {
    // 게임 상태 실시간 감지
    db.collection('gameSettings').doc('gameStatus')
        .onSnapshot((doc) => {
            if (doc.exists) {
                const isActive = doc.data().isActive;
                updateGameStatusUI(isActive);
            }
        });

    // 플레이어 데이터 실시간 감지
    db.collection('activePlayers')
        .onSnapshot(() => {
            if (adminState.currentScreen === 'playerManage') {
                loadPlayersData();
            }
            if (adminState.currentScreen === 'overview') {
                loadOverviewData();
            }
        });
}

// 초기화
document.addEventListener('DOMContentLoaded', function() {
    console.log('관리자 페이지 로드 완료');

    // 로그인 버튼
    document.getElementById('loginBtn').addEventListener('click', adminLogin);
    
    // Enter 키로 로그인
    document.getElementById('adminPw').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            adminLogin();
        }
    });

    // 네비게이션 버튼들
    document.getElementById('overviewNavBtn').addEventListener('click', () => showScreen('overview'));
    document.getElementById('createCodeNavBtn').addEventListener('click', () => showScreen('createCode'));
    document.getElementById('playerManageNavBtn').addEventListener('click', () => showScreen('playerManage'));
    document.getElementById('settingsNavBtn').addEventListener('click', () => showScreen('settings'));

    // 게임 제어 버튼들
    document.getElementById('startGameBtn').addEventListener('click', startGame);
    document.getElementById('stopGameBtn').addEventListener('click', stopGame);
    document.getElementById('resetGameBtn').addEventListener('click', resetGame);

    // 로그인 코드 생성
    document.getElementById('createCodeBtn').addEventListener('click', createLoginCode);

    // 입력 필드 이벤트
    document.getElementById('newLoginCode').addEventListener('input', function(e) {
        e.target.value = e.target.value.toUpperCase();
    });
    
    document.getElementById('newSecretCode').addEventListener('input', function(e) {
        e.target.value = e.target.value.toUpperCase();
    });

    // 플레이어 상세에서 돌아가기
    document.getElementById('backToPlayersBtn').addEventListener('click', backToPlayers);

    // 설정 저장
    document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);

    // 로그아웃
    document.getElementById('logoutBtn').addEventListener('click', adminLogout);

    // 실시간 리스너 설정
    setupRealtimeListeners();
}); db.collection('gameSettings').doc('gameStatus').set({
            isActive: true,
            startedAt: firebase.firestore.FieldValue.serverTimestamp(),
            startedBy: 'admin'
        });

        updateGameStatusUI(true);
        showAlert('게임이 시작되었습니다.', 'success');
        
    } catch (error) {
        console.error('게임 시작 오류:', error);
        showAlert('게임 시작 중 오류가 발생했습니다.', 'error');
    }
}

// 게임 중지
async function stopGame() {
    if (!confirm('정말 게임을 중지하시겠습니까?')) return;

    try {
        await db.collection('gameSettings').doc('gameStatus').set({
            isActive: false,
            stoppedAt: firebase.firestore.FieldValue.serverTimestamp(),
            stoppedBy: 'admin'
        });

        updateGameStatusUI(false);
        showAlert('게임이 중지되었습니다.', 'warning');
        
    } catch (error) {
        console.error('게임 중지 오류:', error);
        showAlert('게임 중지 중 오류가 발생했습니다.', 'error');
    }
}

// 게임 초기화
async function resetGame() {
    if (!confirm('정말 게임을 초기화하시겠습니까? 모든 플레이어 데이터가 삭제됩니다.')) return;

    try {
        // 활성 플레이어 모두 삭제
        const activeSnapshot = await db.collection('activePlayers').get();
        const batch = db.batch();
        
        activeSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();

        // 게임 상태 중지
        await db.collection('gameSettings').doc('gameStatus').set({
            isActive: false,
            resetAt: firebase.firestore.FieldValue.serverTimestamp(),
            resetBy: 'admin'
        });

        updateGameStatusUI(false);
        loadDashboardData(); // 데이터 새로고침
        showAlert('게임이 초기화되었습니다.', 'success');
        
    } catch (error) {
        console.error('게임 초기화 오류:', error);
        showAlert('게임 초기화 중 오류가 발생했습니다.', 'error');
    }
}

// 로그인 코드 생성
async function createLoginCode() {
    const loginCode = document.getElementById('newLoginCode').value.toUpperCase();
    const role = document.getElementById('newCodeRole').value;
    const secretCode = document.getElementById('newSecretCode').value.toUpperCase();
    const secretTitle = document.getElementById('newSecretTitle').value;
    const secretContent = document.getElementById('newSecretContent').value;

    if (!loginCode || !secretCode || !secretTitle || !secretContent) {
        alert('모든 필드를 입력해주세요.');
        return;
    }

    if (loginCode.length !== 4 || secretCode.length !== 4) {
        alert('로그인 코드와 시크릿 코드는 4자리여야 합니다.');
        return;
    }

    try {
        // 중복 확인
        const existingCodeDoc = await db.collection('loginCodes').doc(loginCode).get();
        if (existingCodeDoc.exists) {
            alert('이미 존재하는 로그인 코드입니다.');
            return;
        }

        // 로그인 코드 생성
        await db.collection('loginCodes').doc(loginCode).set({
            role: role,
            secretCode: secretCode,
            secretTitle: secretTitle,
            secretContent: secretContent,
            used: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: 'admin'
        });

        // 입력 필드 초기화
        document.getElementById('newLoginCode').value = '';
        document.getElementById('newSecretCode').value = '';
        document.getElementById('newSecretTitle').value = '';
        document.getElementById('newSecretContent').value = '';

        showAlert('로그인 코드가 생성되었습니다.', 'success');
        loadLoginCodesList();
        loadOverviewData();

    } catch (error) {
        console.error('로그인 코드 생성 오류:', error);
        showAlert('로그인 코드 생성 중 오류가 발생했습니다.', 'error');
    }
}

// 로그인 코드 목록 로드
async function loadLoginCodesList() {
    try {
        const loginCodesSnapshot = await db.collection('loginCodes').orderBy('createdAt', 'desc').get();
        const container = document.getElementById('loginCodesList');
        
        if (loginCodesSnapshot.empty) {
            container.innerHTML = '<p style="text-align: center; color: #666;">생성된 로그인 코드가 없습니다.</p>';
            return;
        }

        let html = '';
        loginCodesSnapshot.forEach(doc => {
            const data = doc.data();
            const roleNames = {
                'detective': '탐정',
                'criminal': '범인',
                'merchant': '상인'
            };

            html += `
                <div class="list-item">
                    <div class="list-item-header">
                        <div class="list-item-title">${doc.id} - ${roleNames[data.role]}</div>
                        <button class="btn danger" onclick="deleteLoginCode('${doc.id}')" style="width: auto; padding: 5px 10px; font-size: 12px;">삭제</button>
                    </div>
                    <div class="list-item-subtitle">시크릿 코드: ${data.secretCode}</div>
                    <div class="list-item-subtitle">제목: ${data.secretTitle || '제목 없음'}</div>
                    <div class="list-item-subtitle">상태: ${data.used ? '사용됨' : '미사용'}</div>
                    <div style="margin-top: 8px; font-size: 14px; color: #555;">${data.secretContent}</div>
                </div>
            `;
        });

        container.innerHTML = html;

    } catch (error) {
        console.error('로그인 코드 목록 로드 오류:', error);
    }
}

// 로그인 코드 삭제
async function deleteLoginCode(loginCode) {
    if (!confirm('정말 이 로그인 코드를 삭제하시겠습니까?')) return;

    try {
        await
