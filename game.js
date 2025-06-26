// 게임 상태
let gameState = {
    isLoggedIn: false,
    player: null,
    role: null,
    secretCode: null,
    results: [],
    isAlive: true,
    deathTimer: null
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
function generateSecretCode(role) {
    const codes = tempSecretCodes[role];
    return codes[Math.floor(Math.random() * codes.length)];
}

async function generateSecretCodeFromFirebase(role) {
    try {
        const secretCodesDoc = await db.collection('gameSettings').doc('secretCodes').get();
        if (!secretCodesDoc.exists) {
            return generateSecretCode(role);
        }
        
        const secretCodesData = secretCodesDoc.data();
        const codes = secretCodesData[role] || tempSecretCodes[role];
        
        return codes[Math.floor(Math.random() * codes.length)];
    } catch (error) {
        console.error('시크릿 코드 생성 오류:', error);
        return generateSecretCode(role);
    }
}

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

// 메인 게임 함수들
async function login() {
    console.log('login 함수 호출됨');
    
    const loginCode = document.getElementById('loginCode').value.toUpperCase();
    const playerName = document.getElementById('playerName').value;
    const playerPosition = document.getElementById('playerPosition').value;

    if (!loginCode || !playerName || !playerPosition) {
        alert('모든 정보를 입력해주세요.');
        return;
    }

    document.getElementById('loginLoading').style.display = 'block';

    try {
        const codeDoc = await db.collection('loginCodes').doc(loginCode).get();
        
        if (!codeDoc.exists) {
            throw new Error('유효하지 않은 로그인 코드입니다.');
        }
        
        const codeData = codeDoc.data();
        
        if (codeData.used) {
            throw new Error('이미 사용된 로그인 코드입니다.');
        }

        const secretCode = await generateSecretCodeFromFirebase(codeData.role);

        const playerData = {
            name: playerName,
            position: playerPosition,
            role: codeData.role,
            secretCode: secretCode,
            isAlive: true,
            results: [],
            killCount: 0,
            money: 0,
            loginTime: firebase.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('players').doc(loginCode).set(playerData);

        await db.collection('loginCodes').doc(loginCode).update({
            used: true,
            usedBy: playerName,
            usedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        gameState.player = {
            name: playerName,
            position: playerPosition,
            loginCode: loginCode
        };
        gameState.role = codeData.role;
        gameState.secretCode = secretCode;
        gameState.isLoggedIn = true;

        setTimeout(() => {
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
        }, 1000);

    } catch (error) {
        document.getElementById('loginLoading').style.display = 'none';
        alert(error.message);
        console.error('로그인 오류:', error);
    }
}

async function logout() {
    if (!confirm('정말 로그아웃하시겠습니까?')) {
        return;
    }

    try {
        if (gameState.player && gameState.player.loginCode) {
            await db.collection('loginCodes').doc(gameState.player.loginCode).update({
                used: false,
                usedBy: null,
                usedAt: null
            });

            await db.collection('players').doc(gameState.player.loginCode).delete();
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
        document.getElementById('loginCode').value = '';
        document.getElementById('playerName').value = '';
        document.getElementById('playerPosition').value = '';
        document.getElementById('targetCode').value = '';
        
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

    document.getElementById('codeLoading').style.display = 'block';

    try {
        const playersSnapshot = await db.collection('players')
            .where('secretCode', '==', targetCode)
            .get();
        
        if (playersSnapshot.empty) {
            throw new Error('유효하지 않은 시크릿 코드입니다.');
        }

        const targetPlayerDoc = playersSnapshot.docs[0];
        const targetPlayer = targetPlayerDoc.data();
        const targetPlayerId = targetPlayerDoc.id;

        if (targetPlayerId === gameState.player.loginCode) {
            throw new Error('자신의 시크릿 코드는 입력할 수 없습니다.');
        }

        if (!targetPlayer.isAlive) {
            throw new Error('이미 게임에서 제외된 플레이어의 코드입니다.');
        }

        const result = await processSecretCode(targetPlayer, targetPlayerId);
        
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
    }
}

async function processSecretCode(targetPlayer, targetPlayerId) {
    let result = {
        targetCode: targetPlayer.secretCode,
        targetRole: targetPlayer.role,
        targetName: targetPlayer.name,
        targetPlayerId: targetPlayerId,
        timestamp: new Date().toLocaleString('ko-KR')
    };

    const myPlayerId = gameState.player.loginCode;
    
    try {
        const myPlayerDoc = await db.collection('players').doc(myPlayerId).get();
        const myPlayerData = myPlayerDoc.data();

        switch (gameState.role) {
            case 'detective':
                if (targetPlayer.role === 'merchant') {
                    result.type = 'clue';
                    result.title = '상인의 증언';
                    result.content = generateMerchantTestimony();
                } else if (targetPlayer.role === 'criminal') {
                    result.type = 'evidence';
                    result.title = '결정적 증거';
                    result.content = generateCriminalEvidence();
                } else {
                    result.type = 'clue';
                    result.title = '동료 탐정 정보';
                    result.content = '동료 탐정과 정보를 공유했습니다.';
                }
                break;

            case 'criminal':
                const currentKillCount = myPlayerData.killCount || 0;
                
                if (currentKillCount >= 3) {
                    throw new Error('이미 최대 제거 횟수(3회)에 도달했습니다.');
                }

                result.type = 'kill';
                result.title = '제거 대상 확보';
                result.content = `${targetPlayer.name} (${targetPlayer.role === 'detective' ? '탐정' : targetPlayer.role === 'merchant' ? '상인' : '대상'})을 제거할 수 있습니다.`;
                result.canKill = true;
                result.executed = false;
                
                await db.collection('players').doc(myPlayerId).update({
                    killCount: currentKillCount + 1
                });
                
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
                await db.collection('players').doc(myPlayerId).update({
                    money: currentMoney + result.amount
                });
                break;
        }

        await db.collection('players').doc(myPlayerId).update({
            results: firebase.firestore.FieldValue.arrayUnion(result)
        });

        gameState.results.push(result);
        return result;
    } catch (error) {
        console.error('시크릿 코드 처리 오류:', error);
        throw error;
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

    document.getElementById('myRole').textContent = roleInfo.title;
    document.getElementById('mySecretCode').textContent = gameState.secretCode;
}

async function setupResultScreen() {
    if (gameState.isLoggedIn) {
        try {
            const playerDoc = await db.collection('players').doc(gameState.player.loginCode).get();
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
    db.collection('players').doc(gameState.player.loginCode)
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

    if (!confirm(`정말로 ${kill.targetName}을(를) 제거하시겠습니까? 3분 후 대상이 게임에서 제외됩니다.`)) {
        return;
    }

    try {
        kill.executed = true;
        kill.content = `${kill.targetName} 제거 실행됨 (3분 후 게임 종료)`;

        const myPlayerId = gameState.player.loginCode;
        await db.collection('players').doc(myPlayerId).update({
            results: gameState.results
        });

        setTimeout(async () => {
            try {
                await db.collection('players').doc(kill.targetPlayerId).update({
                    isAlive: false,
                    deathTime: firebase.firestore.FieldValue.serverTimestamp(),
                    killedBy: myPlayerId
                });
                console.log(`플레이어 ${kill.targetPlayerId} 제거 완료`);
            } catch (error) {
                console.error('플레이어 제거 오류:', error);
            }
        }, 180000);

        alert('제거 명령이 실행되었습니다. 3분 후 대상이 게임에서 제외됩니다.');
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
    document.getElementById('loginButton').addEventListener('click', login);
    document.getElementById('submitCodeButton').addEventListener('click', submitCode);
    
    // 네비게이션 버튼 이벤트 리스너 등록
    document.getElementById('homeNavBtn').addEventListener('click', () => showScreen('home'));
    document.getElementById('roleNavBtn').addEventListener('click', () => showScreen('role'));
    document.getElementById('codeInputNavBtn').addEventListener('click', () => showScreen('codeInput'));
    document.getElementById('resultNavBtn').addEventListener('click', () => showScreen('result'));
    document.getElementById('logoutNavBtn').addEventListener('click', logout);
    
    // 입력 필드 이벤트
    document.getElementById('loginCode').addEventListener('input', function(e) {
        e.target.value = e.target.value.toUpperCase();
    });
    
    document.getElementById('targetCode').addEventListener('input', function(e) {
        e.target.value = e.target.value.toUpperCase();
    });
    
    // Enter 키 이벤트
    document.getElementById('playerPosition').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            login();
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
