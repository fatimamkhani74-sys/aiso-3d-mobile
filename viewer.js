import '@google/model-viewer';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';

import * as fflate from 'three/addons/libs/fflate.module.js';

// DOM Elements
const modelViewer = document.getElementById('main-viewer');
const dropzone = document.getElementById('dropzone');
const loadingScrim = document.getElementById('loading-scrim');
const loadingStatus = document.getElementById('loading-status');
const floatingDock = document.getElementById('floating-dock');
const inspectorPanel = document.getElementById('inspector-panel');

// Titlebar & Stats elements
const fileBadge = document.getElementById('file-badge');
const badgeFilename = document.getElementById('badge-filename');
const badgeExt = document.getElementById('badge-ext');
const badgeSize = document.getElementById('badge-size');
const titlebarStats = document.getElementById('titlebar-stats');
const statTris = document.getElementById('stat-tris');
const statMats = document.getElementById('stat-mats');
const statDim = document.getElementById('stat-dim');

// Metadata elements in inspector
const metaName = document.getElementById('meta-name');
const metaTriangles = document.getElementById('meta-triangles');
const metaMaterials = document.getElementById('meta-materials');
const metaAnimations = document.getElementById('meta-animations');
const metaBounds = document.getElementById('meta-bounds');

// Control inputs
const slExposure = document.getElementById('sl-exposure');
const valExposure = document.getElementById('val-exposure');
const selToneMapping = document.getElementById('sel-tonemapping');
const slEnvRotation = document.getElementById('sl-env-rotation');
const valEnvRotation = document.getElementById('val-env-rotation');
const slSkyboxBlur = document.getElementById('sl-skybox-blur');
const valSkyboxBlur = document.getElementById('val-skybox-blur');
const rowSkyboxBlur = document.getElementById('row-skybox-blur');

const slShadowIntensity = document.getElementById('sl-shadow-intensity');
const valShadowIntensity = document.getElementById('val-shadow-intensity');
const slShadowSoftness = document.getElementById('sl-shadow-softness');
const valShadowSoftness = document.getElementById('val-shadow-softness');

const slFov = document.getElementById('sl-fov');
const valFov = document.getElementById('val-fov');
const slRotateSpeed = document.getElementById('sl-rotate-speed');
const valRotateSpeed = document.getElementById('val-rotate-speed');

// Environment presets map
const HDR_PRESETS = {
  neutral: {
    env: 'neutral',
    sky: null,
    exposure: 1.0,
    toneMapping: 'neutral'
  },
  studio: {
    env: './assets/hdri/studio_small.hdr',
    sky: null,
    exposure: 1.1,
    toneMapping: 'neutral'
  },
  sunrise: {
    env: './assets/hdri/spruit_sunrise.hdr',
    sky: null,
    exposure: 1.2,
    toneMapping: 'neutral'
  },
  forest: {
    env: './assets/hdri/forest_slope.hdr',
    sky: null,
    exposure: 1.0,
    toneMapping: 'neutral'
  }
};

let currentPreset = 'neutral';
let activeBlobUrl = null;
let currentBgMode = 'gradient';

// ==========================================================================
// File Loading Core
// ==========================================================================

