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
  const [overlayReady, setOverlayReady] = useState(false);
  const [landmarksReady, setLandmarksReady] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false); 

  const glassesProperties = {
  '/glasses1.obj': {
    scale: 0.8, 
    positionOffset: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    material: { color: 0x333333, metalness: 0.1, roughness: 0.4 },
  },
  '/glasses2.obj': {
    scale: 8, 
    positionOffset: { x: 0, y: -0.0125, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    material: { color: 0x333333, metalness: 0.1, roughness: 0.4 },
  },

  '/glasses4_new.obj': { 
    scale: 0.4,
    positionOffset: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    material: { color: 0x666666, metalness: 0.15, roughness: 0.35 },
  },
  '/glasses5.obj': { 
    scale: 0.25,
    positionOffset: { x: 0.007, y: 0.004, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    material: { color: 0x666666, metalness: 0.15, roughness: 0.35 },
  },
  '/glasses6.obj': {
    scale: 0.3, 
    positionOffset: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    material: { color: 0x333333, metalness: 0.1, roughness: 0.4 },
  },
  
};

  const { selectedImage, setSelectedImage } = useSelectedGlasses();
  const allOptions = [
    { label: 'Concept', value: '/glasses1.obj' },
    { label: 'Identity', value: '/glasses2.obj' },
    { label: 'PrimRose', value: '/glasses4_new.obj' },
    { label: 'Terminal', value: '/glasses5.obj' },
    { label: 'Roaring', value: '/glasses6.obj' }   
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
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        faceMesh.onResults((results) => {
          if (isMounted) {
            faceCache.current = results.multiFaceLandmarks?.map((landmarks) => ({ landmarks })) || [];
            if (results.multiFaceLandmarks?.length > 0) {
              setFaceDetected(true);
            } else {
              setFaceDetected(false);
            }
          }
        });

        faceMeshRef.current = faceMesh;

        // Preload FaceMesh by sending a dummy image
        const dummyCanvas = document.createElement('canvas');
        dummyCanvas.width = 1;
        dummyCanvas.height = 1;
        await faceMesh.send({ image: dummyCanvas });
        console.log('FaceMesh preloaded');

        setFaceMeshReady(true);

        // Setup Three.js Scene 
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

        // Setup Camera 
        const camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
        camera.position.set(0, 0, 2);
        camera.lookAt(0, 0, 0);
        threeCameraRef.current = camera;

        // Setup Renderer 
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

        // Lighting
        scene.add(new THREE.AmbientLight(0xffffff, 0.6));
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(0, 1, 1);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 1024;
        directionalLight.shadow.mapSize.height = 1024;
        scene.add(directionalLight);

        // Load Glasses Models 
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

          // Get properties for the model, with defaults if not specified
          const props = glassesProperties[path] || {
            scale: 0.01,
            positionOffset: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            material: { color: 0x333333, metalness: 0.1, roughness: 0.4 },
          };

          // Apply scale, position offset, and rotation
          obj.scale.setScalar(props.scale);
          obj.position.add(new THREE.Vector3(
            props.positionOffset.x,
            props.positionOffset.y,
            props.positionOffset.z
          ));
          obj.rotation.set(props.rotation.x, props.rotation.y, props.rotation.z);

          // Apply materials
          obj.traverse((child) => {
            if (child.isMesh) {
              child.material = new THREE.MeshStandardMaterial({
                color: props.material.color,
                metalness: props.material.metalness,
                roughness: props.material.roughness,
              });
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });

          obj.visible = false; // Hide by default
          cachedModels.current[path] = obj;
          scene.add(obj);
          resolve();
        } catch (err) {
          console.error(`Error processing model ${path}:`, err);
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
      setModeLoading(true);
      setOverlayReady(false); // Reset overlay readiness
      setFaceDetected(false); // Reset face detection
      console.log("Starting webcam...");

      if (!faceMeshRef.current) {
        throw new Error("FaceMesh not initialized yet.");
      }

      // Stop any existing streams to prevent conflicts
      stopWebcam();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
      });

      if (!videoRef.current || !threeCanvasRef.current || !canvasRef.current) {
        throw new Error("Required DOM elements are missing.");
      }

      videoRef.current.srcObject = stream;
      videoRef.current.style.visibility = 'hidden'; // Hide until ready
      threeCanvasRef.current.style.visibility = 'hidden';

      return new Promise((resolve, reject) => {
        videoRef.current.onloadedmetadata = () => {
          videoRef.current
            .play()
            .then(() => {
              // Ensure canvas and video are synchronized
              const bounds = videoRef.current.getBoundingClientRect();
              const videoWidth = videoRef.current.videoWidth || bounds.width;
              const videoHeight = videoRef.current.videoHeight || bounds.height;

              [canvasRef.current, threeCanvasRef.current].forEach((c) => {
                if (c) {
                  c.width = videoWidth;
                  c.height = videoHeight;
                  c.style.width = '100%';
                  c.style.height = '100%';
                  c.style.transform = 'scaleX(-1)'; // Mirror for selfie view
                }
              });

              videoRef.current.style.transform = 'scaleX(-1)';
              videoRef.current.style.visibility = 'visible';
              threeCanvasRef.current.style.visibility = 'visible';

              if (rendererRef.current && threeCameraRef.current) {
                rendererRef.current.setSize(videoWidth, videoHeight, false);
                const aspect = videoWidth / videoHeight;
                threeCameraRef.current.aspect = aspect;
                threeCameraRef.current.fov = 45;
                threeCameraRef.current.position.set(0, 0, 2);
                threeCameraRef.current.lookAt(0, 0, 0);
                threeCameraRef.current.updateProjectionMatrix();
              }

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
                setOverlayReady(true); // Mark overlay as ready
                resolve();
              } catch (err) {
                console.error("Camera setup failed:", err);
                reject(err);
              }
            })
            .catch(reject);
        };

        videoRef.current.onerror = () => {
          reject(new Error("Failed to load video stream."));
        };

        setTimeout(() => reject(new Error("Webcam load timeout")), 5000);
      });
    } catch (err) {
      console.error('Failed to start webcam:', err);
      setError('Failed to access webcam. Please check permissions and try again.');
      throw err;
    } finally {
      setModeLoading(false);
    }
  };

  // Stop webcam
  const stopWebcam = () => {
  console.log("Stopping webcam...");
  if (videoRef.current?.srcObject) {
    videoRef.current.srcObject.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch (e) {
        console.warn("Error stopping track:", e);
      }
    });
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
  faceCache.current = [];
  setOverlayReady(false);
  setFaceDetected(false);
  if (threeCanvasRef.current) {
    threeCanvasRef.current.style.visibility = 'hidden';
  }
};

  // Handle mode changes
  useEffect(() => {
    let isMounted = true;

    const switchMode = async () => {
      setModeLoading(true);
      faceCache.current = []; // Clear face cache
      setOverlayReady(false); // Reset overlay readiness
      setFaceDetected(false);

      if (useWebcam && faceMeshReady && modelsLoaded) {
        console.log("Switching to webcam mode...");
        try {
          await startWebcam();
        } catch (err) {
          if (isMounted) {
            setError('Failed to start webcam. Please check permissions and try again.');
          }
        }
      } else if (!useWebcam) {
        console.log("Switching to uploaded image mode...");
        stopWebcam();
        // Image processing will be handled by the animation loop and handleFile
      }

      if (isMounted) {
        setModeLoading(false);
      }
    };

    switchMode();

    return () => {
      isMounted = false;
      stopWebcam();
    };
  }, [useWebcam, faceMeshReady, modelsLoaded]);
  
  // handling file
  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log(`Uploading image: ${file.name}`);
    setModeLoading(true);
    setUseWebcam(false);
    setError(null);
    setFaceDetected(false);

    const reader = new FileReader();
    reader.onload = () => {
      setImageURL(reader.result);
      // Defer image processing to the animation loop
      setModeLoading(false);
    };
    reader.onerror = () => {
      setError('Failed to load image file.');
      setModeLoading(false);
    };
    reader.readAsDataURL(file);
  };

  // Process uploaded image (initial setup only)
  useEffect(() => {
    if (!useWebcam && imageURL && imageRef.current && threeCanvasRef.current && canvasRef.current && rendererRef.current && threeCameraRef.current) {
      const img = imageRef.current;

      const setupImage = () => {
        const { naturalWidth, naturalHeight } = img;
        if (naturalWidth === 0 || naturalHeight === 0) return;

        // Synchronize canvas sizes
        const bounds = img.getBoundingClientRect();
        const aspect = naturalWidth / naturalHeight;

        canvasRef.current.width = naturalWidth;
        canvasRef.current.height = naturalHeight;
        threeCanvasRef.current.width = bounds.width;
        threeCanvasRef.current.height = bounds.height;

        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';
        canvasRef.current.style.width = '100%';
        canvasRef.current.style.height = '100%';
        threeCanvasRef.current.style.width = '100%';
        threeCanvasRef.current.style.height = '100%';

        // Reset transforms for uploaded images
        img.style.transform = 'none';
        canvasRef.current.style.transform = 'none';
        threeCanvasRef.current.style.transform = 'none';

        // Update camera
        threeCameraRef.current.aspect = aspect;
        threeCameraRef.current.fov = 45;
        threeCameraRef.current.position.set(0, 0, 2);
        threeCameraRef.current.lookAt(0, 0, 0);
        threeCameraRef.current.updateProjectionMatrix();

        rendererRef.current.setSize(bounds.width, bounds.height, false);
        rendererRef.current.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      };

      if (img.complete && img.naturalWidth > 0) {
        setupImage();
      } else {
        img.onload = setupImage;
        img.onerror = () => {
          setError('Failed to load uploaded image.');
          setModeLoading(false);
        };
      }
    }
  }, [imageURL, useWebcam]);

  // Take snapshot
  const takeSnapshot = () => {
  const baseCanvas = canvasRef.current;
  const overlayCanvas = threeCanvasRef.current;
  if (!baseCanvas || !overlayCanvas) return;

  const width = Math.max(baseCanvas.width, overlayCanvas.width);
  const height = Math.max(baseCanvas.height, overlayCanvas.height);

  const compositeCanvas = document.createElement("canvas");
  compositeCanvas.width = width;
  compositeCanvas.height = height;
  const ctx = compositeCanvas.getContext("2d");

  if (useWebcam) {
    ctx.scale(-1, 1);
    ctx.translate(-width, 0);
  }

  ctx.drawImage(baseCanvas, 0, 0, width, height);
  ctx.drawImage(overlayCanvas, 0, 0, width, height);

  const screenshotData = compositeCanvas.toDataURL("image/png");
  const link = document.createElement("a");
  link.href = screenshotData;
  link.download = `tryon-snapshot-${Date.now()}.png`;
  link.click();
};

  // Main Animation Loop
  useEffect(() => {
    if (!faceMeshReady || modeLoading || !threeCanvasRef.current || !modelsLoaded || !canvasRef.current) return;

    const animationLoop = () => {
      // Draw base layer (video or image) onto canvasRef
      const ctx = canvasRef.current.getContext('2d');
      if (useWebcam && videoRef.current && videoRef.current.readyState >= 2) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
      } else if (!useWebcam && imageURL && imageRef.current && imageRef.current.complete) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        ctx.drawImage(imageRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
      }

      // Process face detection and render glasses
      if (useWebcam) {
        drawLoop3D();
      } else if (imageURL && faceMeshReady && faceMeshRef.current && imageRef.current) {
        faceMeshRef.current.send({ image: imageRef.current }).then(() => {
          drawLoop3D();
        }).catch((err) => {
          console.error("FaceMesh send error (image):", err);
        });
      }

      animationFrameId.current = requestAnimationFrame(animationLoop);
    };

    animationFrameId.current = requestAnimationFrame(animationLoop);

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }
    };
  }, [faceMeshReady, modeLoading, selectedImage, useWebcam, modelsLoaded, imageURL]);

  // Convert MediaPipe coordinates to Three.js world space
  const convertCoords = (landmark) => {
    if (!threeCameraRef.current) return new THREE.Vector3();
    
    // MediaPipe coordinates are normalized [0,1]
    // Convert to NDC [-1,1]
    const ndcX = (landmark.x - 0.5) * 2;
    const ndcY = (0.5 - landmark.y) * 2; // Flip Y
    const ndcZ = landmark.z * 0.8 ; // MediaPipe Z is typically small
    
    // Unproject from screen space to world space
    const vec = new THREE.Vector3(ndcX, ndcY, ndcZ);
    vec.unproject(threeCameraRef.current);
    
    return vec;
  };

  // Main render loop
  const drawLoop3D = () => {
    const modelKey = selectedImage || allOptions[0]?.value;
    const baseModel = cachedModels.current[modelKey];
    if (!baseModel || !sceneRef.current || !rendererRef.current || !threeCameraRef.current) {
      console.warn("Missing required references for rendering.");
      return;
    }

    const defaultProps = {
      scale: 0.01,
      positionOffset: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      material: { color: 0x333333, metalness: 0.1, roughness: 0.4 },
    };
    const props = { ...defaultProps, ...glassesProperties[modelKey] };

    // Clear existing glasses models from the scene
    sceneRef.current.children.forEach((child) => {
      if (child.userData.isGlassesModel) {
        sceneRef.current.remove(child);
        child.traverse((obj) => {
          if (obj.isMesh) {
            obj.geometry?.dispose();
            obj.material?.dispose();
          }
        });
      }
    });

    cleanupLandmarkSpheres();

    if (!overlayReady) {
      setOverlayReady(true);
      if (videoRef.current) videoRef.current.style.visibility = 'visible';
      if (threeCanvasRef.current) {
        threeCanvasRef.current.style.visibility = 'visible';
        console.log('Three.js canvas visibility set to visible');
      }
    }

    if (faceCache.current.length === 0) {
      rendererRef.current.render(sceneRef.current, threeCameraRef.current);
      return;
    }

    // Process each detected face
    faceCache.current.forEach((face, index) => {
      const landmarks = face.landmarks;
      if (landmarks.length === 0) return;

      // Clone the base model for this face
      const glassesModel = baseModel.clone();
      glassesModel.userData.isGlassesModel = true; // Mark for cleanup
      sceneRef.current.add(glassesModel);
      glassesModel.visible = true;

      // Convert landmark index → THREE.Vector3
      const getLM = (i) => {
        const lm = convertCoords(landmarks[i]);
        return new THREE.Vector3(lm.x, lm.y, lm.z);
      };

      // Key points
      const leftPos = getLM(133);
      const rightPos = getLM(362);
      const nose = getLM(197);
      const leftOuter = getLM(33);
      const rightOuter = getLM(263);
      const foreheadCenter = getLM(10);
      const chinTip = getLM(175);
      const leftEar = getLM(234);
      const rightEar = getLM(454);

      // Eye → ear length for temple scaling
      const templeLength = (leftEar.distanceTo(leftOuter) + rightEar.distanceTo(rightOuter)) / 2;

      // Eye center for positioning
      const eyeCenter = new THREE.Vector3()
        .addVectors(leftPos, rightPos)
        .multiplyScalar(0.5)
        .add(new THREE.Vector3(0, (nose.y - (leftPos.y + rightPos.y) / 2) * 0.5, 0));
      glassesModel.position.copy(eyeCenter);

      // Offset
      const offset = new THREE.Vector3(
        props.positionOffset.x,
        props.positionOffset.y,
        props.positionOffset.z
      );
      offset.applyQuaternion(glassesModel.quaternion);
      glassesModel.position.add(offset);

      // Base scaling for whole model
      const eyeDist = leftPos.distanceTo(rightPos);
      const baseEyeDistance = 0.3 * (canvasRef.current.width / 1280);
      const dynamicScale = eyeDist / baseEyeDistance;
      const finalScale = dynamicScale * props.scale;
      glassesModel.scale.set(finalScale, finalScale, finalScale);

      // Rotation
      const right = new THREE.Vector3().subVectors(rightOuter, leftOuter).normalize();
      const up = new THREE.Vector3().subVectors(foreheadCenter, chinTip).normalize();
      const forward = new THREE.Vector3().crossVectors(right, up).normalize();
      right.crossVectors(up, forward).normalize();
      const rotationMatrix = new THREE.Matrix4().makeBasis(right, up, forward);
      glassesModel.setRotationFromMatrix(rotationMatrix);

      // Per-model rotation offset
      const eulerOffset = new THREE.Euler(props.rotation.x, props.rotation.y, props.rotation.z, 'XYZ');
      const quatOffset = new THREE.Quaternion().setFromEuler(eulerOffset);
      glassesModel.quaternion.multiply(quatOffset);

      // Check if model has separate parts 
      let hasSeparateParts = false;
      glassesModel.traverse((child) => {
        if (child.isMesh) {
          const name = child.name.toLowerCase();
          if (name === 'temple' || name === 'frame') {
            hasSeparateParts = true;
          }
        }
      });

      // Apply scaling and materials for separate parts
      if (hasSeparateParts) {
        glassesModel.traverse((child) => {
          if (!child.isMesh) return;
          const name = child.name.toLowerCase();

          if (name === 'temple') {
            const refLen = 0.1;
            const scaleFactor = templeLength / refLen;
            child.scale.set(1, 1, scaleFactor);
            console.log(`Scaled temple by factor ${scaleFactor} for face ${index}`);
          }

          if (name === 'frame') {
            child.material = new THREE.MeshStandardMaterial({
              color: props.material.color,
              metalness: props.material.metalness,
              roughness: props.material.roughness,
            });
          }
        });
      }

      // Apply material to whole model if no separate parts
      if (!hasSeparateParts) {
        glassesModel.traverse((child) => {
          if (child.isMesh) {
            child.material = new THREE.MeshStandardMaterial({
              color: props.material.color,
              metalness: props.material.metalness,
              roughness: props.material.roughness,
            });
          }
        });
      }

      // Debugging landmarks
      const showLandmarks = false;
      if (showLandmarks) {
        const sphereGeometry = new THREE.SphereGeometry(0.002, 8, 8);
        const keyLandmarks = [133, 362, 197, 175, 33, 263, 234, 454];
        keyLandmarks.forEach((lmIndex, i) => {
          const pos = getLM(lmIndex);
          const sphereMaterial = new THREE.MeshBasicMaterial({
            color: new THREE.Color().setHSL(i / keyLandmarks.length, 1.0, 0.5),
          });
          const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
          sphere.position.copy(pos);
          sceneRef.current.add(sphere);
          landmarkSpheresRef.current.push(sphere);
        });
      }
    });

    // Camera setup
    threeCameraRef.current.position.set(0, 0, 2);
    threeCameraRef.current.lookAt(0, 0, 0);
    threeCameraRef.current.updateProjectionMatrix();

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

          {!modeLoading && overlayReady && !faceDetected && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70 z-40">
              <div className="text-center">
                <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-gray-700">Detecting the landmarks...</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}