// Get the canvas element
const canvas = document.getElementById('billiard-canvas');

// Create a scene
const scene = new THREE.Scene();

// Create a camera
const camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
camera.position.set(0, 10, 0); // Positioned above, looking down
camera.lookAt(0, 0, 0); // Look at the center of the scene

// Create a renderer
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
renderer.setSize(canvas.clientWidth, canvas.clientHeight);

// Add resize listener
window.addEventListener('resize', () => {
    let width = canvas.clientWidth;
    if (width === 0 && canvas.parentElement) {
        width = canvas.parentElement.clientWidth;
    } else if (width === 0) {
        width = window.innerWidth * 0.8;
    }

    let height = canvas.clientHeight;
    if (height === 0 && canvas.parentElement) {
        height = canvas.parentElement.clientHeight;
    } else if (height === 0) {
        height = window.innerHeight * 0.8;
    }
    
    if (width === 0) width = 600;
    if (height === 0) height = 400;

    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
});

// Add Basic Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
directionalLight.position.set(5, 10, 7.5);
scene.add(directionalLight);

// Create Placeholder Table
const tableGeometry = new THREE.BoxGeometry(6, 0.4, 3); // Width, height (thickness), depth
const tableMaterial = new THREE.MeshStandardMaterial({ color: 0x006400 }); // Dark green
const table = new THREE.Mesh(tableGeometry, tableMaterial);
table.position.set(0, -0.2, 0); // Position it slightly below origin
scene.add(table);

// --- SNOOKER SETUP START ---

// Global Constants
const BALL_RADIUS = 0.1;
const FRICTION = 0.02; 
const STOP_THRESHOLD_SQ = 0.0001;

const TABLE_WIDTH = 6; 
const TABLE_DEPTH = 3; 

const CUSHION_EFFECTIVE_LEFT = -TABLE_WIDTH / 2;
const CUSHION_EFFECTIVE_RIGHT = TABLE_WIDTH / 2;
const CUSHION_EFFECTIVE_FRONT = -TABLE_DEPTH / 2; // Negative Z side (Red ball pyramid side)
const CUSHION_EFFECTIVE_BACK = TABLE_DEPTH / 2;   // Positive Z side (Baulk line / D area side)
const CUSHION_RESTITUTION = 0.8;

// Snooker Ball Configuration
const BAULK_LINE_Z = TABLE_DEPTH * 0.25; // Approx. 0.75 for TABLE_DEPTH = 3
const PYRAMID_APEX_Z = -TABLE_DEPTH * 0.20; // Approx. -0.6 for TABLE_DEPTH = 3 (Pink spot is often apex for reds)
                                         // Let's use -0.75 as per prompt for reds' apex for more space.
const RED_APEX_Z = -0.75; 

const SNOOKER_BALLS_CONFIG = {
    'cue':    { color: 0xffffff, points: 0, isColorToRespot: false, spot: new THREE.Vector3(0, BALL_RADIUS, BAULK_LINE_Z + 0.2) }, // Start in D
    'red':    { color: 0xff0000, points: 1, isColorToRespot: false },
    'yellow': { color: 0xffff00, points: 2, isColorToRespot: true, spot: new THREE.Vector3(TABLE_WIDTH / 6, BALL_RADIUS, BAULK_LINE_Z)},
    'green':  { color: 0x008000, points: 3, isColorToRespot: true, spot: new THREE.Vector3(-TABLE_WIDTH / 6, BALL_RADIUS, BAULK_LINE_Z)},
    'brown':  { color: 0x964B00, points: 4, isColorToRespot: true, spot: new THREE.Vector3(0, BALL_RADIUS, BAULK_LINE_Z)}, // Using a more distinct brown
    'blue':   { color: 0x0000ff, points: 5, isColorToRespot: true, spot: new THREE.Vector3(0, BALL_RADIUS, 0)},
    'pink':   { color: 0xffc0cb, points: 6, isColorToRespot: true, spot: new THREE.Vector3(0, BALL_RADIUS, RED_APEX_Z + BALL_RADIUS*2.5)}, // Pink spot is traditionally the apex for the reds triangle.
                                                                                                                                    // Using RED_APEX_Z directly for Pink.
    'black':  { color: 0x000000, points: 7, isColorToRespot: true, spot: new THREE.Vector3(0, BALL_RADIUS, RED_APEX_Z - (TABLE_DEPTH*0.25))} // Black spot further behind reds.
};
// Correct Pink Spot to be at the actual apex of the red ball triangle for Snooker setup.
SNOOKER_BALLS_CONFIG.pink.spot.set(0, BALL_RADIUS, RED_APEX_Z);
// Correct Black Spot relative to red apex
SNOOKER_BALLS_CONFIG.black.spot.set(0, BALL_RADIUS, RED_APEX_Z - (TABLE_DEPTH * 0.15) - (15 * BALL_RADIUS * 2 * Math.sqrt(3)/2 * 0.2) ); // Simplified: just behind reds.
SNOOKER_BALLS_CONFIG.black.spot.set(0, BALL_RADIUS, -1.2); // Adjusted black spot for typical table layout