function showLoading(show, message = 'Loading AR Scene...') {
  loadingStatus.textContent = message;
  loadingScrim.style.display = show ? 'flex' : 'none';
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function loadModelFromFile(filePath) {
  if (!filePath) return;
  const fileName = filePath.split(/[\\/]/).pop();
  const ext = filePath.split('.').pop().toLowerCase();

  showLoading(true, `Loading ${fileName}...`);

  // Clean previous blob if any
  if (activeBlobUrl) {
    URL.revokeObjectURL(activeBlobUrl);
    activeBlobUrl = null;
  }

  try {
    if (ext === 'glb' || ext === 'gltf') {
      // Native fast path for GLB/GLTF
      const fileUrl = 'file:///' + filePath.replace(/\\/g, '/');
      applyModelSource(fileUrl, fileName, ext);
    } else {
      // Convert OBJ, FBX, STL to GLB blob via Three.js
      showLoading(true, `Converting ${ext.toUpperCase()} to AR PBR Scene...`);
      const fileData = await window.electronAPI.getFileData(filePath);
      const glbBlob = await convertToGlb(fileData.buffer, ext, filePath);
      activeBlobUrl = URL.createObjectURL(glbBlob);
      applyModelSource(activeBlobUrl, fileName, ext);
    }
  } catch (err) {
    console.error('Failed to load model:', err);
    showLoading(false);
    alert(`Could not load model: ${err.message || err}`);
  }
}

function applyModelSource(src, fileName, ext) {
  modelViewer.src = src;
  modelViewer.style.display = 'block';
  dropzone.style.display = 'none';
  floatingDock.style.display = 'flex';
  fileBadge.style.display = 'flex';
  titlebarStats.style.display = 'flex';

  // Update UI tags
  badgeFilename.textContent = fileName;
  badgeExt.textContent = ext.toUpperCase();
  metaName.textContent = fileName;

  document.title = `${fileName} — AR 3D Viewer`;

  // Set default AR settings
  applyPreset('neutral');
}

function isTextureValid(texture) {
  if (!texture || !texture.isTexture) return false;
  const img = texture.image;
  if (!img) return false;

  try {
    if (typeof img.src === 'string' && img.src.length > 0) return true;
    if (texture.source) return true;

    if (typeof HTMLImageElement !== 'undefined' && img instanceof HTMLImageElement) {
      if (img.src) return true;
      if (img.complete && img.naturalWidth > 0) return true;
    }
    if (typeof HTMLCanvasElement !== 'undefined' && img instanceof HTMLCanvasElement) {
      if (img.width > 0 && img.height > 0) return true;
    }
    if (typeof ImageBitmap !== 'undefined' && img instanceof ImageBitmap) {
      if (img.width > 0 && img.height > 0) return true;
    }
    if (img.data && img.data.length > 0) return true;
    if (img.width > 0 && img.height > 0) return true;
  } catch (e) {
    return true;
  }

  return true;
}

async function waitForTextures(object) {
  const promises = [];
  object.traverse((child) => {
    if (child.isMesh && child.material) {
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach(mat => {
        for (const key in mat) {
          const tex = mat[key];
          if (tex && tex.isTexture && tex.image) {
            const img = tex.image;
            if (typeof HTMLImageElement !== 'undefined' && img instanceof HTMLImageElement) {
              if (!img.complete || img.naturalWidth === 0) {
                promises.push(new Promise((resolve) => {
                  let resolved = false;
                  const onDone = () => { if (!resolved) { resolved = true; resolve(); } };
                  img.addEventListener('load', onDone, { once: true });
                  img.addEventListener('error', onDone, { once: true });
                  setTimeout(onDone, 3000);
                }));
              }
            }
          }
        }
      });
    }
  });
  if (promises.length > 0) {
    await Promise.all(promises);
  }
}

function cleanZeroWidthTextures(object) {
  const textureKeys = [
    'map', 'alphaMap', 'aoMap', 'bumpMap', 'displacementMap',
    'emissiveMap', 'envMap', 'lightMap', 'metalnessMap',
    'normalMap', 'roughnessMap', 'specularMap'
  ];

  object.traverse((child) => {
    if (child.isMesh && child.material) {
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach(mat => {
        textureKeys.forEach(key => {
          const tex = mat[key];
          if (tex && tex.isTexture) {
            const img = tex.image;
            if (!img) {
              mat[key] = null;
              return;
            }

            // CRITICAL FIX: If image has a valid src (Blob URL / Data URL), KEEP IT!
            if (typeof img.src === 'string' && img.src.length > 0) {
              return;
            }

            let valid = false;
            if (typeof HTMLImageElement !== 'undefined' && img instanceof HTMLImageElement) {
              if (img.src || img.naturalWidth > 0) valid = true;
            } else if (img.width > 0 && img.height > 0) {
              valid = true;
            } else if (img.data && img.data.length > 0) {
              valid = true;
            }

            if (!valid) {
              console.warn(`Removing un-decoded texture '${key}' from material '${mat.name}'`);
              mat[key] = null;
            }
          }
        });
      });
    }
  });
}

// Convert other 3D formats (OBJ, FBX, STL) to GLB in memory
async function convertToGlb(rawBuffer, ext, originalPath) {
  return new Promise(async (resolve, reject) => {
    try {
      let arrayBuffer;
      if (rawBuffer instanceof ArrayBuffer) {
        arrayBuffer = rawBuffer;
      } else if (ArrayBuffer.isView(rawBuffer)) {
        arrayBuffer = rawBuffer.buffer.slice(rawBuffer.byteOffset, rawBuffer.byteOffset + rawBuffer.byteLength);
      } else if (rawBuffer && rawBuffer.buffer) {
        const b = rawBuffer.buffer;
        const offset = rawBuffer.byteOffset || 0;
        const len = rawBuffer.byteLength || b.byteLength;
        arrayBuffer = b.slice(offset, offset + len);
      } else if (rawBuffer && rawBuffer.data) {
        arrayBuffer = new Uint8Array(rawBuffer.data).buffer;
      } else if (typeof rawBuffer === 'object') {
        arrayBuffer = new Uint8Array(Object.values(rawBuffer)).buffer;
      } else {
        throw new Error('Invalid binary buffer received');
      }

      let scene = new THREE.Scene();

      const finishExport = async (object) => {
        try {
          if (!object) {
            reject(new Error('Loaded 3D model object is empty'));
            return;
          }

          // Wait for all texture images to decode completely
          await waitForTextures(object);

          scene.add(object);

          const animations = object.animations || (scene.animations ? scene.animations : []);
          object.traverse((child) => {
            if (child.isMesh) {
              if (!child.material) {
                child.material = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.5, metalness: 0.1 });
              } else {
                const mats = Array.isArray(child.material) ? child.material : [child.material];
                const safeMats = mats.map(mat => {
                  let pbrMat = mat;
                  if (!mat.isMeshStandardMaterial && !mat.isMeshPhysicalMaterial) {
                    pbrMat = new THREE.MeshStandardMaterial({
                      color: mat.color ? mat.color.clone() : new THREE.Color(0xffffff),
                      roughness: mat.roughness !== undefined ? mat.roughness : 0.5,
                      metalness: mat.metalness !== undefined ? mat.metalness : 0.1,
                      map: mat.map || null,
                      normalMap: mat.normalMap || null,
                      roughnessMap: mat.roughnessMap || null,
                      metalnessMap: mat.metalnessMap || null,
                      aoMap: mat.aoMap || null,
                      emissiveMap: mat.emissiveMap || null,
                      emissive: mat.emissive ? mat.emissive.clone() : new THREE.Color(0x000000),
                      transparent: !!mat.transparent,
                      opacity: mat.opacity !== undefined ? mat.opacity : 1.0
                    });
                  }
                  return pbrMat;
                });
                child.material = Array.isArray(child.material) ? safeMats : safeMats[0];
              }
            }
          });

          const exporter = new GLTFExporter();
          const options = {
            binary: true,
            animations: animations
          };

          exporter.parse(
            scene,
            (gltf) => {
              const blob = new Blob([gltf], { type: 'model/gltf-binary' });
              resolve(blob);
            },
            (error) => {
              console.error('GLTFExporter failed:', error);
              reject(new Error(`Failed to convert ${ext.toUpperCase()} to GLB: ${error.message || error}`));
            },
            options
          );
        } catch (err) {
          console.error('finishExport error:', err);
          reject(err);
        }
      };

      if (ext === 'stl') {
        const loader = new STLLoader();
        const geom = loader.parse(arrayBuffer);
        const mat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.4, metalness: 0.2 });
        const mesh = new THREE.Mesh(geom, mat);
        await finishExport(mesh);
      } else if (ext === 'obj') {
        const text = new TextDecoder().decode(arrayBuffer);
        const loader = new OBJLoader();
        const obj = loader.parse(text);
        await finishExport(obj);
      } else if (ext === 'fbx') {
        const loader = new FBXLoader();
        const folderPath = originalPath ? 'file:///' + originalPath.replace(/\\/g, '/').replace(/\/[^\/]+$/, '/') : '';
        const obj = loader.parse(arrayBuffer, folderPath);
        await finishExport(obj);
      } else {
        reject(new Error(`Unsupported format: .${ext}`));
      }
    } catch (err) {
      console.error(`Error converting .${ext} file:`, err);
      reject(err);
    }
  });
}

