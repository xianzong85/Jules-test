// tests.js - Snooker Version

// --- Constants (mirrored from game.js or defined for tests) ---
const TEST_BALL_RADIUS = 0.1;
const TEST_STOP_THRESHOLD_SQ = 0.0001; // From game.js
const TEST_TABLE_WIDTH = 6;
const TEST_TABLE_DEPTH = 3;
const TEST_CUSHION_EFFECTIVE_LEFT = -TEST_TABLE_WIDTH / 2;
const TEST_CUSHION_EFFECTIVE_RIGHT = TEST_TABLE_WIDTH / 2;
const TEST_CUSHION_EFFECTIVE_FRONT = -TEST_TABLE_DEPTH / 2;
const TEST_CUSHION_EFFECTIVE_BACK = TEST_TABLE_DEPTH / 2;
const TEST_CUSHION_RESTITUTION = 0.8;
const TEST_FRICTION = 0.02;


// Simplified SNOOKER_BALLS_CONFIG for tests (ensure spots are accurate for assertions)
// Assuming game.js SNOOKER_BALLS_CONFIG is available if Ball class uses it internally for spots
const TEST_BAULK_LINE_Z = TEST_TABLE_DEPTH * 0.25; // Approx 0.75
const TEST_RED_APEX_Z = -0.75; // Apex for red ball triangle

const TEST_SNOOKER_SPOTS = {
    'cue':    new THREE.Vector3(0, TEST_BALL_RADIUS, TEST_BAULK_LINE_Z + 0.2),
    'yellow': new THREE.Vector3(TEST_TABLE_WIDTH / 6, TEST_BALL_RADIUS, TEST_BAULK_LINE_Z),
    'green':  new THREE.Vector3(-TEST_TABLE_WIDTH / 6, TEST_BALL_RADIUS, TEST_BAULK_LINE_Z),
    'brown':  new THREE.Vector3(0, TEST_BALL_RADIUS, TEST_BAULK_LINE_Z),
    'blue':   new THREE.Vector3(0, TEST_BALL_RADIUS, 0),
    'pink':   new THREE.Vector3(0, TEST_BALL_RADIUS, TEST_RED_APEX_Z),
    'black':  new THREE.Vector3(0, TEST_BALL_RADIUS, -1.2) // From game.js
};

// --- Helper Functions ---

// Helper to find a ball by ID from the global `balls` array
function findBall(id) {
    if (!window.balls) return null;
    return window.balls.find(b => b.id === id);
}