// Ball Class
class Ball {
    constructor(id, initialPosition, colorHex, radius, points, isColorToRespot, defaultSpotPosition = null) {
        this.id = id;
        this.radius = radius;
        this.mass = 1; // Assuming equal mass for simplicity
        this.points = points;
        this.isColorToRespot = isColorToRespot;
        this.defaultSpotPosition = defaultSpotPosition ? defaultSpotPosition.clone() : null;
        
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.isPocketed = false;

        const geometry = new THREE.SphereGeometry(this.radius, 32, 32);
        const material = new THREE.MeshStandardMaterial({ color: colorHex });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(initialPosition);
        this.mesh.position.y = this.radius; 
        
        this.mesh.userData.ballInstance = this;
    }
}

// Balls Array
let balls = [];

// Instantiate Cue Ball
const cueConfig = SNOOKER_BALLS_CONFIG.cue;
const cueBallObj = new Ball(
    'cue', 
    cueConfig.spot, // Starting in the "D"
    cueConfig.color, 
    BALL_RADIUS, 
    cueConfig.points, 
    cueConfig.isColorToRespot
);
scene.add(cueBallObj.mesh);
balls.push(cueBallObj);

window.cueBallObj = cueBallObj; 
window.cueBall = { 
    get position() { return cueBallObj.mesh.position; },
    get velocity() { return cueBallObj.velocity; },
};

// Instantiate Red Balls (15 of them)
const redConfig = SNOOKER_BALLS_CONFIG.red;
const ballDiameter = BALL_RADIUS * 2;
const redRowSpacing = ballDiameter * Math.sqrt(3) / 2; // Vertical distance between rows center-to-center
const redColSpacing = ballDiameter;                     // Horizontal distance between balls in a row center-to-center
const redRackRows = [1, 2, 3, 4, 5]; // Number of balls in each row for 15 reds

let redBallCounter = 0;
for (let i = 0; i < redRackRows.length; i++) {
    const numBallsInRow = redRackRows[i];
    const zPos = SNOOKER_BALLS_CONFIG.pink.spot.z - (i * redRowSpacing); // Rack starts from Pink spot towards negative Z
    for (let j = 0; j < numBallsInRow; j++) {
        const xPos = SNOOKER_BALLS_CONFIG.pink.spot.x - ((numBallsInRow - 1) * redColSpacing / 2) + (j * redColSpacing);
        
        if (redBallCounter >= 15) break;

        const position = new THREE.Vector3(xPos, BALL_RADIUS, zPos);
        const ballId = `red_${redBallCounter + 1}`;
        
        const redBall = new Ball(
            ballId, 
            position, 
            redConfig.color, 
            BALL_RADIUS, 
            redConfig.points, 
            redConfig.isColorToRespot
        );
        scene.add(redBall.mesh);
        balls.push(redBall);
        redBallCounter++;
    }
    if (redBallCounter >= 15) break;
}

// Instantiate Colored Balls (Yellow to Black)
const colorsToSpot = ['yellow', 'green', 'brown', 'blue', 'pink', 'black'];
colorsToSpot.forEach(colorName => {
    const config = SNOOKER_BALLS_CONFIG[colorName];
    const colorBall = new Ball(
        colorName,
        config.spot,
        config.color,
        BALL_RADIUS,
        config.points,
        config.isColorToRespot,
        config.spot // Store its own spot as defaultSpotPosition
    );
    scene.add(colorBall.mesh);
    balls.push(colorBall);
});

console.log(`Total balls created: ${balls.length}`); // Should be 1 (cue) + 15 (reds) + 6 (colors) = 22

// --- SNOOKER SETUP END ---

