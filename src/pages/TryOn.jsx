import React, { useRef, useState, useEffect } from 'react';
import { useSelectedGlasses } from '../context/SelectedGlassesContext';
import * as mpFaceMesh from '@mediapipe/face_mesh';
import * as mpCameraUtils from '@mediapipe/camera_utils';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';

export default function TryOn() {
  const videoRef = useRef(null);
  const imageRef = useRef(null);
  const canvasRef = useRef(null);
  const threeCanvasRef = useRef(null);

  const faceMeshRef = useRef(null);
  const cameraRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const threeCameraRef = useRef(null);

  const cachedModels = useRef({});
  const faceCache = useRef([]);
  const animationFrameId = useRef(null);
  const landmarkSpheresRef = useRef([]);

  const [imageURL, setImageURL] = useState(null);
  const [useWebcam, setUseWebcam] = useState(true);
  const [modeLoading, setModeLoading] = useState(false);
  const [faceMeshReady, setFaceMeshReady] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [error, setError] = useState(null);

  const { selectedImage, setSelectedImage } = useSelectedGlasses();
  const allOptions = [
    { label: 'Glasses 1', value: '/oculos.obj' },
    { label: 'Glasses 2', value: '/glasses2.obj' },
    { label: 'Glasses 3', value: '/glasses3.obj' }
  ];

  // Initialization: FaceMesh, Scene, Camera, Renderer, Lighting, Models
  useEffect(() => {
    let isMounted = true;
    
    const init = async () => {
      try {
        setError(null);
        
        if (!threeCanvasRef.current) return;

        // === Setup FaceMesh ===
        const faceMesh = new mpFaceMesh.FaceMesh({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
        });

        faceMesh.setOptions({
          maxNumFaces: 2,
          refineLandmarks: true,
          minDetectionConfidence: 0.7,
          minTrackingConfidence: 0.7,
        });

        faceMesh.onResults((results) => {
          if (isMounted) {
            faceCache.current = results.multiFaceLandmarks?.map((landmarks) => ({ landmarks })) || [];
          }
        });

        faceMeshRef.current = faceMesh;
        setFaceMeshReady(true);

        // === Setup Three.js Scene ===
        const scene = new THREE.Scene();
        sceneRef.current = scene;

        const canvas = threeCanvasRef.current;
        const video = videoRef.current;

        // Wait for layout
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const bounds = video?.getBoundingClientRect() || canvas.getBoundingClientRect();
        const canvasWidth = bounds.width;
        const canvasHeight = bounds.height;
        const aspect = canvasWidth / canvasHeight;

        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        // === Setup Camera ===
        const camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
        camera.position.set(0, 0, 2);
        camera.lookAt(0, 0, 0);
        threeCameraRef.current = camera;

        // === Setup Renderer ===
        const renderer = new THREE.WebGLRenderer({
          canvas,
          alpha: true,
          antialias: true,
          preserveDrawingBuffer: true,
        });
        renderer.setSize(canvasWidth, canvasHeight, false);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setClearColor(0x000000, 0);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        rendererRef.current = renderer;

        // === Lighting ===
        scene.add(new THREE.AmbientLight(0xffffff, 0.6));
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(0, 1, 1);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 1024;
        directionalLight.shadow.mapSize.height = 1024;
        scene.add(directionalLight);

        // === Load Glasses Models ===
        const loader = new OBJLoader();

        const loadModel = (path) =>
          new Promise((resolve, reject) => {
            loader.load(
              path,
              (obj) => {
                try {
                  // Center the model
                  const box = new THREE.Box3().setFromObject(obj);
                  const center = box.getCenter(new THREE.Vector3());
                  obj.position.sub(center);
                  obj.position.y += box.getSize(new THREE.Vector3()).y * 0.5;
                  obj.visible = false;

                  // Apply materials
                  obj.traverse((child) => {
                    if (child.isMesh) {
                      if (!child.material) {
                        child.material = new THREE.MeshStandardMaterial({
                          color: 0x333333,
                          metalness: 0.1,
                          roughness: 0.4,
                        });
                      }
                      child.castShadow = true;
                      child.receiveShadow = true;
                    }
                  });

                  cachedModels.current[path] = obj;
                  scene.add(obj);
                  resolve();
                } catch (err) {
                  reject(err);
                }
              },
              (progress) => {
                console.log(`Loading ${path}: ${(progress.loaded / progress.total * 100)}%`);
              },
              (error) => {
                console.error(`Failed to load model ${path}:`, error);
                reject(error);
              }
            );
          });

        // Load all models
        try {
          await Promise.all(allOptions.map((opt) => loadModel(opt.value)));
          if (isMounted) {
            setSelectedImage(allOptions[0].value);
            setModelsLoaded(true);
            console.log("All models loaded successfully");
          }
        } catch (e) {
          console.error("Error loading models:", e);
          if (isMounted) {
            setError("Failed to load glasses models. Please check model files.");
            setModeLoading(false);
          }
        }

      } catch (err) {
        console.error("Initialization failed:", err);
        if (isMounted) {
          setError("Failed to initialize. Please refresh the page.");
          setModeLoading(false);
        }
      }
    };

    const timer = setTimeout(init, 100);
    return () => {
      isMounted = false;
      clearTimeout(timer);
      cleanup();
    };
  }, []);

  // Cleanup function
  const cleanup = () => {
    // Cancel animation frame
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }

    // Stop webcam
    stopWebcam();

    // Close MediaPipe
    if (faceMeshRef.current) {
      try {
        faceMeshRef.current.close();
      } catch (e) {
        console.warn("Error closing FaceMesh:", e);
      }
      faceMeshRef.current = null;
    }

    // Cleanup landmark spheres
    cleanupLandmarkSpheres();

    // Cleanup Three.js
    if (rendererRef.current) {
      try {
        rendererRef.current.dispose();
        rendererRef.current.forceContextLoss?.();
      } catch (e) {
        console.warn("Error disposing renderer:", e);
      }
      rendererRef.current = null;
    }

    if (sceneRef.current) {
      sceneRef.current.traverse((obj) => {
        if (obj.isMesh) {
          obj.geometry?.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach(m => m.dispose());
          } else {
            obj.material?.dispose();
          }
        }
      });
      sceneRef.current.clear();
      sceneRef.current = null;
    }

    threeCameraRef.current = null;
  };

  // Cleanup landmark spheres
  const cleanupLandmarkSpheres = () => {
    if (sceneRef.current && landmarkSpheresRef.current.length > 0) {
      landmarkSpheresRef.current.forEach((sphere) => {
        sceneRef.current.remove(sphere);
        sphere.geometry?.dispose();
        sphere.material?.dispose();
      });
      landmarkSpheresRef.current = [];
    }
  };

  // Resize handler
  useEffect(() => {
    const handleResize = () => {
      const container = threeCanvasRef.current?.parentElement;
      if (!container || !videoRef.current || !canvasRef.current || 
          !threeCanvasRef.current || !rendererRef.current || !threeCameraRef.current) {
        return;
      }

      const width = container.clientWidth;
      const height = container.clientHeight;
      const aspect = width / height;

      // Resize video & canvases
      [videoRef.current, canvasRef.current, threeCanvasRef.current].forEach((el) => {
        el.style.width = '100%';
        el.style.height = '100%';
      });

      [canvasRef.current, threeCanvasRef.current].forEach((c) => {
        c.width = width;
        c.height = height;
      });

      rendererRef.current.setSize(width, height, false);
      rendererRef.current.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      threeCameraRef.current.aspect = aspect;
      threeCameraRef.current.updateProjectionMatrix();
    };

    const resizeObserver = new ResizeObserver(handleResize);
    if (threeCanvasRef.current?.parentElement) {
      resizeObserver.observe(threeCanvasRef.current.parentElement);
    }

    handleResize();
    return () => resizeObserver.disconnect();
  }, []);

  // Start webcam
  const startWebcam = async () => {
    try {
      setError(null);
      console.log("Starting webcam...");

      if (!faceMeshRef.current) {
        throw new Error("FaceMesh not initialized yet.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        } 
      });
      
      if (!videoRef.current) return;

      videoRef.current.srcObject = stream;

      return new Promise((resolve, reject) => {
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play()
            .then(() => {
              requestAnimationFrame(() => {
                const bounds = videoRef.current.getBoundingClientRect();
                const videoWidth = videoRef.current.videoWidth || bounds.width;
                const videoHeight = videoRef.current.videoHeight || bounds.height;

                // Update canvas sizes
                [canvasRef.current, threeCanvasRef.current].forEach((c) => {
                  if (c) {
                    c.width = videoWidth;
                    c.height = videoHeight;
                    c.style.width = '100%';
                    c.style.height = '100%';
                  }
                });

                if (rendererRef.current && threeCameraRef.current) {
                  rendererRef.current.setSize(videoWidth, videoHeight, false);
                  
                  // Update camera
                  const aspect = videoWidth / videoHeight;
                  threeCameraRef.current.aspect = aspect;
                  threeCameraRef.current.fov = 45;
                  threeCameraRef.current.position.set(0, 0, 2);
                  threeCameraRef.current.lookAt(0, 0, 0);
                  threeCameraRef.current.updateProjectionMatrix();
                }

                // Mirror for selfie view
                videoRef.current.style.transform = "scaleX(-1)";
                threeCanvasRef.current.style.transform = "scaleX(-1)";
                canvasRef.current.style.transform = "scaleX(-1)";

                // Start MediaPipe camera
                try {
                  cameraRef.current = new mpCameraUtils.Camera(videoRef.current, {
                    onFrame: async () => {
                      try {
                        if (faceMeshRef.current && videoRef.current.readyState >= 2) {
                          await faceMeshRef.current.send({ image: videoRef.current });
                        }
                      } catch (err) {
                        console.error("FaceMesh send error:", err);
                      }
                    },
                    width: videoWidth,
                    height: videoHeight,
                  });

                  cameraRef.current.start();
                  resolve();
                } catch (err) {
                  console.error("Camera setup failed:", err);
                  reject(err);
                }
              });
            })
            .catch(reject);
        };
        
        videoRef.current.onerror = reject;
        
        // Timeout fallback
        setTimeout(() => reject(new Error("Video load timeout")), 10000);
      });
    } catch (err) {
      console.error('Failed to start webcam:', err);
      setError('Failed to access webcam. Please check permissions and try again.');
      throw err;
    }
  };

  // Stop webcam
  const stopWebcam = () => {
    console.log("Stopping webcam...");
    
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }

    if (cameraRef.current) {
      try {
        cameraRef.current.stop();
      } catch (e) {
        console.warn("Error stopping camera:", e);
      }
      cameraRef.current = null;
    }
  };

  // Handle mode changes
  useEffect(() => {
    if (useWebcam && faceMeshReady && modelsLoaded) {
      setModeLoading(true);
      setImageURL(null);
      startWebcam()
        .then(() => setModeLoading(false))
        .catch(() => setModeLoading(false));
    } else if (!useWebcam) {
      console.log("Switching to uploaded image mode...");
      stopWebcam();
    }
  }, [useWebcam, faceMeshReady, modelsLoaded]);

  // Handle file upload
  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log(`Uploading image: ${file.name}`);
    const reader = new FileReader();
    reader.onload = () => {
      setUseWebcam(false);
      setModeLoading(true);
      setImageURL(reader.result);
      setError(null);
    };
    reader.onerror = () => {
      setError('Failed to load image file.');
    };
    reader.readAsDataURL(file);
  };

  // Process uploaded image
  useEffect(() => {
    if (!useWebcam && imageURL) {
      console.log("Processing uploaded image...");
      const img = imageRef.current;
      
      const processImage = async () => {
        if (!img || !rendererRef.current || !threeCameraRef.current) return;

        const { naturalWidth, naturalHeight } = img;
        
        // Update canvas sizes
        if (canvasRef.current) {
          canvasRef.current.width = naturalWidth;
          canvasRef.current.height = naturalHeight;
        }
        
        if (threeCanvasRef.current) {
          const bounds = img.getBoundingClientRect();
          threeCanvasRef.current.width = bounds.width;
          threeCanvasRef.current.height = bounds.height;
          rendererRef.current.setSize(bounds.width, bounds.height, false);
        }
        
        // Update camera
        const aspect = naturalWidth / naturalHeight;
        threeCameraRef.current.aspect = aspect;
        threeCameraRef.current.fov = 45;
        threeCameraRef.current.position.set(0, 0, 2);
        threeCameraRef.current.lookAt(0, 0, 0);
        threeCameraRef.current.updateProjectionMatrix();

        // Reset transforms for uploaded images
        img.style.transform = "none";
        threeCanvasRef.current.style.transform = "none";
        canvasRef.current.style.transform = "none";

        // Process with MediaPipe
        if (faceMeshReady && faceMeshRef.current) {
          try {
            await faceMeshRef.current.send({ image: img });
          } catch (err) {
            console.error("FaceMesh send error (image):", err);
          }
        }
        
        setModeLoading(false);
      };

      if (img?.complete && img.naturalWidth > 0) {
        processImage();
      } else if (img) {
        img.onload = processImage;
        img.onerror = () => {
          setError('Failed to load uploaded image.');
          setModeLoading(false);
        };
      }
    }
  }, [useWebcam, imageURL, faceMeshReady]);

  // Take snapshot
  const takeSnapshot = () => {
    if (!canvasRef.current || !threeCanvasRef.current) return;
    
    try {
      const c = canvasRef.current;
      const t = threeCanvasRef.current;
      const snapshot = document.createElement('canvas');
      snapshot.width = c.width;
      snapshot.height = c.height;
      
      const ctx = snapshot.getContext('2d');
      
      // Draw background (video or image)
      if (useWebcam && videoRef.current) {
        if (useWebcam) {
          ctx.translate(snapshot.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(videoRef.current, 0, 0, snapshot.width, snapshot.height);
        ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
      } else if (!useWebcam && imageRef.current) {
        ctx.drawImage(imageRef.current, 0, 0, snapshot.width, snapshot.height);
      }
      
      // Draw Three.js overlay
      ctx.drawImage(t, 0, 0);
      
      // Download
      const link = document.createElement('a');
      link.download = `glasses-tryon-${Date.now()}.png`;
      link.href = snapshot.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Failed to take snapshot:', err);
      setError('Failed to save snapshot.');
    }
  };

  // Main Animation Loop
  useEffect(() => {
    if (!faceMeshReady || modeLoading || !threeCanvasRef.current || !modelsLoaded) return;

    const animationLoop = () => {
      drawLoop3D();
      animationFrameId.current = requestAnimationFrame(animationLoop);
    };

    animationFrameId.current = requestAnimationFrame(animationLoop);

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [faceMeshReady, modeLoading, selectedImage, useWebcam, modelsLoaded]);

  // Convert MediaPipe coordinates to Three.js world space
  const convertCoords = (landmark) => {
    if (!threeCameraRef.current) return new THREE.Vector3();
    
    // MediaPipe coordinates are normalized [0,1]
    // Convert to NDC [-1,1]
    const ndcX = (landmark.x - 0.5) * 2;
    const ndcY = (0.5 - landmark.y) * 2; // Flip Y
    const ndcZ = 0.0; // MediaPipe Z is typically small
    
    // Unproject from screen space to world space
    const vec = new THREE.Vector3(ndcX, ndcY, ndcZ);
    vec.unproject(threeCameraRef.current);
    
    return vec;
  };

  // Main render loop
  const drawLoop3D = () => {
    const modelKey = selectedImage || allOptions[0]?.value;
    const glassesModel = cachedModels.current[modelKey];
    const landmarks = faceCache.current[0]?.landmarks || [];

    if (!glassesModel || !sceneRef.current || !rendererRef.current || !threeCameraRef.current) {
      return;
    }

    // Hide all models first
    Object.values(cachedModels.current).forEach(model => {
      if (model) model.visible = false;
    });

    // Clean up previous landmark spheres
    cleanupLandmarkSpheres();

    if (landmarks.length === 0) {
      // No face detected, just render empty scene
      rendererRef.current.render(sceneRef.current, threeCameraRef.current);
      return;
    }

    // Show selected glasses
    glassesModel.visible = true;

    // Key facial landmarks
    const get = (i) => landmarks[i];
    const leftPos = convertCoords(get(133));   // Left eye inner corner
    const rightPos = convertCoords(get(362));  // Right eye inner corner
    const nose = convertCoords(get(197));     // Nose tip
    const chinPos = convertCoords(get(175));      // Chin
    const leftOuter = convertCoords(get(33));  // Left eye outer corner
    const rightOuter = convertCoords(get(263)); // Right eye outer corner
    const foreheadCenter = convertCoords(get(10));    // Forehead center
    const chinTip = convertCoords(get(175));          // Chin tip



    // Calculate glasses position (between eyes, slightly above)
    const eyeCenter = {
      x: (leftPos.x + rightPos.x) / 2,
      y: ((leftPos.y + rightPos.y) / 2 + nose.y) / 2,
      z: (leftPos.z + rightPos.z) / 2,
    };

    const glassesOffset = 0.0005; // Increase or tweak this
glassesModel.position.set(
  eyeCenter.x,
  eyeCenter.y,
  eyeCenter.z + glassesOffset // push outward
);

    // Calculate scale based on eye distance
    const eyeDist = Math.hypot(rightPos.x - leftPos.x, rightPos.y - leftPos.y);
    const baseEyeDistance = 0.3;
    const scale = (eyeDist / baseEyeDistance) * 0.8;
    glassesModel.scale.set(scale, scale, scale);

    // Calculate rotation
    // Right: eye-to-eye vector
    const right = new THREE.Vector3().subVectors(rightOuter, leftOuter).normalize();

    // Up: forehead to chin
    const up = new THREE.Vector3().subVectors(foreheadCenter, chinTip).normalize();

    // Forward: orthogonal to right and up
    const forward = new THREE.Vector3().crossVectors(right, up).normalize();

    // Re-orthogonalize up vector to remove drift (in case of numerical instability)
    up.crossVectors(forward, right).normalize();

    // Construct rotation matrix from orthogonal basis
    const rotationMatrix = new THREE.Matrix4().makeBasis(right, up, forward);
    glassesModel.setRotationFromMatrix(rotationMatrix);


    // Optional: Add landmark visualization for debugging
    // if (process.env.NODE_ENV === 'development') {
    //   const sphereGeometry = new THREE.SphereGeometry(0.002, 8, 8);
      
    //   // Show key landmarks
    //   const keyLandmarks = [133, 362, 4, 175, 33, 263];
    //   keyLandmarks.forEach((index, i) => {
    //     const pos = convertCoords(get(index));
    //     const sphereMaterial = new THREE.MeshBasicMaterial({ 
    //       color: new THREE.Color().setHSL(i / keyLandmarks.length, 1.0, 0.5) 
    //     });
    //     const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    //     sphere.position.copy(pos);
    //     sceneRef.current.add(sphere);
    //     landmarkSpheresRef.current.push(sphere);
    //   });
    // }

    // Render the scene
    rendererRef.current.render(sceneRef.current, threeCameraRef.current);
  };

  // JSX 
  return (
    <div className="relative min-h-screen overflow-hidden">
      <img
        src="/background.png"
        alt="Background"
        className="absolute inset-0 w-full h-full object-cover -z-20"
        onError={(e) => {
          e.target.style.display = 'none';
        }}
      />
      <div className="absolute inset-0 bg-white/60 backdrop-blur-md -z-10" />

      <div className="relative z-10 flex flex-col items-center py-10 px-4">
        <h1 className="text-3xl font-bold text-blue-700 mb-6">TryRoom for EyeGlasses</h1>

        {error && (
          <div className="max-w-2xl mx-auto mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 text-center">{error}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 mx-auto block"
            >
              Refresh Page
            </button>
          </div>
        )}

        <div className="flex flex-wrap gap-4 justify-center mb-6">
          <button
            onClick={() => setUseWebcam(true)}
            disabled={modeLoading}
            className={`px-5 py-2 rounded-lg text-white shadow transition-colors ${
              useWebcam ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'
            } ${modeLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            aria-label="Use webcam for try-on"
          >
            Use Webcam
          </button>
          <label
            className={`cursor-pointer bg-white border px-5 py-2 rounded-lg shadow transition-colors hover:bg-gray-50 ${
              modeLoading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            aria-label="Upload an image for try-on"
          >
            Upload Image
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleFile} 
              className="hidden"
              disabled={modeLoading}
            />
          </label>
          <button
            onClick={takeSnapshot}
            disabled={modeLoading || (!useWebcam && !imageURL)}
            className={`bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg shadow transition-colors ${
              modeLoading || (!useWebcam && !imageURL) ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            aria-label="Save snapshot of try-on"
          >
            Save Snapshot
          </button>
        </div>

        <div className="flex flex-wrap justify-center gap-6 mb-6">
          <div className="text-center">
            <label htmlFor="glasses-select" className="block mb-1 font-medium">
              Select Glasses:
            </label>
            <select
              id="glasses-select"
              value={selectedImage}
              onChange={(e) => setSelectedImage(e.target.value)}
              disabled={modeLoading}
              className={`px-4 py-2 border rounded-md shadow focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                modeLoading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              aria-label="Select glasses model"
            >
              {allOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="relative w-full max-w-3xl aspect-video border rounded-xl overflow-hidden bg-white shadow">
          {useWebcam ? (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="absolute top-0 left-0 w-full h-full object-cover"
            />
          ) : imageURL ? (
            <img
              ref={imageRef}
              src={imageURL}
              alt="Uploaded try-on image"
              className="absolute top-0 left-0 w-full h-full object-contain bg-gray-100"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
              <div className="text-center text-gray-500">
                <div className="text-6xl mb-4">👤</div>
                <p>Select camera or upload a photo to start trying on glasses</p>
              </div>
            </div>
          )}

          <canvas
            ref={canvasRef}
            className="absolute top-0 left-0 w-full h-full pointer-events-none z-10"
          />

          <canvas
            ref={threeCanvasRef}
            className="absolute top-0 left-0 w-full h-full pointer-events-none z-20"
          />

          {modeLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70 z-40">
              <div className="text-center">
                <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-gray-700">
                  {!faceMeshReady ? 'Loading face detection...' : 
                   !modelsLoaded ? 'Loading glasses models...' : 
                   'Starting camera...'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}