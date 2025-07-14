function setupRealtimeListener() {
    // 기존 리스너가 있다면 해제
    if (gameState.realtimeListener) {
        try {
            gameState.realtimeListener();
        } catch (error) {
            console.error('기존 리스너 해제 오류:', error);
        }
        gameState.realtimeListener = null;
    }

    // 로그인 상태가 아니면 리스너 설정 안 함
    if (!gameState.isLoggedIn || !gameState.player) {
        return;
    }

    // activePlayers 리스너 설정
    gameState.realtimeListener = db.collection('activePlayers').doc(gameState.player.loginCode)
        .onSnapshot(function(doc) {
            // 로그아웃 상태이면 리스너 실행 안 함
            if (!gameState.isLoggedIn) {
                return;
            }
        
        if (doc.exists) {
            const data = doc.data();
            
            // 🆕 범인인 경우 돈 정보도 실시간 동기화 (맨 먼저)
            if (gameState.role === 'criminal') {
                const serverMoney = data.criminalMoney || 0;
                if (criminalMoney !== serverMoney) {
                    console.log('실시간 돈 동기화:', criminalMoney, '→', serverMoney);
                    criminalMoney = serverMoney;
                    gameState.criminalMoney = serverMoney; // 🆕 gameState도 동기화
                    
                    // 🆕 결과 화면이 열려있으면 즉시 업데이트
                    if (document.getElementById('resultScreen').classList.contains('active')) {
                        setupResultScreen().catch(error => {
                            console.error('실시간 결과 화면 업데이트 오류:', error);
                        });
                    }
                }
            }
            
            // receivedInteractions 데이터 동기화
            if (data.receivedInteractions) {
                gameState.receivedInteractions = data.receivedInteractions;
                updateInteractionCount();
            }
            
                // 역할이나 시크릿 코드가 변경된 경우 게임 상태 업데이트
                if (data.role !== gameState.role || data.secretCode !== gameState.secretCode) {
                    console.log('관리자에 의해 역할/시크릿 코드가 변경되었습니다.');
                    
                    // 게임 상태 업데이트
                    gameState.role = data.role;
                    gameState.secretCode = data.secretCode;
                    
                    // 역할 카드 다시 설정
                    setupRoleCard();
                    
                    // 상호작용 미션 다시 로드
                    loadInteractionMission().then(function() {
                        setupRoleCard(); // 미션 로드 후 다시 역할 카드 설정
                    });
                    
                    // 결과 화면도 업데이트
                    setupResultScreen().catch(function(error) {
                        console.error('결과 화면 업데이트 오류:', error);
                    });
                    
                    // 사용자에게 알림
                    alert('관리자가 당신의 역할 정보를 업데이트했습니다. 새로운 정보를 확인해주세요!');
                }
                
                // 상호작용 미션이나 시크릿 코드 관련 내용 변경 감지를 위한 추가 리스너
                checkForContentUpdates();
                
                // 사망하거나 비활성화된 경우 강제 로그아웃 (관리자나 범인에 의한 제거)
                if (!data.isAlive || !data.isActive) {
                    if (gameState.isAlive && gameState.isLoggedIn) {
                        console.log('관리자나 범인에 의해 게임에서 제외됩니다.');
                        
                // 🆕 징벌/제거 진동
                triggerVibrationPattern('error');
                        
                        // 실시간 리스너 즉시 해제
                        if (gameState.realtimeListener) {
                            try {
                                gameState.realtimeListener();
                            } catch (error) {
                                console.error('강제 제거 시 리스너 해제 오류:', error);
                            }
                            gameState.realtimeListener = null;
                        }
                        
                        // 상태 변경
                        gameState.isAlive = false;
                        gameState.isLoggedIn = false;
                        
                        // UI 초기화
                        document.querySelectorAll('.screen').forEach(function(screen) {
                            screen.classList.remove('active');
                        });
                        
                        const loginScreen = document.getElementById('loginScreen');
                        if (loginScreen) {
                            loginScreen.classList.add('active');
                        }
                        
                        const bottomNav = document.getElementById('bottomNav');
                        if (bottomNav) {
                            bottomNav.style.display = 'none';
                        }
                        
                        // 게임 상태 초기화
                        gameState = {
                            isLoggedIn: false,
                            player: null,
                            role: null,
                            secretCode: null,
                            results: [],
                            isAlive: true,
                            deathTimer: null,
                            usedCodes: [],
                            receivedInteractions: {},
                            realtimeListener: null,
                            interactionMission: null,
                            secretTitle: null,
                            secretContent: null,
                            merchantRank: null,
                            totalMerchants: null,
                            merchantRankingListener: null
                        };
                        
                        alert('게임에서 제외되었습니다. 다시 접속할 수 없습니다.');
                    }
                    return;
                }
                
                // 결과 업데이트
                if (data.results && data.results.length !== gameState.results.length) {
                    gameState.results = data.results;
                    setupResultScreen().catch(function(error) {
                        console.error('실시간 결과 업데이트 오류:', error);
                    });
                }
            } else {
                // 문서가 삭제된 경우
                if (gameState.isLoggedIn) {
                    console.log('계정이 삭제되었습니다.');
                    if (gameState.realtimeListener) {
                        try {
                            gameState.realtimeListener();
                        } catch (error) {
                            console.error('문서 삭제 시 리스너 해제 오류:', error);
                        }
                        gameState.realtimeListener = null;
                    }
                    location.reload();
                }
            }
        });
}