// Snooker Game State
let snookerGameState = {
    targetBallState: 'MUST_HIT_RED', // or 'MUST_HIT_NOMINATED_COLOR', 'MUST_HIT_YELLOW', etc.
    scorePlayer1: 0,
    scorePlayer2: 0,
    redsRemaining: 15,
    turnEnds: false, // Flag to indicate if the current player's turn should end
    foulCommitted: false, // Flag if a foul occurred in the current shot
    shotProcessedForThisTurn: false // Flag to prevent multiple processing of turn end
};
window.snookerGameState = snookerGameState;

// Pocket Geometry
const POCKET_RADIUS = 0.22; // Slightly larger than BALL_RADIUS for easier potting
const pockets = [
    // Corner pockets (adjusted to be more inside the effective boundaries)
    { x: CUSHION_EFFECTIVE_LEFT + POCKET_RADIUS * 0.8, z: CUSHION_EFFECTIVE_FRONT + POCKET_RADIUS * 0.8, id: 'bottom_left' },
    { x: CUSHION_EFFECTIVE_RIGHT - POCKET_RADIUS * 0.8, z: CUSHION_EFFECTIVE_FRONT + POCKET_RADIUS * 0.8, id: 'bottom_right' },
    { x: CUSHION_EFFECTIVE_LEFT + POCKET_RADIUS * 0.8, z: CUSHION_EFFECTIVE_BACK - POCKET_RADIUS * 0.8, id: 'top_left' },
    { x: CUSHION_EFFECTIVE_RIGHT - POCKET_RADIUS * 0.8, z: CUSHION_EFFECTIVE_BACK - POCKET_RADIUS * 0.8, id: 'top_right' },
    // Middle pockets
    { x: 0, z: CUSHION_EFFECTIVE_FRONT + POCKET_RADIUS * 0.7, id: 'bottom_middle' }, // A bit less inset for middle
    { x: 0, z: CUSHION_EFFECTIVE_BACK - POCKET_RADIUS * 0.7, id: 'top_middle' }
];

// Shot state variables (reset per shot)
let ballPocketedThisTurn = null; 
let shotHadEffect = false; // Will be true if any ball moves significantly or is pocketed


