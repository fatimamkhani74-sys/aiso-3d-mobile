import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
// Capacitor Bridge Safe References
const Capacitor = window.Capacitor;
const AppPlugin = window.Capacitor?.Plugins?.App;
const FilesystemPlugin = window.Capacitor?.Plugins?.Filesystem;
const HapticsPlugin = window.Capacitor?.Plugins?.Haptics;


// DOM elements
const container = document.getElementById('canvas-container');
const emptyState = document.getElementById('empty-state');
const fileInput = document.getElementById('file-input');
const btnOpenFile = document.getElementById('btn-open-file');
const btnEmptyBrowse = document.getElementById('btn-empty-browse');
const btnWireframe = document.getElementById('btn-wireframe');
const btnGrid = document.getElementById('btn-grid');
const btnAutoRotate = document.getElementById('btn-autorotate');
const btnBg = document.getElementById('btn-bg');
const btnResetCam = document.getElementById('btn-reset-cam');
const btnModelInfo = document.getElementById('btn-model-info');
const infoSheet = document.getElementById('info-sheet');
const btnCloseSheet = document.getElementById('btn-close-sheet');
const sheetBackdrop = document.getElementById('sheet-backdrop');
const loader = document.getElementById('loader');
const loaderText = document.getElementById('loader-text');

// Sheet info values
const infoFilename = document.getElementById('info-filename');
const infoVertices = document.getElementById('info-vertices');
const infoTriangles = document.getElementById('info-triangles');
const infoMeshes = document.getElementById('info-meshes');
const infoAnimations = document.getElementById('info-animations');

// State
let scene, camera, renderer, controls, gridHelper;
let currentModel = null;
let mixer = null;
const clock = new THREE.Clock();
let isWireframe = false;
let isGridVisible = true;
let isAutoRotating = false;
let bgIndex = 0;
const bgColors = ['#08080C', '#13131A', '#1E293B', '#F8FAFC'];

// Safe haptic trigger
async function triggerHaptic(style = 'Light') {
  try {
    if (HapticsPlugin?.impact) {
      await HapticsPlugin.impact({ style });
    }
  } catch (e) {
    // Haptics not available
  }
}

function showLoader(show, text = 'Loading 3D Model...') {
  loaderText.textContent = text;
  if (show) {
    loader.classList.remove('hidden');
  } else {
    loader.classList.add('hidden');
  }
}

// Initialize Three.js Scene
function initScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(bgColors[0]);

  // Camera
  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.05, 1000);
  camera.position.set(0, 2, 5);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  // Touch-optimized OrbitControls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.rotateSpeed = 0.85;
  controls.zoomSpeed = 1.0;
  controls.panSpeed = 0.8;
  controls.screenSpacePanning = true;
  controls.minDistance = 0.1;
  controls.maxDistance = 100;
  controls.maxPolarAngle = Math.PI / 2 + 0.3; // Allow slight under-viewing

  // Lighting
  setupLighting();

  // Grid
  gridHelper = new THREE.GridHelper(10, 20, 0x3b82f6, 0x1e293b);
  gridHelper.position.y = -0.001;
  scene.add(gridHelper);

  // Window resize
  window.addEventListener('resize', onWindowResize);

  // Animation Loop
  animate();
}

function setupLighting() {
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
  scene.add(ambientLight);

  const mainLight = new THREE.DirectionalLight(0xffffff, 2.0);
  mainLight.position.set(5, 10, 7.5);
  scene.add(mainLight);

  const fillLight = new THREE.DirectionalLight(0x90b0ff, 1.0);
  fillLight.position.set(-5, 4, -5);
  scene.add(fillLight);

  const bottomLight = new THREE.DirectionalLight(0x304060, 0.6);
  bottomLight.position.set(0, -6, 0);
  scene.add(bottomLight);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  if (mixer) mixer.update(delta);

  if (isAutoRotating && controls) {
    controls.autoRotate = true;
    controls.autoRotateSpeed = 2.0;
  } else if (controls) {
    controls.autoRotate = false;
  }

  controls.update();
  renderer.render(scene, camera);
}