// UI 관련 함수들
function showScreen(screenName) {
    console.log('화면 전환 시도:', screenName, '로그인 상태:', gameState.isLoggedIn);
    
    // 로그인이 안 된 상태에서는 무조건 아무것도 하지 않음
    if (!gameState.isLoggedIn) {
        console.log('로그인이 필요합니다. 화면 전환 차단됨');
        return false; // 아무것도 하지 않음
    }

    // 화면 전환 시 코드 결과 메시지 자동 제거
    const codeResult = document.getElementById('codeResult');
    if (codeResult) {
        codeResult.innerHTML = '';
    }
   
    // 로그인된 상태에서만 정상적인 화면 전환
    document.querySelectorAll('.screen').forEach(function(screen) {
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
    document.querySelectorAll('.nav-item').forEach(function(item) {
        item.classList.remove('active');
    });

    const navItems = document.querySelectorAll('.nav-item');
    const buttonScreens = ['home', 'role', 'codeInput', 'result'];
    navItems.forEach(function(button, index) {
        if (buttonScreens[index] === screenName) {
            button.classList.add('active');
        }
    });
    
    // 결과 화면일 때만 데이터 로드
    if (screenName === 'result' && gameState.isLoggedIn) {
        setupResultScreen().catch(function(error) {
            console.error('결과 화면 설정 오류:', error);
        });
    }
    
    return true;
}

// 게임 상태
let gameState = {
    isLoggedIn: false,
    player: null,
    role: null,
    secretCode: null,
    results: [],
    isAlive: true,
    deathTimer: null,
    usedCodes: [], // 내가 이미 입력한 시크릿 코드 목록
    receivedInteractions: {}, // 내가 상대에게 코드를 입력당한 기록
    realtimeListener: null,
    interactionMission: null, // 상호작용 미션
    secretTitle: null, // 시크릿 코드 제목
    secretContent: null, // 시크릿 코드 내용
    // 랭킹 관련 추가
    merchantRank: null,
    totalMerchants: null,
    merchantRankingListener: null,
    // 🆕 범인 관련 추가
    criminalMoney: 0
};
// 2단계: 범인 상점 기본 변수 - game.js 상단(gameState 변수 근처)에 추가

// 범인 상점 관련 변수 (gameState 아래에 추가)
let criminalMoney = 0;
let criminalShopItems = [
    {
        id: 'extra_kills',
        name: '🔪 암살 기회 확장',
        description: '제거 기회를 3회 추가로 획득합니다',
        price: 150,
        available: true,
        maxPurchases: 2, // 최대 2번까지 구매 가능
        purchased: 0
    }
];

// 범인 돈 초기화 함수
function initializeCriminalMoney() {
    if (gameState.role === 'criminal') {
        loadCriminalMoney();
    }
}

// 서버에서 범인 돈 정보 로드
async function loadCriminalMoney() {
    
    console.log('🔍 loadCriminalMoney 함수 시작 - 플레이어:', gameState.player.loginCode); // 🆕 디버깅 로그
    
    try {
        const playerDoc = await db.collection('activePlayers').doc(gameState.player.loginCode).get();
        console.log('🔍 플레이어 문서 존재 여부:', playerDoc.exists); // 🆕 디버깅 로그
        
        if (playerDoc.exists) {
            const data = playerDoc.data();
            console.log('🔍 서버 데이터 전체:', data);
            console.log('🔍 서버 criminalMoney:', data.criminalMoney);
            console.log('🔍 서버 criminalMoney 타입:', typeof data.criminalMoney);
            
            // 🔧 criminalMoney 복원 (undefined/null 체크 강화)
            if (data.hasOwnProperty('criminalMoney') && data.criminalMoney !== null && data.criminalMoney !== undefined) {
                criminalMoney = data.criminalMoney;
                console.log('🔍 criminalMoney 복원:', criminalMoney);
            } else {
                console.log('🔍 criminalMoney 필드가 없거나 null/undefined - 0으로 초기화');
                criminalMoney = 0;
            }
            
            console.log('범인 돈 로드 완료:', criminalMoney + '원');
            
            // 🆕 maxKills도 복원
            if (data.maxKills) {
                console.log('최대 킬 횟수 복원:', data.maxKills + '회');
            }
            
            // 구매 이력도 복원
            if (data.criminalShopPurchases) {
                criminalShopItems.forEach(item => {
                    const purchased = data.criminalShopPurchases[item.id] || 0;
                    item.purchased = purchased;
                    if (purchased >= item.maxPurchases) {
                        item.available = false;
                    } else {
                        item.available = true; // 🆕 명시적으로 available 설정
                    }
                });
                console.log('상점 구매 이력 복원:', data.criminalShopPurchases); // 디버깅용
            } else {
                // 🆕 구매 이력이 없는 경우 모든 아이템을 구매 가능 상태로 초기화
                criminalShopItems.forEach(item => {
                    item.purchased = 0;
                    item.available = true;
                });
            }
            
            // 🆕 gameState에도 동기화
            gameState.criminalMoney = criminalMoney;
            
        } else {
            console.log('플레이어 문서가 존재하지 않음 - criminalMoney를 0으로 초기화');
            criminalMoney = 0;
            gameState.criminalMoney = 0;
        }
    } catch (error) {
        console.error('범인 돈 정보 로드 오류:', error);
        criminalMoney = 0;
        gameState.criminalMoney = 0;
    }
}
// 3단계: 범인 돈 획득 시스템 - game.js에 추가

// 범인 돈 업데이트 (제거 성공 시 호출)
async function updateCriminalMoney(targetRole, amount) {
    try {
        criminalMoney += amount;
        
        // 서버에 업데이트
        await db.collection('activePlayers').doc(gameState.player.loginCode).update({
            criminalMoney: criminalMoney,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        console.log('범인 돈 업데이트:', amount + '원 획득, 총:', criminalMoney + '원');
        
        // 돈 획득 알림 표시
        showCriminalMoneyNotification(targetRole, amount);
        
        // 결과 화면이 열려있으면 업데이트
        if (document.getElementById('resultScreen').classList.contains('active')) {
            setupResultScreen();
        }
        
    } catch (error) {
        console.error('범인 돈 업데이트 오류:', error);
    }
}

// 돈 획득 알림 팝업 표시
function showCriminalMoneyNotification(targetRole, amount) {
    const roleNames = {
        'merchant': '상인',
        'detective': '탐정'
    };
    
    // 🆕 구매 가능 여부 확인
    const canBuyItems = criminalMoney >= 150;
    const availableItems = criminalShopItems.filter(item => item.available);
    const hasAvailableItems = availableItems.length > 0;
    
    let extraMessage = '';
    if (canBuyItems && hasAvailableItems) {
        extraMessage = '<div style="margin-top: 8px; padding: 6px 10px; background: rgba(255,255,255,0.2); border-radius: 6px; font-size: 0.85em;">💡 암시장에서 아이템 구매 가능!</div>';
    }
    
    const notification = document.createElement('div');
    notification.className = 'criminal-money-notification';
    notification.innerHTML = `
        <div class="money-notification-content">
            <div class="money-icon">💰</div>
            <div class="money-text">
                <strong>🎯 제거 성공!</strong><br>
                +${amount}원 획득!
                ${extraMessage}
            </div>
            <div class="total-money">총 ${criminalMoney.toLocaleString()}원</div>
        </div>
    `;
    
    // 🆕 개선된 팝업 스타일 (구매 가능할 때 다른 색상)
    let bgGradient = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
    if (canBuyItems && hasAvailableItems) {
        bgGradient = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
    }
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${bgGradient};
        color: white;
        padding: 15px 20px;
        border-radius: 12px;
        box-shadow: 0 8px 25px rgba(239, 68, 68, 0.3);
        z-index: 9999;
        transform: translateX(300px);
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        max-width: 300px;
        cursor: pointer;
    `;
    
    // 🆕 클릭 시 암시장 열기 기능
    notification.addEventListener('click', function() {
        // 결과 화면으로 이동
        showScreen('result');
        
        // 잠시 후 암시장 열기
        setTimeout(() => {
            if (canBuyItems && hasAvailableItems) {
                openCriminalShop();
            }
        }, 500);
        
        // 알림 제거
        notification.style.transform = 'translateX(300px)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 300);
    });
    
    document.body.appendChild(notification);
    
    // 슬라이드 인 애니메이션
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // 🆕 자동 제거 시간 조정 (구매 가능하면 더 오래 표시)
    const autoRemoveTime = (canBuyItems && hasAvailableItems) ? 5000 : 3000;
    
    setTimeout(() => {
        notification.style.transform = 'translateX(300px)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 300);
    }, autoRemoveTime);
}

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

// 나의 시크릿 코드 토글 함수
function toggleMySecret() {
    const secretSection = document.querySelector('.my-secret-section');
    const toggleIcon = document.getElementById('secretToggleIcon');
    
    if (secretSection && toggleIcon) {
        secretSection.classList.toggle('expanded');
        
        // 부드러운 아이콘 전환 애니메이션
        toggleIcon.style.transform = 'scale(0)';
        
        setTimeout(() => {
            if (secretSection.classList.contains('expanded')) {
                toggleIcon.textContent = '🔓'; // 잠금 해제
            } else {
                toggleIcon.textContent = '🔒'; // 잠금
            }
            
            // 아이콘이 나타나는 애니메이션
            toggleIcon.style.transform = 'scale(1)';
        }, 200);
    }
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

// 간편 로그인 함수 (이미 등록된 사용자) - 재접속 기능 추가
async function quickLogin() {
    console.log('간편 로그인 시도');
    
    // 게임 상태 확인 (로그인만 체크)
    const isGameActive = await checkGameStatus();
    if (!isGameActive) {
        alert('게임이 아직 시작되지 않았습니다. 관리자가 게임을 시작할 때까지 기다려주세요.');
        return;
    }
    
    const loginCode = document.getElementById('quickLoginCode').value.toUpperCase();
    const reconnectPassword = document.getElementById('quickLoginPassword').value;

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
        
        // 사망 상태 확인 (제거된 플레이어 로그인 방지)
        const activePlayerDoc = await db.collection('activePlayers').doc(loginCode).get();
        let previousData = {};
        
        if (activePlayerDoc.exists) {
            const activeData = activePlayerDoc.data();
            if (!activeData.isAlive) {
                throw new Error('게임에서 제거되어 접속할 수 없습니다. 관리자가 부활시킬 때까지 기다려주세요.');
            }
            
            // 이미 접속 중인 경우 재접속 비밀번호 확인
            if (activeData.isActive) {
                if (!reconnectPassword) {
                    throw new Error('재접속 비밀번호를 입력해주세요.');
                }
                if (userData.reconnectPassword !== reconnectPassword) {
                    throw new Error('재접속 비밀번호가 올바르지 않습니다.');
                }
                console.log('재접속 비밀번호 확인됨 - 재접속 허용');
            }
            
            // 기존 데이터 보존 (결과, 킬카운트, 돈, 상호작용 기록 등)
            previousData = {
                results: activeData.results || [],
                killCount: activeData.killCount || 0,
                money: activeData.money || 0,
                usedCodes: activeData.usedCodes || [], // 사용된 코드 목록도 보존
                receivedInteractions: activeData.receivedInteractions || {},
                // 🆕 범인 관련 데이터도 보존
                criminalMoney: activeData.criminalMoney || 0,
                maxKills: activeData.maxKills || 3,
                criminalShopPurchases: activeData.criminalShopPurchases || {}
            };
        }

                // 활성 플레이어로 등록 (기존 데이터 유지)
                if (activePlayerDoc.exists) {
                    // 🆕 이미 문서가 존재하는 경우 - 필요한 필드만 업데이트
                    const updateData = {
                        name: userData.name,
                        position: userData.position,
                        role: userData.role,
                        secretCode: userData.secretCode,
                        reconnectPassword: userData.reconnectPassword,
                        isAlive: true,
                        isActive: true,
                        loginTime: firebase.firestore.FieldValue.serverTimestamp()
                    };
                    
                    console.log('🔍 기존 문서 업데이트 - criminalMoney 보존');
                    await db.collection('activePlayers').doc(loginCode).update(updateData);
                } else {
                    // 🆕 문서가 없는 경우에만 새로 생성
                    const playerData = {
                        name: userData.name,
                        position: userData.position,
                        role: userData.role,
                        secretCode: userData.secretCode,
                        reconnectPassword: userData.reconnectPassword,
                        isAlive: true,
                        isActive: true,
                        results: [],
                        killCount: 0,
                        money: 0,
                        usedCodes: [],
                        receivedInteractions: {},
                        loginTime: firebase.firestore.FieldValue.serverTimestamp()
                    };
                    
                    // 범인인 경우 범인 관련 데이터도 추가
                    if (userData.role === 'criminal') {
                        playerData.criminalMoney = 0;
                        playerData.maxKills = 3;
                        playerData.criminalShopPurchases = {};
                    }
                    
                    console.log('🔍 새 문서 생성');
                    await db.collection('activePlayers').doc(loginCode).set(playerData);
                }
        // 게임 상태 설정
        gameState.player = {
            name: userData.name,
            position: userData.position,
            loginCode: loginCode
        };
        gameState.role = userData.role;
        gameState.secretCode = userData.secretCode;
        gameState.isLoggedIn = true;
        gameState.usedCodes = previousData.usedCodes || []; // 사용된 코드 목록 복원
        gameState.receivedInteractions = previousData.receivedInteractions || {};

        setTimeout(function() {
            completeLogin();
        }, 1000);

    } catch (error) {
        document.getElementById('loginLoading').style.display = 'none';
        alert(error.message);
        console.error('간편 로그인 오류:', error);
    }
}

// 등록 함수 (처음 사용자) - 게임 시작 여부 관계없이 등록 가능
async function register() {
    console.log('등록 시도');
    
    // 등록은 게임 시작 여부와 관계없이 항상 가능
    const loginCode = document.getElementById('registerCode').value.toUpperCase();
    const playerName = document.getElementById('playerName').value;
    const playerPosition = document.getElementById('playerPosition').value;
    const reconnectPassword = document.getElementById('reconnectPassword').value;

    if (!loginCode || !playerName || !playerPosition || !reconnectPassword) {
        alert('모든 정보를 입력해주세요.');
        return;
    }

    if (reconnectPassword.length < 4) {
        alert('재접속 비밀번호는 4자리 이상이어야 합니다.');
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

        // 등록된 사용자로 저장 (영구 저장) - 재접속 비밀번호 포함
        const userData = {
            name: playerName,
            position: playerPosition,
            role: codeData.role,
            secretCode: codeData.secretCode,
            reconnectPassword: reconnectPassword,
            registeredAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('registeredUsers').doc(loginCode).set(userData);

        // 게임 시작 여부 확인
        const isGameActive = await checkGameStatus();
        
        if (isGameActive) {
            // 게임이 시작된 경우에만 활성 플레이어로 등록
            await db.collection('activePlayers').doc(loginCode).set({
                name: userData.name,
                position: userData.position,
                role: userData.role,
                secretCode: userData.secretCode,
                reconnectPassword: userData.reconnectPassword,
                isAlive: true,
                isActive: true,
                results: [], // 🆕 새 등록자는 빈 배열로 시작
                killCount: 0, // 🆕 새 등록자는 0으로 시작
                money: 0, // 🆕 새 등록자는 0원으로 시작
                usedCodes: [], // 🆕 새 등록자는 빈 배열로 시작
                receivedInteractions: {}, // 🆕 새 등록자는 빈 객체로 시작
                // 범인인 경우 범인 관련 데이터도 추가
                ...(userData.role === 'criminal' && {
                    criminalMoney: 0, // 🆕 새 범인은 0원으로 시작
                    maxKills: await getDefaultMaxKills(),
                    criminalShopPurchases: {}
                }),
                loginTime: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

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

        document.getElementById('loginLoading').style.display = 'none';
        
        if (isGameActive) {
            // 게임이 시작된 경우 바로 로그인
            setTimeout(function() {
                completeLogin();
            }, 1000);
        } else {
            // 게임이 시작되지 않은 경우 대기 메시지
            alert('등록이 완료되었습니다! 관리자가 게임을 시작할 때까지 기다려주시고 게임 시작 후 다시 로그인해주세요.');
            
            // 폼 초기화
            document.getElementById('registerCode').value = '';
            document.getElementById('playerName').value = '';
            document.getElementById('playerPosition').value = '';
            document.getElementById('reconnectPassword').value = '';
            
            // 게임 상태 초기화
            gameState = {
                isLoggedIn: false,
                player: null,
                role: null,
                secretCode: null,
                results: [],
                isAlive: true,
                deathTimer: null,
                usedCodes: [],
                receivedInteractions: {},
                realtimeListener: null
            };
        }

    } catch (error) {
        document.getElementById('loginLoading').style.display = 'none';
        
        // 로그인 코드 부족 시 특별 메시지
        if (error.message.includes('유효하지 않은')) {
            alert('유효하지 않은 로그인 코드입니다. 관리자에게 문의하세요.');
        } else {
            alert(error.message);
        }
        console.error('등록 오류:', error);
    }
}
// 🆕 기본 maxKills 값을 가져오는 헬퍼 함수
async function getDefaultMaxKills() {
    try {
        const settingsDoc = await db.collection('gameSettings').doc('config').get();
        if (settingsDoc.exists && settingsDoc.data().maxKills) {
            return settingsDoc.data().maxKills;
        }
    } catch (error) {
        console.error('기본 maxKills 가져오기 오류:', error);
    }
    return 3; // 기본값
}
// 로그인 완료 처리 공통 함수
async function completeLogin() {
    document.getElementById('loginLoading').style.display = 'none';
    
    // 헤더를 compact 모드로 변경 및 컨텐츠 조정
    const header = document.querySelector('.header');
    const content = document.querySelector('.content');
    header.classList.add('compact');
    content.classList.add('compact');
    
    // 로그인 화면 숨기기
    document.getElementById('loginScreen').classList.remove('active');
    document.getElementById('homeScreen').classList.add('active');
    
    // 하단 네비게이션 표시 및 활성화
    const bottomNav = document.getElementById('bottomNav');
    bottomNav.style.display = 'flex';
    
    // 네비게이션 버튼 활성화
    document.getElementById('roleNavBtn').classList.remove('disabled');
    document.getElementById('codeInputNavBtn').classList.remove('disabled');
    document.getElementById('resultNavBtn').classList.remove('disabled');
    document.getElementById('logoutNavBtn').style.display = 'flex';
    
    // 홈 버튼 활성화
    document.getElementById('homeNavBtn').classList.add('active');
    
    // 상호작용 미션 가져오기
    await loadInteractionMission();
    
    setupRoleCard();
    
    // 공지사항 로드
    await loadNotices();
    
    // 공지사항 실시간 리스너 설정
    setupNoticesListener();
    
    // 로그인 코드 변경 실시간 리스너 설정
    setupLoginCodesListener();
    
    setupResultScreen().catch(function(error) {
        console.error('결과 화면 설정 오류:', error);
    });
    
    // 상호작용 카운트 업데이트 (누적 유지)
    updateInteractionCount();
    
setupRealtimeListener();
    
    console.log('로그인 완료!');
    // 🆕 범인인 경우 돈 정보 로드 (다른 초기화보다 먼저)
    if (gameState.role === 'criminal') {
        await loadCriminalMoney();
        console.log('범인 돈 로드 완료:', criminalMoney + '원');
    }
    
    setupRealtimeListener();
    
    // 상인인 경우 랭킹 시스템 초기화
    if (gameState.role === 'merchant') {
        const { rank, totalMerchants } = await calculateMerchantRanking();
        gameState.merchantRank = rank;
        gameState.totalMerchants = totalMerchants;
        setupMerchantRankingListener();
    }
    
    console.log('로그인 완료!');
}

// 상호작용 미션이나 시크릿 코드 내용 변경 감지
async function checkForContentUpdates() {
    if (!gameState.isLoggedIn || !gameState.secretCode) {
        return;
    }
    
    try {
        const loginCodesSnapshot = await db.collection('loginCodes')
            .where('secretCode', '==', gameState.secretCode)
            .limit(1)
            .get();
        
        if (!loginCodesSnapshot.empty) {
            const loginCodeData = loginCodesSnapshot.docs[0].data();
            const newMission = loginCodeData.interactionMission || '미션 정보가 없습니다.';
            const newSecretTitle = loginCodeData.secretTitle || '';
            const newSecretContent = loginCodeData.secretContent || '';
            
            // 상호작용 미션이 변경된 경우
            if (gameState.interactionMission && gameState.interactionMission !== newMission) {
                console.log('상호작용 미션이 변경되었습니다.');
                gameState.interactionMission = newMission;
                setupRoleCard(); // 역할 카드 업데이트
                alert('관리자가 상호작용 미션을 업데이트했습니다. 새로운 미션을 확인해주세요!');
            }
            
            // 시크릿 코드 제목이나 내용이 변경된 경우 (처음 로드가 아닌 경우에만)
            if (gameState.secretTitle && gameState.secretContent) {
                if (gameState.secretTitle !== newSecretTitle || gameState.secretContent !== newSecretContent) {
                    console.log('시크릿 코드 내용이 변경되었습니다.');
                    gameState.secretTitle = newSecretTitle;
                    gameState.secretContent = newSecretContent;
                    alert('관리자가 시크릿 코드 정보를 업데이트했습니다. 변경된 내용을 확인해주세요!');
                }
            }
            
            // 처음 로드하는 경우 데이터 저장 (알림 없음)
            if (!gameState.interactionMission) {
                gameState.interactionMission = newMission;
            }
            if (!gameState.secretTitle) {
                gameState.secretTitle = newSecretTitle;
            }
            if (!gameState.secretContent) {
                gameState.secretContent = newSecretContent;
            }
        }
    } catch (error) {
        console.error('콘텐츠 업데이트 확인 오류:', error);
    }
}

// 로그인 코드 컬렉션 실시간 리스너 설정
function setupLoginCodesListener() {
    if (!gameState.isLoggedIn || !gameState.secretCode) {
        return;
    }
    
    // 내 시크릿 코드에 해당하는 로그인 코드 문서 감지
    db.collection('loginCodes')
        .where('secretCode', '==', gameState.secretCode)
        .onSnapshot(function(snapshot) {
            if (!gameState.isLoggedIn) {
                return;
            }
            
            snapshot.docChanges().forEach(function(change) {
                if (change.type === 'modified') {
                    console.log('로그인 코드 정보가 수정되었습니다.');
                    checkForContentUpdates();
                }
            });
        });
}
function updateInteractionCount() {
    if (gameState.isLoggedIn) {
        // 내가 입력한 코드 수
        const myInputCount = gameState.usedCodes ? gameState.usedCodes.length : 0;
        
        // 상대가 나에게 입력한 코드 수
        const receivedCount = gameState.receivedInteractions ? Object.keys(gameState.receivedInteractions).length : 0;
        
        // 전체 상호작용 수 (중복 제거 필요 없음 - 양방향 모두 카운트)
        const totalCount = myInputCount + receivedCount;
        
        const counterElement = document.getElementById('interactionCount');
        if (counterElement) {
            counterElement.textContent = totalCount;
        }
    }
}

async function loadInteractionMission() {
    try {
        const loginCodesSnapshot = await db.collection('loginCodes')
            .where('secretCode', '==', gameState.secretCode)
            .limit(1)
            .get();
        
        if (!loginCodesSnapshot.empty) {
            const loginCodeData = loginCodesSnapshot.docs[0].data();
            gameState.interactionMission = loginCodeData.interactionMission || '미션 정보가 없습니다.';
        } else {
            gameState.interactionMission = '미션 정보를 찾을 수 없습니다.';
        }
    } catch (error) {
        console.error('상호작용 미션 로드 오류:', error);
        gameState.interactionMission = '미션 정보 로드 실패';
    }
}

// 🆕 이미지 URL 검증이 추가된 loadNotices 함수 (기존 함수 교체)
async function loadNotices() {
    try {
        const noticesSnapshot = await db.collection('notices')
            .orderBy('createdAt', 'desc')
            .limit(10)
            .get();
        
        const noticesContainer = document.getElementById('noticesContainer');
        
        if (noticesSnapshot.empty) {
            noticesContainer.innerHTML = '<p style="text-align: center; color: #666; font-size: 0.9em;">등록된 공지사항이 없습니다.</p>';
            return;
        }

        let html = '<div class="notices-list">';
        noticesSnapshot.forEach(function(doc, index) {
            const notice = doc.data();
            
            // 🆕 이미지 HTML을 onclick 없이 생성 (나중에 JavaScript로 이벤트 추가)
            let imageHtml = '';
            if (notice.imageUrl && notice.imageUrl.trim() !== '' && notice.imageUrl !== 'null') {
                console.log('공지사항 이미지 URL:', notice.imageUrl);
                imageHtml = '<div class="notice-image-container" style="margin-bottom: 12px;">' +
                           '<img src="' + notice.imageUrl + '" alt="공지사항 이미지" ' +
                           'style="width: 100%; max-height: 300px; object-fit: contain; border-radius: 8px; ' +
                           'box-shadow: 0 2px 8px rgba(0,0,0,0.1); cursor: pointer;" ' +
                           // 🆕 onclick 제거! data 속성으로 URL 저장
                           'data-image-url="' + notice.imageUrl + '" ' +
                           'class="notice-modal-image" ' +
                           'onerror="this.style.display=\'none\'; console.error(\'공지사항 이미지 로드 실패:\', this.src);">' +
                           '</div>';
            } else {
                console.log('공지사항에 유효한 이미지 없음:', notice.imageUrl);
            }
            
            html += '<div class="notice-item" id="notice-' + doc.id + '">' +
                    '<div class="notice-header" onclick="toggleNotice(\'' + doc.id + '\', event)">' +
                    '<div class="notice-title">' + notice.title + '</div>' +
                    '<div class="notice-toggle">▼</div>' +
                    '</div>' +
                    '<div class="notice-content">' +
                    imageHtml + // 🆕 onclick 없는 이미지 HTML
                    '<div class="notice-text">' + formatTextWithLineBreaks(notice.content) + '</div>' +
                    '</div>' +
                    '</div>';
        });
        html += '</div>';
        
        noticesContainer.innerHTML = html;
        
        // 🆕 HTML 삽입 후 이미지 클릭 이벤트를 별도로 추가
        setupNoticeImageEvents();
        
    } catch (error) {
        console.error('공지사항 로드 오류:', error);
        const noticesContainer = document.getElementById('noticesContainer');
        if (noticesContainer) {
            noticesContainer.innerHTML = '<p style="text-align: center; color: #666; font-size: 0.9em;">공지사항을 불러올 수 없습니다.</p>';
        }
    }
}

// 🆕 공지사항 이미지 클릭 이벤트 별도 설정 함수
function setupNoticeImageEvents() {
    const images = document.querySelectorAll('.notice-modal-image');
    
    images.forEach(function(img) {
        // 🆕 기존 이벤트 리스너 제거 (중복 방지)
        img.removeEventListener('click', handleNoticeImageClick);
        
        // 🆕 새로운 이벤트 리스너 추가
        img.addEventListener('click', handleNoticeImageClick);
    });
    
    console.log('공지사항 이미지 이벤트 설정 완료:', images.length + '개');
}

// 🆕 공지사항 이미지 클릭 핸들러 함수
function handleNoticeImageClick(event) {
    // 🆕 이벤트 전파 완전 차단
    event.stopPropagation();
    event.preventDefault();
    
    const imageUrl = event.target.getAttribute('data-image-url');
    
    console.log('공지사항 이미지 클릭됨:', imageUrl);
    
    if (imageUrl) {
        openImageModal(imageUrl);
    } else {
        console.error('이미지 URL을 찾을 수 없음');
    }
}


// 🆕 개선된 toggleNotice 함수 (기존 함수 교체)
function toggleNotice(noticeId, event) {
    // 🆕 이벤트 전파 방지 추가
    if (event) {
        event.stopPropagation();
    }
    
    const noticeElement = document.getElementById('notice-' + noticeId);
    if (!noticeElement) return;
    
    const isExpanded = noticeElement.classList.contains('expanded');
    
    console.log('토글 요청:', noticeId, isExpanded ? '닫기' : '열기');
    
    if (isExpanded) {
        // 닫기
        noticeElement.classList.remove('expanded');
        console.log('공지사항 닫기:', noticeId);
    } else {
        // 다른 모든 공지사항 먼저 닫기
        document.querySelectorAll('.notice-item.expanded').forEach(item => {
            if (item.id !== 'notice-' + noticeId) {
                item.classList.remove('expanded');
                console.log('다른 공지사항 닫기:', item.id);
            }
        });
        
        // 클릭한 공지사항 열기
        noticeElement.classList.add('expanded');
        console.log('공지사항 열기:', noticeId);
    }
}

function formatTextWithLineBreaks(text) {
    if (!text) return '';
    return text.replace(/\n/g, '<br>');
}
// 공지사항 실시간 리스너 설정
function setupNoticesListener() {
    // 로그인 상태에서만 공지사항 실시간 감지
    if (gameState.isLoggedIn) {
        let isFirstLoad = true; // 첫 로드인지 확인하는 플래그
        
        db.collection('notices')
            .orderBy('createdAt', 'desc')
            .limit(10)
            .onSnapshot(function(snapshot) {
                console.log('공지사항 업데이트 감지');
                
                // 첫 로드가 아닌 경우에만 신규 공지사항 알림
                if (!isFirstLoad) {
                    // 변경된 문서들 확인
                    snapshot.docChanges().forEach(function(change) {
                        if (change.type === 'added') {
                            const newNotice = change.doc.data();
                            
                            // 새로운 공지사항 알림
                            showNoticeAlert(newNotice.title, newNotice.content);
                            
                            console.log('새로운 공지사항 알림:', newNotice.title);
                        }
                    });
                }
                
                // 공지사항 목록 업데이트
                loadNotices();
                
                // 첫 로드 완료 표시
                isFirstLoad = false;
            });
    }
}

// 🆕 공지사항 알림에서도 이미지 표시 (기존 함수 수정)
function showNoticeAlert(title, content, onCloseCallback) {
    // 🆕 휴대폰 진동 발생 (공지사항 특별 패턴)
    triggerNotificationVibration();
    
    // 기존 공지사항 알림이 있으면 제거
    const existingAlert = document.querySelector('.notice-alert');
    if (existingAlert) {
        existingAlert.remove();
    }
    
    // 알림 요소 생성
    const alert = document.createElement('div');
    alert.className = 'notice-alert';
    alert.innerHTML = 
        '<div class="notice-alert-content">' +
        '<div class="notice-alert-header">' +
        '<span class="notice-alert-icon">📢</span>' +
        '<span class="notice-alert-title">새로운 공지사항</span>' +
        '<button class="notice-alert-close" onclick="closeNoticeAlert()">&times;</button>' +
        '</div>' +
        '<div class="notice-alert-body">' +
        '<div class="notice-alert-subject">' + title + '</div>' +
        '<div class="notice-alert-text">' + content + '</div>' +
        '</div>' +
        '<div class="notice-alert-actions">' +
        '<button class="notice-alert-btn confirm" onclick="goToNotices()">공지사항 보기</button>' +
        '<button class="notice-alert-btn dismiss" onclick="closeNoticeAlert()">확인</button>' +
        '</div>' +
        '</div>';

    // 페이지에 추가
    document.body.appendChild(alert);

    // 콜백 함수 저장 (닫기 시 호출하기 위해)
    if (onCloseCallback) {
        alert._onCloseCallback = onCloseCallback;
    }

    // 애니메이션으로 표시
    setTimeout(() => {
        alert.classList.add('show');
    }, 100);

    // 10초 후 자동 제거
    setTimeout(() => {
        if (alert.parentNode) {
            closeNoticeAlert();
        }
    }, 10000);
}


// 🆕 공지사항 전용 진동 패턴 함수
function triggerNotificationVibration() {
    // 진동 API 지원 여부 확인
    if ('vibrate' in navigator) {
        try {
            // 공지사항 전용 진동 패턴 (짧게-길게-짧게-길게)
            // [진동시간, 쉬는시간, 진동시간, 쉬는시간, ...]
            const notificationPattern = [200, 100, 300, 100, 200, 100, 300];
            
            navigator.vibrate(notificationPattern);
            console.log('📱 공지사항 진동 실행');
            
        } catch (error) {
            console.log('진동 실행 실패:', error);
        }
    } else {
        console.log('이 기기는 진동을 지원하지 않습니다');
    }
}

// 🆕 다양한 진동 패턴 함수들 (추가 기능)
function triggerVibrationPattern(type) {
    if ('vibrate' in navigator) {
        let pattern = [];
        
        switch (type) {
            case 'notification':
                // 공지사항: 짧게-길게-짧게-길게
                pattern = [200, 100, 300, 100, 200, 100, 300];
                break;
            case 'alert':
                // 경고: 길게 3번
                pattern = [500, 200, 500, 200, 500];
                break;
            case 'success':
                // 성공: 짧게 2번
                pattern = [100, 100, 100];
                break;
            case 'error':
                // 오류: 매우 길게 1번
                pattern = [1000];
                break;
            case 'rank-up':
                // 순위 상승: 빠르게 여러 번
                pattern = [50, 50, 50, 50, 50, 50, 50, 100, 200];
                break;
            default:
                // 기본: 한 번만
                pattern = [200];
        }
        
        try {
            navigator.vibrate(pattern);
            console.log('📱 ' + type + ' 진동 실행');
        } catch (error) {
            console.log('진동 실행 실패:', error);
        }
    }
}


// 🆕 공지사항 알림 닫기 함수
function closeNoticeAlert() {
    const alert = document.querySelector('.notice-alert');
    if (alert) {
        alert.classList.remove('show');
        setTimeout(() => {
            if (alert.parentNode) {
                alert.remove();
            }
        }, 300);
    }
}

// 🆕 공지사항 화면으로 이동 함수
function goToNotices() {
    closeNoticeAlert();
    showScreen('home'); // 홈 화면으로 이동 (공지사항이 홈에 있음)
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
// 실시간 리스너들 해제
        if (gameState.realtimeListener) {
            try {
                gameState.realtimeListener();
            } catch (error) {
                console.error('리스너 해제 오류:', error);
            }
            gameState.realtimeListener = null;
        }

        // 상인 랭킹 리스너 해제
        if (gameState.merchantRankingListener) {
            try {
                gameState.merchantRankingListener();
            } catch (error) {
                console.error('랭킹 리스너 해제 오류:', error);
            }
            gameState.merchantRankingListener = null;
        }

        // Firestore 업데이트 (로그인 상태일 때만)
        if (gameState.player && gameState.player.loginCode) {
            await db.collection('activePlayers').doc(gameState.player.loginCode).update({
                isActive: false,
                logoutTime: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

        // 🆕 범인 관련 변수도 초기화
        criminalMoney = 0;
        criminalShopItems.forEach(item => {
            item.purchased = 0;
            item.available = true;
        });

        gameState = {
            isLoggedIn: false,
            player: null,
            role: null,
            secretCode: null,
            results: [],
            isAlive: true,
            deathTimer: null,
            usedCodes: [],
            receivedInteractions: {},
            realtimeListener: null,
            interactionMission: null,
            secretTitle: null,
            secretContent: null,
            merchantRank: null,
            totalMerchants: null,
            merchantRankingListener: null,
            criminalMoney: 0 // 🆕 추가
        };
        // 헤더를 원래 상태로 복구 및 컨텐츠 원상복구
        const header = document.querySelector('.header');
        const content = document.querySelector('.content');
        header.classList.remove('compact');
        content.classList.remove('compact');

        // 모든 화면 숨기고 로그인 화면만 표시
        document.querySelectorAll('.screen').forEach(function(screen) {
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
        if (document.getElementById('quickLoginPassword')) {
            document.getElementById('quickLoginPassword').value = '';
        }
        document.getElementById('registerCode').value = '';
        document.getElementById('playerName').value = '';
        document.getElementById('playerPosition').value = '';
        if (document.getElementById('reconnectPassword')) {
            document.getElementById('reconnectPassword').value = '';
        }
        document.getElementById('targetCode').value = '';
        
        // 폼 상태 초기화 (간편 로그인 폼 표시)
        document.getElementById('registerForm').style.display = 'none';
        document.getElementById('quickLoginForm').style.display = 'block';
        
        // 결과 화면 내용 완전 초기화
        const codeResult = document.getElementById('codeResult');
        if (codeResult) codeResult.innerHTML = '';
        
        const resultContent = document.getElementById('resultContent');
        if (resultContent) resultContent.innerHTML = '';
        
        const resultTitle = document.getElementById('resultTitle');
        if (resultTitle) resultTitle.textContent = '내 결과';
        
        // 역할 카드 초기화
        const roleCard = document.getElementById('roleCard');
        if (roleCard) {
            roleCard.innerHTML = '';
            roleCard.className = 'role-card';
        }
        
        // 내 정보 화면 초기화
        const mySecretCode = document.getElementById('mySecretCode');
        if (mySecretCode) mySecretCode.textContent = '-';
        
        // 새로운 요소들 초기화
        const myNameElement = document.getElementById('myName');
        const myPositionElement = document.getElementById('myPosition');
        
        if (myNameElement) myNameElement.textContent = '-';
        if (myPositionElement) myPositionElement.textContent = '-';
        
        // 상호작용 카운트는 누적 유지 (초기화하지 않음)
        
        // 게임 상태 메시지 초기화
        const gameStatus = document.getElementById('gameStatus');
        if (gameStatus) {
            gameStatus.innerHTML = '<div class="status-message">게임이 진행 중입니다. 다른 플레이어들과 상호작용하며 목표를 달성하세요!</div>';
        }

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

    if (!gameState.isLoggedIn || !gameState.secretCode) {
        alert('로그인 상태를 확인해주세요.');
        return;
    }

    const now = Date.now();
    const mySecretCode = gameState.secretCode;
    
    // gameState 객체들 초기화 확인
    if (!gameState.usedCodes) {
        gameState.usedCodes = [];
    }
    if (!gameState.receivedInteractions) {
        gameState.receivedInteractions = {};
    }
    
    // 1. 내가 이미 입력한 코드인지 확인 (영구 차단)
    if (gameState.usedCodes.includes(targetCode)) {
        alert('한번 입력한 코드는 다시 입력할 수 없습니다.');
        return;
    }

    // 2. 상대가 나에게 코드를 입력했는지 확인 (역방향 쿨타임)
    if (gameState.receivedInteractions[targetCode]) {
        const interactionData = gameState.receivedInteractions[targetCode];
        if (interactionData.cooldownUntil && now < interactionData.cooldownUntil) {
            const remainingTime = Math.ceil((interactionData.cooldownUntil - now) / 1000);
            alert('이 플레이어가 최근에 당신과 상호작용했습니다. 잠시 후에 다시 시도하세요.');
            return;
        }
    }

    document.getElementById('codeLoading').style.display = 'block';

    try {
        // 활성 플레이어에서 시크릿 코드로 검색
        const playersSnapshot = await db.collection('activePlayers')
            .where('isActive', '==', true)
            .get();
        
        let targetPlayer = null;
        let targetPlayerId = null;
        
        playersSnapshot.forEach(function(doc) {
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

        // 상호작용 처리
        const result = await processSecretCode(targetPlayer, targetPlayerId);
        
        // 3. 내가 입력한 코드를 사용된 코드 목록에 추가 (영구 차단)
        gameState.usedCodes.push(targetCode);
        
        // 4. Firestore에도 사용된 코드 목록 업데이트
        await db.collection('activePlayers').doc(gameState.player.loginCode).update({
            usedCodes: firebase.firestore.FieldValue.arrayUnion(targetCode)
        });
        
        // 상호작용 카운트 업데이트
        updateInteractionCount();
        
        // 5. 상대방 Firestore에 내가 상호작용했다는 기록 저장
        await recordInteractionToTarget(targetPlayerId, mySecretCode);
        
        setTimeout(function() {
            document.getElementById('codeLoading').style.display = 'none';
            displayCodeResult(result);
            document.getElementById('targetCode').value = '';
            setupResultScreen().catch(function(error) {
                console.error('결과 화면 업데이트 오류:', error);
            });
        }, 1000);

    } catch (error) {
        document.getElementById('codeLoading').style.display = 'none';
        alert(error.message);
        console.error('시크릿 코드 처리 오류:', error);
    }
}

// 상대방에게 상호작용 기록 저장
async function recordInteractionToTarget(targetPlayerId, mySecretCode) {
    try {
        const interactionRecord = {
            fromSecretCode: mySecretCode,
            timestamp: Date.now(),
            cooldownUntil: Date.now() + 180000 // 3분 쿨다운
        };
        
        await db.collection('activePlayers').doc(targetPlayerId).update({
            ['receivedInteractions.' + mySecretCode]: interactionRecord
        });
        
        console.log('상대방(' + targetPlayerId + ')에게 상호작용 기록 저장됨');
    } catch (error) {
        console.error('상호작용 기록 저장 오류:', error);
    }
}

async function processSecretCode(targetPlayer, targetPlayerId) {
    let result = {
        targetCode: targetPlayer.secretCode,
        targetName: targetPlayer.name,
        targetPosition: targetPlayer.position,
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
                result.content = targetPlayer.name + '을(를) 제거할 수 있습니다.';
                result.canKill = true;
                result.executed = false;
                result.targetRole = targetPlayer.role;
                // 여기서는 killCount를 증가시키지 않음 (실제 공격 시에만 증가)
                break;

            case 'merchant':
                result.type = 'money';
                // 역할별 차등 거래 금액
                if (targetPlayer.role === 'merchant') {
                    // 상인끼리: 50~130원
                    result.amount = Math.floor(Math.random() * 81) + 50;
                } else if (targetPlayer.role === 'detective') {
                    // 탐정과 거래: 90~190원
                    result.amount = Math.floor(Math.random() * 101) + 90;
                } else if (targetPlayer.role === 'criminal') {
                    // 범인과 거래: 200~300원
                    result.amount = Math.floor(Math.random() * 101) + 200;
                }
                result.title = '거래 성공';
                result.content = result.amount + '원을 획득했습니다.';
                
                const currentMoney = myPlayerData.money || 0;
                await db.collection('activePlayers').doc(myPlayerId).update({
                    money: currentMoney + result.amount
                });
                
                 // 🆕 거래 성공 진동 (거래 금액에 따라 다른 패턴)
                if (result.amount >= 200) {
                    triggerVibrationPattern('success'); // 고액 거래
                } else {
                    triggerVibrationPattern('notification'); // 일반 거래
                }
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

// 🆕 수정된 시크릿 정보 가져오기 함수 (이미지 URL 포함)
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
                content: loginCodeData.secretContent,
                imageUrl: loginCodeData.secretImageUrl // 🆕 이미지 URL 추가
            };
        }
        
        return { title: null, content: null, imageUrl: null };
    } catch (error) {
        console.error('시크릿 정보 가져오기 오류:', error);
        return { title: null, content: null, imageUrl: null };
    }
}

function setupRoleCard() {
    const roleInfo = roleDescriptions[gameState.role];
    const roleCard = document.getElementById('roleCard');
    
    roleCard.className = 'role-card ' + roleInfo.className;
    roleCard.innerHTML = '<div class="role-title">' + roleInfo.title + '</div>' +
                        '<div class="role-description">' + roleInfo.description + '</div>';

    // 역할/S.C 화면의 내 정보 설정 - 한 줄로 표시
    document.getElementById('myName').textContent = gameState.player.name;
    document.getElementById('myPosition').textContent = gameState.player.position;
    document.getElementById('mySecretCode').textContent = gameState.secretCode;
    
    // 상호작용 미션 설정
    const missionElement = document.getElementById('myMission');
    if (missionElement) {
        missionElement.textContent = gameState.interactionMission || '미션 정보를 불러오는 중...';
    }
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
            resultTitle.textContent = '🔪 제거 대상 및 암시장';
            await displayCriminalResults(resultContent);
            break;

        case 'merchant':
            resultTitle.textContent = '💰 수익 현황';
            displayMerchantResults(resultContent);
            break;
    }
}

function showDeathMessage() {
    const gameStatus = document.getElementById('gameStatus');
    gameStatus.innerHTML = '<div class="status-message error">⚠️ 범인에게 제거되었습니다! 게임에서 제외됩니다.</div>';
}

// 🆕 수정된 시크릿 코드 결과 표시 함수 (기존 displayCodeResult 교체)
async function displayCodeResult(result) {
    const resultDiv = document.getElementById('codeResult');
    
    // 🆕 시크릿 정보에서 이미지 URL 가져오기
    let imageHtml = '';
    if (result.type === 'clue' || result.type === 'evidence') {
        try {
            const secretInfo = await getSecretInfoFromLoginCode(result.targetCode);
            if (secretInfo.imageUrl) {
                imageHtml = '<div class="secret-image-container" style="margin-bottom: 12px;">' +
                           '<img src="' + secretInfo.imageUrl + '" alt="증거 이미지" ' +
                           'style="width: 100%; max-height: 250px; object-fit: contain; border-radius: 8px; ' +
                           'box-shadow: 0 2px 8px rgba(0,0,0,0.1); cursor: pointer;" ' +
                           'onclick="openImageModal(\'' + secretInfo.imageUrl + '\')" ' +
                           'onerror="this.style.display=\'none\'; console.error(\'이미지 로드 실패:\', this.src);">' +
                           '</div>';
            }
        } catch (error) {
            console.error('시크릿 이미지 가져오기 오류:', error);
        }
    }
    
    let html = '<div class="status-message">' +
               '<strong>' + result.title + '</strong><br>' +
               imageHtml + // 🆕 이미지 먼저 표시
               // 🆕 줄바꿈 처리된 내용
               formatTextWithLineBreaks(result.content) + '</div>';
    resultDiv.innerHTML = html;
    
    triggerVibrationPattern('success');
}

// 🆕 수정된 탐정 결과 표시 함수 (기존 displayDetectiveResults 교체)
function displayDetectiveResults(container) {
    const clues = gameState.results.filter(function(r) { 
        return r.type === 'clue' || r.type === 'evidence'; 
    });
    
    if (clues.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #666;">아직 수집한 단서가 없습니다.</p>';
        return;
    }

    let html = '<div class="clues-list">';
    clues.forEach(function(clue, index) {
        // 각 단서마다 고유 ID 생성
        const clueId = 'clue-' + index;
        
        html += '<div class="clue-item" id="' + clueId + '">';
        html += '<div class="clue-header" onclick="toggleClue(\'' + clueId + '\', event)">';
        html += '<div class="clue-title">' + clue.title + '</div>';
        html += '<div class="clue-timestamp">' + clue.timestamp + '</div>';
        html += '<div class="clue-toggle">▼</div>';
        html += '</div>';
        html += '<div class="clue-content">';
        // 🆕 줄바꿈 처리된 단서 내용
        html += '<div class="clue-text">' + formatTextWithLineBreaks(clue.content) + '</div>';
        html += '</div>';
        html += '</div>';
    });
    html += '</div>';
    
    container.innerHTML = html;
    
    // 🆕 단서에 이미지 추가 (비동기로 처리)
    addImagesToClues(clues);
}
// 🆕 단서에 이미지를 추가하는 비동기 함수
// 🆕 addImagesToClues 함수에서 이미지 HTML 생성 부분 수정
async function addImagesToClues(clues) {
    for (let i = 0; i < clues.length; i++) {
        const clue = clues[i];
        const clueId = 'clue-' + i;
        
        try {
            const secretInfo = await getSecretInfoFromLoginCode(clue.targetCode);
            if (secretInfo.imageUrl) {
                const clueContent = document.querySelector('#' + clueId + ' .clue-content');
                if (clueContent) {
                    // 🆕 이벤트 전파 방지 추가
                    const imageHtml = '<div class="clue-image-container" style="margin-bottom: 12px;">' +
                                     '<img src="' + secretInfo.imageUrl + '" alt="단서 이미지" ' +
                                     'style="width: 100%; max-height: 200px; object-fit: contain; border-radius: 8px; ' +
                                     'box-shadow: 0 2px 8px rgba(0,0,0,0.1); cursor: pointer;" ' +
                                     // 🆕 이벤트 전파 방지 추가
                                     'onclick="event.stopPropagation(); openImageModal(\'' + secretInfo.imageUrl + '\')" ' +
                                     'onerror="this.style.display=\'none\'; console.error(\'이미지 로드 실패:\', this.src);">' +
                                     '</div>';
                    
                    const clueText = clueContent.querySelector('.clue-text');
                    if (clueText) {
                        clueText.insertAdjacentHTML('beforebegin', imageHtml);
                    }
                }
            }
        } catch (error) {
            console.error('단서 이미지 추가 오류:', error);
        }
    }
}

// 🆕 개선된 이미지 모달 열기 함수 (기존 openImageModal 함수 교체)
function openImageModal(imageUrl) {
    console.log('이미지 모달 열기 시도:', imageUrl);
    
    // 🆕 URL 유효성 검사
    if (!imageUrl || imageUrl.trim() === '' || imageUrl === 'null' || imageUrl === 'undefined') {
        console.error('유효하지 않은 이미지 URL:', imageUrl);
        alert('이미지를 불러올 수 없습니다. (URL이 비어있음)');
        return;
    }
    
    // 🆕 URL 형식 검사
    try {
        new URL(imageUrl);
    } catch (e) {
        console.error('잘못된 URL 형식:', imageUrl);
        alert('이미지를 불러올 수 없습니다. (잘못된 URL 형식)');
        return;
    }
    
    // 기존 모달이 있으면 제거
    const existingModal = document.querySelector('.image-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // 🆕 이미지 미리 로드 테스트
    const testImg = new Image();
    testImg.onload = function() {
        console.log('이미지 로드 성공:', imageUrl);
        createAndShowModal(imageUrl);
    };
    testImg.onerror = function() {
        console.error('이미지 로드 실패:', imageUrl);
        alert('이미지를 불러올 수 없습니다. (서버에서 이미지를 찾을 수 없음)');
    };
    testImg.src = imageUrl;
}

// 🆕 이미지 모달 창 닫기 함수
function closeImageModal() {
    const modal = document.querySelector('.image-modal');
    if (modal) {
        modal.style.animation = 'modalFadeIn 0.3s ease-out reverse';
        setTimeout(() => {
            if (modal.parentNode) {
                modal.remove();
            }
        }, 300);
    }
}
// 🆕 모달 생성 및 표시 함수
function createAndShowModal(imageUrl) {
    // 모달 HTML 생성
    const modal = document.createElement('div');
    modal.className = 'image-modal';
    modal.innerHTML = `
        <div class="image-modal-overlay" onclick="closeImageModal()"></div>
        <div class="image-modal-content">
            <button class="image-modal-close" onclick="closeImageModal()">&times;</button>
            <div class="image-loading" id="modalImageLoading">
                <div class="spinner"></div>
                <p>이미지 로딩 중...</p>
            </div>
            <img src="${imageUrl}" alt="확대 이미지" class="image-modal-img" 
                 onload="onModalImageLoad(this)" 
                 onerror="onModalImageError(this)">
        </div>
    `;
    
    // 모달 스타일 추가 (한 번만)
    if (!document.querySelector('style[data-image-modal]')) {
        const style = document.createElement('style');
        style.setAttribute('data-image-modal', 'true');
        style.textContent = `
            .image-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
                animation: modalFadeIn 0.3s ease-out;
            }
            
            .image-modal-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                cursor: pointer;
            }
            
            .image-modal-content {
                position: relative;
                max-width: 90vw;
                max-height: 90vh;
                background: white;
                border-radius: 12px;
                overflow: hidden;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                animation: modalSlideIn 0.3s ease-out;
            }
            
            .image-modal-close {
                position: absolute;
                top: 10px;
                right: 15px;
                background: rgba(0, 0, 0, 0.6);
                color: white;
                border: none;
                font-size: 24px;
                font-weight: bold;
                width: 35px;
                height: 35px;
                border-radius: 50%;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10001;
                transition: background-color 0.3s ease;
            }
            
            .image-modal-close:hover {
                background: rgba(0, 0, 0, 0.8);
            }
            
            .image-modal-img {
                max-width: 100%;
                max-height: 90vh;
                object-fit: contain;
                display: none; /* 처음에는 숨김 */
            }
            
            .image-loading {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 40px;
                min-width: 200px;
                min-height: 150px;
            }
            
            .image-loading .spinner {
                border: 3px solid rgba(102, 126, 234, 0.1);
                border-top: 3px solid #667eea;
                border-radius: 50%;
                width: 30px;
                height: 30px;
                animation: spin 1s linear infinite;
                margin-bottom: 16px;
            }
            
            .image-loading p {
                color: #6b7280;
                font-weight: 500;
            }
            
            @keyframes modalFadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            @keyframes modalSlideIn {
                from { transform: scale(0.8) translateY(20px); opacity: 0; }
                to { transform: scale(1) translateY(0); opacity: 1; }
            }
            
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            @media (max-width: 480px) {
                .image-modal-content {
                    max-width: 95vw;
                    max-height: 95vh;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(modal);
    
    // ESC 키로 모달 닫기
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            closeImageModal();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
}

// 🆕 모달 이미지 로드 성공 처리
function onModalImageLoad(img) {
    console.log('모달 이미지 로드 완료');
    const loading = document.getElementById('modalImageLoading');
    if (loading) {
        loading.style.display = 'none';
    }
    img.style.display = 'block';
}

// 🆕 모달 이미지 로드 실패 처리
function onModalImageError(img) {
    console.error('모달 이미지 로드 실패:', img.src);
    const loading = document.getElementById('modalImageLoading');
    if (loading) {
        loading.innerHTML = '<p style="padding: 20px; text-align: center; color: #ef4444;">이미지를 불러올 수 없습니다.</p>';
    }
}

// 수정된 범인 결과 화면 (displayCriminalResults 함수 교체)

async function displayCriminalResults(container) {
    const kills = gameState.results.filter(function(r) { 
        return r.type === 'kill'; 
    });
    
        // 서버에서 최신 데이터 가져오기
        let actualKillCount = 0;
        let maxKills = 3;
        
        // 🆕 관리자 설정에서 기본 maxKills 가져오기
        try {
            const settingsDoc = await db.collection('gameSettings').doc('config').get();
            if (settingsDoc.exists && settingsDoc.data().maxKills) {
                maxKills = settingsDoc.data().maxKills;
            }
        } catch (error) {
            console.error('maxKills 설정 가져오기 오류:', error);
        }
        
        try {
            const myPlayerDoc = await db.collection('activePlayers').doc(gameState.player.loginCode).get();
            if (myPlayerDoc.exists) {
                const data = myPlayerDoc.data();
                actualKillCount = data.killCount || 0;
                
                // 🆕 플레이어별 maxKills (기본값과 비교해서 더 큰 값 사용)
                const playerMaxKills = data.maxKills || maxKills;
                maxKills = Math.max(maxKills, playerMaxKills);
                
                criminalMoney = data.criminalMoney || 0;
            
            // 구매 이력 복원
            if (data.criminalShopPurchases) {
                criminalShopItems.forEach(item => {
                    const purchased = data.criminalShopPurchases[item.id] || 0;
                    item.purchased = purchased;
                    if (purchased >= item.maxPurchases) {
                        item.available = false;
                    } else {
                        item.available = true;
                    }
                });
            }
        }
    } catch (error) {
        console.error('범인 데이터 가져오기 오류:', error);
    }
    
    const remainingKills = maxKills - actualKillCount;
    
    let html = '<div class="status-message">제거 기회: ' + remainingKills + '/' + maxKills + '회 남음</div>';
    
    // 🆕 개선된 암시장 아코디언 섹션
    html += '<div class="criminal-shop-section">';
    
    // 암시장 헤더 (클릭 가능)
    html += '<div class="criminal-shop-header" onclick="toggleCriminalShop()">';
    html += '<div class="criminal-shop-title">';
    html += '<span style="font-size: 1.1em;">💰</span>';
    html += '<span>암시장</span>';
    html += '<span class="shop-money-display">보유: ' + criminalMoney.toLocaleString() + '원</span>';
    html += '</div>';
    html += '<div class="shop-toggle-icon" id="shopToggleIcon">🔒</div>';
    html += '</div>';
    
    // 암시장 내용 (접히는 부분)
    html += '<div class="criminal-shop-content">';
    
    // 상점 안내 메시지
    if (criminalShopItems.every(item => !item.available)) {
        html += '<div style="text-align: center; color: #6b7280; padding: 20px; font-style: italic;">';
        html += '🎉 모든 아이템을 구매했습니다!';
        html += '</div>';
    } else if (criminalMoney === 0) {
        html += '<div style="text-align: center; color: #6b7280; padding: 20px; font-style: italic;">';
        html += '💡 플레이어를 제거해서 돈을 모으세요!';
        html += '</div>';
    }
    
    // 상점 아이템들 표시
    criminalShopItems.forEach(function(item) {
        const canAfford = criminalMoney >= item.price;
        const isAvailable = item.available;
        
        let itemClasses = 'shop-item';
        if (!isAvailable) {
            itemClasses += ' shop-item-soldout';
        } else if (!canAfford) {
            itemClasses += ' shop-item-expensive';
        } else {
            itemClasses += ' affordable';
        }
        
        html += '<div class="' + itemClasses + '">';
        html += '<div class="shop-item-header">';
        html += '<div class="shop-item-title">' + item.name + '</div>';
        html += '<div class="shop-item-price">' + item.price.toLocaleString() + '원</div>';
        html += '</div>';
        html += '<div class="shop-item-description">' + item.description + '</div>';
        html += '<div class="shop-item-status">';
        
        if (!isAvailable) {
            html += '<span class="shop-status-text soldout">구매 완료 (' + item.purchased + '/' + item.maxPurchases + ')</span>';
        } else if (!canAfford) {
            html += '<span class="shop-status-text expensive">돈이 부족합니다 (부족: ' + (item.price - criminalMoney).toLocaleString() + '원)</span>';
        } else {
            html += '<button class="btn shop-buy-btn" onclick="purchaseCriminalItem(\'' + item.id + '\')">';
            html += '💳 구매하기';
            html += '</button>';
        }
        
        html += '</div>';
        html += '</div>';
    });
    
    html += '</div>'; // criminal-shop-content 끝
    html += '</div>'; // criminal-shop-section 끝

    // 🆕 개선된 제거 대상 목록
    if (kills.length === 0) {
        html += '<div style="text-align: center; color: #6b7280; margin-top: 24px; padding: 20px;">';
        html += '<div style="font-size: 2.5em; margin-bottom: 8px;">🎯</div>';
        html += '<div style="font-weight: 600; margin-bottom: 4px; color: #374151;">제거 대상이 없습니다</div>';
        html += '<div style="font-size: 0.85em; opacity: 0.8;">다른 플레이어의 시크릿 코드를 입력해서 대상을 확보하세요</div>';
        html += '</div>';
    } else {
        html += '<div style="margin-top: 20px;">';
        html += '<h3 style="color: #1f2937; margin-bottom: 12px; display: flex; align-items: center; gap: 6px; font-size: 1.1em;">';
        html += '<span>🎯</span>제거 대상 목록';
        html += '</h3>';
        html += '<div class="kill-targets-list">';
        
        kills.forEach(function(kill, index) {
            // 🔧 상태 결정 로직 수정
            let statusIcon = '';
            let statusText = '';
            let statusColor = '';
            let showButton = false;
            
            console.log('Kill 체크:', kill.targetName, 'canKill:', kill.canKill, 'executed:', kill.executed);
            
            if (kill.executed) {
                statusIcon = '✅';
                statusText = '제거 완료';
                statusColor = '#10b981';
            } else if (kill.canKill && remainingKills > 0) {
                statusIcon = '🗡️';
                statusText = '제거 가능';
                statusColor = '#666666';
                showButton = true;
            } else {
                statusIcon = '❌';
                statusText = remainingKills <= 0 ? '기회 없음' : '대기 중';
                statusColor = '#6b7280';
            }
            
            html += '<div class="kill-target-item">';
            
            // 메인 정보
            html += '<div class="kill-target-main">';
            html += '<div class="kill-target-info">';
            html += '<div class="kill-target-name">' + kill.targetName + ' (' + (kill.targetPosition || '직위 미상') + ')</div>';
            html += '<div class="kill-target-details">';
            
            // 보상 정보 (executed 되었고 보상이 있을 때만 표시)
            if (kill.rewardMoney && kill.executed) {
                html += '<span class="kill-reward">💰 ' + kill.rewardMoney + '원 획득</span>';
            } else if (kill.targetRole) {
                // 아직 실행 안 된 경우 예상 보상 표시
                let expectedReward = '';
                if (kill.targetRole === 'merchant') {
                    expectedReward = '랜덤보상';
                } else if (kill.targetRole === 'detective') {
                    expectedReward = '랜덤보상';
                }
                if (expectedReward) {
                    html += '<span class="kill-reward">💰 ' + expectedReward + '</span>';
                }
            }
            
            // 상태 표시
            html += '<span class="kill-status" style="color: ' + statusColor + ';">';
            html += statusIcon + ' ' + statusText;
            html += '</span>';
            
            html += '</div>'; // kill-target-details 끝
            html += '</div>'; // kill-target-info 끝
            
            // 🔧 버튼 영역 수정
            if (showButton) {
                html += '<button class="kill-action-btn" onclick="executeKill(' + index + ')">';
                html += '⚔️';
                html += '</button>';
            }
            
            html += '</div>'; // kill-target-main 끝
            html += '</div>'; // kill-target-item 끝
        });
        
        html += '</div>'; // kill-targets-list 끝
        html += '</div>';
    }
    
    container.innerHTML = html;
    
    // 암시장 초기 상태 설정 (닫힘)
    const shopSection = container.querySelector('.criminal-shop-section');
    if (shopSection) {
        // 처음에는 닫힌 상태로 시작
        shopSection.classList.remove('expanded');
        
        // 돈이 150원 이상이면 자동으로 열기 (첫 구매 가능할 때)
        if (criminalMoney >= 150 && criminalShopItems.some(item => item.available)) {
            setTimeout(() => {
                shopSection.classList.add('expanded');
                const toggleIcon = document.getElementById('shopToggleIcon');
                if (toggleIcon) {
                    toggleIcon.textContent = '🔓';
                }
            }, 500);
        }
    }
}
// ========== 상인 랭킹 시스템 함수들 (여기서부터 추가) ==========

// 상인 랭킹 계산 함수
async function calculateMerchantRanking() {
    if (gameState.role !== 'merchant' || !gameState.isLoggedIn) {
        return { rank: null, totalMerchants: null };
    }

    try {
        // 모든 상인 플레이어의 수익 정보 가져오기
        const merchantSnapshot = await db.collection('activePlayers')
            .where('role', '==', 'merchant')
            .where('isAlive', '==', true)
            .get();

        if (merchantSnapshot.empty) {
            return { rank: 1, totalMerchants: 1 };
        }

        const merchants = [];
        merchantSnapshot.forEach(doc => {
            const data = doc.data();
            merchants.push({
                id: doc.id,
                name: data.name,
                money: data.money || 0
            });
        });

        // 수익순으로 정렬
        merchants.sort((a, b) => b.money - a.money);

        // 내 순위 찾기
        const myId = gameState.player.loginCode;
        const myRank = merchants.findIndex(merchant => merchant.id === myId) + 1;

        return {
            rank: myRank,
            totalMerchants: merchants.length
        };

    } catch (error) {
        console.error('상인 랭킹 계산 오류:', error);
        return { rank: null, totalMerchants: null };
    }
}

// 랭킹 애니메이션 함수
function animateNumber(element, startValue, endValue, duration = 1000) {
    if (!element || startValue === endValue) {
        if (element) element.textContent = endValue;
        return;
    }

    const startTime = performance.now();
    const difference = endValue - startValue;

    function updateNumber(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // easeOutCubic 애니메이션
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        const currentValue = Math.round(startValue + (difference * easeProgress));
        
        element.textContent = currentValue;
        
        if (progress < 1) {
            requestAnimationFrame(updateNumber);
        }
    }
    
    requestAnimationFrame(updateNumber);
}

// 상인 랭킹 실시간 리스너 설정
function setupMerchantRankingListener() {
    if (gameState.role !== 'merchant' || !gameState.isLoggedIn) {
        return;
    }

    // 기존 리스너가 있다면 해제
    if (gameState.merchantRankingListener) {
        try {
            gameState.merchantRankingListener();
        } catch (error) {
            console.error('기존 랭킹 리스너 해제 오류:', error);
        }
        gameState.merchantRankingListener = null;
    }

    // 상인 플레이어들의 변경사항을 실시간으로 감지
    gameState.merchantRankingListener = db.collection('activePlayers')
        .where('role', '==', 'merchant')
        .where('isAlive', '==', true)
        .onSnapshot(async function(snapshot) {
            if (!gameState.isLoggedIn || gameState.role !== 'merchant') {
                return;
            }

            const { rank, totalMerchants } = await calculateMerchantRanking();
            
            // 이전 랭킹과 비교하여 애니메이션 적용
            const prevRank = gameState.merchantRank;
            const prevTotal = gameState.totalMerchants;
            
            gameState.merchantRank = rank;
            gameState.totalMerchants = totalMerchants;
            
            // UI 업데이트
            updateMerchantRankingUI(prevRank, prevTotal);
        });
}

function updateMerchantRankingUI(prevRank, prevTotal) {
    if (gameState.role !== 'merchant') {
        return;
    }

    const rankElement = document.getElementById('merchantRank');
    
    if (rankElement && gameState.merchantRank) {
        if (prevRank && prevRank !== gameState.merchantRank) {
            // 순위가 향상된 경우
            if (prevRank > gameState.merchantRank) {
                rankElement.classList.add('rank-up');
                showRankingToast('순위가 상승했습니다! ' + prevRank + '위 → ' + gameState.merchantRank + '위', 'success');
                
                // 🆕 순위 상승 진동 추가
                triggerVibrationPattern('rank-up');                
                // 순위 향상 효과음
                playRankUpSound();
                
                setTimeout(() => {
                    rankElement.classList.remove('rank-up');
                }, 1000);
            } 
            // 순위가 하락한 경우
            else if (prevRank < gameState.merchantRank) {
                rankElement.classList.add('rank-down');
                showRankingToast('순위가 하락했습니다. ' + prevRank + '위 → ' + gameState.merchantRank + '위', 'warning');
                
                setTimeout(() => {
                    rankElement.classList.remove('rank-down');
                }, 800);
            }
            
            // 숫자 애니메이션
            animateNumber(rankElement, prevRank, gameState.merchantRank, 800);
        } else {
            rankElement.textContent = gameState.merchantRank;
        }
    }
    
    // 🆕 총 상인 수 관련 코드 제거 (더 이상 업데이트하지 않음)
    
    // 🆕 순위 메시지 실시간 업데이트 추가
    updateRankMessage();
}

// 🆕 순위 메시지를 실시간으로 업데이트하는 새로운 함수
function updateRankMessage() {
    if (gameState.role !== 'merchant' || !gameState.merchantRank) {
        return;
    }
    
    const rankMessageElement = document.querySelector('.rank-message');
    if (!rankMessageElement) {
        return;
    }
    
    // 기존 클래스 제거
    rankMessageElement.classList.remove('first-place', 'top-three', 'upper-half', 'encourage');
    
    // 순위에 따른 새로운 메시지와 클래스 설정 (총 상인 수 없이)
    let newMessage = '';
    let newClass = '';
    
    if (gameState.merchantRank === 1) {
        newMessage = '🏆 최고의 상인입니다!';
        newClass = 'first-place';
    } else if (gameState.merchantRank <= 3) {
        newMessage = '🥇 상위권 진입!';
        newClass = 'top-three';
    } else if (gameState.merchantRank <= 5) {
        newMessage = '📈 좋은 성과입니다!';
        newClass = 'upper-half';
    } else {
        newMessage = '💪 더 노력해보세요!';
        newClass = 'encourage';
    }
    
    // 메시지 변경 시 부드러운 애니메이션
    rankMessageElement.style.opacity = '0';
    rankMessageElement.style.transform = 'translateY(10px)';
    
    setTimeout(() => {
        rankMessageElement.textContent = newMessage;
        rankMessageElement.classList.add(newClass);
        rankMessageElement.style.opacity = '1';
        rankMessageElement.style.transform = 'translateY(0)';
    }, 200);
}

// 랭킹 토스트 메시지 표시
function showRankingToast(message, type = 'info') {
    // 기존 토스트가 있으면 제거
    const existingToast = document.querySelector('.ranking-toast');
    if (existingToast) {
        existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = 'ranking-toast ranking-toast-' + type;
    toast.innerHTML = '<div class="toast-content">' +
                     '<span class="toast-icon">' + getToastIcon(type) + '</span>' +
                     '<span class="toast-message">' + message + '</span>' +
                     '</div>';

    document.body.appendChild(toast);

    // 애니메이션으로 표시
    setTimeout(() => {
        toast.classList.add('show');
    }, 100);

    // 3초 후 자동 제거
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, 300);
    }, 3000);
}

// 토스트 아이콘 반환
function getToastIcon(type) {
    switch (type) {
        case 'success': return '🎉';
        case 'warning': return '⚠️';
        case 'info': return 'ℹ️';
        default: return '📊';
    }
}

// 순위 향상 효과음
function playRankUpSound() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // 간단한 성공 사운드 생성
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
        oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1); // E5
        oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2); // G5
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
        // 오디오 재생 실패 시 무시
        console.log('오디오 재생 실패:', error);
    }
}