// Animate Loop (Refactored)
function animate() {
    requestAnimationFrame(animate);

    // Check if any ball has moved significantly (reset per frame, set true if velocity > threshold)
    // This simple check for shotHadEffect might need refinement, e.g., set true when cue ball is struck.
    // For now, pocketing a ball or any ball having velocity after physics will imply an effect.
    let anyBallMoving = !allBallsStationary(); // Check before physics updates for current frame effect

    // 1. Update individual ball positions based on velocity
    for (const ball of balls) {
        if (ball.isPocketed) continue;
        ball.mesh.position.add(ball.velocity);
    }

    // 2. Handle Collisions
    //    a. Ball-to-Cushion Collisions
    for (const ball of balls) {
        if (ball.isPocketed) continue;

        if (ball.mesh.position.x - ball.radius < CUSHION_EFFECTIVE_LEFT) {
            ball.mesh.position.x = CUSHION_EFFECTIVE_LEFT + ball.radius;
            ball.velocity.x = -ball.velocity.x * CUSHION_RESTITUTION;
        } else if (ball.mesh.position.x + ball.radius > CUSHION_EFFECTIVE_RIGHT) {
            ball.mesh.position.x = CUSHION_EFFECTIVE_RIGHT - ball.radius;
            ball.velocity.x = -ball.velocity.x * CUSHION_RESTITUTION;
        }

        if (ball.mesh.position.z - ball.radius < CUSHION_EFFECTIVE_FRONT) {
            ball.mesh.position.z = CUSHION_EFFECTIVE_FRONT + ball.radius;
            ball.velocity.z = -ball.velocity.z * CUSHION_RESTITUTION;
        } else if (ball.mesh.position.z + ball.radius > CUSHION_EFFECTIVE_BACK) {
            ball.mesh.position.z = CUSHION_EFFECTIVE_BACK + ball.radius;
            ball.velocity.z = -ball.velocity.z * CUSHION_RESTITUTION;
        }
    }

    //    b. Ball-to-Ball Collisions
    for (let i = 0; i < balls.length; i++) {
        const ball1 = balls[i];
        if (ball1.isPocketed) continue;
        for (let j = i + 1; j < balls.length; j++) {
            const ball2 = balls[j];
            if (ball2.isPocketed) continue;

            const dx = ball2.mesh.position.x - ball1.mesh.position.x;
            const dz = ball2.mesh.position.z - ball1.mesh.position.z;
            const distanceSq = dx * dx + dz * dz;
            const sumRadii = ball1.radius + ball2.radius;
            const sumRadiiSq = sumRadii * sumRadii;

            if (distanceSq < sumRadiiSq && distanceSq > 1e-6) { 
                const distance = Math.sqrt(distanceSq);
                const overlap = sumRadii - distance;
                
                const mtvX = (dx / distance) * overlap * 0.5; 
                const mtvZ = (dz / distance) * overlap * 0.5;
                
                ball1.mesh.position.x -= mtvX;
                ball1.mesh.position.z -= mtvZ;
                ball2.mesh.position.x += mtvX;
                ball2.mesh.position.z += mtvZ;

                const normalX = dx / distance;
                const normalZ = dz / distance;
                
                const relVelX = ball1.velocity.x - ball2.velocity.x;
                const relVelZ = ball1.velocity.z - ball2.velocity.z;
                
                const velAlongNormal = relVelX * normalX + relVelZ * normalZ;

                if (velAlongNormal > 0) continue;
                
                const v1n = ball1.velocity.x * normalX + ball1.velocity.z * normalZ;
                const v1t_x = ball1.velocity.x - v1n * normalX; 
                const v1t_z = ball1.velocity.z - v1n * normalZ;

                const v2n = ball2.velocity.x * normalX + ball2.velocity.z * normalZ;
                const v2t_x = ball2.velocity.x - v2n * normalX; 
                const v2t_z = ball2.velocity.z - v2n * normalZ;
                
                const newV1n_vecX = v2n * normalX;
                const newV1n_vecZ = v2n * normalZ;
                const newV2n_vecX = v1n * normalX;
                const newV2n_vecZ = v1n * normalZ;

                ball1.velocity.x = newV1n_vecX + v1t_x;
                ball1.velocity.z = newV1n_vecZ + v1t_z;
                ball2.velocity.x = newV2n_vecX + v2t_x;
                ball2.velocity.z = newV2n_vecZ + v2t_z;
            }
        }
    }

    //    b. Ball-to-Ball Collisions (Existing logic)
    //    ... [No changes to ball-ball collision logic itself in this step] ...

    // 2c. Pocket Detection (NEW)
    // This runs *after* positions are updated and collisions resolved, but *before* final friction/stopping for the frame.
    // Only process potting if balls were moving or a shot was just made (to avoid processing stationary balls falling in pockets due to precision)
    if (anyBallMoving || !snookerGameState.shotProcessedForThisTurn) { // Process if balls are moving or shot just happened
        for (const ball of balls) {
            if (ball.isPocketed) continue;

            for (const pocket of pockets) {
                const distSq = Math.pow(ball.mesh.position.x - pocket.x, 2) + Math.pow(ball.mesh.position.z - pocket.z, 2);
                if (distSq < POCKET_RADIUS * POCKET_RADIUS) {
                    console.log(`${ball.id} pocketed in ${pocket.id}!`);
                    ball.isPocketed = true;
                    ball.mesh.visible = false;
                    ball.velocity.set(0, 0, 0);
                    shotHadEffect = true; // A ball was pocketed

                    if (ball.id === 'cue') {
                        console.log("Cue ball pocketed - Foul!");
                        snookerGameState.turnEnds = true;
                        snookerGameState.foulCommitted = true;
                        if (!ballPocketedThisTurn || ballPocketedThisTurn.id !== 'cue') { // Prioritize cue ball foul
                           ballPocketedThisTurn = ball; 
                        }
                        break; 
                    } else if (ball.id.startsWith('red')) {
                        snookerGameState.redsRemaining--;
                        console.log(`Red ball pocketed. Reds remaining: ${snookerGameState.redsRemaining}`);
                        if (snookerGameState.targetBallState === 'MUST_HIT_RED') {
                            if (!ballPocketedThisTurn || ballPocketedThisTurn.points < ball.points) {
                                ballPocketedThisTurn = ball;
                            }
                        } else { // Potted a red when not supposed to (foul)
                            console.log("Foul: Potted a red when not targeting red.");
                            snookerGameState.turnEnds = true;
                            snookerGameState.foulCommitted = true;
                            // ballPocketedThisTurn might be set to this red if it's the first/only pot, indicating a foul.
                            if (!ballPocketedThisTurn) ballPocketedThisTurn = ball;

                        }
                    } else { // A colored ball (yellow to black)
                        if (snookerGameState.targetBallState === 'MUST_HIT_NOMINATED_COLOR' || 
                            snookerGameState.targetBallState === ball.id.toUpperCase()) { 
                            if (!ballPocketedThisTurn || ballPocketedThisTurn.points < ball.points) {
                                ballPocketedThisTurn = ball;
                            }
                        } else { // Potted a color when not supposed to (foul)
                            console.log(`Foul: Potted ${ball.id} when not targeting it or any color.`);
                            snookerGameState.turnEnds = true;
                            snookerGameState.foulCommitted = true;
                            if (!ballPocketedThisTurn) ballPocketedThisTurn = ball;
                        }
                    }
                    break; 
                }
            }
            if (ball.isPocketed && ball.id === 'cue') break; 
        }
    }


    // 3. Apply friction and stop balls, ensure Y position
    for (const ball of balls) {
        if (ball.isPocketed) continue;
        ball.mesh.position.y = ball.radius; 
        ball.velocity.multiplyScalar(1 - FRICTION);
        if (ball.velocity.lengthSq() < STOP_THRESHOLD_SQ) {
            ball.velocity.set(0, 0, 0);
        }
    }

    // 4. Evaluate Turn End (NEW)
    // Check if it's the current player's turn according to network.js gameState
    // and if the game has started.
    if (allBallsStationary() && 
        window.gameState && window.gameState.gameStarted && 
        window.localPlayerId === window.gameState.currentPlayer && 
        !snookerGameState.shotProcessedForThisTurn) {
        
        if (window.sendFullBallState) { // Send final ball states before evaluating turn
            window.sendFullBallState(balls);
        }
        evaluateTurnEnd();
        snookerGameState.shotProcessedForThisTurn = true; // Mark as processed for this shot
    }


    // Cue Stick Aiming & Visibility Logic
    if (window.localPlayerId === window.gameState?.currentPlayer && 
        cueBallObj.velocity.lengthSq() < STOP_THRESHOLD_SQ && 
        window.gameState && window.gameState.gameStarted) {
        cueStick.visible = true;
        raycaster.setFromCamera(mouse, camera);
        const intersectionPoint = new THREE.Vector3(); 
        const intersects = raycaster.ray.intersectPlane(tablePlane, intersectionPoint);

        if (intersects) {
            aimingDirection.subVectors(intersectionPoint, cueBallObj.mesh.position);
            aimingDirection.y = 0; 
            aimingDirection.normalize(); 

            const cueStickOffset = -0.75; 
            cueStick.position.copy(cueBallObj.mesh.position).addScaledVector(aimingDirection, cueStickOffset);
            
            const lookAtTarget = new THREE.Vector3().copy(cueStick.position).add(aimingDirection);
            cueStick.lookAt(lookAtTarget);

        }
    } else {
        cueStick.visible = false;
    }
    
    renderer.render(scene, camera);
}

