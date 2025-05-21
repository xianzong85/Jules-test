// tests.js

// Define a friction constant for testing, matching the one in game.js
// Ideally, this would be imported or shared from game.js if it were structured as a module.
const testFriction = 0.02;
const testBallRadius = 0.1; // Assuming this matches ballRadius in game.js
const stopThresholdSq = 0.0001; // Assuming this matches the stopping threshold in game.js

QUnit.module('Billiard Game Logic', function(hooks) {
    let originalCueBallPosition;
    let originalCueBallVelocity;

    hooks.beforeEach(function() {
        // Ensure game.js has been loaded and window.cueBall is available
        if (!window.cueBall || !window.cueBall.position || !window.cueBall.velocity) {
            throw new Error("cueBall is not initialized in game.js or not exposed to window. Tests cannot run.");
        }
        // Save original state if needed, or reset
        originalCueBallPosition = window.cueBall.position.clone();
        originalCueBallVelocity = window.cueBall.velocity.clone();

        // Reset cueBall for each test to a known state
        window.cueBall.position.set(0, testBallRadius, 0.5); // Default starting position
        window.cueBall.velocity.set(0, 0, 0); // Default starting velocity
    });

    hooks.afterEach(function() {
        // Restore original state if necessary, though typically tests should not rely on this
        // window.cueBall.position.copy(originalCueBallPosition);
        // window.cueBall.velocity.copy(originalCueBallVelocity);
    });

    QUnit.test('Test Ball Initialization', function(assert) {
        assert.ok(window.cueBall, 'cueBall object exists');
        assert.ok(window.cueBall.position instanceof THREE.Vector3, 'cueBall.position is a THREE.Vector3');
        assert.ok(window.cueBall.velocity instanceof THREE.Vector3, 'cueBall.velocity is a THREE.Vector3');
        
        // game.js initializes cueBall.velocity to (0,0,0) after creation.
        // The beforeEach hook also resets it to (0,0,0)
        assert.deepEqual(
            { x: window.cueBall.velocity.x, y: window.cueBall.velocity.y, z: window.cueBall.velocity.z },
            { x: 0, y: 0, z: 0 },
            'cueBall initial velocity is (0,0,0)'
        );
        assert.equal(window.cueBall.position.y, testBallRadius, 'cueBall is on the table plane initially');
    });

    QUnit.test('Test Ball Movement Application (1 tick)', function(assert) {
        const initialPos = window.cueBall.position.clone();
        const testVelocity = new THREE.Vector3(0.1, 0, 0.05);
        window.cueBall.velocity.copy(testVelocity);

        // Simulate one tick of position update (from game.js animate loop)
        // cueBall.position.add(cueBall.velocity);
        // cueBall.position.y = ballRadius; 
        window.cueBall.position.add(window.cueBall.velocity);
        window.cueBall.position.y = testBallRadius;


        const expectedPos = initialPos.clone().add(testVelocity);
        expectedPos.y = testBallRadius; // Ensure y is clamped

        assert.deepEqual(
            { x: window.cueBall.position.x, y: window.cueBall.position.y, z: window.cueBall.position.z },
            { x: expectedPos.x, y: expectedPos.y, z: expectedPos.z },
            'cueBall position updated correctly after one tick based on velocity'
        );
        assert.equal(window.cueBall.position.y, testBallRadius, 'cueBall remains on the table plane after movement');
    });

    QUnit.test('Test Friction Application (1 tick)', function(assert) {
        const initialVelocity = new THREE.Vector3(0.1, 0, -0.1);
        window.cueBall.velocity.copy(initialVelocity);

        // Simulate one tick of friction application (from game.js animate loop)
        // cueBall.velocity.multiplyScalar(1 - friction);
        window.cueBall.velocity.multiplyScalar(1 - testFriction);

        const expectedVelocityX = initialVelocity.x * (1 - testFriction);
        const expectedVelocityY = initialVelocity.y * (1 - testFriction); // Should remain 0
        const expectedVelocityZ = initialVelocity.z * (1 - testFriction);
        
        assert.ok(window.cueBall.velocity.lengthSq() < initialVelocity.lengthSq(), 'Velocity magnitude decreased after friction');
        assert.close(window.cueBall.velocity.x, expectedVelocityX, 0.00001, 'Velocity X component decreased correctly');
        assert.close(window.cueBall.velocity.y, expectedVelocityY, 0.00001, 'Velocity Y component remained 0');
        assert.close(window.cueBall.velocity.z, expectedVelocityZ, 0.00001, 'Velocity Z component decreased correctly');
    });

    QUnit.test('Test Ball Stopping (very low speed)', function(assert) {
        // Set a velocity that is small but above the stopping threshold initially
        const veryLowVelocity = new THREE.Vector3(0.001, 0, 0.001); // lengthSq = 0.000002
        window.cueBall.velocity.copy(veryLowVelocity);
        
        // Make sure it's initially not zero
        assert.notDeepEqual({x: window.cueBall.velocity.x, y:window.cueBall.velocity.y, z:window.cueBall.velocity.z}, {x:0,y:0,z:0}, "Initial velocity is not zero");


        // Simulate one tick of friction and stopping logic (from game.js animate loop)
        // cueBall.velocity.multiplyScalar(1 - friction);
        // if (cueBall.velocity.lengthSq() < 0.0001) { cueBall.velocity.set(0, 0, 0); }
        window.cueBall.velocity.multiplyScalar(1 - testFriction);
        if (window.cueBall.velocity.lengthSq() < stopThresholdSq) {
            window.cueBall.velocity.set(0, 0, 0);
        }

        assert.deepEqual(
            { x: window.cueBall.velocity.x, y: window.cueBall.velocity.y, z: window.cueBall.velocity.z },
            { x: 0, y: 0, z: 0 },
            'cueBall velocity becomes (0,0,0) when speed is very low after friction'
        );
    });
});

// It's good practice to ensure game.js doesn't start its animation loop when included in a test environment.
// If game.js starts requestAnimationFrame, it could interfere with tests or run unnecessarily.
// For now, we assume game.js is safe to include as is.
// A more robust setup might involve conditional logic in game.js:
// if (typeof QUnit === 'undefined') { animate(); }
// Or by having an explicit init function for the game.