// ========== 상인 랭킹 시스템 함수들 끝 ==========
// 상인 결과 화면에 실시간 랭킹 정보 표시
async function displayMerchantResults(container) {
    const transactions = gameState.results.filter(function(r) { 
        return r.type === 'money'; 
    });
    
    let html = '';
    let totalMoney = 0;

    // 실시간 랭킹 정보 가져오기 (최신 데이터)
    if (gameState.role === 'merchant') {
        // 랭킹 정보가 없으면 다시 계산
        if (!gameState.merchantRank) {
            const { rank, totalMerchants } = await calculateMerchantRanking();
            gameState.merchantRank = rank;
            gameState.totalMerchants = totalMerchants;
        }

        html += '<div class="merchant-ranking-info">';
        if (gameState.merchantRank) {
            html += '<div class="ranking-display">';
            html += '<div class="rank-title">현재 순위</div>';
            html += '<div class="rank-numbers">';
            html += '<span id="merchantRank" class="rank-number">' + gameState.merchantRank + '</span>';
            html += '<span class="rank-suffix">위</span>';
            html += '</div>';
            
            // 순위별 특별 메시지
            if (gameState.merchantRank === 1) {
                html += '<div class="rank-message first-place">🏆 최고의 상인입니다!</div>';
            } else if (gameState.merchantRank <= 3) {
                html += '<div class="rank-message top-three">🥇 상위권 진입!</div>';
            } else if (gameState.merchantRank <= 5) {
                html += '<div class="rank-message upper-half">📈 좋은 성과입니다!</div>';
            } else {
                html += '<div class="rank-message encourage">💪 더 노력해보세요!</div>';
            }
            
            html += '</div>';
        } else {
            html += '<div class="ranking-display loading">';
            html += '<div class="rank-title">순위 계산 중...</div>';
            html += '</div>';
        }
        html += '</div>';
    }

    if (transactions.length === 0) {
        html += '<p style="text-align: center; color: #666;">아직 거래 기록이 없습니다.</p>';
    } else {
        html += '<div class="result-list">';
        transactions.forEach(function(transaction, index) {
            totalMoney += transaction.amount || 0;
            html += '<div class="result-item">' +
                    '<div class="result-item-title">거래 완료 #' + (index + 1) + '</div>' +
                    '<div class="result-item-subtitle">' + transaction.timestamp + '</div>' +
                    '<div class="result-item-value">+' + transaction.amount + '원 (누적: ' + totalMoney + '원)</div>' +
                    '</div>';
        });
        html += '</div>';
    }
    
    // 총 수익을 맨 위에 표시
    const finalHtml = '<div class="status-message">총 수익: <span class="total-money-highlight">' + totalMoney.toLocaleString() + '</span>원</div>' + html;
    
    container.innerHTML = finalHtml;
}

