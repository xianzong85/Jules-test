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
    // Ensure the canvas element has dimensions, otherwise use parent or fallback
    if (width === 0 && canvas.parentElement) {
        width = canvas.parentElement.clientWidth;
    } else if (width === 0) {
        width = window.innerWidth * 0.8; // Fallback if no parent width
    }

    let height = canvas.clientHeight;
    if (height === 0 && canvas.parentElement) {
        height = canvas.parentElement.clientHeight;
    } else if (height === 0) {
        height = window.innerHeight * 0.8; // Fallback if no parent height
    }
    
    // If either width or height is still 0, use some default values to avoid errors
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

// Create Placeholder Cue Ball
const ballRadius = 0.1;
const cueBallGeometry = new THREE.SphereGeometry(ballRadius, 32, 32);
const cueBallMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
const cueBall = new THREE.Mesh(cueBallGeometry, cueBallMaterial);
cueBall.position.set(0, ballRadius, 0.5); // Position it on the table placeholder
scene.add(cueBall);
window.cueBall = cueBall; // Expose cueBall globally for network.js

// Ball Properties
cueBall.velocity = new THREE.Vector3(0, 0, 0);
const friction = 0.02; // Coefficient of friction
const ballMass = 1; // Mass of the ball (currently unused but good for future physics)


// Basic Render Loop
function animate() {
    requestAnimationFrame(animate);

    // Update ball position
    cueBall.position.add(cueBall.velocity);
    cueBall.position.y = ballRadius; // Ensure ball stays on the table plane

    // Apply friction
    cueBall.velocity.multiplyScalar(1 - friction);

    // Stop ball if speed is very low
    if (cueBall.velocity.lengthSq() < 0.0001) {
        cueBall.velocity.set(0, 0, 0);
    }

    // Add any other animations or updates here
    renderer.render(scene, camera);
}

// Call animate to start the rendering, but ensure canvas has dimensions first
if (canvas.clientWidth > 0 && canvas.clientHeight > 0) {
    animate();
} else {
    // Fallback or log if canvas has no dimensions initially
    console.warn("Canvas dimensions are zero. Starting animate loop, but rendering might not be visible until resize.");
    // Try to initialize renderer with fallback dimensions if canvas is not yet sized
    if (canvas.clientWidth === 0 || canvas.clientHeight === 0) {
        const fallbackWidth = (canvas.parentElement || window).innerWidth * 0.8 || 600;
        const fallbackHeight = (canvas.parentElement || window).innerHeight * 0.8 || 400;
        renderer.setSize(fallbackWidth, fallbackHeight);
        camera.aspect = fallbackWidth / fallbackHeight;
        camera.updateProjectionMatrix();
    }
    animate();
}

// Initial resize call to set size correctly if canvas dimensions are available
if (canvas.clientWidth > 0 && canvas.clientHeight > 0) {
    window.dispatchEvent(new Event('resize'));
}

// Simple Cue Control (Key Press)
window.addEventListener('keydown', (event) => {
    if (event.code === 'Space') {
        // Check if the ball is (almost) stationary
        if (cueBall.velocity.lengthSq() < 0.0001) {
            // Apply an initial velocity (e.g., shoot along negative Z-axis)
            cueBall.velocity.set(0, 0, -0.2);
            // Send the state over WebSocket
            if (window.sendCueBallState) {
                window.sendCueBallState(cueBall.position, cueBall.velocity);
            }
        }
    }
});