// --- Cue Control & Aiming ---
const cueStickGeometry = new THREE.CylinderGeometry(0.02, 0.02, 1.5, 8);
const cueStickMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 }); 
const cueStick = new THREE.Mesh(cueStickGeometry, cueStickMaterial);
cueStick.geometry.rotateX(Math.PI / 2); 
scene.add(cueStick);
cueStick.visible = false;

let mouse = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const tablePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -BALL_RADIUS); 
let aimingDirection = new THREE.Vector3(0, 0, -1); 

canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
});

canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) { 
        if (window.localPlayerId === window.gameState?.currentPlayer &&
            cueBallObj.velocity.lengthSq() < STOP_THRESHOLD_SQ && 
            cueStick.visible && 
            window.gameState && window.gameState.gameStarted) {
            // Reset shot-specific state variables
            snookerGameState.shotProcessedForThisTurn = false;
            snookerGameState.turnEnds = false;
            snookerGameState.foulCommitted = false;
            ballPocketedThisTurn = null; 
            shotHadEffect = true; 

            cueBallObj.velocity.copy(aimingDirection).multiplyScalar(0.35); 
            cueStick.visible = false;
            
            // Note: sendFullBallState is now called when balls stop, not immediately on shot.
            // The old sendCueBallState (or equivalent) is removed from here.
            // If an immediate state update upon shooting is desired, it would be a different message type
            // or sendFullBallState could be called here too, but that might be too frequent.
            // The current design sends ball states when they stop.
            // For now, we rely on the client's local physics and send state when turn ends.
            // However, if network.js expects an immediate send of the cue ball after shot:
            if (window.sendFullBallState) { // Or a more specific "shotTaken" message
                 // Sending full state immediately might be too much, but for consistency:
                 // window.sendFullBallState(balls); 
                 // Let's assume the primary state sync is when balls stop.
            }
        }
    }
});