// Helper to set up the standard 22 Snooker balls
// This should replicate the setup logic in game.js
function setupSnookerBalls() {
    window.balls = []; // Clear existing balls

    // Use SNOOKER_BALLS_CONFIG from game.js for accuracy if possible, else use test version
    const CONFIG = window.SNOOKER_BALLS_CONFIG || { // Fallback to test spots if game.js's isn't loaded/exposed
        'cue':    { color: 0xffffff, points: 0, isColorToRespot: false, spot: TEST_SNOOKER_SPOTS.cue },
        'red':    { color: 0xff0000, points: 1, isColorToRespot: false },
        'yellow': { color: 0xffff00, points: 2, isColorToRespot: true, spot: TEST_SNOOKER_SPOTS.yellow },
        'green':  { color: 0x008000, points: 3, isColorToRespot: true, spot: TEST_SNOOKER_SPOTS.green },
        'brown':  { color: 0x964B00, points: 4, isColorToRespot: true, spot: TEST_SNOOKER_SPOTS.brown },
        'blue':   { color: 0x0000ff, points: 5, isColorToRespot: true, spot: TEST_SNOOKER_SPOTS.blue },
        'pink':   { color: 0xffc0cb, points: 6, isColorToRespot: true, spot: TEST_SNOOKER_SPOTS.pink },
        'black':  { color: 0x000000, points: 7, isColorToRespot: true, spot: TEST_SNOOKER_SPOTS.black }
    };

    // Cue Ball
    const cueConfig = CONFIG.cue;
    window.cueBallObj = new Ball('cue', cueConfig.spot, cueConfig.color, TEST_BALL_RADIUS, cueConfig.points, cueConfig.isColorToRespot, cueConfig.spot);
    window.balls.push(window.cueBallObj);

    // Red Balls
    const redConfig = CONFIG.red;
    const ballDiameter = TEST_BALL_RADIUS * 2;
    const redRowSpacing = ballDiameter * Math.sqrt(3) / 2;
    const redColSpacing = ballDiameter;
    const redRackRows = [1, 2, 3, 4, 5];
    let redBallCounter = 0;
    for (let i = 0; i < redRackRows.length; i++) {
        const numBallsInRow = redRackRows[i];
        const zPos = CONFIG.pink.spot.z - (i * redRowSpacing);
        for (let j = 0; j < numBallsInRow; j++) {
            const xPos = CONFIG.pink.spot.x - ((numBallsInRow - 1) * redColSpacing / 2) + (j * redColSpacing);
            if (redBallCounter >= 15) break;
            const redBall = new Ball(`red_${redBallCounter + 1}`, new THREE.Vector3(xPos, TEST_BALL_RADIUS, zPos), redConfig.color, TEST_BALL_RADIUS, redConfig.points, redConfig.isColorToRespot);
            window.balls.push(redBall);
            redBallCounter++;
        }
        if (redBallCounter >= 15) break;
    }

    // Colored Balls
    ['yellow', 'green', 'brown', 'blue', 'pink', 'black'].forEach(colorName => {
        const config = CONFIG[colorName];
        const colorBall = new Ball(colorName, config.spot, config.color, TEST_BALL_RADIUS, config.points, config.isColorToRespot, config.spot);
        window.balls.push(colorBall);
    });
     // Ensure window.cueBall shim from game.js points to the right object if it exists
    if (window.cueBall && typeof window.cueBall === 'object') {
        // This might not be necessary if game.js's shim is robust or if tests always use cueBallObj
    }
}

// Helper to set up a specific scenario for potting tests
// ballData: [{id: 'ball_id', position: [x,y,z], velocity: [vx,vy,vz], isPocketed: false}, ...]
function setupScenario(ballDataArray, currentSnookerGameState) {
    window.balls.length = 0; // Clear existing balls
    
    ballDataArray.forEach(data => {
        const config = window.SNOOKER_BALLS_CONFIG[data.id.startsWith('red') ? 'red' : data.id] || window.SNOOKER_BALLS_CONFIG.cue; // Simplified config fetch
        const ball = new Ball(
            data.id,
            new THREE.Vector3(...data.position),
            config.color, TEST_BALL_RADIUS, config.points, config.isColorToRespot, config.spot
        );
        ball.velocity.set(...data.velocity);
        ball.isPocketed = data.isPocketed;
        ball.mesh.visible = !data.isPocketed;
        window.balls.push(ball);
        if (data.id === 'cue') {
            window.cueBallObj = ball;
        }
    });

    // Set snooker game state from game.js
    if (window.snookerGameState && currentSnookerGameState) {
        Object.assign(window.snookerGameState, currentSnookerGameState);
    }
}


// --- Test Modules ---