// ==========================================================================
// Model-Viewer Event Handlers & Metadata Extraction
// ==========================================================================

modelViewer.addEventListener('load', () => {
  showLoading(false);

  // Extract model bounding box & dimensions
  try {
    const symbols = Object.getOwnPropertySymbols(modelViewer);
    const sceneSymbol = symbols.find(s => s.description === 'scene' || s.toString().includes('scene'));
    
    // Read triangle & material info
    let triangleCount = 0;
    let materialCount = 0;

    if (modelViewer.model) {
      if (modelViewer.model.materials) {
        materialCount = modelViewer.model.materials.length;
      }
    }

    // Dimension estimation from camera target / size
    const bounds = modelViewer.getBoundingBoxCenter ? modelViewer.getBoundingBoxCenter() : null;
    const dimensions = modelViewer.getDimensions ? modelViewer.getDimensions() : null;

    let dimStr = '—';
    if (dimensions) {
      dimStr = `${dimensions.x.toFixed(2)} × ${dimensions.y.toFixed(2)} × ${dimensions.z.toFixed(2)}m`;
    }

    // Set stats in UI
    statMats.textContent = materialCount.toString();
    statDim.textContent = dimStr;
    metaMaterials.textContent = materialCount.toString();
    metaBounds.textContent = dimStr;

    // Check animations
    const anims = modelViewer.availableAnimations || [];
    statTris.textContent = 'PBR';
    metaTriangles.textContent = 'Calibrated';
    metaAnimations.textContent = anims.length.toString();

    const animDock = document.getElementById('anim-dock-group');
    const animSelect = document.getElementById('anim-select');
    if (anims.length > 0) {
      animDock.style.display = 'flex';
      animSelect.innerHTML = '';
      anims.forEach((name, idx) => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name || `Animation ${idx + 1}`;
        animSelect.appendChild(opt);
      });
      modelViewer.animationName = anims[0];
      modelViewer.play();
    } else {
      animDock.style.display = 'none';
    }

    // Check variants
    const variants = modelViewer.availableVariants || [];
    const cardVariants = document.getElementById('card-variants');
    const selVariants = document.getElementById('sel-variants');
    if (variants.length > 0) {
      cardVariants.style.display = 'flex';
      selVariants.innerHTML = '';
      variants.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v;
        opt.textContent = v;
        selVariants.appendChild(opt);
      });
      selVariants.onchange = () => {
        modelViewer.variantName = selVariants.value;
      };
    } else {
      cardVariants.style.display = 'none';
    }

  } catch (e) {
    console.warn('Metadata inspection warning:', e);
  }
});

