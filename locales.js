// locales.js
const UILocales = {
    'en': {
        'startGame': 'Start Game',
        'connecting': 'Connecting...',
        'waitingForConnection': 'Waiting to connect to server...',
        'disconnected': 'Disconnected.',
        'disconnectedFromServer': 'Disconnected from server.',
        'connectionError': 'Connection Error',
        'notConnected': 'Not connected',
        'serverFull': 'Server is full. Cannot join.',
        'gameAlreadyStarted': 'Game has already started.',
        'onlyPlayer1CanStart': 'Only Player 1 can start the game.',
        'gameStateNotAvailable': 'Game state not yet available from network.',
        'playerIDNotAssigned': 'Player ID not assigned yet. Cannot start game.',
        'youAre': 'You are',
        'gameStarted': 'Game started!',
        'firstTurn': 'First turn',
        'target': 'Target',
        'reds': 'Reds',
        'yourTurn': 'Your Turn',
        'opponentsTurn': "Opponent's Turn",
        'opponentDisconnected': 'Opponent disconnected. Game reset.',
        'waitingForPlayers': 'Waiting for players...',
        'waitingForNewGame': 'Waiting for new game.',
        'serverError': 'Server error',
        // Snooker specific states
        'MUST_HIT_RED': 'Red',
        'MUST_HIT_NOMINATED_COLOR': 'Color',
        'MUST_HIT_YELLOW': 'Yellow',
        'MUST_HIT_GREEN': 'Green',
        'MUST_HIT_BROWN': 'Brown',
        'MUST_HIT_BLUE': 'Blue',
        'MUST_HIT_PINK': 'Pink',
        'MUST_HIT_BLACK': 'Black',
        'GAME_OVER': 'Game Over'
    },
    'zh': {
        'startGame': '开始游戏',
        'connecting': '连接中...',
        'waitingForConnection': '等待连接服务器...',
        'disconnected': '已断开连接。',
        'disconnectedFromServer': '已从服务器断开。',
        'connectionError': '连接错误',
        'notConnected': '未连接',
        'serverFull': '服务器已满，无法加入。',
        'gameAlreadyStarted': '游戏已经开始。',
        'onlyPlayer1CanStart': '只有玩家1可以开始游戏。',
        'gameStateNotAvailable': '网络游戏状态尚未就绪。',
        'playerIDNotAssigned': '玩家ID尚未分配，无法开始游戏。',
        'youAre': '你是',
        'gameStarted': '游戏开始！',
        'firstTurn': '先手',
        'target': '目标',
        'reds': '红球',
        'yourTurn': '你的回合',
        'opponentsTurn': "对手回合",
        'opponentDisconnected': '对手已断开连接，游戏重置。',
        'waitingForPlayers': '等待玩家...',
        'waitingForNewGame': '等待新游戏。',
        'serverError': '服务器错误',
        // Snooker specific states
        'MUST_HIT_RED': '红球',
        'MUST_HIT_NOMINATED_COLOR': '彩球',
        'MUST_HIT_YELLOW': '黄球',
        'MUST_HIT_GREEN': '绿球',
        'MUST_HIT_BROWN': '咖啡球',
        'MUST_HIT_BLUE': '蓝球',
        'MUST_HIT_PINK': '粉球',
        'MUST_HIT_BLACK': '黑球',
        'GAME_OVER': '游戏结束'
    }
};

let currentLocale = 'en'; // Default language. User can change this via console: setLocale('zh')

function _(key, replacements = {}) {
    let translation = UILocales[currentLocale]?.[key] || UILocales['en']?.[key] || `Missing: ${key}`;
    for (const placeholder in replacements) {
        translation = translation.replace(`{${placeholder}}`, replacements[placeholder]);
    }
    return translation;
}

window.setLocale = (lang) => {
    if (UILocales[lang]) {
        currentLocale = lang;
        console.log(`Locale set to: ${lang}`);
        // Optionally, trigger a UI refresh here if elements need to re-render text.
        // For now, text is mostly set on initial load or on specific events.
        // A full refresh would require functions to update all text elements.
        // Example: if (window.updateUIText) window.updateUIText();
    } else {
        console.warn(`Locale ${lang} not found.`);
    }
};
window._ = _; // Expose translation function globally