// Placeholder for functions network.js might call
window.resetGameControls = () => { 
    if(cueStick) cueStick.visible = false; 
    // Reset snookerGameState if needed, though server should drive game state resets primarily.
    // snookerGameState.targetBallState = 'MUST_HIT_RED';
    // snookerGameState.redsRemaining = 15;
    console.log("game.js: resetGameControls called.");
};
window.enableCueControls = (isMyTurn) => {
    console.log("game.js: enableCueControls called with isMyTurn:", isMyTurn);
    // The primary cue stick visibility is handled in animate() based on active player and ball state.
    // This function can be used for additional UI cues or more complex control locking if needed.
    // Example: if (!isMyTurn && cueStick) cueStick.visible = false; (animate() handles this better)
};

function allBallsStationary() {
            }
        }
    }
});


// Initial resize call and animation start
if (canvas.clientWidth > 0 && canvas.clientHeight > 0) {
    window.dispatchEvent(new Event('resize'));
    animate();
} else {
    console.warn("Canvas dimensions are zero. Starting animate loop, but rendering might not be visible until resize.");
    const fallbackWidth = (canvas.parentElement || window).innerWidth * 0.8 || 600;
    const fallbackHeight = (canvas.parentElement || window).innerHeight * 0.8 || 400;
    renderer.setSize(fallbackWidth, fallbackHeight);
    camera.aspect = fallbackWidth / fallbackHeight;
    camera.updateProjectionMatrix();
    animate();
}
if (canvas.clientWidth > 0 && canvas.clientHeight > 0) { 
    window.dispatchEvent(new Event('resize'));
}

// Placeholder for functions network.js might call
window.resetGameControls = () => { 
    if(cueStick) cueStick.visible = false; 
    // Reset snookerGameState if needed, though server should drive game state resets primarily.
    // snookerGameState.targetBallState = 'MUST_HIT_RED';
    // snookerGameState.redsRemaining = 15;
    console.log("resetGameControls called by network.js");
};
window.enableCueControls = (isMyTurn) => {
    console.log("enableCueControls called with:", isMyTurn, "Current player:", window.gameState ? window.gameState.currentPlayer : 'unknown');
    // Actual enabling/disabling of cue stick interaction might depend on:
    // 1. Is it this client's turn? (isMyTurn)
    // 2. Is the cue ball stationary? (handled in animate's cue stick logic)
    // This function is more of a notification for now. UI could reflect "Your turn" vs "Opponent's turn".
};

function allBallsStationary() {
    for (const ball of balls) {
        if (!ball.isPocketed && ball.velocity.lengthSq() > STOP_THRESHOLD_SQ) {
            return false;
        }
    }
    return true;
}