modelViewer.addEventListener('error', (event) => {
  showLoading(false);
  console.error('Model viewer error:', event);
});

// ==========================================================================
// Lighting & Environment Controls
// ==========================================================================

function applyPreset(presetKey) {
  currentPreset = presetKey;
  const config = HDR_PRESETS[presetKey] || HDR_PRESETS.neutral;

  modelViewer.environmentImage = config.env;
  if (currentBgMode === 'skybox') {
    modelViewer.skyboxImage = config.env;
  }

  modelViewer.exposure = config.exposure;
  modelViewer.toneMapping = config.toneMapping;

  slExposure.value = config.exposure;
  valExposure.textContent = config.exposure.toFixed(2) + 'x';
  selToneMapping.value = config.toneMapping;

  // Update pills in dock
  document.querySelectorAll('.preset-pill').forEach(pill => {
    pill.classList.toggle('active', pill.dataset.preset === presetKey);
  });

  // Update cards in inspector
  document.querySelectorAll('.env-card').forEach(card => {
    card.classList.toggle('active', card.dataset.preset === presetKey);
  });
}

// Preset pills click
document.querySelectorAll('.preset-pill').forEach(pill => {
  pill.addEventListener('click', () => applyPreset(pill.dataset.preset));
});

// Inspector env cards click
document.querySelectorAll('.env-card').forEach(card => {
  card.addEventListener('click', () => applyPreset(card.dataset.preset));
});

