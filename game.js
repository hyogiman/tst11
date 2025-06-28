// UI 관련 함수들
function showScreen(screenName) {
    console.log('화면 전환:', screenName);
    
    // 로그인이 안 된 상태에서 다른 화면 접근 방지
    if (!gameState.isLoggedIn) {
        console.log('로그인이 필요합니다.');
        // 로그인 화면으로 이동
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        // 게임 상태
let gameState = {
    isLoggedIn: false,
    player: null,
    role: null,
    secretCode: null,
    results: [],
    isAlive: true,
    deathTimer: null,
    interactionCooldowns: {} // 상호작용 쿨다운 관리
};

// 기본 시크릿 코드
const tempSecretCodes = {
    'detective': ['DT01', 'DT02', 'DT03'],
    'criminal': ['CR01', 'CR02', 'CR03'],
    'merchant': ['MC01', 'MC02', 'MC03']
};

// 역할별 설명
const roleDescriptions = {
    detective: {
        title: '🔍 탐정',
        description: '범인을 찾아내는 것이 목표입니다. 다른 플레이어의 시크릿 코드를 수집하여 단서를 모으세요.',
        className: 'detective'
    },
    criminal: {
        title: '🔪 범인',
        description: '탐정을 찾아 제거하는 것이 목표입니다. 최대 3명까지 제거할 수 있으며, 탐정을 우선적으로 노리세요.',
        className: 'criminal'
    },
    merchant: {
        title: '💰 상인',
        description: '돈을 버는 것이 목표입니다. 다른 플레이어와 거래하여 최대한 많은 돈을 모으세요.',
        className: 'merchant'
    }
};

// 유틸리티 함수들
function generateMerchantTestimony() {
    const testimonies = [
        "오늘 아침 사무실 근처에서 수상한 사람을 봤어요.",
        "어제 늦게까지 남아있던 사람이 있었던 것 같아요.",
        "복사기 근처에서 이상한 소리가 났어요.",
        "누군가 다른 사람의 책상을 뒤지고 있었어요.",
        "점심시간에 혼자 있는 사람을 봤어요.",
        "화장실에서 수상한 대화를 들었어요."
    ];
    return testimonies[Math.floor(Math.random() * testimonies.length)];
}

function generateCriminalEvidence() {
    const evidences = [
        "범인은 왼손잡이일 가능성이 높습니다.",
        "범인은 IT 부서와 관련이 있을 것입니다.",
        "범인은 최근 스트레스를 많이 받은 사람입니다.",
        "범인은 회사 내부 구조를 잘 아는 사람입니다.",
        "범인은 평소 조용한 성격의 소유자입니다.",
        "범인은 회사에 불만이 있는 사람일 가능성이 높습니다."
    ];
    return evidences[Math.floor(Math.random() * evidences.length)];
}

// 게임 상태 확인
async function checkGameStatus() {
    try {
        const gameDoc = await db.collection('gameSettings').doc('gameStatus').get();
        return gameDoc.exists ? gameDoc.data().isActive : false;
    } catch (error) {
        console.error('게임 상태 확인 오류:', error);
        return false;
    }
}

// 간편 로그인 함수 (이미 등록된 사용자)
async function quickLogin() {
    console.log('간편 로그인 시도');
    
    // 게임 상태 확인
    const isGameActive = await checkGameStatus();
    if (!isGameActive) {
        alert('게임이 아직 시작되지 않았습니다. 관리자가 게임을 시작할 때까지 기다려주세요.');
        return;
    }
    
    const loginCode = document.getElementById('quickLoginCode').value.toUpperCase();

    if (!loginCode) {
        alert('로그인 코드를 입력해주세요.');
        return;
    }

    document.getElementById('loginLoading').style.display = 'block';
    document.getElementById('loadingText').textContent = '로그인 중...';

    try {
        // 등록된 사용자 정보 확인
        const userDoc = await db.collection('registeredUsers').doc(loginCode).get();
        
        if (!userDoc.exists) {
            throw new Error('등록되지 않은 코드입니다. 먼저 등록해주세요.');
        }
        
        const userData = userDoc.data();
        
        // 현재 접속 중인지 확인
        const activePlayerDoc = await db.collection('activePlayers').doc(loginCode).get();
        if (activePlayerDoc.exists && activePlayerDoc.data().isActive) {
            throw new Error('이미 접속 중인 코드입니다.');
        }

        // 활성 플레이어로 등록
        await db.collection('activePlayers').doc(loginCode).set({
            name: userData.name,
            position: userData.position,
            role: userData.role,
            secretCode: userData.secretCode,
            isAlive: true,
            isActive: true,
            results: [],
            killCount: 0,
            money: 0,
            loginTime: firebase.firestore.FieldValue.serverTimestamp()
        });

        // 게임 상태 설정
        gameState.player = {
            name: userData.name,
            position: userData.position,
            loginCode: loginCode
        };
        gameState.role = userData.role;
        gameState.secretCode = userData.secretCode;
        gameState.isLoggedIn = true;

        setTimeout(() => {
            completeLogin();
        }, 1000);

    } catch (error) {
        document.getElementById('loginLoading').style.display = 'none';
        alert(error.message);
        console.error('간편 로그인 오류:', error);
    }
}

// 등록 함수 (처음 사용자)
async function register() {
    console.log('등록 시도');
    
    // 게임 상태 확인
    const isGameActive = await checkGameStatus();
    if (!isGameActive) {
        alert('게임이 아직 시작되지 않았습니다. 관리자가 게임을 시작할 때까지 기다려주세요.');
        return;
    }
    
    const loginCode = document.getElementById('registerCode').value.toUpperCase();
    const playerName = document.getElementById('playerName').value;
    const playerPosition = document.getElementById('playerPosition').value;

    if (!loginCode || !playerName || !playerPosition) {
        alert('모든 정보를 입력해주세요.');
        return;
    }

    document.getElementById('loginLoading').style.display = 'block';
    document.getElementById('loadingText').textContent = '등록 중...';

    try {
        // 로그인 코드 유효성 검증
        const codeDoc = await db.collection('loginCodes').doc(loginCode).get();
        
        if (!codeDoc.exists) {
            throw new Error('유효하지 않은 로그인 코드입니다. 관리자에게 문의하세요.');
        }
        
        const codeData = codeDoc.data();
        
        if (codeData.used) {
            throw new Error('이미 사용된 로그인 코드입니다. 다른 로그인 코드를 사용하거나 관리자에게 문의하세요.');
        }
        
        // 이미 등록된 사용자인지 확인
        const existingUserDoc = await db.collection('registeredUsers').doc(loginCode).get();
        if (existingUserDoc.exists) {
            throw new Error('이미 등록된 코드입니다.');
        }

        // 등록된 사용자로 저장 (영구 저장)
        const userData = {
            name: playerName,
            position: playerPosition,
            role: codeData.role,
            secretCode: codeData.secretCode,
            registeredAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('registeredUsers').doc(loginCode).set(userData);

        // 활성 플레이어로도 등록
        await db.collection('activePlayers').doc(loginCode).set({
            ...userData,
            isAlive: true,
            isActive: true,
            results: [],
            killCount: 0,
            money: 0,
            loginTime: firebase.firestore.FieldValue.serverTimestamp()
        });

        // 로그인 코드 사용 표시
        await db.collection('loginCodes').doc(loginCode).update({
            used: true,
            usedBy: playerName,
            usedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // 게임 상태 설정
        gameState.player = {
            name: playerName,
            position: playerPosition,
            loginCode: loginCode
        };
        gameState.role = codeData.role;
        gameState.secretCode = codeData.secretCode;
        gameState.isLoggedIn = true;

        setTimeout(() => {
            completeLogin();
        }, 1000);

    } catch (error) {
        document.getElementById('loginLoading').style.display = 'none';
        
        // 로그인 코드 부족 시 특별 메시지
        if (error.message.includes('유효하지 않은')) {
            alert('로그인 코드가 추가로 필요합니다. 관리자에게 문의하세요.');
        } else {
            alert(error.message);
        }
        console.error('등록 오류:', error);
    }
}

// 로그인 완료 처리 공통 함수
function completeLogin() {
    document.getElementById('loginLoading').style.display = 'none';
    
    // 로그인 화면 숨기기
    document.getElementById('loginScreen').classList.remove('active');
    document.getElementById('homeScreen').classList.add('active');
    
    // 하단 네비게이션 표시 및 활성화
    const bottomNav = document.getElementById('bottomNav');
    bottomNav.style.display = 'flex';
    
    document.getElementById('roleNavBtn').classList.remove('disabled');
    document.getElementById('codeInputNavBtn').classList.remove('disabled');
    document.getElementById('resultNavBtn').classList.remove('disabled');
    document.getElementById('logoutNavBtn').style.display = 'flex';
    
    setupRoleCard();
    setupResultScreen().catch(error => {
        console.error('결과 화면 설정 오류:', error);
    });
    setupRealtimeListener();
    
    console.log('로그인 완료!');
}

// 폼 전환 함수들
function showRegisterForm() {
    document.getElementById('quickLoginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'block';
}

function showLoginForm() {
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('quickLoginForm').style.display = 'block';
}

async function logout() {
    if (!confirm('정말 로그아웃하시겠습니까?')) {
        return;
    }

    try {
        if (gameState.player && gameState.player.loginCode) {
            // 활성 플레이어에서만 제거 (등록 정보는 유지)
            await db.collection('activePlayers').doc(gameState.player.loginCode).update({
                isActive: false,
                logoutTime: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

        // 게임 상태 완전 초기화
        gameState = {
            isLoggedIn: false,
            player: null,
            role: null,
            secretCode: null,
            results: [],
            isAlive: true,
            deathTimer: null
        };

        // 모든 화면 숨기고 로그인 화면만 표시
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById('loginScreen').classList.add('active');
        
        // 하단 네비게이션 숨기기 및 초기화
        const bottomNav = document.getElementById('bottomNav');
        bottomNav.style.display = 'none';
        
        // 네비게이션 버튼들 비활성화 및 초기화
        document.getElementById('homeNavBtn').classList.remove('active');
        document.getElementById('roleNavBtn').classList.add('disabled');
        document.getElementById('roleNavBtn').classList.remove('active');
        document.getElementById('codeInputNavBtn').classList.add('disabled');
        document.getElementById('codeInputNavBtn').classList.remove('active');
        document.getElementById('resultNavBtn').classList.add('disabled');
        document.getElementById('resultNavBtn').classList.remove('active');
        document.getElementById('logoutNavBtn').style.display = 'none';
        
        // 홈 버튼 활성화 (다시 로그인할 때를 위해)
        document.getElementById('homeNavBtn').classList.add('active');

        // 모든 입력 필드 초기화
        document.getElementById('quickLoginCode').value = '';
        document.getElementById('registerCode').value = '';
        document.getElementById('playerName').value = '';
        document.getElementById('playerPosition').value = '';
        document.getElementById('targetCode').value = '';
        
        // 폼 상태 초기화 (간편 로그인 폼 표시)
        document.getElementById('registerForm').style.display = 'none';
        document.getElementById('quickLoginForm').style.display = 'block';
        
        // 결과 화면 내용 완전 초기화
        document.getElementById('codeResult').innerHTML = '';
        document.getElementById('resultContent').innerHTML = '';
        document.getElementById('resultTitle').textContent = '내 결과';
        
        // 역할 카드 초기화
        document.getElementById('roleCard').innerHTML = '';
        document.getElementById('roleCard').className = 'role-card';
        
        // 내 정보 화면 초기화
        document.getElementById('myRole').textContent = '-';
        document.getElementById('mySecretCode').textContent = '-';
        
        // 게임 상태 메시지 초기화
        document.getElementById('gameStatus').innerHTML = `
            <div class="status-message">
                게임이 진행 중입니다. 다른 플레이어들과 상호작용하며 목표를 달성하세요!
            </div>
        `;

        console.log('로그아웃 및 화면 초기화 완료');

    } catch (error) {
        console.error('로그아웃 오류:', error);
        alert('로그아웃 중 오류가 발생했습니다.');
    }
}

async function submitCode() {
    const targetCode = document.getElementById('targetCode').value.toUpperCase();
    
    if (!targetCode) {
        alert('시크릿 코드를 입력해주세요.');
        return;
    }

    // 쿨다운 체크
    const now = Date.now();
    if (gameState.interactionCooldowns[targetCode] && now < gameState.interactionCooldowns[targetCode]) {
        const remainingTime = Math.ceil((gameState.interactionCooldowns[targetCode] - now) / 1000);
        alert(`이 플레이어와는 ${remainingTime}초 후에 다시 상호작용할 수 있습니다.`);
        return;
    }

    document.getElementById('codeLoading').style.display = 'block';

    try {
        // 활성 플레이어에서 시크릿 코드로 검색
        const playersSnapshot = await db.collection('activePlayers')
            .where('isActive', '==', true)
            .get();
        
        let targetPlayer = null;
        let targetPlayerId = null;
        
        // 모든 활성 플레이어 중에서 해당 시크릿 코드를 가진 플레이어 찾기
        playersSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.secretCode === targetCode) {
                targetPlayer = data;
                targetPlayerId = doc.id;
            }
        });
        
        if (!targetPlayer) {
            throw new Error('유효하지 않은 시크릿 코드입니다.');
        }

        if (targetPlayerId === gameState.player.loginCode) {
            throw new Error('자신의 시크릿 코드는 입력할 수 없습니다.');
        }

        if (!targetPlayer.isAlive) {
            throw new Error('이미 게임에서 제외된 플레이어의 코드입니다.');
        }

        const result = await processSecretCode(targetPlayer, targetPlayerId);
        
        // 상호작용 쿨다운 설정 (3분 = 180초)
        gameState.interactionCooldowns[targetCode] = now + 180000;
        
        setTimeout(() => {
            document.getElementById('codeLoading').style.display = 'none';
            displayCodeResult(result);
            document.getElementById('targetCode').value = '';
            setupResultScreen().catch(error => {
                console.error('결과 화면 업데이트 오류:', error);
            });
        }, 1000);

    } catch (error) {
        document.getElementById('codeLoading').style.display = 'none';
        alert(error.message);
        console.error('시크릿 코드 처리 오류:', error);
    }
}

async function processSecretCode(targetPlayer, targetPlayerId) {
    let result = {
        targetCode: targetPlayer.secretCode,
        targetName: targetPlayer.name,
        targetPlayerId: targetPlayerId,
        timestamp: new Date().toLocaleString('ko-KR')
    };

    const myPlayerId = gameState.player.loginCode;
    
    try {
        const myPlayerDoc = await db.collection('activePlayers').doc(myPlayerId).get();
        const myPlayerData = myPlayerDoc.data();

        switch (gameState.role) {
            case 'detective':
                // 관리자가 설정한 제목과 내용 사용
                const secretInfo = await getSecretInfoFromLoginCode(targetPlayer.secretCode);
                result.type = targetPlayer.role === 'criminal' ? 'evidence' : 'clue';
                result.title = secretInfo.title || (targetPlayer.role === 'criminal' ? '결정적 증거' : '상인의 증언');
                result.content = secretInfo.content || (targetPlayer.role === 'criminal' ? generateCriminalEvidence() : generateMerchantTestimony());
                break;

            case 'criminal':
                result.type = 'kill';
                result.title = '제거 대상 확보';
                result.content = `${targetPlayer.name}을(를) 제거할 수 있습니다.`;
                result.canKill = true;
                result.executed = false;
                result.targetRole = targetPlayer.role;
                // 여기서는 killCount를 증가시키지 않음 (실제 공격 시에만 증가)
                break;

            case 'merchant':
                result.type = 'money';
                if (targetPlayer.role === 'merchant') {
                    result.amount = Math.floor(Math.random() * 100) + 1;
                } else {
                    result.amount = Math.floor(Math.random() * 100) + 50;
                }
                result.title = '거래 성공';
                result.content = `${result.amount}원을 획득했습니다.`;
                
                const currentMoney = myPlayerData.money || 0;
                await db.collection('activePlayers').doc(myPlayerId).update({
                    money: currentMoney + result.amount
                });
                break;
        }

        await db.collection('activePlayers').doc(myPlayerId).update({
            results: firebase.firestore.FieldValue.arrayUnion(result)
        });

        gameState.results.push(result);
        return result;
        
    } catch (error) {
        console.error('시크릿 코드 처리 오류:', error);
        throw error;
    }
}

// 로그인 코드에서 시크릿 정보 가져오기 (제목 포함)
async function getSecretInfoFromLoginCode(secretCode) {
    try {
        const loginCodesSnapshot = await db.collection('loginCodes')
            .where('secretCode', '==', secretCode)
            .limit(1)
            .get();
        
        if (!loginCodesSnapshot.empty) {
            const loginCodeData = loginCodesSnapshot.docs[0].data();
            return {
                title: loginCodeData.secretTitle,
                content: loginCodeData.secretContent
            };
        }
        
        return { title: null, content: null };
    } catch (error) {
        console.error('시크릿 정보 가져오기 오류:', error);
        return { title: null, content: null };
    }
}

// UI 관련 함수들
function showScreen(screenName) {
    console.log('화면 전환:', screenName);
    
    // 로그인이 안 된 상태에서 다른 화면 접근 방지
    if (!gameState.isLoggedIn && screenName !== 'home') {
        console.log('로그인이 필요합니다.');
        return;
    }
    
    // 모든 화면 숨기기
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });

    const screenMap = {
        'home': 'homeScreen',
        'role': 'roleScreen', 
        'codeInput': 'codeInputScreen',
        'result': 'resultScreen'
    };

    const targetScreenId = screenMap[screenName];
    if (targetScreenId) {
        document.getElementById(targetScreenId).classList.add('active');
    }

    // 네비게이션 활성화 상태 변경
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });

    const navItems = document.querySelectorAll('.nav-item');
    const buttonScreens = ['home', 'role', 'codeInput', 'result'];
    navItems.forEach((button, index) => {
        if (buttonScreens[index] === screenName) {
            button.classList.add('active');
        }
    });
    
    // 결과 화면일 때만 데이터 로드
    if (screenName === 'result' && gameState.isLoggedIn) {
        setupResultScreen().catch(error => {
            console.error('결과 화면 설정 오류:', error);
        });
    }
}

function setupRoleCard() {
    const roleInfo = roleDescriptions[gameState.role];
    const roleCard = document.getElementById('roleCard');
    
    roleCard.className = `role-card ${roleInfo.className}`;
    roleCard.innerHTML = `
        <div class="role-title">${roleInfo.title}</div>
        <div class="role-description">${roleInfo.description}</div>
        <div class="secret-code">
            <div class="secret-code-label">나의 시크릿 코드</div>
            <div class="secret-code-value">${gameState.secretCode}</div>
        </div>
    `;

    // 역할/S.C 화면의 내 정보 설정 (역할 제거, 성명/직위 추가)
    document.getElementById('mySecretCode').textContent = gameState.secretCode;
    
    // 새로운 요소들 추가 (HTML에서 myRole을 myName과 myPosition으로 변경 필요)
    const myNameElement = document.getElementById('myName');
    const myPositionElement = document.getElementById('myPosition');
    
    if (myNameElement) myNameElement.textContent = gameState.player.name;
    if (myPositionElement) myPositionElement.textContent = gameState.player.position;
}

async function setupResultScreen() {
    if (gameState.isLoggedIn) {
        try {
            const playerDoc = await db.collection('activePlayers').doc(gameState.player.loginCode).get();
            if (playerDoc.exists) {
                const playerData = playerDoc.data();
                gameState.results = playerData.results || [];
            }
        } catch (error) {
            console.error('결과 데이터 로드 오류:', error);
        }
    }

    const resultContent = document.getElementById('resultContent');
    const resultTitle = document.getElementById('resultTitle');
    
    switch (gameState.role) {
        case 'detective':
            resultTitle.textContent = '🔍 수집한 단서들';
            displayDetectiveResults(resultContent);
            break;
        case 'criminal':
            resultTitle.textContent = '🔪 제거 기록';
            displayCriminalResults(resultContent);
            break;
        case 'merchant':
            resultTitle.textContent = '💰 수익 현황';
            displayMerchantResults(resultContent);
            break;
    }
}

function setupRealtimeListener() {
    db.collection('activePlayers').doc(gameState.player.loginCode)
        .onSnapshot((doc) => {
            if (doc.exists) {
                const data = doc.data();
                
                if (!data.isAlive && gameState.isAlive) {
                    gameState.isAlive = false;
                    showDeathMessage();
                }
                
                if (data.results && data.results.length !== gameState.results.length) {
                    gameState.results = data.results;
                    setupResultScreen().catch(error => {
                        console.error('실시간 결과 업데이트 오류:', error);
                    });
                }
            }
        });
}

function showDeathMessage() {
    const gameStatus = document.getElementById('gameStatus');
    gameStatus.innerHTML = `
        <div class="status-message error">
            ⚠️ 범인에게 제거되었습니다! 게임에서 제외됩니다.
        </div>
    `;
}

function displayCodeResult(result) {
    const resultDiv = document.getElementById('codeResult');
    let html = `
        <div class="status-message">
            <strong>${result.title}</strong><br>
            ${result.content}
        </div>
    `;
    resultDiv.innerHTML = html;
}

function displayDetectiveResults(container) {
    const clues = gameState.results.filter(r => r.type === 'clue' || r.type === 'evidence');
    
    if (clues.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #666;">아직 수집한 단서가 없습니다.</p>';
        return;
    }

    let html = '<div class="result-list">';
    clues.forEach((clue) => {
        const safeContent = clue.content.replace(/'/g, "&apos;").replace(/"/g, "&quot;");
        html += `
            <div class="result-item" onclick="showClueDetail('${clue.title}', '${safeContent}')">
                <div class="result-item-title">${clue.title}</div>
                <div class="result-item-subtitle">${clue.timestamp}</div>
            </div>
        `;
    });
    html += '</div>';
    
    container.innerHTML = html;
}

function displayCriminalResults(container) {
    const kills = gameState.results.filter(r => r.type === 'kill');
    const remainingKills = 3 - kills.length;
    
    let html = `
        <div class="status-message">
            남은 제거 기회: ${remainingKills}회
        </div>
    `;

    if (kills.length === 0) {
        html += '<p style="text-align: center; color: #666;">아직 제거 대상이 없습니다.</p>';
    } else {
        html += '<div class="result-list">';
        kills.forEach((kill, index) => {
            html += `
                <div class="result-item">
                    <div class="result-item-title">${kill.content}</div>
                    <div class="result-item-subtitle">${kill.timestamp}</div>
                    ${kill.canKill && !kill.executed ? 
                        `<button class="attack-btn" onclick="executeKill(${index})">공격</button>` : 
                        kill.executed ? '<span style="color: #e74c3c; position: absolute; right: 15px; top: 50%; transform: translateY(-50%);">실행됨</span>' : ''
                    }
                </div>
            `;
        });
        html += '</div>';
    }
    
    container.innerHTML = html;
}

function displayMerchantResults(container) {
    const transactions = gameState.results.filter(r => r.type === 'money');
    const totalMoney = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
    
    let html = `
        <div class="status-message">
            총 수익: ${totalMoney}원
        </div>
    `;

    if (transactions.length === 0) {
        html += '<p style="text-align: center; color: #666;">아직 거래 기록이 없습니다.</p>';
    } else {
        html += '<div class="result-list">';
        transactions.forEach(transaction => {
            html += `
                <div class="result-item">
                    <div class="result-item-title">거래 완료</div>
                    <div class="result-item-subtitle">${transaction.timestamp}</div>
                    <div class="result-item-value">+${transaction.amount}원</div>
                </div>
            `;
        });
        html += '</div>';
    }
    
    container.innerHTML = html;
}

function showClueDetail(title, content) {
    alert(`${title}\n\n${content}`);
}

async function executeKill(killIndex) {
    const kill = gameState.results.filter(r => r.type === 'kill')[killIndex];
    
    if (!kill || !kill.canKill || kill.executed) {
        alert('이미 실행되었거나 실행할 수 없는 대상입니다.');
        return;
    }

    if (!confirm(`정말로 ${kill.targetName}을(를) 제거하시겠습니까? 즉시 대상이 게임에서 완전히 제외됩니다.`)) {
        return;
    }

    try {
        const myPlayerId = gameState.player.loginCode;
        
        // killCount 증가 (공격 버튼을 눌렀을 때)
        const myPlayerDoc = await db.collection('activePlayers').doc(myPlayerId).get();
        const myPlayerData = myPlayerDoc.data();
        const currentKillCount = myPlayerData.killCount || 0;
        
        if (currentKillCount >= 3) {
            alert('이미 최대 제거 횟수(3회)에 도달했습니다.');
            return;
        }

        kill.executed = true;
        kill.content = `${kill.targetName} 제거 완료`;

        // killCount 증가 및 결과 업데이트
        await db.collection('activePlayers').doc(myPlayerId).update({
            results: gameState.results,
            killCount: currentKillCount + 1
        });

        // 즉시 대상 플레이어 제거 및 강제 로그아웃
        await db.collection('activePlayers').doc(kill.targetPlayerId).update({
            isAlive: false,
            isActive: false, // 강제 로그아웃
            deathTime: firebase.firestore.FieldValue.serverTimestamp(),
            killedBy: myPlayerId
        });

        alert('제거 명령이 실행되었습니다. 대상이 즉시 게임에서 제외됩니다.');
        setupResultScreen().catch(error => {
            console.error('결과 화면 새로고침 오류:', error);
        });

    } catch (error) {
        console.error('공격 실행 오류:', error);
        alert('공격 실행 중 오류가 발생했습니다.');
    }
}

// 초기화
document.addEventListener('DOMContentLoaded', function() {
    console.log('페이지 로드 완료');
    
    // 버튼 이벤트 리스너 등록
    document.getElementById('quickLoginButton').addEventListener('click', quickLogin);
    document.getElementById('registerButton').addEventListener('click', register);
    document.getElementById('submitCodeButton').addEventListener('click', submitCode);
    document.getElementById('showRegisterButton').addEventListener('click', showRegisterForm);
    document.getElementById('showLoginButton').addEventListener('click', showLoginForm);
    
    // 네비게이션 버튼 이벤트 리스너 등록
    document.getElementById('homeNavBtn').addEventListener('click', () => showScreen('home'));
    document.getElementById('roleNavBtn').addEventListener('click', () => showScreen('role'));
    document.getElementById('codeInputNavBtn').addEventListener('click', () => showScreen('codeInput'));
    document.getElementById('resultNavBtn').addEventListener('click', () => showScreen('result'));
    document.getElementById('logoutNavBtn').addEventListener('click', logout);
    
    // 입력 필드 이벤트
    document.getElementById('quickLoginCode').addEventListener('input', function(e) {
        e.target.value = e.target.value.toUpperCase();
    });
    
    document.getElementById('registerCode').addEventListener('input', function(e) {
        e.target.value = e.target.value.toUpperCase();
    });
    
    document.getElementById('targetCode').addEventListener('input', function(e) {
        e.target.value = e.target.value.toUpperCase();
    });
    
    // Enter 키 이벤트
    document.getElementById('quickLoginCode').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            quickLogin();
        }
    });
    
    document.getElementById('playerPosition').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            register();
        }
    });
    
    document.getElementById('targetCode').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            submitCode();
        }
    });

    // 하단 네비게이션 초기 숨김
    document.getElementById('bottomNav').style.display = 'none';
});
