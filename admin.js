// 관리자 상태
let adminState = {
    isLoggedIn: false,
    currentSection: 'overview',
    editingPlayer: null
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
    document.getElementById('loginSection').classList.remove('active');
    document.getElementById('dashboardSection').classList.add('active');
}

// 로그아웃
function adminLogout() {
    if (confirm('정말 로그아웃하시겠습니까?')) {
        adminState.isLoggedIn = false;
        adminState.currentSection = 'overview';
        
        document.getElementById('dashboardSection').classList.remove('active');
        document.getElementById('loginSection').classList.add('active');
        
        // 입력 필드 초기화
        document.getElementById('adminId').value = '';
        document.getElementById('adminPw').value = '';
    }
}

// 메뉴 전환
function switchSection(sectionName) {
    // 사이드바 메뉴 활성화 상태 변경
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');

    // 콘텐츠 섹션 전환
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(sectionName).classList.add('active');

    adminState.currentSection = sectionName;

    // 섹션별 데이터 로드
    switch (sectionName) {
        case 'overview':
            loadOverviewData();
            break;
        case 'gameControl':
            loadGameControlData();
            break;
        case 'playerManage':
            loadPlayersData();
            break;
        case 'secretCodes':
            loadSecretCodesData();
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
    const indicators = document.querySelectorAll('#gameStatusIndicator, #gameStatusIndicator2');
    const texts = document.querySelectorAll('#gameStatusText, #gameStatusText2');

    indicators.forEach(indicator => {
        indicator.className = `status-indicator ${isActive ? 'status-active' : 'status-inactive'}`;
    });

    texts.forEach(text => {
        text.textContent = isActive ? '진행 중' : '중지됨';
    });

    // 버튼 상태 업데이트
    document.getElementById('startGameBtn').disabled = isActive;
    document.getElementById('stopGameBtn').disabled = !isActive;
}

// 게임 제어 데이터 로드
async function loadGameControlData() {
    await loadGameStatus();
}

// 게임 시작
async function startGame() {
    try {
        await db.collection('gameSettings').doc('gameStatus').set({
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

// 플레이어 데이터 로드
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
            const isActive = activeData && activeData.isActive;
            const isAlive = activeData ? activeData.isAlive : true;

            const row = tbody.insertRow();
            row.innerHTML = `
                <td>${doc.id}</td>
                <td>${userData.name}</td>
                <td>${userData.position}</td>
                <td>${getRoleDisplayName(userData.role)}</td>
                <td>${userData.secretCode}</td>
                <td>
                    ${isActive ? 
                        `<span class="${isAlive ? 'status-alive' : 'status-dead'}">${isAlive ? '생존' : '사망'}</span>` : 
                        '<span style="color: #6c757d;">미접속</span>'
                    }
                </td>
                <td>
                    <button class="btn secondary" onclick="editPlayer('${doc.id}')">편집</button>
                    ${!isAlive && isActive ? 
                        `<button class="btn success" onclick="revivePlayer('${doc.id}')">부활</button>` : ''
                    }
                </td>
            `;
        });

    } catch (error) {
        console.error('플레이어 데이터 로드 오류:', error);
    }
}

// 역할 한글명 반환
function getRoleDisplayName(role) {
    const roleNames = {
        'detective': '탐정',
        'criminal': '범인',
        'merchant': '상인'
    };
    return roleNames[role] || role;
}

// 플레이어 편집
async function editPlayer(playerId) {
    try {
        const userDoc = await db.collection('registeredUsers').doc(playerId).get();
        const activeDoc = await db.collection('activePlayers').doc(playerId).get();
        
        if (!userDoc.exists) return;

        const userData = userDoc.data();
        const activeData = activeDoc.exists ? activeDoc.data() : null;

        // 모달에 데이터 채우기
        document.getElementById('editPlayerName').value = userData.name;
        document.getElementById('editPlayerPosition').value = userData.position;
        document.getElementById('editPlayerSecretCode').value = userData.secretCode;
        document.getElementById('editPlayerStatus').value = activeData ? activeData.isAlive.toString() : 'true';

        adminState.editingPlayer = playerId;
        document.getElementById('editPlayerModal').style.display = 'block';

    } catch (error) {
        console.error('플레이어 편집 데이터 로드 오류:', error);
    }
}

// 플레이어 정보 저장
async function savePlayer() {
    if (!adminState.editingPlayer) return;

    try {
        const playerId = adminState.editingPlayer;
        const name = document.getElementById('editPlayerName').value;
        const position = document.getElementById('editPlayerPosition').value;
        const secretCode = document.getElementById('editPlayerSecretCode').value.toUpperCase();
        const isAlive = document.getElementById('editPlayerStatus').value === 'true';

        // 등록된 사용자 정보 업데이트
        await db.collection('registeredUsers').doc(playerId).update({
            name: name,
            position: position,
            secretCode: secretCode
        });

        // 활성 플레이어 정보 업데이트 (있는 경우)
        const activeDoc = await db.collection('activePlayers').doc(playerId).get();
        if (activeDoc.exists) {
            await db.collection('activePlayers').doc(playerId).update({
                name: name,
                position: position,
                secretCode: secretCode,
                isAlive: isAlive
            });
        }

        closeEditModal();
        loadPlayersData();
        showAlert('플레이어 정보가 업데이트되었습니다.', 'success');

    } catch (error) {
        console.error('플레이어 저장 오류:', error);
        showAlert('플레이어 정보 저장 중 오류가 발생했습니다.', 'error');
    }
}

// 플레이어 부활
async function revivePlayer(playerId) {
    if (!confirm('이 플레이어를 부활시키시겠습니까?')) return;

    try {
        await db.collection('activePlayers').doc(playerId).update({
            isAlive: true,
            revivedAt: firebase.firestore.FieldValue.serverTimestamp(),
            revivedBy: 'admin'
        });

        loadPlayersData();
        loadOverviewData();
        showAlert('플레이어가 부활되었습니다.', 'success');

    } catch (error) {
        console.error('플레이어 부활 오류:', error);
        showAlert('플레이어 부활 중 오류가 발생했습니다.', 'error');
    }
}

// 시크릿 코드 데이터 로드
async function loadSecretCodesData() {
    try {
        const secretCodesDoc = await db.collection('gameSettings').doc('secretCodesInfo').get();
        const secretCodesInfo = secretCodesDoc.exists ? secretCodesDoc.data() : {};

        const container = document.getElementById('secretCodesContainer');
        container.innerHTML = '';

        // 모든 역할의 시크릿 코드 표시
        const roles = ['detective', 'criminal', 'merchant'];
        const roleNames = {
            'detective': '탐정',
            'criminal': '범인', 
            'merchant': '상인'
        };

        roles.forEach(role => {
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <h4>${roleNames[role]} 시크릿 코드</h4>
                <div id="${role}Codes"></div>
            `;
            container.appendChild(card);

            // 각 역할별 시크릿 코드 표시
            const codesContainer = document.getElementById(`${role}Codes`);
            
            // 기본 시크릿 코드들
            const defaultCodes = {
                'detective': ['DT01', 'DT02', 'DT03', 'DT04', 'DT05'],
                'criminal': ['CR01', 'CR02', 'CR03', 'CR04', 'CR05'],
                'merchant': ['MC01', 'MC02', 'MC03', 'MC04', 'MC05']
            };

            defaultCodes[role].forEach(code => {
                const codeDiv = document.createElement('div');
                codeDiv.className = 'input-group';
                
                const currentInfo = secretCodesInfo[code] || { title: '', content: '' };
                
                codeDiv.innerHTML = `
                    <strong style="min-width: 60px;">${code}:</strong>
                    <input type="text" placeholder="제목" value="${currentInfo.title}" 
                           onchange="updateSecretCodeInfo('${code}', 'title', this.value)">
                    <input type="text" placeholder="내용" value="${currentInfo.content}" 
                           onchange="updateSecretCodeInfo('${code}', 'content', this.value)">
                `;
                codesContainer.appendChild(codeDiv);
            });
        });

    } catch (error) {
        console.error('시크릿 코드 데이터 로드 오류:', error);
    }
}

// 시크릿 코드 정보 업데이트
async function updateSecretCodeInfo(code, field, value) {
    try {
        const docRef = db.collection('gameSettings').doc('secretCodesInfo');
        const doc = await docRef.get();
        const currentData = doc.exists ? doc.data() : {};

        if (!currentData[code]) {
            currentData[code] = { title: '', content: '' };
        }

        currentData[code][field] = value;

        await docRef.set(currentData);
        console.log(`시크릿 코드 ${code} ${field} 업데이트됨:`, value);

    } catch (error) {
        console.error('시크릿 코드 정보 업데이트 오류:', error);
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

        await db.collection('gameSettings').doc('config').update({
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

// 모달 관련 함수들
function closeEditModal() {
    document.getElementById('editPlayerModal').style.display = 'none';
    adminState.editingPlayer = null;
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

    // 현재 활성 섹션의 맨 위에 추가
    const activeSection = document.querySelector('.content-section.active');
    if (activeSection) {
        activeSection.insertBefore(alert, activeSection.firstChild);
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
    if (adminState.currentSection === 'playerManage') {
        db.collection('activePlayers')
            .onSnapshot(() => {
                loadPlayersData();
                loadOverviewData();
            });
    }
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

    // 로그아웃 버튼
    document.getElementById('logoutBtn').addEventListener('click', adminLogout);

    // 메뉴 항목들
    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const section = this.getAttribute('data-section');
            if (section) {
                switchSection(section);
            }
        });
    });

    // 게임 제어 버튼들
    document.getElementById('startGameBtn').addEventListener('click', startGame);
    document.getElementById('stopGameBtn').addEventListener('click', stopGame);
    document.getElementById('resetGameBtn').addEventListener('click', resetGame);

    // 플레이어 관리 버튼들
    document.getElementById('savePlayerBtn').addEventListener('click', savePlayer);
    document.getElementById('cancelEditBtn').addEventListener('click', closeEditModal);
    document.getElementById('closeEditModal').addEventListener('click', closeEditModal);

    // 설정 저장 버튼
    document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);

    // 모달 외부 클릭 시 닫기
    window.addEventListener('click', function(e) {
        const modal = document.getElementById('editPlayerModal');
        if (e.target === modal) {
            closeEditModal();
        }
    });

    // 실시간 리스너 설정
    setupRealtimeListeners();
});