// Center and frame model in camera view
function frameModel(object) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  // Center model at origin with bottom at grid level
  object.position.x -= center.x;
  object.position.y -= box.min.y;
  object.position.z -= center.z;

  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = camera.fov * (Math.PI / 180);
  let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.5;
  cameraZ = Math.max(cameraZ, 1.5);

  camera.position.set(cameraZ * 0.8, cameraZ * 0.6, cameraZ);
  camera.lookAt(0, size.y / 2, 0);
  controls.target.set(0, size.y / 2, 0);
  controls.update();

  // Adjust grid to model scale
  const gridSize = Math.max(10, Math.ceil(maxDim * 3));
  scene.remove(gridHelper);
  gridHelper = new THREE.GridHelper(gridSize, gridSize * 2, 0x3b82f6, 0x1e293b);
  gridHelper.visible = isGridVisible;
  scene.add(gridHelper);
}

// Calculate model statistics
function updateModelStats(object, filename, animCount = 0) {
  let vertices = 0;
  let triangles = 0;
  let meshes = 0;

  object.traverse((child) => {
    if (child.isMesh && child.geometry) {
      meshes++;
      const geom = child.geometry;
      if (geom.attributes.position) {
        vertices += geom.attributes.position.count;
      }
      if (geom.index) {
        triangles += geom.index.count / 3;
      } else if (geom.attributes.position) {
        triangles += geom.attributes.position.count / 3;
      }
    }
  });

  infoFilename.textContent = filename || 'Model';
  infoVertices.textContent = vertices.toLocaleString();
  infoTriangles.textContent = Math.round(triangles).toLocaleString();
  infoMeshes.textContent = meshes.toLocaleString();
  infoAnimations.textContent = animCount.toString();
}

// Load 3D Model from ArrayBuffer
export async function loadModelFromBuffer(buffer, ext, filename = 'Model') {
  showLoader(true, `Parsing .${ext.toUpperCase()} Model...`);

  if (currentModel) {
    scene.remove(currentModel);
    if (mixer) {
      mixer.stopAllAction();
      mixer = null;
    }
  }

  try {
    let loadedObject = null;
    let anims = [];

    if (ext === 'glb' || ext === 'gltf') {
      const loader = new GLTFLoader();
      const dracoLoader = new DRACOLoader();
      dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
      loader.setDRACOLoader(dracoLoader);

      const gltf = await new Promise((res, rej) => loader.parse(buffer, '', res, rej));
      loadedObject = gltf.scene;
      anims = gltf.animations || [];

      if (anims.length > 0) {
        mixer = new THREE.AnimationMixer(loadedObject);
        anims.forEach((clip) => mixer.clipAction(clip).play());
      }
    } else if (ext === 'obj') {
      const text = new TextDecoder().decode(buffer);
      const loader = new OBJLoader();
      loadedObject = loader.parse(text);
    } else if (ext === 'fbx') {
      const loader = new FBXLoader();
      loadedObject = loader.parse(buffer, '');
      if (loadedObject.animations && loadedObject.animations.length > 0) {
        mixer = new THREE.AnimationMixer(loadedObject);
        loadedObject.animations.forEach((clip) => mixer.clipAction(clip).play());
        anims = loadedObject.animations;
      }
    } else if (ext === 'stl') {
      const loader = new STLLoader();
      const geometry = loader.parse(buffer);
      const material = new THREE.MeshStandardMaterial({
        color: 0x90cdf4,
        roughness: 0.35,
        metalness: 0.25,
      });
      loadedObject = new THREE.Mesh(geometry, material);
    } else {
      throw new Error(`Format .${ext} is not supported.`);
    }

    currentModel = loadedObject;
    scene.add(currentModel);
    frameModel(currentModel);
    updateModelStats(currentModel, filename, anims.length);

    emptyState.classList.add('hidden');
    triggerHaptic('Medium');
  } catch (err) {
    console.error('Model loading failed:', err);
    alert('Could not load 3D model: ' + (err.message || 'Unknown error'));
  } finally {
    showLoader(false);
  }
}

