// 관리자 상태
let adminState = {
    isLoggedIn: false,
    currentScreen: 'overview'
};

// 관리자 로그인
async function adminLogin() {
    const adminId = document.getElementById('adminId').value;
    const adminPw = document.getElementById('adminPw').value;

    if (adminId === 'admin' && adminPw === 'dlsgur12!@') {
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
    
    // 네비게이션 활성화 상태 변경
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
        case 'merchantRanking':  // 새로 추가
            loadMerchantRankingData();
            break;
        case 'notices':
            loadNoticesData();
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
        const loginCodesSnapshot = await db.collection('loginCodes').get();
        const loginCodesCount = loginCodesSnapshot.size;

        const registeredSnapshot = await db.collection('registeredUsers').get();
        const registeredCount = registeredSnapshot.size;

        const activeSnapshot = await db.collection('activePlayers')
            .where('isActive', '==', true)
            .get();
        const activeCount = activeSnapshot.size;

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

    indicator.className = 'status-indicator ' + (isActive ? 'status-active' : 'status-inactive');
    text.textContent = isActive ? '진행 중' : '중지됨';

    document.getElementById('startGameBtn').disabled = isActive;
    document.getElementById('stopGameBtn').disabled = !isActive;
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
        const activeSnapshot = await db.collection('activePlayers').get();
        const batch = db.batch();
        
        activeSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();

        await db.collection('gameSettings').doc('gameStatus').set({
            isActive: false,
            resetAt: firebase.firestore.FieldValue.serverTimestamp(),
            resetBy: 'admin'
        });

        updateGameStatusUI(false);
        loadDashboardData();
        showAlert('게임이 초기화되었습니다.', 'success');
    } catch (error) {
        console.error('게임 초기화 오류:', error);
        showAlert('게임 초기화 중 오류가 발생했습니다.', 'error');
    }
}

// 로그인 코드 생성/수정 관련 변수
let editingCodeId = null;

// 로그인 코드 생성 또는 수정
async function createOrUpdateLoginCode() {
    const loginCode = document.getElementById('newLoginCode').value.toUpperCase();
    const role = document.getElementById('newCodeRole').value;
    const secretCode = document.getElementById('newSecretCode').value.toUpperCase();
    const secretTitle = document.getElementById('newSecretTitle').value;
    const secretContent = document.getElementById('newSecretContent').value;
    const interactionMission = document.getElementById('newInteractionMission').value;

    if (!loginCode || !secretCode || !secretTitle || !secretContent || !interactionMission) {
        alert('모든 필드를 입력해주세요.');
        return;
    }

    if (loginCode.length !== 4 || secretCode.length !== 4) {
        alert('로그인 코드와 시크릿 코드는 4자리여야 합니다.');
        return;
    }

    try {
        // 수정 모드가 아닌 경우에만 중복 검사
        if (!editingCodeId) {
            const existingCodeDoc = await db.collection('loginCodes').doc(loginCode).get();
            if (existingCodeDoc.exists) {
                alert('이미 존재하는 로그인 코드입니다.');
                return;
            }
        }

        const codeData = {
            role: role,
            secretCode: secretCode,
            secretTitle: secretTitle,
            secretContent: secretContent,
            interactionMission: interactionMission,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: 'admin'
        };

        if (editingCodeId) {
            // 수정 모드
            if (editingCodeId !== loginCode) {
                // 로그인 코드가 변경된 경우
                const existingCodeDoc = await db.collection('loginCodes').doc(loginCode).get();
                if (existingCodeDoc.exists) {
                    alert('변경하려는 로그인 코드가 이미 존재합니다.');
                    return;
                }
                
                // 기존 문서 삭제하고 새 문서 생성
                await db.collection('loginCodes').doc(editingCodeId).delete();
                
                // 기존 데이터에서 used 정보 가져오기
                const oldDoc = await db.collection('loginCodes').doc(editingCodeId).get();
                if (oldDoc.exists) {
                    const oldData = oldDoc.data();
                    codeData.used = oldData.used || false;
                    codeData.usedBy = oldData.usedBy || null;
                    codeData.usedAt = oldData.usedAt || null;
                    codeData.createdAt = oldData.createdAt || firebase.firestore.FieldValue.serverTimestamp();
                } else {
                    codeData.used = false;
                    codeData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                }
                
                await db.collection('loginCodes').doc(loginCode).set(codeData);
                
                // 기존 사용자 데이터도 업데이트 (로그인 코드가 변경된 경우)
                await updateUserDataAfterCodeChange(editingCodeId, loginCode, codeData);
                
                showAlert('로그인 코드가 수정되었습니다.', 'success');
            } else {
                // 로그인 코드는 그대로, 다른 필드만 수정
                await db.collection('loginCodes').doc(loginCode).update(codeData);
                
                // 기존 사용자 데이터도 업데이트 (같은 로그인 코드)
                await updateUserDataAfterCodeChange(loginCode, loginCode, codeData);
                
                showAlert('로그인 코드가 수정되었습니다.', 'success');
            }
        } else {
            // 생성 모드
            codeData.used = false;
            codeData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            codeData.createdBy = 'admin';
            
            await db.collection('loginCodes').doc(loginCode).set(codeData);
            showAlert('로그인 코드가 생성되었습니다.', 'success');
        }

        // 폼 초기화 및 수정 모드 해제
        resetCodeForm();
        loadLoginCodesList();
        loadOverviewData();

    } catch (error) {
        console.error('로그인 코드 처리 오류:', error);
        showAlert('처리 중 오류가 발생했습니다.', 'error');
    }
}

