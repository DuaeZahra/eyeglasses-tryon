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
  const [faceDetected, setFaceDetected] = useState(false);

  const glassesProperties = {
    '/glasses1.obj': {
      scale: 0.9,
      positionOffset: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      material: { color: 0x333333, metalness: 0.1, roughness: 0.4 },
    },
    '/glasses2.obj': {
      scale: 8.5,
      positionOffset: { x:0, y: -0.0125, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      material: { color: 0x333333, metalness: 0.1, roughness: 0.4 },
    },
    '/glasses3_new2.obj': {
      scale: 0.5,
      positionOffset: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      material: { color: 0x666666, metalness: 0.15, roughness: 0.35 },
    },
    '/glasses4.obj': {
      scale: 0.25,
      positionOffset: { x: 0.005, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      material: { color: 0x666666, metalness: 0.15, roughness: 0.35 },
    },
    '/glasses5.obj': {
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
    { label: 'PrimRose', value: '/glasses3_new2.obj' },
    { label: 'Terminal', value: '/glasses4.obj' },
    { label: 'Roaring', value: '/glasses5.obj' },
  ];

  // Initialisation
  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        setError(null);

        if (!threeCanvasRef.current) return;

        // Setup FaceMesh
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
            setFaceDetected(results.multiFaceLandmarks?.length > 0);
          }
        });

        faceMeshRef.current = faceMesh;

        // Preload FaceMesh
        const dummyCanvas = document.createElement('canvas');
        dummyCanvas.width = 1;
        dummyCanvas.height = 1;
        await faceMesh.send({ image: dummyCanvas });
        console.log('FaceMesh preloaded');
        setFaceMeshReady(true);

        // Setup Three.js
        const scene = new THREE.Scene();
        sceneRef.current = scene;

        const canvas = threeCanvasRef.current;
        const video = videoRef.current;

        // layout
        await new Promise((resolve) => setTimeout(resolve, 100));

        const bounds = video?.getBoundingClientRect() || canvas.getBoundingClientRect();
        const canvasWidth = bounds.width;
        const canvasHeight = bounds.height;
        const aspect = canvasWidth / canvasHeight;

        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        // Setup Camera
        const fov = 45;
        const camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 1000);
        const z = canvasHeight / (2 * Math.tan((fov * Math.PI) / 360));
        camera.position.set(0, 0, z);
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
        directionalLight.shadow.mapSize.set(1024, 1024);
        scene.add(directionalLight);

        // Load Glasses Models
        const loader = new OBJLoader();

        const loadModel = (path) =>
          new Promise((resolve, reject) => {
            loader.load(
              path,
              (obj) => {
                try {
                  const box = new THREE.Box3().setFromObject(obj);
                  const center = box.getCenter(new THREE.Vector3());
                  obj.position.sub(center);
                  obj.position.y += box.getSize(new THREE.Vector3()).y * 0.5;

                  const props = glassesProperties[path] || {
                    scale: 0.01,
                    positionOffset: { x: 0, y: 0, z: 0 },
                    rotation: { x: 0, y: 0, z: 0 },
                    material: { color: 0x333333, metalness: 0.1, roughness: 0.4 },
                  };

                  obj.scale.setScalar(props.scale);
                  obj.position.add(new THREE.Vector3(
                    props.positionOffset.x,
                    props.positionOffset.y,
                    props.positionOffset.z
                  ));
                  obj.rotation.set(props.rotation.x, props.rotation.y, props.rotation.z);

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

                  obj.visible = false;
                  cachedModels.current[path] = obj;
                  scene.add(obj);
                  resolve();
                } catch (err) {
                  console.error(`Error processing model ${path}:`, err);
                  reject(err);
                }
              },
              undefined,
              (error) => {
                console.error(`Failed to load model ${path}:`, error);
                reject(error);
              }
            );
          });

        await Promise.all(allOptions.map((opt) => loadModel(opt.value)));
        if (isMounted) {
          if (!allOptions.some((opt) => opt.value === selectedImage)) {
            console.log(`Invalid or no selectedImage (${selectedImage}), defaulting to /glasses1.obj`);
            setSelectedImage('/glasses1.obj');
          }
          setModelsLoaded(true);
          console.log('All models loaded successfully');
        }
      } catch (err) {
        console.error('Initialization failed:', err);
        if (isMounted) {
          setError('Failed to initialize. Please refresh the page.');
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
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }

    stopWebcam();

    if (faceMeshRef.current) {
      try {
        faceMeshRef.current.close();
      } catch (e) {
        console.warn("Error closing FaceMesh:", e);
      }
      faceMeshRef.current = null;
    }

    cleanupLandmarkSpheres();

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
    setOverlayReady(false);
    setFaceDetected(false);

    if (!faceMeshRef.current) {
      throw new Error("FaceMesh not initialized yet.");
    }

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
    videoRef.current.style.visibility = 'hidden';
    threeCanvasRef.current.style.visibility = 'hidden';

    return new Promise((resolve, reject) => {
      videoRef.current.onloadedmetadata = () => {
        videoRef.current
          .play()
          .then(() => {
            const bounds = videoRef.current.getBoundingClientRect();
            const videoWidth = videoRef.current.videoWidth || bounds.width;
            const videoHeight = videoRef.current.videoHeight || bounds.height;

            [canvasRef.current, threeCanvasRef.current].forEach((c) => {
              if (c) {
                c.width = videoWidth;
                c.height = videoHeight;
                c.style.width = '100%';
                c.style.height = '100%';
                c.style.transform = 'scaleX(-1)';
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

            try {
              cameraRef.current = new mpCameraUtils.Camera(videoRef.current, {
                onFrame: async () => {
                  try {
                    if (faceMeshRef.current && videoRef.current.readyState >= 2) {
                      await faceMeshRef.current.send({ image: videoRef.current });
                    }
                  } catch {
                    /* Ignore FaceMesh frame errors */
                  }
                },
                width: videoWidth,
                height: videoHeight,
              });

              cameraRef.current.start();
              setOverlayReady(true);
              resolve();
            } catch (err) {
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
  
  // Mode Switching 
  useEffect(() => {
    let isMounted = true;

    const switchMode = async () => {
      setModeLoading(true);
      faceCache.current = [];
      setOverlayReady(false);
      setFaceDetected(false);

      if (useWebcam) {
        if (!faceMeshReady || !modelsLoaded) {
          return; // Skip until models are ready
        }
        try {
          await startWebcam();
        } catch (err) {
          if (isMounted) setError('Failed to start webcam. Please check permissions and try again.');
        }
      } else {
        stopWebcam();
      }

      if (isMounted) setModeLoading(false);
    };

    switchMode();
    return () => {
      isMounted = false;
      stopWebcam();
    };
  }, [useWebcam, faceMeshReady, modelsLoaded]);

  // Handle File Upload 
  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setModeLoading(true);
    setUseWebcam(false);
    setError(null);
    setFaceDetected(false);

    const reader = new FileReader();
    reader.onload = () => {
      setImageURL(reader.result);
      setModeLoading(false);
    };
    reader.onerror = () => {
      setError('Failed to load image file.');
      setModeLoading(false);
    };
    reader.readAsDataURL(file);
  };

  // Process Uploaded Image
  useEffect(() => {
    if (!useWebcam && imageURL && imageRef.current && threeCanvasRef.current && canvasRef.current && rendererRef.current && threeCameraRef.current) {
      const img = imageRef.current;

      const setupImage = () => {
        const { naturalWidth, naturalHeight } = img;
        if (naturalWidth === 0 || naturalHeight === 0) return;

        // Use natural size consistently
        canvasRef.current.width = naturalWidth;
        canvasRef.current.height = naturalHeight;
        threeCanvasRef.current.width = naturalWidth;
        threeCanvasRef.current.height = naturalHeight;

        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';
        canvasRef.current.style.width = '100%';
        canvasRef.current.style.height = '100%';
        threeCanvasRef.current.style.width = '100%';
        threeCanvasRef.current.style.height = '100%';

        // Camera adjustment
        const aspect = naturalWidth / naturalHeight;
        const fov = 45;
        const z = naturalHeight / (2 * Math.tan((fov * Math.PI) / 360));

        threeCameraRef.current.aspect = aspect;
        threeCameraRef.current.fov = fov;
        threeCameraRef.current.position.set(0, 0, z);
        threeCameraRef.current.lookAt(0, 0, 0);
        threeCameraRef.current.updateProjectionMatrix();

        rendererRef.current.setSize(naturalWidth, naturalHeight, false);
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
    if (!baseCanvas || !overlayCanvas) {
      console.warn("Missing canvas references.");
      return;
    }

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
    link.download = `tryon-snapshot.png`;
    link.click();
  };

  // Animation Loop
  useEffect(() => {
    if (!faceMeshReady || modeLoading || !threeCanvasRef.current || !modelsLoaded || !canvasRef.current) return;

    const animationLoop = () => {
      const ctx = canvasRef.current.getContext('2d');
      if (useWebcam && videoRef.current && videoRef.current.readyState >= 2) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
      } else if (!useWebcam && imageURL && imageRef.current && imageRef.current.complete) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        ctx.drawImage(imageRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
      }

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

  // MediaPipe coordinates to Three.js
  const convertCoords = (landmark) => { 
  if (!threeCameraRef.current) return new THREE.Vector3();

  const ndcX = (landmark.x - 0.5) * 2;
  const ndcY = (0.5 - landmark.y) * 2;
  const ndcZ = landmark.z * 0.6; 
  const vec = new THREE.Vector3(ndcX, ndcY, ndcZ);
  vec.unproject(threeCameraRef.current);

  return vec;
};

  // Main render loop
  const drawLoop3D = () => {
    const modelKey = selectedImage || '/glasses1.obj';
    const baseModel = cachedModels.current[modelKey];
    
    if (!baseModel || !sceneRef.current || !rendererRef.current || !threeCameraRef.current) {
      console.warn("Missing required references for rendering.");
      return;
    }

    const defaultProps = {
      scale: 1,
      positionOffset: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      material: { color: 0x333333, metalness: 0.1, roughness: 0.4 },
    };
    const props = { ...defaultProps, ...glassesProperties[modelKey] };

    // Clear old glasses models
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
      }
    }

    // drawing glasses on all the faces
    faceCache.current.forEach((face) => {
      const landmarks = face.landmarks;
      if (landmarks.length === 0) return;

      const glassesModel = baseModel.clone();
      glassesModel.userData.isGlassesModel = true;
      sceneRef.current.add(glassesModel);
      glassesModel.visible = true;

      const getLM = (i) => convertCoords(landmarks[i]);

      const leftPos = getLM(133);
      const rightPos = getLM(362);
      const nose = getLM(197);
      const leftOuter = getLM(33);
      const rightOuter = getLM(263);
      const foreheadCenter = getLM(10);
      const chinTip = getLM(175);
      const leftEar = getLM(234);
      const rightEar = getLM(454);

      // Position
      const eyeCenter = new THREE.Vector3()
    .addVectors(leftPos, rightPos)
    .multiplyScalar(0.5);

      // Scaling
      const eyeDist = leftPos.distanceTo(rightPos);
      const faceHeight = foreheadCenter.distanceTo(chinTip);
      const combinedScale = (eyeDist + faceHeight) / 2;
      const finalScale = combinedScale * props.scale;

      // Rotation (basis vectors)
      const right = new THREE.Vector3().subVectors(rightOuter, leftOuter).normalize();
      const up = new THREE.Vector3().subVectors(foreheadCenter, chinTip).normalize();
      const forward = new THREE.Vector3().crossVectors(right, up).normalize();
      right.crossVectors(up, forward).normalize();
      const rotationMatrix = new THREE.Matrix4().makeBasis(right, up, forward);
      const eulerOffset = new THREE.Euler(props.rotation.x, props.rotation.y, props.rotation.z, 'XYZ');
      const quatOffset = new THREE.Quaternion().setFromEuler(eulerOffset);

      // Apply transform to glasses root
      glassesModel.position.copy(eyeCenter);
      glassesModel.scale.set(finalScale, finalScale, finalScale);
      glassesModel.setRotationFromMatrix(rotationMatrix);
      glassesModel.quaternion.multiply(quatOffset);

      // Check if model has separate frame/temple parts
      let hasSeparateParts = false;
      glassesModel.traverse((child) => {
        if (child.isMesh) {
          const name = child.name.toLowerCase();
          if (name.includes("temple") || name.includes("frame")) {
            hasSeparateParts = true;
          }
        }
      });

      if (hasSeparateParts) {

        // World positions of edges
        const leftFrameEdgeWorld = leftPos.clone();
        const rightFrameEdgeWorld = rightPos.clone();

        // Temple directions and lengths
        const leftTempleDir = new THREE.Vector3().subVectors(leftEar, leftFrameEdgeWorld).normalize();
        const rightTempleDir = new THREE.Vector3().subVectors(rightEar, rightFrameEdgeWorld).normalize();
        const leftTempleLength = leftEar.distanceTo(leftFrameEdgeWorld);
        const rightTempleLength = rightEar.distanceTo(rightFrameEdgeWorld);

        glassesModel.traverse((child) => {
          if (!child.isMesh) return;
          const name = child.name.toLowerCase();

          // Common material
          child.material = new THREE.MeshStandardMaterial({
            color: props.material.color,
            metalness: props.material.metalness,
            roughness: props.material.roughness,
          });

          if (name.includes("temple")) {
            let templeLength, templeDir, attachWorld;

            if (name.includes("left")) {
              templeLength = leftTempleLength;
              templeDir = leftTempleDir;
              attachWorld = leftFrameEdgeWorld;
            } else if (name.includes("right")) {
              templeLength = rightTempleLength;
              templeDir = rightTempleDir;
              attachWorld = rightFrameEdgeWorld;
            }

            // Convert attach point to local space of glassesModel
            const localAttach = attachWorld.clone().applyMatrix4(glassesModel.matrixWorld.clone().invert());
            child.position.copy(localAttach);

            // Scale temple
            const referenceLength = 0.08;
            const scaleFactor = templeLength 
            child.scale.set(scaleFactor, 1, 1); 

            // Rotate temple to point toward ear
            const defaultTempleDir = new THREE.Vector3(0, 0, -1); 
            const rotationQuat = new THREE.Quaternion().setFromUnitVectors(defaultTempleDir, templeDir);
            child.setRotationFromQuaternion(rotationQuat);
          }
        });
      } else {
        // No separate parts
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

      // Apply offset after all transforms
      const offset = new THREE.Vector3(
        props.positionOffset.x,
        props.positionOffset.y,
        props.positionOffset.z
      );
      offset.applyQuaternion(glassesModel.quaternion);
      glassesModel.position.add(offset);
    });

    // Mirror if webcam
    if (useWebcam) {
      if (videoRef.current) videoRef.current.style.transform = 'scaleX(-1)';
      if (canvasRef.current) canvasRef.current.style.transform = 'scaleX(-1)';
      if (threeCanvasRef.current) threeCanvasRef.current.style.transform = 'scaleX(-1)';
    } else {
      if (imageRef.current) imageRef.current.style.transform = 'scaleX(1)';
      if (canvasRef.current) canvasRef.current.style.transform = 'scaleX(1)';
      if (threeCanvasRef.current) threeCanvasRef.current.style.transform = 'scaleX(1)';
    }

    rendererRef.current.render(sceneRef.current, threeCameraRef.current);
  };

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
            } ${	modeLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
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
              value={selectedImage || '/glasses1.obj'}
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
  );
}