// Capacitor native open-with / file association handler
function setupCapacitorListeners() {
  if (AppPlugin?.addListener) {
    AppPlugin.addListener('appUrlOpen', async (event) => {
      console.log('App opened with URL:', event.url);
      if (!event.url) return;

      showLoader(true, 'Opening 3D file...');
      try {
        let fileUrl = event.url;
        // Handle file:// or content:// URLs
        const ext = fileUrl.split('?')[0].split('.').pop().toLowerCase();
        const filename = decodeURIComponent(fileUrl.split('/').pop().split('?')[0]);

        if (FilesystemPlugin?.readFile) {
          const result = await FilesystemPlugin.readFile({
            path: fileUrl
          });

          // Decode base64 data from capacitor filesystem
          const binaryString = atob(result.data);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }

          await loadModelFromBuffer(bytes.buffer, ext, filename);
          return;
        }

        // Fallback: fetch directly
        const response = await fetch(event.url);
        const buffer = await response.arrayBuffer();
        await loadModelFromBuffer(buffer, ext, filename);
      } catch (err) {
        console.error('Error opening external file:', err);
        try {
          const response = await fetch(event.url);
          const buffer = await response.arrayBuffer();
          const ext = event.url.split('?')[0].split('.').pop().toLowerCase();
          await loadModelFromBuffer(buffer, ext, 'Model');
        } catch (fetchErr) {
          alert('Failed to read external file: ' + err.message);
        }
      } finally {
        showLoader(false);
      }
    });
  }
}

// Setup Event Listeners & UI Controls
function setupUIEvents() {
  const triggerFileInput = () => {
    triggerHaptic();
    fileInput.click();
  };

  btnOpenFile.addEventListener('click', triggerFileInput);
  btnEmptyBrowse.addEventListener('click', triggerFileInput);

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const ext = file.name.split('.').pop().toLowerCase();
    const reader = new FileReader();
    reader.onload = () => {
      loadModelFromBuffer(reader.result, ext, file.name);
    };
    reader.readAsArrayBuffer(file);
    fileInput.value = '';
  });

  // Wireframe toggle
  btnWireframe.addEventListener('click', () => {
    triggerHaptic();
    isWireframe = !isWireframe;
    btnWireframe.classList.toggle('active', isWireframe);
    if (currentModel) {
      currentModel.traverse((child) => {
        if (child.isMesh && child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => (m.wireframe = isWireframe));
          } else {
            child.material.wireframe = isWireframe;
          }
        }
      });
    }
  });

  // Grid toggle
  btnGrid.addEventListener('click', () => {
    triggerHaptic();
    isGridVisible = !isGridVisible;
    btnGrid.classList.toggle('active', isGridVisible);
    if (gridHelper) gridHelper.visible = isGridVisible;
  });

  // Auto rotate toggle
  btnAutoRotate.addEventListener('click', () => {
    triggerHaptic();
    isAutoRotating = !isAutoRotating;
    btnAutoRotate.classList.toggle('active', isAutoRotating);
  });

  // Background Theme cycle
  btnBg.addEventListener('click', () => {
    triggerHaptic();
    bgIndex = (bgIndex + 1) % bgColors.length;
    const newColor = bgColors[bgIndex];
    scene.background = new THREE.Color(newColor);
    const isLight = bgIndex === bgColors.length - 1;
    if (gridHelper) {
      gridHelper.material.color.setHex(isLight ? 0x94a3b8 : 0x3b82f6);
    }
  });

  // Reset Camera view
  btnResetCam.addEventListener('click', () => {
    triggerHaptic();
    if (currentModel) {
      frameModel(currentModel);
    } else {
      camera.position.set(0, 2, 5);
      camera.lookAt(0, 0, 0);
      controls.target.set(0, 0, 0);
      controls.update();
    }
  });

  // Info Modal Sheet
  btnModelInfo.addEventListener('click', () => {
    triggerHaptic();
    infoSheet.classList.remove('hidden');
  });

  const closeSheet = () => {
    triggerHaptic();
    infoSheet.classList.add('hidden');
  };

  btnCloseSheet.addEventListener('click', closeSheet);
  sheetBackdrop.addEventListener('click', closeSheet);
}

// Boot up
window.addEventListener('DOMContentLoaded', () => {
  initScene();
  setupUIEvents();
  setupCapacitorListeners();
});