// 코드 수정 후 사용자 데이터 업데이트
async function updateUserDataAfterCodeChange(oldLoginCode, newLoginCode, newCodeData) {
    try {
        const batch = db.batch();
        
        // 1. registeredUsers 컬렉션 업데이트
        const registeredUserDoc = await db.collection('registeredUsers').doc(oldLoginCode).get();
        if (registeredUserDoc.exists) {
            const userData = registeredUserDoc.data();
            
            // 새로운 데이터로 업데이트
            const updatedUserData = {
                ...userData,
                role: newCodeData.role,
                secretCode: newCodeData.secretCode,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            if (oldLoginCode !== newLoginCode) {
                // 로그인 코드가 변경된 경우: 기존 문서 삭제하고 새 문서 생성
                batch.delete(db.collection('registeredUsers').doc(oldLoginCode));
                batch.set(db.collection('registeredUsers').doc(newLoginCode), updatedUserData);
            } else {
                // 같은 로그인 코드: 기존 문서 업데이트
                batch.update(db.collection('registeredUsers').doc(oldLoginCode), {
                    role: newCodeData.role,
                    secretCode: newCodeData.secretCode,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        }
        
        // 2. activePlayers 컬렉션 업데이트
        const activePlayerDoc = await db.collection('activePlayers').doc(oldLoginCode).get();
        if (activePlayerDoc.exists) {
            const playerData = activePlayerDoc.data();
            
            // 새로운 데이터로 업데이트
            const updatedPlayerData = {
                ...playerData,
                role: newCodeData.role,
                secretCode: newCodeData.secretCode,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            if (oldLoginCode !== newLoginCode) {
                // 로그인 코드가 변경된 경우: 기존 문서 삭제하고 새 문서 생성
                batch.delete(db.collection('activePlayers').doc(oldLoginCode));
                batch.set(db.collection('activePlayers').doc(newLoginCode), updatedPlayerData);
            } else {
                // 같은 로그인 코드: 기존 문서 업데이트
                batch.update(db.collection('activePlayers').doc(oldLoginCode), {
                    role: newCodeData.role,
                    secretCode: newCodeData.secretCode,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        }
        
        // 배치 커밋
        await batch.commit();
        
        console.log('사용자 데이터 업데이트 완료:', oldLoginCode, '->', newLoginCode);
        
    } catch (error) {
        console.error('사용자 데이터 업데이트 오류:', error);
        throw error;
    }
}
async function editLoginCode(loginCodeId) {
    try {
        const doc = await db.collection('loginCodes').doc(loginCodeId).get();
        if (!doc.exists) {
            alert('로그인 코드를 찾을 수 없습니다.');
            return;
        }

        const data = doc.data();
        
        // 폼에 기존 데이터 입력
        document.getElementById('newLoginCode').value = loginCodeId;
        document.getElementById('newCodeRole').value = data.role;
        document.getElementById('newSecretCode').value = data.secretCode;
        document.getElementById('newSecretTitle').value = data.secretTitle || '';
        document.getElementById('newSecretContent').value = data.secretContent || '';
        document.getElementById('newInteractionMission').value = data.interactionMission || '';

        // 수정 모드로 전환
        editingCodeId = loginCodeId;
        document.getElementById('codeFormTitle').textContent = '로그인 코드 수정';
        document.getElementById('createCodeBtn').textContent = '수정 완료';
        document.getElementById('cancelEditBtn').style.display = 'inline-block';

        // 폼 영역으로 스크롤
        document.getElementById('codeFormTitle').scrollIntoView({ behavior: 'smooth' });

    } catch (error) {
        console.error('로그인 코드 수정 시작 오류:', error);
        alert('수정 중 오류가 발생했습니다.');
    }
}

// 수정 취소
function cancelEdit() {
    resetCodeForm();
}

// 폼 초기화
function resetCodeForm() {
    editingCodeId = null;
    document.getElementById('codeFormTitle').textContent = '새 로그인 코드 생성';
    document.getElementById('createCodeBtn').textContent = '코드 생성';
    document.getElementById('cancelEditBtn').style.display = 'none';
    
    document.getElementById('newLoginCode').value = '';
    document.getElementById('newCodeRole').value = 'detective';
    document.getElementById('newSecretCode').value = '';
    document.getElementById('newSecretTitle').value = '';
    document.getElementById('newSecretContent').value = '';
    document.getElementById('newInteractionMission').value = '';
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

            html += '<div class="list-item">';
            html += '<div class="list-item-header">';
            html += '<div class="list-item-title">' + doc.id + ' - ' + roleNames[data.role] + '</div>';
            html += '<div>';
            html += '<button class="btn warning" onclick="editLoginCode(\'' + doc.id + '\')" style="width: auto; padding: 5px 10px; font-size: 12px; margin-right: 5px;">수정</button>';
            html += '<button class="btn danger" onclick="deleteLoginCode(\'' + doc.id + '\')" style="width: auto; padding: 5px 10px; font-size: 12px;">삭제</button>';
            html += '</div>';
            html += '</div>';
            html += '<div class="list-item-subtitle">시크릿 코드: ' + data.secretCode + '</div>';
            html += '<div class="list-item-subtitle">제목: ' + (data.secretTitle || '제목 없음') + '</div>';
            html += '<div class="list-item-subtitle">상호작용 미션: ' + (data.interactionMission || '미션 없음') + '</div>';
            html += '<div class="list-item-subtitle">상태: ' + (data.used ? '사용됨' : '미사용') + '</div>';
            html += '<div style="margin-top: 8px; font-size: 14px; color: #555;">' + data.secretContent + '</div>';
            html += '</div>';
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
        await db.collection('loginCodes').doc(loginCode).delete();
        showAlert('로그인 코드가 삭제되었습니다.', 'success');
        loadLoginCodesList();
        loadOverviewData();
    } catch (error) {
        console.error('로그인 코드 삭제 오류:', error);
        showAlert('로그인 코드 삭제 중 오류가 발생했습니다.', 'error');
    }
}

// 플레이어 데이터 로드
async function loadPlayersData() {
    try {
        const registeredSnapshot = await db.collection('registeredUsers').get();
        const activeSnapshot = await db.collection('activePlayers').get();
        
        const activePlayersMap = {};
        activeSnapshot.forEach(doc => {
            activePlayersMap[doc.id] = doc.data();
        });

        const tbody = document.getElementById('playersTable');
        tbody.innerHTML = '';

        registeredSnapshot.forEach(doc => {
            const userData = doc.data();
            const activeData = activePlayersMap[doc.id];
            
            let statusText = '';
            let statusClass = '';
            let showReviveButton = false;
            let showPunishButton = false;
            
            if (activeData) {
                if (activeData.isActive) {
                    if (activeData.isAlive) {
                        statusText = '생존';
                        statusClass = 'status-alive';
                        showPunishButton = true; // 생존 상태일 때만 징벌 가능
                    } else {
                        statusText = '사망';
                        statusClass = 'status-dead';
                        showReviveButton = true;
                    }
                } else {
                    if (activeData.isAlive) {
                        statusText = '미접속';
                        statusClass = '';
                        showPunishButton = true; // 미접속이지만 생존 상태면 징벌 가능
                    } else {
                        statusText = '사망(미접속)';
                        statusClass = 'status-dead';
                        showReviveButton = true;
                    }
                }
            } else {
                statusText = '미접속';
                statusClass = '';
                // activeData가 없으면 징벌 불가 (아직 게임에 참여하지 않음)
            }

            const roleNames = {
                'detective': '탐정',
                'criminal': '범인',
                'merchant': '상인'
            };

            const row = tbody.insertRow();
            let html = '<td>' + doc.id + '</td>';
            html += '<td>' + userData.name + '</td>';
            html += '<td>' + roleNames[userData.role] + '</td>';
            html += '<td>';
            html += '<span class="' + statusClass + '" style="color: ';
            if (statusClass === 'status-alive') {
                html += '#27ae60';
            } else if (statusClass === 'status-dead') {
                html += '#e74c3c';
            } else {
                html += '#6c757d';
            }
            html += ';">' + statusText + '</span>';
            html += '</td>';
            html += '<td>';
            html += '<button class="btn secondary" onclick="showPlayerDetail(\'' + doc.id + '\')" style="width: auto; padding: 5px 10px; font-size: 12px; margin-right: 5px;">상세</button>';
            
            // 🆕 징벌 버튼 추가 (생존 상태일 때만)
            if (showPunishButton) {
                html += '<button class="btn punish" onclick="punishPlayer(\'' + doc.id + '\', \'' + userData.name + '\')" style="width: auto; padding: 5px 10px; font-size: 12px; margin-right: 5px;">징벌</button>';
            }
            
            // 부활 버튼 (사망 상태일 때만)
            if (showReviveButton) {
                html += '<button class="btn success" onclick="revivePlayer(\'' + doc.id + '\')" style="width: auto; padding: 5px 10px; font-size: 12px; margin-right: 5px;">부활</button>';
            }
            
            html += '<button class="btn danger" onclick="deletePlayer(\'' + doc.id + '\')" style="width: auto; padding: 5px 10px; font-size: 12px;">삭제</button>';
            html += '</td>';
            row.innerHTML = html;
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

        document.getElementById('playerDetailTitle').textContent = userData.name + ' 상세 정보';
        
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
        
        let html = '<div class="player-detail">';
        html += '<h3>기본 정보</h3>';
        html += '<p><strong>로그인 코드:</strong> ' + playerId + '</p>';
        html += '<p><strong>이름:</strong> ' + userData.name + '</p>';
        html += '<p><strong>직위:</strong> ' + userData.position + '</p>';
        html += '<p><strong>역할:</strong> ' + roleNames[userData.role] + '</p>';
        html += '<p><strong>시크릿 코드:</strong> ' + userData.secretCode + '</p>';
        html += '<p><strong>상태:</strong> ' + statusText + '</p>';
        html += '</div>';

        if (activeData && activeData.results && activeData.results.length > 0) {
            html += '<div class="player-detail"><h3>활동 기록 (' + activeData.results.length + '개)</h3>';

            activeData.results.forEach(function(result, index) {
                let actionText = '';
                let actionColor = '#666';

                switch (result.type) {
                    case 'clue':
                    case 'evidence':
                        actionText = '단서 수집: ' + result.title;
                        actionColor = '#3498db';
                        break;
                    case 'kill':
                        actionText = '제거 대상 확보: ' + result.targetName;
                        if (result.executed) {
                            actionText += ' (실행됨)';
                            actionColor = '#e74c3c';
                        } else {
                            actionColor = '#f39c12';
                        }
                        break;
                    case 'money':
                        actionText = '거래 완료: +' + result.amount + '원';
                        actionColor = '#27ae60';
                        break;
                }

                html += '<div class="activity-item">';
                html += '<div style="color: ' + actionColor + '; font-weight: 600;">' + actionText + '</div>';
                html += '<div class="activity-time">' + result.timestamp + '</div>';
                html += '<div style="margin-top: 5px; font-size: 13px;">' + result.content + '</div>';
                html += '</div>';
            });

            html += '</div>';
        }

        if (activeData && userData.role === 'merchant' && activeData.money) {
            html += '<div class="player-detail">';
            html += '<h3>수익 현황</h3>';
            html += '<p><strong>총 수익:</strong> ' + activeData.money + '원</p>';
            html += '</div>';
        }

        if (activeData && userData.role === 'criminal' && activeData.killCount) {
            html += '<div class="player-detail">';
            html += '<h3>제거 현황</h3>';
            html += '<p><strong>제거 횟수:</strong> ' + activeData.killCount + '/3회</p>';
            html += '</div>';
        }

        document.getElementById('playerDetailContent').innerHTML = html;
        
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
        
        const userRef = db.collection('registeredUsers').doc(playerId);
        batch.delete(userRef);
        
        const activeRef = db.collection('activePlayers').doc(playerId);
        batch.delete(activeRef);

        await batch.commit();

        showAlert('플레이어가 삭제되었습니다.', 'success');
        loadPlayersData();
        loadOverviewData();
    } catch (error) {
        console.error('플레이어 삭제 오류:', error);
        showAlert('플레이어 삭제 중 오류가 발생했습니다.', 'error');
    }
}
// 플레이어 징벌적 사망 함수
async function punishPlayer(playerId, playerName) {
    // 징벌 사유 입력받기
    const reason = prompt('징벌 사유를 입력하세요 (선택사항):', '게임 규칙 위반');
    
    if (!confirm('정말로 ' + playerName + '을(를) 징벌적 사망시키시겠습니까?\n\n이 플레이어는 즉시 게임에서 제외되며, 재접속할 수 없게 됩니다.')) {
        return;
    }

    try {
        const now = firebase.firestore.FieldValue.serverTimestamp();
        
        // activePlayers에서 플레이어 상태 업데이트
        const activePlayerDoc = await db.collection('activePlayers').doc(playerId).get();
        
        if (activePlayerDoc.exists) {
            // 기존 플레이어 데이터에 징벌 정보 추가
            await db.collection('activePlayers').doc(playerId).update({
                isAlive: false,
                isActive: false, // 재접속도 차단
                deathTime: now,
                deathReason: 'punishment', // 징벌적 사망 표시
                punishmentReason: reason || '게임 규칙 위반',
                punishedBy: 'admin',
                punishedAt: now
            });
        } else {
            // activePlayers 컬렉션에 없는 경우 새로 생성 (미접속 플레이어)
            const userDoc = await db.collection('registeredUsers').doc(playerId).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                await db.collection('activePlayers').doc(playerId).set({
                    name: userData.name,
                    position: userData.position,
                    role: userData.role,
                    secretCode: userData.secretCode,
                    isAlive: false,
                    isActive: false,
                    results: [],
                    killCount: 0,
                    money: 0,
                    receivedInteractions: {},
                    deathTime: now,
                    deathReason: 'punishment',
                    punishmentReason: reason || '게임 규칙 위반',
                    punishedBy: 'admin',
                    punishedAt: now
                });
            }
        }

        // 징벌 로그 기록
        await db.collection('punishmentLogs').add({
            playerId: playerId,
            playerName: playerName,
            reason: reason || '게임 규칙 위반',
            punishedBy: 'admin',
            punishedAt: now,
            adminAction: 'punishment_death'
        });

        loadPlayersData();
        loadOverviewData();
        
        // 성공 메시지
        showAlert(playerName + '이(가) 징벌적 사망 처리되었습니다.', 'warning');
        
        console.log('플레이어 ' + playerId + ' 징벌적 사망 처리 완료');

    } catch (error) {
        console.error('플레이어 징벌 처리 오류:', error);
        showAlert('플레이어 징벌 처리 중 오류가 발생했습니다.', 'error');
    }
}
// 플레이어 부활 (징벌 해제 포함)
async function revivePlayer(playerId) {
    try {
        // 플레이어 현재 상태 확인
        const activePlayerDoc = await db.collection('activePlayers').doc(playerId).get();
        let isPunished = false;
        let playerName = '';
        
        if (activePlayerDoc.exists) {
            const data = activePlayerDoc.data();
            isPunished = data.deathReason === 'punishment';
            playerName = data.name;
        }
        
        // 징벌된 플레이어인 경우 특별 확인
        let confirmMessage = '이 플레이어를 부활시키시겠습니까?';
        if (isPunished) {
            confirmMessage = '⚠️ 이 플레이어는 징벌로 인해 사망한 상태입니다.\n\n징벌을 해제하고 부활시키시겠습니까?\n(게임 재참여가 가능해집니다)';
        }
        
        if (!confirm(confirmMessage)) {
            return;
        }

        if (activePlayerDoc.exists) {
            const updateData = {
                isAlive: true,
                isActive: false,
                revivedAt: firebase.firestore.FieldValue.serverTimestamp(),
                revivedBy: 'admin'
            };
            
            // 징벌 관련 정보 제거
            if (isPunished) {
                updateData.deathReason = firebase.firestore.FieldValue.delete();
                updateData.punishmentReason = firebase.firestore.FieldValue.delete();
                updateData.punishedBy = firebase.firestore.FieldValue.delete();
                updateData.punishedAt = firebase.firestore.FieldValue.delete();
            }
            
            await db.collection('activePlayers').doc(playerId).update(updateData);
        } else {
            const userDoc = await db.collection('registeredUsers').doc(playerId).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                await db.collection('activePlayers').doc(playerId).set({
                    name: userData.name,
                    position: userData.position,
                    role: userData.role,
                    secretCode: userData.secretCode,
                    isAlive: true,
                    isActive: false,
                    results: [],
                    killCount: 0,
                    money: 0,
                    receivedInteractions: {},
                    revivedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    revivedBy: 'admin'
                });
            }
        }

        // 징벌 해제 로그 기록
        if (isPunished) {
            await db.collection('punishmentLogs').add({
                playerId: playerId,
                playerName: playerName,
                action: 'punishment_revoked',
                revokedBy: 'admin',
                revokedAt: firebase.firestore.FieldValue.serverTimestamp(),
                adminAction: 'revive_punished_player'
            });
        }

        loadPlayersData();
        loadOverviewData();
        
        const message = isPunished ? 
            '플레이어가 부활되고 징벌이 해제되었습니다. (미접속 상태)' : 
            '플레이어가 부활되었습니다. (미접속 상태)';
        showAlert(message, 'success');
        
    } catch (error) {
        console.error('플레이어 부활 오류:', error);
        showAlert('플레이어 부활 중 오류가 발생했습니다.', 'error');
    }
}

// 공지사항 생성
async function createNotice() {
    const title = document.getElementById('newNoticeTitle').value;
    const content = document.getElementById('newNoticeContent').value;

    if (!title || !content) {
        alert('제목과 내용을 모두 입력해주세요.');
        return;
    }

    try {
        await db.collection('notices').add({
            title: title,
            content: content,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: 'admin'
        });

        document.getElementById('newNoticeTitle').value = '';
        document.getElementById('newNoticeContent').value = '';

        showAlert('공지사항이 등록되었습니다.', 'success');
        loadNoticesData();
    } catch (error) {
        console.error('공지사항 생성 오류:', error);
        showAlert('공지사항 등록 중 오류가 발생했습니다.', 'error');
    }
}

// 공지사항 목록 로드
async function loadNoticesData() {
    try {
        const noticesSnapshot = await db.collection('notices').orderBy('createdAt', 'desc').get();
        const container = document.getElementById('noticesListAdmin');
        
        if (noticesSnapshot.empty) {
            container.innerHTML = '<p style="text-align: center; color: #666;">등록된 공지사항이 없습니다.</p>';
            return;
        }

        let html = '';
        noticesSnapshot.forEach(function(doc) {
            const data = doc.data();
            const date = data.createdAt ? data.createdAt.toDate().toLocaleDateString('ko-KR') : '날짜 없음';

            html += '<div class="list-item">';
            html += '<div class="list-item-header">';
            html += '<div class="list-item-title">' + data.title + '</div>';
            html += '<button class="btn danger" onclick="deleteNotice(\'' + doc.id + '\')" style="width: auto; padding: 5px 10px; font-size: 12px;">삭제</button>';
            html += '</div>';
            html += '<div class="list-item-subtitle">등록일: ' + date + '</div>';
            html += '<div style="margin-top: 8px; font-size: 14px; color: #555;">' + data.content + '</div>';
            html += '</div>';
        });

        container.innerHTML = html;
    } catch (error) {
        console.error('공지사항 목록 로드 오류:', error);
    }
}

// 공지사항 삭제
async function deleteNotice(noticeId) {
    if (!confirm('정말 이 공지사항을 삭제하시겠습니까?')) return;

    try {
        await db.collection('notices').doc(noticeId).delete();
        showAlert('공지사항이 삭제되었습니다.', 'success');
        loadNoticesData();
    } catch (error) {
        console.error('공지사항 삭제 오류:', error);
        showAlert('공지사항 삭제 중 오류가 발생했습니다.', 'error');
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
            // 0일 때도 정확히 0으로 표시되도록 수정
            document.getElementById('missionResetCooldownSetting').value = 
                settings.hasOwnProperty('missionResetCooldown') ? settings.missionResetCooldown : 300;
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
        const missionResetCooldown = parseInt(document.getElementById('missionResetCooldownSetting').value);
        
        // 0 이상의 값만 허용
        if (isNaN(missionResetCooldown) || missionResetCooldown < 0) {
            showAlert('미션 초기화 쿨타임은 0 이상의 숫자여야 합니다.', 'error');
            return;
        }
        
        await db.collection('gameSettings').doc('config').set({
            maxKills: maxKills,
            killTimer: killTimer,
            missionResetCooldown: missionResetCooldown,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: 'admin'
        });

        showAlert('설정이 저장되었습니다. (미션 쿨타임: ' + 
                 (missionResetCooldown === 0 ? '제한 없음' : missionResetCooldown + '초') + ')', 'success');
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
    
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    document.getElementById('playerManageNavBtn').classList.add('active');
    
    adminState.currentScreen = 'playerManage';
}

// 알림 표시
function showAlert(message, type) {
    type = type || 'success';
    
    const existingAlert = document.querySelector('.alert');
    if (existingAlert) {
        existingAlert.remove();
    }

    const alert = document.createElement('div');
    alert.className = 'alert alert-' + type;
    alert.textContent = message;

    const activeScreen = document.querySelector('.screen.active');
    if (activeScreen) {
        activeScreen.insertBefore(alert, activeScreen.firstChild);
    }

    setTimeout(function() {
        if (alert.parentNode) {
            alert.remove();
        }
    }, 3000);
}
// ========== 상인 랭킹 관리 함수들 (여기서부터 추가) ==========

// 상인 랭킹 데이터 로드 함수
async function loadMerchantRankingData() {
    try {
        // 모든 상인 플레이어 데이터 가져오기
        const merchantSnapshot = await db.collection('activePlayers')
            .where('role', '==', 'merchant')
            .get();
        
        // 등록된 사용자 정보도 함께 가져오기
        const registeredSnapshot = await db.collection('registeredUsers')
            .where('role', '==', 'merchant')
            .get();
        
        // 등록된 사용자 정보를 맵으로 변환
        const registeredUsers = {};
        registeredSnapshot.forEach(doc => {
            registeredUsers[doc.id] = doc.data();
        });

        const merchants = [];
        let totalEarnings = 0;
        let maxEarnings = 0;
        let activeCount = 0;

        merchantSnapshot.forEach(doc => {
            const activeData = doc.data();
            const registeredData = registeredUsers[doc.id];
            
            if (registeredData) {
                const money = activeData.money || 0;
                const transactionCount = activeData.results ? 
                    activeData.results.filter(r => r.type === 'money').length : 0;
                
                merchants.push({
                    id: doc.id,
                    name: registeredData.name,
                    position: registeredData.position,
                    money: money,
                    transactionCount: transactionCount,
                    isAlive: activeData.isAlive || false,
                    isActive: activeData.isActive || false
                });

                if (activeData.isAlive) {
                    totalEarnings += money;
                    maxEarnings = Math.max(maxEarnings, money);
                    activeCount++;
                }
            }
        });

        // 수익순으로 정렬
        merchants.sort((a, b) => b.money - a.money);

        // 통계 정보 업데이트
        updateMerchantStats(merchants.length, totalEarnings, maxEarnings, activeCount);

        // 테이블 업데이트
        updateMerchantRankingTable(merchants);

    } catch (error) {
        console.error('상인 랭킹 데이터 로드 오류:', error);
        showAlert('상인 랭킹 데이터 로드 중 오류가 발생했습니다.', 'error');
    }
}

// 상인 통계 정보 업데이트
function updateMerchantStats(totalCount, totalEarnings, maxEarnings, activeCount) {
    document.getElementById('totalMerchantsCount').textContent = totalCount;
    
    const averageEarnings = activeCount > 0 ? Math.round(totalEarnings / activeCount) : 0;
    document.getElementById('averageEarnings').textContent = averageEarnings.toLocaleString();
    document.getElementById('topEarnings').textContent = maxEarnings.toLocaleString();
}

// 상인 랭킹 테이블 업데이트
function updateMerchantRankingTable(merchants) {
    const tbody = document.getElementById('merchantRankingTable');
    tbody.innerHTML = '';

    if (merchants.length === 0) {
        const row = tbody.insertRow();
        row.innerHTML = '<td colspan="6" style="text-align: center; color: #666; padding: 20px;">등록된 상인이 없습니다.</td>';
        return;
    }

    merchants.forEach((merchant, index) => {
        const row = tbody.insertRow();
        
        // 순위
        const rank = index + 1;
        let rankDisplay = rank;
        let rankClass = '';
        
        if (rank === 1) {
            rankDisplay = '🥇 ' + rank;
            rankClass = 'rank-first';
        } else if (rank === 2) {
            rankDisplay = '🥈 ' + rank;
            rankClass = 'rank-second';
        } else if (rank === 3) {
            rankDisplay = '🥉 ' + rank;
            rankClass = 'rank-third';
        }

        // 상태 표시
        let statusText = '';
        let statusClass = '';
        
        if (merchant.isAlive) {
            if (merchant.isActive) {
                statusText = '접속중';
                statusClass = 'status-online';
            } else {
                statusText = '생존';
                statusClass = 'status-alive';
            }
        } else {
            statusText = '사망';
            statusClass = 'status-dead';
        }

        let html = '<td><span class="' + rankClass + '">' + rankDisplay + '</span></td>';
        html += '<td><strong>' + merchant.name + '</strong></td>';
        html += '<td>' + merchant.position + '</td>';
        html += '<td><span class="money-amount">' + merchant.money.toLocaleString() + '원</span></td>';
        html += '<td>' + merchant.transactionCount + '회</td>';
        html += '<td><span class="' + statusClass + '">' + statusText + '</span></td>';
        
        row.innerHTML = html;
        
        // 순위별 특별 스타일 적용
        if (rankClass) {
            row.classList.add(rankClass);
        }
    });
}

// ========== 상인 랭킹 관리 함수들 끝 ==========
// 실시간 데이터 감지 설정
function setupRealtimeListeners() {
    db.collection('gameSettings').doc('gameStatus')
        .onSnapshot(function(doc) {
            if (doc.exists) {
                const isActive = doc.data().isActive;
                updateGameStatusUI(isActive);
            }
        });

    db.collection('activePlayers')
        .onSnapshot(function() {
            if (adminState.currentScreen === 'playerManage') {
                loadPlayersData();
            }
            if (adminState.currentScreen === 'overview') {
                loadOverviewData();
            }
            if (adminState.currentScreen === 'merchantRanking') {
                loadMerchantRankingData();
            }
        });
}

// 초기화
document.addEventListener('DOMContentLoaded', function() {
    console.log('관리자 페이지 로드 완료');

    // 로그인 관련 이벤트
    document.getElementById('loginBtn').addEventListener('click', adminLogin);
    
    document.getElementById('adminPw').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            adminLogin();
        }
    });

    // 네비게이션 버튼 이벤트 리스너
    document.getElementById('overviewNavBtn').addEventListener('click', function() {
        showScreen('overview');
    });
    document.getElementById('createCodeNavBtn').addEventListener('click', function() {
        showScreen('createCode');
    });
    document.getElementById('playerManageNavBtn').addEventListener('click', function() {
        showScreen('playerManage');
    });
    // 상인 랭킹 네비게이션 버튼 추가
    document.getElementById('merchantRankingNavBtn').addEventListener('click', function() {
        showScreen('merchantRanking');
    });
    document.getElementById('noticesNavBtn').addEventListener('click', function() {
        showScreen('notices');
    });
    document.getElementById('settingsNavBtn').addEventListener('click', function() {
        showScreen('settings');
    });

    // 게임 제어 버튼 이벤트
    document.getElementById('startGameBtn').addEventListener('click', startGame);
    document.getElementById('stopGameBtn').addEventListener('click', stopGame);
    document.getElementById('resetGameBtn').addEventListener('click', resetGame);

    // 로그인 코드 생성 관련 이벤트
    document.getElementById('createCodeBtn').addEventListener('click', createOrUpdateLoginCode);
    document.getElementById('cancelEditBtn').addEventListener('click', cancelEdit);

    // 입력 필드 자동 대문자 변환
    document.getElementById('newLoginCode').addEventListener('input', function(e) {
        e.target.value = e.target.value.toUpperCase();
    });
    
    document.getElementById('newSecretCode').addEventListener('input', function(e) {
        e.target.value = e.target.value.toUpperCase();
    });

    // 플레이어 관리 관련 이벤트
    document.getElementById('backToPlayersBtn').addEventListener('click', backToPlayers);

    // 공지사항 관련 이벤트
    document.getElementById('createNoticeBtn').addEventListener('click', createNotice);

    // 설정 관련 이벤트
    document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);

    // 로그아웃 이벤트
    document.getElementById('logoutBtn').addEventListener('click', adminLogout);

    // 실시간 리스너 설정
    setupRealtimeListeners();
});