// Custom HDR file loader
document.getElementById('btn-custom-hdr').addEventListener('click', async () => {
  if (window.electronAPI) {
    const hdrPath = await window.electronAPI.openHdrDialog();
    if (hdrPath) {
      const hdrUrl = 'file:///' + hdrPath.replace(/\\/g, '/');
      modelViewer.environmentImage = hdrUrl;
      if (currentBgMode === 'skybox') modelViewer.skyboxImage = hdrUrl;
      document.querySelectorAll('.preset-pill, .env-card').forEach(el => el.classList.remove('active'));
    }
  }
});

// Exposure Slider
slExposure.addEventListener('input', () => {
  const val = parseFloat(slExposure.value);
  modelViewer.exposure = val;
  valExposure.textContent = val.toFixed(2) + 'x';
});

// Tone Mapping
selToneMapping.addEventListener('change', () => {
  modelViewer.toneMapping = selToneMapping.value;
});

// Environment Rotation
slEnvRotation.addEventListener('input', () => {
  const deg = parseInt(slEnvRotation.value, 10);
  modelViewer.environmentRotation = `${deg}deg`;
  valEnvRotation.textContent = `${deg}°`;
});

// Skybox Blur
slSkyboxBlur.addEventListener('input', () => {
  const val = parseFloat(slSkyboxBlur.value);
  modelViewer.skyboxBlur = val;
  valSkyboxBlur.textContent = val.toFixed(2);
});

// Background Swatches
document.querySelectorAll('.bg-swatch').forEach(swatch => {
  swatch.addEventListener('click', () => {
    document.querySelectorAll('.bg-swatch').forEach(s => s.classList.remove('active'));
    swatch.classList.add('active');

    const mode = swatch.dataset.bg;
    currentBgMode = mode;

    const container = document.getElementById('viewer-container');

    if (mode === 'gradient') {
      container.style.background = 'radial-gradient(circle at 50% 50%, #161824 0%, #08080c 100%)';
      modelViewer.skyboxImage = null;
      rowSkyboxBlur.style.display = 'none';
    } else if (mode === 'dark') {
      container.style.background = '#09090b';
      modelViewer.skyboxImage = null;
      rowSkyboxBlur.style.display = 'none';
    } else if (mode === 'neutral-dark') {
      container.style.background = '#1e1e24';
      modelViewer.skyboxImage = null;
      rowSkyboxBlur.style.display = 'none';
    } else if (mode === 'light') {
      container.style.background = '#e2e8f0';
      modelViewer.skyboxImage = null;
      rowSkyboxBlur.style.display = 'none';
    } else if (mode === 'transparent') {
      container.style.background = 'transparent';
      modelViewer.skyboxImage = null;
      rowSkyboxBlur.style.display = 'none';
    } else if (mode === 'skybox') {
      const config = HDR_PRESETS[currentPreset] || HDR_PRESETS.neutral;
      modelViewer.skyboxImage = config.env;
      rowSkyboxBlur.style.display = 'flex';
    }
  });
});

// ==========================================================================
// Shadows & Ground Controls
// ==========================================================================

slShadowIntensity.addEventListener('input', () => {
  const val = parseFloat(slShadowIntensity.value);
  modelViewer.shadowIntensity = val;
  valShadowIntensity.textContent = val.toFixed(2);
});

slShadowSoftness.addEventListener('input', () => {
  const val = parseFloat(slShadowSoftness.value);
  modelViewer.shadowSoftness = val;
  valShadowSoftness.textContent = val.toFixed(2);
});

// ==========================================================================
// Camera & Lens Controls
// ==========================================================================

slFov.addEventListener('input', () => {
  const val = parseInt(slFov.value, 10);
  modelViewer.fieldOfView = `${val}deg`;
  valFov.textContent = `${val}°`;
});

slRotateSpeed.addEventListener('input', () => {
  const val = parseInt(slRotateSpeed.value, 10);
  modelViewer.rotationPerSecond = `${val}deg`;
  valRotateSpeed.textContent = `${val}°/s`;
});

// Preset Camera Views
document.getElementById('btn-view-front').addEventListener('click', () => {
  modelViewer.cameraOrbit = '0deg 75deg 105%';
});
document.getElementById('btn-view-top').addEventListener('click', () => {
  modelViewer.cameraOrbit = '0deg 0deg 105%';
});
document.getElementById('btn-view-side').addEventListener('click', () => {
  modelViewer.cameraOrbit = '90deg 75deg 105%';
});
document.getElementById('btn-view-iso').addEventListener('click', () => {
  modelViewer.cameraOrbit = '45deg 55deg 105%';
});