function evaluateTurnEnd() {
    console.log("Evaluating turn end. Ball pocketed:", ballPocketedThisTurn ? ballPocketedThisTurn.id : 'none', "Foul:", snookerGameState.foulCommitted);

    if (snookerGameState.foulCommitted) {
        if (ballPocketedThisTurn && ballPocketedThisTurn.id === 'cue') {
            // Re-spot cue ball
            cueBallObj.isPocketed = false;
            cueBallObj.mesh.visible = true;
            cueBallObj.mesh.position.copy(SNOOKER_BALLS_CONFIG.cue.spot); // Place in D for now
            cueBallObj.velocity.set(0,0,0);
            console.log("Cue ball re-spotted after foul.");
        }
        // If other balls were potted on a foul shot, they stay pocketed unless they are colors that need re-spotting.
        // Proper re-spotting logic for colors is complex (check if own spot is covered, etc.) - deferred.
        // For now, if a color is potted on a foul, and it's a re-spottable color, it stays pocketed (simplification).
        
        console.log("Turn ends due to foul. Switching player.");
        let nextTargetForOpponent_foul = snookerGameState.redsRemaining > 0 ? 'MUST_HIT_RED' : 'MUST_HIT_YELLOW';
        // If game over, it's game over.
        if (snookerGameState.targetBallState === 'GAME_OVER') nextTargetForOpponent_foul = 'GAME_OVER';

        if(window.sendEndTurn) window.sendEndTurn({ 
            redsRemaining: snookerGameState.redsRemaining, 
            nextTargetForOpponent: nextTargetForOpponent_foul 
        });
        // snookerGameState.targetBallState is updated by server message 'turnUpdate'
    
    } else if (ballPocketedThisTurn) { // Valid pot, no foul
        if (ballPocketedThisTurn.id.startsWith('red')) {
            snookerGameState.targetBallState = 'MUST_HIT_NOMINATED_COLOR';
            console.log("Red potted legally. Next target: Nominated Color.");
            // Player continues turn.
        } else if (ballPocketedThisTurn.isColorToRespot) { // A nominated color potted legally
            console.log(`${ballPocketedThisTurn.id} color potted legally.`);
            // Re-spotting logic (simplified: always re-spot to its default spot if available)
            // A proper check if spot is occupied is needed.
            const B = ballPocketedThisTurn; // ballPocketedThisTurn is the Ball object
            B.isPocketed = false; 
            B.mesh.visible = true;
            B.mesh.position.copy(B.defaultSpotPosition);
            B.velocity.set(0,0,0);
            console.log(`${B.id} re-spotted to its default spot.`);

            if (snookerGameState.redsRemaining > 0) {
                snookerGameState.targetBallState = 'MUST_HIT_RED';
                console.log("Color potted. Next target: Red.");
                // Player continues turn.
            } else {
                // All reds are gone, now potting colors in sequence.
                // Determine next color based on ballPocketedThisTurn.id
                const colorSequence = ['YELLOW', 'GREEN', 'BROWN', 'BLUE', 'PINK', 'BLACK'];
                const currentIndex = colorSequence.indexOf(ballPocketedThisTurn.id.toUpperCase());
                if (currentIndex < colorSequence.length - 1) {
                    snookerGameState.targetBallState = `MUST_HIT_${colorSequence[currentIndex + 1]}`;
                    console.log(`Potted ${ballPocketedThisTurn.id}. Next target: ${colorSequence[currentIndex + 1]}.`);
                } else { // Black potted, game over
                    snookerGameState.targetBallState = 'GAME_OVER'; // Local update
                    console.log("Black potted. Game Over!");
                    if(window.sendEndTurn) window.sendEndTurn({ 
                        redsRemaining: snookerGameState.redsRemaining, 
                        nextTargetForOpponent: 'GAME_OVER' // Signal game over
                    });
                    // Player might "continue" locally but game state is GAME_OVER
                }
                // Player continues turn unless it's game over. If turn continues, no sendEndTurn() call here.
            }
        } else { // Should not happen if logic is correct (e.g. potting cue ball without foul flag being set)
            console.log("Unexpected pot scenario (valid pot, but not red or color). Ending turn.");
            let nextTargetForOpponent_unexpected = snookerGameState.redsRemaining > 0 ? 'MUST_HIT_RED' : 'MUST_HIT_YELLOW';
            if(window.sendEndTurn) window.sendEndTurn({ 
                redsRemaining: snookerGameState.redsRemaining, 
                nextTargetForOpponent: nextTargetForOpponent_unexpected 
            });
        }
        // If player continues turn (e.g. potted red, potted color with reds remaining), no sendEndTurn() here.
    } else { // No valid pot, no foul explicitly set (e.g. miss or hit wrong ball without potting anything)
        console.log("No valid ball pocketed or foul. Turn ends. Switching player.");
        let nextTargetForOpponent_miss = snookerGameState.redsRemaining > 0 ? 'MUST_HIT_RED' : 'MUST_HIT_YELLOW';
         if (snookerGameState.targetBallState === 'GAME_OVER') nextTargetForOpponent_miss = 'GAME_OVER'; // Should not happen if miss

        if(window.sendEndTurn) window.sendEndTurn({ 
            redsRemaining: snookerGameState.redsRemaining, 
            nextTargetForOpponent: nextTargetForOpponent_miss
        });
    }
    
    // shotHadEffect is not directly used here to decide turn end, but useful for logging or other rules.
    console.log("Shot had effect:", shotHadEffect);
}