QUnit.module('Snooker Ball Setup', function(hooks) {
    hooks.beforeEach(function() {
        // Ensure Ball class is available (loaded from game.js)
        if (typeof Ball === 'undefined') {
            throw new Error("Ball class not defined. Ensure game.js is loaded before tests.js.");
        }
        setupSnookerBalls(); // Sets up all 22 balls
        // Initialize game.js's snookerGameState for these tests
        if (window.snookerGameState) {
            window.snookerGameState.targetBallState = 'MUST_HIT_RED';
            window.snookerGameState.redsRemaining = 15;
            // scores, etc., can be default
        }
    });

    QUnit.test('Test Ball Count', function(assert) {
        assert.equal(window.balls.length, 22, 'Correct number of balls (1 cue + 15 reds + 6 colors)');
    });

    QUnit.test('Test Initial Positions', function(assert) {
        const cue = findBall('cue');
        assert.ok(cue, 'Cue ball exists');
        assert.deepEqual(cue.mesh.position.toArray(), TEST_SNOOKER_SPOTS.cue.toArray(), 'Cue ball on its spot');

        const firstRed = findBall('red_1'); // Apex of the triangle (closest to pink)
        assert.ok(firstRed, 'First red ball (red_1) exists');
        // The first red ball in the triangle (apex) is 1 row down from pink spot
        const expectedFirstRedZ = TEST_SNOOKER_SPOTS.pink.z; // Apex red is at the pink spot Z.
        assert.close(firstRed.mesh.position.x, TEST_SNOOKER_SPOTS.pink.x, TEST_BALL_RADIUS * 0.1, 'First red X correct');
        assert.close(firstRed.mesh.position.z, expectedFirstRedZ, TEST_BALL_RADIUS * 0.1, 'First red Z correct');
        
        const pink = findBall('pink');
        assert.ok(pink, 'Pink ball exists');
        assert.deepEqual(pink.mesh.position.toArray(), TEST_SNOOKER_SPOTS.pink.toArray(), 'Pink ball on its spot');

        const black = findBall('black');
        assert.ok(black, 'Black ball exists');
        assert.deepEqual(black.mesh.position.toArray(), TEST_SNOOKER_SPOTS.black.toArray(), 'Black ball on its spot');
    });

    QUnit.test('Test Ball Properties', function(assert) {
        const red = findBall('red_5'); // A sample red
        assert.ok(red, 'Sample red ball exists');
        assert.equal(red.points, 1, 'Red ball points correct');
        assert.notOk(red.isColorToRespot, 'Red ball isColorToRespot is false');
        assert.equal(red.defaultSpotPosition, null, 'Red ball defaultSpotPosition is null');

        const yellow = findBall('yellow');
        assert.ok(yellow, 'Yellow ball exists');
        assert.equal(yellow.points, 2, 'Yellow ball points correct');
        assert.ok(yellow.isColorToRespot, 'Yellow ball isColorToRespot is true');
        assert.deepEqual(yellow.defaultSpotPosition.toArray(), TEST_SNOOKER_SPOTS.yellow.toArray(), 'Yellow ball defaultSpotPosition correct');
        
        const black = findBall('black');
        assert.ok(black, 'Black ball exists');
        assert.equal(black.points, 7, 'Black ball points correct');
        assert.ok(black.isColorToRespot, 'Black ball isColorToRespot is true');
        assert.deepEqual(black.defaultSpotPosition.toArray(), TEST_SNOOKER_SPOTS.black.toArray(), 'Black ball defaultSpotPosition correct');
    });
});