// Reset Camera Button in Dock
document.getElementById('dock-reset-cam').addEventListener('click', () => {
  modelViewer.cameraOrbit = 'auto auto auto';
  modelViewer.fieldOfView = '45deg';
  slFov.value = 45;
  valFov.textContent = '45°';
});

// Auto-Rotate Button in Dock
const dockAutoRotate = document.getElementById('dock-auto-rotate');
dockAutoRotate.addEventListener('click', () => {
  const newState = !modelViewer.autoRotate;
  modelViewer.autoRotate = newState;
  dockAutoRotate.classList.toggle('active', newState);
});

// 4K High-Res Screenshot
document.getElementById('dock-screenshot').addEventListener('click', async () => {
  try {
    const dataUrl = modelViewer.toDataURL('image/png', 1.0);
    const link = document.createElement('a');
    link.download = `${badgeFilename.textContent || 'model'}_snapshot.png`;
    link.href = dataUrl;
    link.click();
  } catch (e) {
    console.error('Screenshot error:', e);
  }
});

// Animation Play/Pause
const animPlayBtn = document.getElementById('anim-play-btn');
let isPlaying = true;
animPlayBtn.addEventListener('click', () => {
  if (isPlaying) {
    modelViewer.pause();
    isPlaying = false;
    animPlayBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
  } else {
    modelViewer.play();
    isPlaying = true;
    animPlayBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
  }
});

document.getElementById('anim-select').addEventListener('change', (e) => {
  modelViewer.animationName = e.target.value;
  modelViewer.play();
  isPlaying = true;
  animPlayBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
});

// Inspector Toggle
const dockTogglePanel = document.getElementById('dock-toggle-panel');
dockTogglePanel.addEventListener('click', () => {
  inspectorPanel.classList.toggle('collapsed');
  dockTogglePanel.classList.toggle('active', !inspectorPanel.classList.contains('collapsed'));
});

// Inspector Tabs Switcher
document.querySelectorAll('.tab-btn').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    tab.classList.add('active');
    const targetId = `tab-${tab.dataset.tab}`;
    document.getElementById(targetId)?.classList.add('active');
  });
});

// ==========================================================================
// Window Controls & File Dialog
// ==========================================================================

document.getElementById('win-min').addEventListener('click', () => window.electronAPI?.minimizeWindow());
document.getElementById('win-max').addEventListener('click', () => window.electronAPI?.maximizeWindow());
document.getElementById('win-close').addEventListener('click', () => window.electronAPI?.closeWindow());

async function triggerOpenFile() {
  if (window.electronAPI) {
    const fp = await window.electronAPI.openFileDialog();
    if (fp) loadModelFromFile(fp);
  }
}

document.getElementById('btn-quick-open').addEventListener('click', triggerOpenFile);
document.getElementById('btn-browse-file').addEventListener('click', triggerOpenFile);

// ==========================================================================
// Drag & Drop
// ==========================================================================

window.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('drag-active');
});

window.addEventListener('dragleave', (e) => {
  if (e.relatedTarget === null) {
    dropzone.classList.remove('drag-active');
  }
});

window.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('drag-active');
  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    const file = e.dataTransfer.files[0];
    if (file.path) {
      loadModelFromFile(file.path);
    }
  }
});

// ==========================================================================
// Keyboard Shortcuts
// ==========================================================================

window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

  if (e.ctrlKey && e.key.toLowerCase() === 'o') {
    e.preventDefault();
    triggerOpenFile();
  } else if (e.key === ' ' || e.code === 'Space') {
    e.preventDefault();
    dockAutoRotate.click();
  } else if (e.key.toLowerCase() === 'r') {
    document.getElementById('dock-reset-cam').click();
  } else if (e.key === 'Tab') {
    e.preventDefault();
    dockTogglePanel.click();
  }
});

// ==========================================================================
// Electron IPC Loader (Double click / Open with)
// ==========================================================================

if (window.electronAPI) {
  window.electronAPI.onLoadModel((filePath) => {
    loadModelFromFile(filePath);
  });
}