function toggleClue(clueId, event) {
    // 🆕 이벤트 전파 방지 추가
    if (event) {
        event.stopPropagation();
    }
    
    // 모든 단서 접기
    const allClues = document.querySelectorAll('.clue-item');
    allClues.forEach(function(clue) {
        if (clue.id !== clueId) {
            clue.classList.remove('expanded');
        }
    });
    
    // 클릭한 단서만 토글
    const targetClue = document.getElementById(clueId);
    if (targetClue) {
        const wasExpanded = targetClue.classList.contains('expanded');
        targetClue.classList.toggle('expanded');
        
        console.log('단서 토글:', clueId, wasExpanded ? '닫기' : '열기');
    }
}



async function executeKill(killIndex) {
    const kill = gameState.results.filter(function(r) { 
        return r.type === 'kill'; 
    })[killIndex];
    
    if (!kill || !kill.canKill || kill.executed) {
        alert('이미 실행되었거나 실행할 수 없는 대상입니다.');
        return;
    }

    // 관리자 설정에서 제거 대기 시간 가져오기
    let killTimer = 180; // 기본값 3분
    try {
        const settingsDoc = await db.collection('gameSettings').doc('config').get();
        if (settingsDoc.exists) {
            killTimer = settingsDoc.data().killTimer || 180;
        }
    } catch (error) {
        console.error('설정 가져오기 오류:', error);
    }

    const killTimeMinutes = Math.floor(killTimer / 60);
    const killTimeSeconds = killTimer % 60;
    const timeText = killTimeSeconds === 0 ? killTimeMinutes + '분' : killTimeMinutes + '분 ' + killTimeSeconds + '초';

    if (!confirm('정말로 ' + kill.targetName + '을(를) 제거하시겠습니까? ' + timeText + ' 후 대상이 게임에서 완전히 제외되고 보상을 받습니다.')) {
        return;
    }

    try {
        const myPlayerId = gameState.player.loginCode;
        
        // killCount 및 maxKills 확인
        const myPlayerDoc = await db.collection('activePlayers').doc(myPlayerId).get();
        const myPlayerData = myPlayerDoc.data();
        const currentKillCount = myPlayerData.killCount || 0;
        
        // 🆕 관리자 설정에서 기본 maxKills 가져오기
        let baseMaxKills = 3; // 기본값
        try {
            const settingsDoc = await db.collection('gameSettings').doc('config').get();
            if (settingsDoc.exists && settingsDoc.data().maxKills) {
                baseMaxKills = settingsDoc.data().maxKills;
            }
        } catch (error) {
            console.error('maxKills 설정 가져오기 오류:', error);
        }
        
        // 🆕 플레이어별 maxKills 계산 (기본값 + 상점 구매 보너스)
        let maxKills = myPlayerData.maxKills || baseMaxKills;
        
        // 🆕 만약 플레이어의 maxKills가 현재 설정보다 낮으면 업데이트
        if (maxKills < baseMaxKills) {
            maxKills = baseMaxKills;
            
            // 🆕 플레이어 데이터 업데이트
            await db.collection('activePlayers').doc(myPlayerId).update({
                maxKills: maxKills
            });
            
            console.log('플레이어 maxKills 업데이트:', maxKills);
        }
        
        if (currentKillCount >= maxKills) {
            alert(`이미 최대 제거 횟수(${maxKills}회)에 도달했습니다.`);
            return;
        }

        // 🆕 보상 계산 (새로 추가된 부분)
        let rewardMoney = 0;
        if (gameState.role === 'criminal') {
            if (kill.targetRole === 'merchant') {
                rewardMoney = Math.floor(Math.random() * 41) + 40; // 40~80원
            } else if (kill.targetRole === 'detective') {
                rewardMoney = Math.floor(Math.random() * 71) + 50; // 70~120원
            }
        }

        kill.executed = true;
        kill.rewardMoney = rewardMoney; // 보상 정보 저장
        
        // content에 보상 정보 추가
        kill.content = kill.targetName + ' 제거 예정 (' + timeText + ' 후 게임 종료)';
        if (rewardMoney > 0) {
            kill.content += ' - 보상: ' + rewardMoney + '원';
        }


        // 🆕 범인인 경우 보상 지급 (새로 추가된 부분)
        if (gameState.role === 'criminal' && rewardMoney > 0) {
            await updateCriminalMoney(kill.targetRole, rewardMoney);
        }
        
        // killCount 증가 및 결과 업데이트
        await db.collection('activePlayers').doc(myPlayerId).update({
            results: gameState.results,
            killCount: currentKillCount + 1
        });
        // 지정된 시간 후 대상 플레이어 제거
        setTimeout(async function() {
            try {
                await db.collection('activePlayers').doc(kill.targetPlayerId).update({
                    isAlive: false,
                    deathTime: firebase.firestore.FieldValue.serverTimestamp(),
                    killedBy: myPlayerId
                });
                console.log('플레이어 ' + kill.targetPlayerId + ' 제거 완료');
            } catch (error) {
                console.error('플레이어 제거 오류:', error);
            }
        }, killTimer * 1000);

        let alertMessage = '제거 명령이 실행되었습니다. ' + timeText + ' 후 대상이 게임에서 제외됩니다.';
        if (rewardMoney > 0) {
            alertMessage += ' (' + rewardMoney + '원 보상 지급됨)';
        }
        alert(alertMessage);
        
        // 공격 성공 진동
        if (typeof triggerVibrationPattern === 'function') {
            triggerVibrationPattern('alert');
        }
        
        setupResultScreen().catch(function(error) {
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
    
    // 초기 상태: 하단 네비게이션 숨김
    const bottomNav = document.getElementById('bottomNav');
    if (bottomNav) {
        bottomNav.style.display = 'none';
    }
    
    // 버튼 이벤트 리스너 등록
    document.getElementById('quickLoginButton').addEventListener('click', quickLogin);
    document.getElementById('registerButton').addEventListener('click', register);
    document.getElementById('submitCodeButton').addEventListener('click', submitCode);
    document.getElementById('showRegisterButton').addEventListener('click', showRegisterForm);
    document.getElementById('showLoginButton').addEventListener('click', showLoginForm);
    
    // 네비게이션 버튼 이벤트 리스너 등록 (로그인 상태에서만 작동)
    document.getElementById('homeNavBtn').addEventListener('click', function(e) {
        if (!gameState.isLoggedIn) {
            e.preventDefault();
            console.log('로그인이 필요합니다. 홈 버튼 비활성화됨');
            return;
        }
        showScreen('home');
    });
    
    document.getElementById('roleNavBtn').addEventListener('click', function(e) {
        if (!gameState.isLoggedIn) {
            e.preventDefault();
            console.log('로그인이 필요합니다.');
            return;
        }
        showScreen('role');
    });
    
    document.getElementById('codeInputNavBtn').addEventListener('click', function(e) {
        if (!gameState.isLoggedIn) {
            e.preventDefault();
            console.log('로그인이 필요합니다.');
            return;
        }
        showScreen('codeInput');
    });
    
    document.getElementById('resultNavBtn').addEventListener('click', function(e) {
        if (!gameState.isLoggedIn) {
            e.preventDefault();
            console.log('로그인이 필요합니다.');
            return;
        }
        showScreen('result');
    });
    
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
    
    // 나의 시크릿 코드 토글 이벤트 리스너
    const mySecretToggle = document.getElementById('mySecretToggle');
    if (mySecretToggle) {
        mySecretToggle.addEventListener('click', toggleMySecret);
    }
});
// 4단계: 범인 상점 구매 시스템 - game.js에 추가

// 범인 상점 아이템 구매 함수
async function purchaseCriminalItem(itemId) {
    const item = criminalShopItems.find(i => i.id === itemId);
    
    if (!item) {
        alert('존재하지 않는 아이템입니다.');
        return;
    }
    
    if (!item.available) {
        alert('이미 최대 구매 수량에 도달했습니다.');
        return;
    }
    
    if (criminalMoney < item.price) {
        alert(`돈이 부족합니다. (필요: ${item.price}원, 보유: ${criminalMoney}원)`);
        return;
    }
    
    // 🆕 개선된 확인 메시지
    const confirmMessage = `💰 아이템 구매 확인\n\n` +
                          `상품: ${item.name}\n` +
                          `가격: ${item.price}원\n` +
                          `보유금: ${criminalMoney}원\n` +
                          `구매 후 잔액: ${criminalMoney - item.price}원\n\n` +
                          `정말로 구매하시겠습니까?`;
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    try {
        // 돈 차감
        criminalMoney -= item.price;
        item.purchased += 1;
        
        // 최대 구매량 도달 시 구매 불가 처리
        if (item.purchased >= item.maxPurchases) {
            item.available = false;
        }
        
        // 서버 업데이트 데이터 준비
        const updateData = {
            criminalMoney: criminalMoney,
            [`criminalShopPurchases.${itemId}`]: item.purchased
        };
        
        // 아이템 효과 적용
        if (itemId === 'extra_kills') {
            // 🆕 관리자 설정에서 기본 maxKills 가져오기
            let baseMaxKills = 3;
            try {
                const settingsDoc = await db.collection('gameSettings').doc('config').get();
                if (settingsDoc.exists && settingsDoc.data().maxKills) {
                    baseMaxKills = settingsDoc.data().maxKills;
                }
            } catch (error) {
                console.error('maxKills 설정 가져오기 오류:', error);
            }
            
            // 🆕 최대 킬 횟수 증가 (관리자 설정 기본값 + 구매한 만큼)
            updateData.maxKills = baseMaxKills + (3 * item.purchased);
            
            console.log('아이템 구매 후 maxKills:', updateData.maxKills);
        }
        
        // 서버에 저장
        await db.collection('activePlayers').doc(gameState.player.loginCode).update(updateData);
        
        // 🆕 개선된 성공 알림
        alert(`🎉 구매 완료!\n\n"${item.name}"을(를) 획득했습니다.\n잔액: ${criminalMoney}원`);
        
        // 구매 성공 진동 (진동 함수가 있는 경우)
        if (typeof triggerVibrationPattern === 'function') {
            triggerVibrationPattern('success');
        }
        
        // 🆕 구매 성공 시 암시장 자동으로 열기
        setTimeout(() => {
            openCriminalShop();
        }, 300);
        
        // 결과 화면 새로고침
        setupResultScreen();
        
    } catch (error) {
        console.error('아이템 구매 오류:', error);
        alert('구매 중 오류가 발생했습니다.');
    }
}



// 2단계: 암시장 토글 함수 - game.js에 추가

// 암시장 토글 함수
function toggleCriminalShop() {
    const shopSection = document.querySelector('.criminal-shop-section');
    const toggleIcon = document.getElementById('shopToggleIcon');
    
    if (shopSection && toggleIcon) {
        shopSection.classList.toggle('expanded');
        
        // 부드러운 아이콘 전환 애니메이션
        toggleIcon.style.transform = 'scale(0)';
        
        setTimeout(() => {
            if (shopSection.classList.contains('expanded')) {
                toggleIcon.textContent = '🔓'; // 열림 - 잠금 해제
            } else {
                toggleIcon.textContent = '🔒'; // 닫힘 - 잠금
            }
            
            // 아이콘이 나타나는 애니메이션
            toggleIcon.style.transform = 'scale(1)';
        }, 200);
        
        // 진동 피드백 (있는 경우)
        if (typeof triggerVibrationPattern === 'function') {
            triggerVibrationPattern('success');
        }
        
        console.log('암시장 토글:', shopSection.classList.contains('expanded') ? '열림' : '닫힘');
    }
}

// 암시장 상태 확인 함수 (선택사항)
function getCriminalShopStatus() {
    const shopSection = document.querySelector('.criminal-shop-section');
    return shopSection ? shopSection.classList.contains('expanded') : false;
}

// 암시장 강제 열기 함수 (구매 후 자동으로 열어주기 위해)
function openCriminalShop() {
    const shopSection = document.querySelector('.criminal-shop-section');
    const toggleIcon = document.getElementById('shopToggleIcon');
    
    if (shopSection && !shopSection.classList.contains('expanded')) {
        shopSection.classList.add('expanded');
        
        if (toggleIcon) {
            toggleIcon.style.transform = 'scale(0)';
            setTimeout(() => {
                toggleIcon.textContent = '🔓';
                toggleIcon.style.transform = 'scale(1)';
            }, 200);
        }
    }
}

// 전역 스코프에 함수 등록
window.toggleMySecret = toggleMySecret;
window.toggleNotice = toggleNotice; // 🆕 업데이트된 함수
window.setupNoticeImageEvents = setupNoticeImageEvents; // 🆕 추가
window.handleNoticeImageClick = handleNoticeImageClick; // 🆕 추가
window.purchaseCriminalItem = purchaseCriminalItem;
window.toggleCriminalShop = toggleCriminalShop;
window.getCriminalShopStatus = getCriminalShopStatus;
window.openCriminalShop = openCriminalShop;
window.openImageModal = openImageModal;
window.closeImageModal = closeImageModal;
window.toggleClue = toggleClue;
window.closeNoticeAlert = closeNoticeAlert;
window.goToNotices = goToNotices;
window.triggerVibrationPattern = triggerVibrationPattern;
window.onModalImageLoad = onModalImageLoad;
window.onModalImageError = onModalImageError;
window.executeKill = executeKill; // 🆕 이 줄 추가!