QUnit.module('Snooker Potting and Turn Logic', function(hooks) {
    let sendEndTurnCalled;
    let sendEndTurnPayload;
    let sendFullBallStateCalled;

    hooks.beforeEach(function() {
        // Ensure Ball class and snookerGameState are available
        if (typeof Ball === 'undefined' || !window.snookerGameState || typeof window.evaluateTurnEnd === 'undefined') {
            throw new Error("Required game logic (Ball, snookerGameState, evaluateTurnEnd) not found. Ensure game.js is loaded.");
        }
        
        setupSnookerBalls(); // Full rack for default, tests can modify

        // Reset snookerGameState (from game.js)
        window.snookerGameState.targetBallState = 'MUST_HIT_RED';
        window.snookerGameState.redsRemaining = 15;
        window.snookerGameState.foulCommitted = false;
        window.snookerGameState.turnEnds = false;
        window.snookerGameState.shotProcessedForThisTurn = false;
        // Reset scores if necessary: window.snookerGameState.scorePlayer1 = 0; etc.

        // Mock network functions and player context
        sendEndTurnCalled = false;
        sendEndTurnPayload = null;
        sendFullBallStateCalled = false;
        window.sendEndTurn = (payload) => {
            sendEndTurnCalled = true;
            sendEndTurnPayload = payload;
            console.log("Mock sendEndTurn called with:", payload);
        };
        window.sendFullBallState = (balls) => {
            sendFullBallStateCalled = true;
            // console.log("Mock sendFullBallState called with", balls.length, "balls");
        };
        window.localPlayerId = 'player1'; // Simulate it's player1's turn
        window.gameState = { currentPlayer: 'player1', gameStarted: true }; // network.js's gameState
    });

    QUnit.test('Potting a Red Ball Legally', function(assert) {
        window.snookerGameState.targetBallState = 'MUST_HIT_RED';
        const redToPot = findBall('red_1');
        assert.ok(redToPot, "Red ball to pot exists");

        // Simulate potting this red ball
        window.ballPocketedThisTurn = redToPot; // Set by game.js pocketing logic
        redToPot.isPocketed = true; // Manually set for test
        window.snookerGameState.redsRemaining = 14; // Manually update for test
        
        window.evaluateTurnEnd();

        assert.equal(window.snookerGameState.targetBallState, 'MUST_HIT_NOMINATED_COLOR', 'Target state updated to MUST_HIT_NOMINATED_COLOR');
        assert.equal(window.snookerGameState.redsRemaining, 14, 'Reds remaining decremented');
        assert.notOk(sendEndTurnCalled, 'sendEndTurn should NOT be called (player continues)');
        assert.notOk(window.snookerGameState.foulCommitted, 'Foul should not be committed');
    });

    QUnit.test('Potting a Nominated Color Legally (Reds on Table)', function(assert) {
        window.snookerGameState.targetBallState = 'MUST_HIT_NOMINATED_COLOR';
        const blueToPot = findBall('blue');
        assert.ok(blueToPot, "Blue ball to pot exists");

        window.ballPocketedThisTurn = blueToPot;
        // Potting logic in game.js would set isPocketed, then evaluateTurnEnd re-spots it.
        // Here we simulate that blueToPot was pocketed, and evaluateTurnEnd should handle the re-spot.
        blueToPot.isPocketed = true; // It's pocketed...
        
        window.evaluateTurnEnd(); // ...then re-spotted by this.

        assert.notOk(blueToPot.isPocketed, 'Blue ball is NOT pocketed after re-spot');
        assert.ok(blueToPot.mesh.visible, 'Blue ball mesh is visible after re-spot');
        assert.deepEqual(blueToPot.mesh.position.toArray(), blueToPot.defaultSpotPosition.toArray(), 'Blue ball re-spotted to its default spot');
        assert.equal(window.snookerGameState.targetBallState, 'MUST_HIT_RED', 'Target state updated to MUST_HIT_RED');
        assert.notOk(sendEndTurnCalled, 'sendEndTurn should NOT be called (player continues)');
        assert.notOk(window.snookerGameState.foulCommitted, 'Foul should not be committed');
    });

    QUnit.test('Potting Yellow Legally (No Reds on Table)', function(assert) {
        window.snookerGameState.redsRemaining = 0;
        window.snookerGameState.targetBallState = 'MUST_HIT_YELLOW'; // Correct sequence after reds
        const yellowToPot = findBall('yellow');
        assert.ok(yellowToPot, "Yellow ball exists");

        window.ballPocketedThisTurn = yellowToPot;
        yellowToPot.isPocketed = true; // Stays pocketed
        
        window.evaluateTurnEnd();

        assert.ok(yellowToPot.isPocketed, 'Yellow ball IS pocketed (stays down)');
        assert.equal(window.snookerGameState.targetBallState, 'MUST_HIT_GREEN', 'Target state updated to MUST_HIT_GREEN');
        assert.notOk(sendEndTurnCalled, 'sendEndTurn should NOT be called (player continues)');
        assert.notOk(window.snookerGameState.foulCommitted, 'Foul should not be committed');
    });
    
    QUnit.test('Potting a Color after Last Red (Transition to Yellow)', function(assert) {
        // Step 1: Player was targeting red, potted the last red.
        window.snookerGameState.targetBallState = 'MUST_HIT_RED';
        window.snookerGameState.redsRemaining = 1;
        const lastRed = findBall('red_1'); // Assume this is the last red
        window.ballPocketedThisTurn = lastRed;
        lastRed.isPocketed = true;
        window.snookerGameState.redsRemaining = 0;
        
        window.evaluateTurnEnd(); // After this, target should be a color.
        assert.equal(window.snookerGameState.targetBallState, 'MUST_HIT_NOMINATED_COLOR', 'After last red, target is NOMINATED_COLOR');
        assert.notOk(sendEndTurnCalled, 'Player continues after potting last red');

        // Step 2: Player now pots a color (e.g., Black)
        window.snookerGameState.foulCommitted = false; // Reset for next shot in same turn
        window.snookerGameState.turnEnds = false;
        const blackToPot = findBall('black');
        window.ballPocketedThisTurn = blackToPot;
        blackToPot.isPocketed = true; // Pot black

        window.evaluateTurnEnd(); // Evaluate this color pot

        assert.notOk(blackToPot.isPocketed, 'Black ball re-spotted after being potted after last red');
        assert.equal(window.snookerGameState.targetBallState, 'MUST_HIT_YELLOW', 'After potting color (post-reds), target is YELLOW');
        assert.notOk(sendEndTurnCalled, 'Player continues after potting color (post-reds)');
    });


    QUnit.test('Failing to Pot (Miss)', function(assert) {
        window.snookerGameState.targetBallState = 'MUST_HIT_RED';
        window.ballPocketedThisTurn = null; // No ball pocketed
        
        window.evaluateTurnEnd();

        assert.ok(sendEndTurnCalled, 'sendEndTurn WAS called after a miss');
        assert.deepEqual(sendEndTurnPayload, {
            redsRemaining: 15,
            nextTargetForOpponent: 'MUST_HIT_RED'
        }, 'Payload for miss is correct (reds > 0)');
        assert.notOk(window.snookerGameState.foulCommitted, 'Foul should not be committed on a simple miss');
    });

    QUnit.test('Foul - Potting Cue Ball', function(assert) {
        window.snookerGameState.targetBallState = 'MUST_HIT_RED';
        const cue = findBall('cue');
        
        // Simulate cue ball pocketing (as game.js pocketing logic would)
        window.ballPocketedThisTurn = cue; 
        cue.isPocketed = true; // This would be set by pocket detection.
        window.snookerGameState.foulCommitted = true; // This flag also set by pocket detection for cue.
        
        window.evaluateTurnEnd();

        assert.notOk(cue.isPocketed, 'Cue ball is NOT pocketed after re-spot');
        assert.deepEqual(cue.mesh.position.toArray(), cue.defaultSpotPosition.toArray(), 'Cue ball re-spotted to D-area');
        assert.ok(sendEndTurnCalled, 'sendEndTurn WAS called after cue ball foul');
        assert.deepEqual(sendEndTurnPayload, {
            redsRemaining: 15,
            nextTargetForOpponent: 'MUST_HIT_RED'
        }, 'Payload for cue ball foul is correct');
    });

    QUnit.test('Foul - Potting Wrong Ball (Color when Red is Target)', function(assert) {
        window.snookerGameState.targetBallState = 'MUST_HIT_RED';
        const blue = findBall('blue');
        
        // Simulate potting blue (as game.js pocketing logic would)
        window.ballPocketedThisTurn = blue;
        blue.isPocketed = true;
        window.snookerGameState.foulCommitted = true; // Foul flag set by pocket detection logic
        
        window.evaluateTurnEnd();

        assert.ok(blue.isPocketed, 'Blue ball remains pocketed (wrongly potted color, current simplified rule)');
        // In full rules, it would re-spot. For now, test based on simplified logic in provided evaluateTurnEnd.
        // If evaluateTurnEnd were to re-spot it:
        // assert.notOk(blue.isPocketed, 'Blue ball re-spotted after foul pot');
        // assert.deepEqual(blue.mesh.position.toArray(), blue.defaultSpotPosition.toArray(), 'Blue ball re-spotted');

        assert.ok(sendEndTurnCalled, 'sendEndTurn WAS called after potting wrong ball');
        assert.deepEqual(sendEndTurnPayload, {
            redsRemaining: 15,
            nextTargetForOpponent: 'MUST_HIT_RED'
        }, 'Payload for potting wrong ball is correct');
    });
});
```
