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

  const [imageURL, setImageURL] = useState(null);
  const [useWebcam, setUseWebcam] = useState(true);
  const [modeLoading, setModeLoading] = useState(false);
  const [faceMeshReady, setFaceMeshReady] = useState(false);
  
  // Fixed values from the fine-tuning controls
  const positionOffset = { x: -0.270, y: 0.000, z: 0.000 };
  const scaleMultiplier = -2.00;
  const rotationOffset = { x: 0.0192, y: 0.000, z: 0.000 }; // 1.1° converted to radians

  const { selectedImage, setSelectedImage } = useSelectedGlasses();
  const allOptions = [{ label: 'Glasses 1', value: '/oculos.obj' }];

  // Initialization
  useEffect(() => {
    let isMounted = true;
    if (!threeCanvasRef.current) return;
    
    const init = async () => {
      if (!threeCanvasRef.current) {
        setTimeout(init, 100);
        return;
      }

      setModeLoading(true);
      console.log("Initializing FaceMesh and Three.js...");

      // FaceMesh
      const faceMesh = new mpFaceMesh.FaceMesh({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
      });

      faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.7,
      });

      faceMesh.onResults((results) => {
        faceCache.current = results.multiFaceLandmarks?.map((landmarks) => ({ landmarks })) || [];
      });

      faceMeshRef.current = faceMesh;
      setFaceMeshReady(true);

      // Scene
      sceneRef.current = new THREE.Scene();

      const canvas = threeCanvasRef.current;
      const canvasWidth = canvas.clientWidth;
      const canvasHeight = canvas.clientHeight;
      const aspect = canvasWidth / canvasHeight;

      // Use Orthographic Camera for better face alignment
      const frustumSize = 2;
      threeCameraRef.current = new THREE.OrthographicCamera(
        -frustumSize * aspect / 2, // left
        frustumSize * aspect / 2,  // right
        frustumSize / 2,           // top
        -frustumSize / 2,          // bottom
        0.1,                       // near
        1000                       // far
      );
      threeCameraRef.current.position.z = 5;

      // Renderer
      try {
        rendererRef.current = new THREE.WebGLRenderer({
          canvas: canvas,
          alpha: true,
          antialias: true,
        });
        rendererRef.current.setSize(canvasWidth, canvasHeight, false);
        rendererRef.current.setPixelRatio(window.devicePixelRatio);
        rendererRef.current.setClearColor(0x000000, 0);
      } catch (err) {
        console.error("Renderer initialization failed:", err);
        setModeLoading(false);
        return;
      }

      // Lighting
      sceneRef.current.add(new THREE.AmbientLight(0xffffff, 0.8));
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
      directionalLight.position.set(0, 1, 1);
      sceneRef.current.add(directionalLight);

      // Load Models
      const loader = new OBJLoader();
      const loadModel = (path) =>
        new Promise((resolve, reject) => {
          loader.load(
            path,
            (obj) => {
              // Center the model but don't raise it - we'll position it correctly at runtime
              const box = new THREE.Box3().setFromObject(obj);
              const center = box.getCenter(new THREE.Vector3());
              obj.position.sub(center);

              obj.visible = false;

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
              sceneRef.current.add(obj);
              resolve(obj);
            },
            undefined,
            (error) => {
              console.error(`Failed to load model ${path}:`, error);
              reject(error);
            }
          );
        });

      try {
        await Promise.all(allOptions.map((opt) => loadModel(opt.value)));
        if (isMounted) {
          setSelectedImage(allOptions[0].value);
          console.log("Cached models:", Object.keys(cachedModels.current));
          setModeLoading(false);
        }
      } catch (e) {
        console.error("Error loading models:", e);
        setModeLoading(false);
      }
    };

    const timer = setTimeout(init, 100);

    return () => {
      isMounted = false;
      clearTimeout(timer);

      faceMeshRef.current?.close();
      faceMeshRef.current = null;

      cameraRef.current?.stop?.();
      cameraRef.current = null;

      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current.forceContextLoss?.();
        rendererRef.current = null;
      }

      if (sceneRef.current) {
        sceneRef.current.traverse((object) => {
          if (object.isMesh) {
            object.geometry?.dispose();
            if (Array.isArray(object.material)) {
              object.material.forEach((m) => m.dispose());
            } else {
              object.material?.dispose();
            }
          }
        });
        sceneRef.current.clear();
        sceneRef.current = null;
      }

      cancelAnimationFrame(animationFrameId.current);
    };
  }, []);

  // Resizes both canvases to match the container size.
  useEffect(() => {
    const canvas = threeCanvasRef.current;
    const renderer = rendererRef.current;
    const camera = threeCameraRef.current;

    const container = canvas?.parentElement;
    if (!container || !canvas || !renderer || !camera) return;

    const resize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      const aspect = width / height;

      // Update canvas size
      canvas.width = width;
      canvas.height = height;
      canvas.style.width = "100%";
      canvas.style.height = "100%";

      // Resize Three.js renderer and update camera
      renderer.setSize(width, height, false);
      renderer.setPixelRatio(window.devicePixelRatio);

      // Update orthographic camera
      const frustumSize = 2;
      camera.left = -frustumSize * aspect / 2;
      camera.right = frustumSize * aspect / 2;
      camera.top = frustumSize / 2;
      camera.bottom = -frustumSize / 2;
      camera.updateProjectionMatrix();
    };

    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize(); // Initial call

    return () => observer.disconnect();
  }, []);

  // Webcam Handling 
  useEffect(() => {
    if (useWebcam) {
      setModeLoading(true);
      setImageURL(null);
      startWebcam()
        .then(() => setModeLoading(false))
        .catch((e) => {
          console.error('Webcam initialization failed:', e);
          setModeLoading(false);
        });
    } else {
      console.log("Switching to uploaded image mode...");
      stopWebcam();
    }
  }, [useWebcam]);

  const startWebcam = async () => {
    try {
      console.log("Starting webcam...");
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (!videoRef.current) return;

      videoRef.current.srcObject = stream;
      return new Promise((resolve) => {
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play().catch((e) => console.error('Video play failed:', e));
          const { videoWidth, videoHeight } = videoRef.current;
          
          // Update canvas sizes
          if (canvasRef.current) {
            canvasRef.current.width = videoWidth;
            canvasRef.current.height = videoHeight;
          }
          if (threeCanvasRef.current) {
            threeCanvasRef.current.width = videoWidth;
            threeCanvasRef.current.height = videoHeight;
          }
          
          rendererRef.current.setSize(videoWidth, videoHeight);
          
          // Update camera aspect
          const aspect = videoWidth / videoHeight;
          const frustumSize = 2;
          threeCameraRef.current.left = -frustumSize * aspect / 2;
          threeCameraRef.current.right = frustumSize * aspect / 2;
          threeCameraRef.current.top = frustumSize / 2;
          threeCameraRef.current.bottom = -frustumSize / 2;
          threeCameraRef.current.updateProjectionMatrix();

          cameraRef.current = new mpCameraUtils.Camera(videoRef.current, {
            onFrame: async () => {
              // Manual frame processing
            },
            width: videoWidth,
            height: videoHeight,
          });
          cameraRef.current.start();
          resolve();
        };
      });
    } catch (e) {
      console.error('Failed to start webcam:', e);
      throw e;
    }
  };

  const stopWebcam = () => {
    console.log("Stopping webcam...");
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    cameraRef.current?.stop();
    cameraRef.current = null;
  };

  // Image Handling
  useEffect(() => {
    if (!useWebcam && imageURL) {
      console.log("Processing uploaded image...");
      const img = imageRef.current;
      if (img?.complete && img.naturalWidth > 0) {
        processUploadedImage();
      } else if (img) {
        img.onload = () => processUploadedImage();
      }
    }
  }, [useWebcam, imageURL]);

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (f) {
      console.log(`Uploading image: ${f.name}`);
      const r = new FileReader();
      r.onload = () => {
        setUseWebcam(false);
        setModeLoading(true);
        setImageURL(r.result);
      };
      r.readAsDataURL(f);
    }
  };

  const processUploadedImage = async () => {
    if (!imageRef.current || !rendererRef.current || !threeCameraRef.current) return;

    const { naturalWidth, naturalHeight } = imageRef.current;
    
    // Update canvas sizes
    if (canvasRef.current) {
      canvasRef.current.width = naturalWidth;
      canvasRef.current.height = naturalHeight;
    }
    if (threeCanvasRef.current) {
      threeCanvasRef.current.width = naturalWidth;
      threeCanvasRef.current.height = naturalHeight;
    }
    
    rendererRef.current.setSize(naturalWidth, naturalHeight);
    
    // Update camera aspect
    const aspect = naturalWidth / naturalHeight;
    const frustumSize = 2;
    threeCameraRef.current.left = -frustumSize * aspect / 2;
    threeCameraRef.current.right = frustumSize * aspect / 2;
    threeCameraRef.current.top = frustumSize / 2;
    threeCameraRef.current.bottom = -frustumSize / 2;
    threeCameraRef.current.updateProjectionMatrix();

    if (faceMeshReady && faceMeshRef.current && imageRef.current) {
      try {
        await faceMeshRef.current.send({ image: imageRef.current });
      } catch (err) {
        console.error("FaceMesh send error (image):", err);
      }
    }
    setModeLoading(false);
  };

  // Snapshot
  const snapshot = () => {
    if (!canvasRef.current || !threeCanvasRef.current) return;
    const c = canvasRef.current;
    const t = threeCanvasRef.current;
    const s = document.createElement('canvas');
    s.width = c.width;
    s.height = c.height;
    const ctx = s.getContext('2d');
    if (useWebcam) {
      ctx.translate(s.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(c, 0, 0);
    ctx.drawImage(t, 0, 0);
    const a = document.createElement('a');
    a.download = 'tryon.png';
    a.href = s.toDataURL('image/png');
    a.click();
  };

  // Main Animation Loop 
  useEffect(() => {
    if (!faceMeshReady || modeLoading || !threeCanvasRef.current) return;
    
    const animationLoop = async () => {
      await detectAndCacheFaces();
      drawLoop3D();
      animationFrameId.current = requestAnimationFrame(animationLoop);
    };
    animationFrameId.current = requestAnimationFrame(animationLoop);
    return () => cancelAnimationFrame(animationFrameId.current);
  }, [faceMeshReady, modeLoading, selectedImage, useWebcam]);

  // Detection 
  const detectAndCacheFaces = async () => {
    if (!faceMeshReady || !faceMeshRef.current) return;
    if (useWebcam && videoRef.current) {
      if (videoRef.current.readyState < 2) return;
      try {
        await faceMeshRef.current.send({ image: videoRef.current });
      } catch (err) {
        console.error("FaceMesh send error (webcam):", err);
      }
    }
  };

  // Coordinate conversion function
  const convertToWorldCoords = (landmark, aspect, frustumSize = 2) => {
    return {
      x: (landmark.x - 0.5) * aspect * frustumSize,
      y: (0.5 - landmark.y) * frustumSize,
      z: landmark.z * -1, // Adjusted Z depth
    };
  };

  // Draw Loop with fixed values applied
  const drawLoop3D = () => {
    const modelKey = selectedImage || allOptions[0]?.value;
    const glassesModel = cachedModels.current[modelKey];
    const landmarks = faceCache.current[0]?.landmarks || [];

    if (!glassesModel || landmarks.length === 0 || !threeCanvasRef.current) {
      return;
    }

    const canvas = threeCanvasRef.current;
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const aspect = canvasWidth / canvasHeight;
    const frustumSize = 2;

    glassesModel.visible = true;

    // Get landmark points
    const leftEyeInner = landmarks[133];   // Inner corner of left eye
    const rightEyeInner = landmarks[362];  // Inner corner of right eye
    const leftEyeOuter = landmarks[143];   // Outer corner of left eye
    const rightEyeOuter = landmarks[372];  // Outer corner of right eye
    const noseBridge = landmarks[168];     // Nose bridge (between eyes)
    const forehead = landmarks[10];        // Forehead center
    const chinTip = landmarks[152];        // Chin tip
    const leftEyeCenter = landmarks[33];   // Left eye center
    const rightEyeCenter = landmarks[263]; // Right eye center

    // Convert to world coordinates
    const leftEyeInnerPos = convertToWorldCoords(leftEyeInner, aspect, frustumSize);
    const rightEyeInnerPos = convertToWorldCoords(rightEyeInner, aspect, frustumSize);
    const leftEyeOuterPos = convertToWorldCoords(leftEyeOuter, aspect, frustumSize);
    const rightEyeOuterPos = convertToWorldCoords(rightEyeOuter, aspect, frustumSize);
    const noseBridgePos = convertToWorldCoords(noseBridge, aspect, frustumSize);
    const foreheadPos = convertToWorldCoords(forehead, aspect, frustumSize);
    const chinPos = convertToWorldCoords(chinTip, aspect, frustumSize);
    const leftEyeCenterPos = convertToWorldCoords(leftEyeCenter, aspect, frustumSize);
    const rightEyeCenterPos = convertToWorldCoords(rightEyeCenter, aspect, frustumSize);

    // Calculate proper eye center using eye centers, not inner corners
    const eyeCenter = {
      x: (leftEyeCenterPos.x + rightEyeCenterPos.x) / 2 + positionOffset.x,
      y: (leftEyeCenterPos.y + rightEyeCenterPos.y) / 2 + 0.08 + positionOffset.y, // Move up to sit on nose bridge
      z: (leftEyeCenterPos.z + rightEyeCenterPos.z) / 2 + 0.02 + positionOffset.z, // Move slightly forward
    };

    // Position glasses at calculated eye center
    glassesModel.position.copy(eyeCenter);

    // Calculate scale based on eye distance (outer corners for frame width)
    const eyeDistance = Math.sqrt(
      Math.pow(rightEyeOuterPos.x - leftEyeOuterPos.x, 2) +
      Math.pow(rightEyeOuterPos.y - leftEyeOuterPos.y, 2)
    );
    const baseEyeDistance = 0.6; // Baseline distance for glasses frame
    const scale = Math.max(0.5, Math.min(2.0, eyeDistance / baseEyeDistance * scaleMultiplier)); // Constrain scale
    glassesModel.scale.set(scale, scale, scale);

    // Calculate rotations with better accuracy
    const roll = Math.atan2(
      rightEyeCenterPos.y - leftEyeCenterPos.y,
      rightEyeCenterPos.x - leftEyeCenterPos.x
    ) + rotationOffset.z;

    // Pitch calculation using nose bridge to forehead/chin
    const faceHeight = Math.abs(foreheadPos.y - chinPos.y);
    const pitch = Math.atan2(
      noseBridgePos.z - eyeCenter.z,
      faceHeight
    ) * 0.2 + rotationOffset.x; // Reduced influence

    // Yaw calculation based on face turning
    const yaw = (rightEyeCenterPos.z - leftEyeCenterPos.z) * 0.3 + rotationOffset.y;

    glassesModel.rotation.set(pitch, yaw, roll);

    rendererRef.current.render(sceneRef.current, threeCameraRef.current);
  };

  // JSX 
  return (
    <div className="relative min-h-screen overflow-hidden">
      <img
        src="/background.png"
        alt="Background"
        className="absolute inset-0 w-full h-full object-cover -z-20"
      />
      <div className="absolute inset-0 bg-white/60 backdrop-blur-md -z-10" />

      <div className="relative z-10 flex flex-col items-center py-10 px-4">
        <h1 className="text-3xl font-bold text-blue-700 mb-6">TryRoom for EyeGlasses</h1>

        <div className="flex flex-wrap gap-4 justify-center mb-6">
          <button
            onClick={() => setUseWebcam(true)}
            className={`px-5 py-2 rounded-lg text-white shadow ${
              useWebcam ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'
            }`}
            aria-label="Use webcam for try-on"
          >
            Use Webcam
          </button>
          <label
            className="cursor-pointer bg-white border px-5 py-2 rounded-lg shadow"
            aria-label="Upload an image for try-on"
          >
            Upload Image
            <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
          </label>
          <button
            onClick={snapshot}
            className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg shadow"
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
              className="px-4 py-2 border rounded-md shadow"
              aria-label="Select glasses model"
            >
              {allOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
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
              className={`w-full h-full object-contain transition-opacity duration-300 ${
                useWebcam ? 'scale-x-[-1]' : ''
              } ${modeLoading ? 'opacity-0' : 'opacity-100'}`}
            />
          ) : (
            <img
              ref={imageRef}
              src={imageURL}
              alt="Uploaded try-on image"
              className="w-full h-full object-contain"
            />
          )}
          <canvas
            ref={canvasRef}
            className={`absolute inset-0 pointer-events-none ${useWebcam ? 'scale-x-[-1]' : ''}`}
          />
          <canvas
            ref={threeCanvasRef}
            className={`absolute inset-0 pointer-events-none ${useWebcam ? 'scale-x-[-1]' : ''}`}
          />
          {modeLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70 z-40">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}