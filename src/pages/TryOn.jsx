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

  const { selectedImage, setSelectedImage } = useSelectedGlasses();
  const allOptions = [{ label: 'Glasses 1', value: '/oculos.obj'                     
   }];

  // Initialization
  useEffect(() => {
    let isMounted = true;

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

      // Three.js Scene 
      sceneRef.current = new THREE.Scene();

      const canvasWidth = threeCanvasRef.current.clientWidth;
      const canvasHeight = threeCanvasRef.current.clientHeight;
      const aspect = canvasWidth / canvasHeight;

      // PerspectiveCamera for 3D alignment
      const fov = 45;
      const near = 0.1;
      const far = 1000;
      threeCameraRef.current = new THREE.PerspectiveCamera(fov, aspect, near, far);
      threeCameraRef.current.position.z = 2.5; 

      // Renderer
      try {
        rendererRef.current = new THREE.WebGLRenderer({
          canvas: threeCanvasRef.current,
          alpha: true,
          antialias: true,
        });
        rendererRef.current.setSize(canvasWidth, canvasHeight);
        rendererRef.current.setPixelRatio(window.devicePixelRatio);
        rendererRef.current.setClearColor(0x000000, 0); // Transparent background
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

      //  Load Glasses Models 
      const loader = new OBJLoader();

      const loadModel = (path) =>
        new Promise((resolve, reject) => {
          loader.load(
            path,
            (obj) => {
              console.log(`Glasses model loaded: ${path}`);

              // Center model
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
              resolve();
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

    // -------------------- Cleanup --------------------
    return () => {
      isMounted = false;
      clearTimeout(timer);

      faceMeshRef.current?.close();
      faceMeshRef.current = null;

      cameraRef.current?.stop();
      cameraRef.current = null;

      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current.forceContextLoss?.();
        rendererRef.current = null;
      }

      if (sceneRef.current) {
        sceneRef.current.traverse((object) => {
          if (object.geometry) object.geometry.dispose();
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach((m) => m.dispose());
            } else {
              object.material.dispose();
            }
          }
        });
        sceneRef.current.clear();
        sceneRef.current = null;
      }

      cancelAnimationFrame(animationFrameId.current);
    };
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
          
          // Update camera aspect for orthographic camera
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
    threeCameraRef.current.scale.x = -1; 

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
    if (!faceMeshReady || modeLoading) return;

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

  // Draw Loop
  const drawLoop3D = () => {
  const glassesModel = cachedModels.current[selectedImage || allOptions[0].value];
  const landmarks = faceCache.current[0]?.landmarks || [];

  if (landmarks.length > 0) {
    glassesModel.visible = true;

    // Key landmarks
    const leftEyeInner  = landmarks[133];
    const rightEyeInner = landmarks[362];
    const leftEyeOuter  = landmarks[143];
    const rightEyeOuter = landmarks[372];
    const forehead      = landmarks[168];
    const chinTip       = landmarks[175];

    // Canvas dimensions required for conversion of coords
    const canvasWidth  = threeCanvasRef.current.width;
    const canvasHeight = threeCanvasRef.current.height;
    const aspect       = canvasWidth / canvasHeight;
    const frustumSize  = 1.6;

    // Map FaceMesh normalized coords to Three.js coords
    const convertCoords = (lm) => {
      const x = (lm.x - 0.5) * aspect * frustumSize;
      const y = (0.5 - lm.y) * frustumSize;
      const z = lm.z * -10;
      return { x, y, z };
    };

    //Position 
    const leftPos  = convertCoords(leftEyeInner);
    const rightPos = convertCoords(rightEyeInner);
    const eyeCenter = {
      x: (leftPos.x + rightPos.x) / 2,
      y: (leftPos.y + rightPos.y) / 2,
      z: (leftPos.z + rightPos.z) / 2,
    };
    glassesModel.position.set(eyeCenter.x, eyeCenter.y, eyeCenter.z);


    //Scale based on inter-eye distance
    const eyeDist = Math.hypot(
      rightPos.x - leftPos.x,
      rightPos.y - leftPos.y
    );
    const baseEyeDistance = 0.3;  
    const scaleMultiplier = 1.2;
    const s = (eyeDist / baseEyeDistance) * scaleMultiplier;
    glassesModel.scale.set(s, s, s);


    // Rotation to match head tilt 
    const rollAngle = Math.atan2(
      rightPos.y - leftPos.y,
      rightPos.x - leftPos.x
    );

    const foreheadPos = convertCoords(forehead);
    const chinPos     = convertCoords(chinTip);
    const pitchAngle = Math.atan2(
      chinPos.y - foreheadPos.y,
      Math.abs(chinPos.z - foreheadPos.z)
    ) * 0.3;

    const leftOuter  = convertCoords(leftEyeOuter);
    const rightOuter = convertCoords(rightEyeOuter);
    const yawAngle = (Math.abs(rightOuter.z) - Math.abs(leftOuter.z)) * 0.5;

    glassesModel.rotation.set(pitchAngle, yawAngle, rollAngle);
    
    rendererRef.current.render(sceneRef.current, threeCameraRef.current);
  }
};

  // JSX 
  return (
    <div className="relative min-h-screen overflow-hidden">
      <img src="/background.png" alt="Background" className="absolute inset-0 w-full h-full object-cover -z-20" />
      <div className="absolute inset-0 bg-white/60 backdrop-blur-md -z-10" />

      <div className="relative z-10 flex flex-col items-center py-10 px-4">
        <h1 className="text-3xl font-bold text-blue-700 mb-6">TryRoom for EyeGlasses</h1>

        <div className="flex flex-wrap gap-4 justify-center mb-6">
          <button
            onClick={() => setUseWebcam(true)}
            className={`px-5 py-2 rounded-lg text-white shadow ${useWebcam ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            Use Webcam
          </button>
          <label className="cursor-pointer bg-white border px-5 py-2 rounded-lg shadow">
            Upload Image
            <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
          </label>
          <button
            onClick={snapshot}
            className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg shadow"
          >
            Save Snapshot
          </button>
        </div>

        <div className="flex flex-wrap justify-center gap-6 mb-6">
          <div className="text-center">
            <label className="block mb-1 font-medium">Select Glasses:</label>
            <select
              value={selectedImage || '/oculos.obj'}
              onChange={(e) => setSelectedImage(e.target.value)}
              className="px-4 py-2 border rounded-md shadow"
            >
              {allOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
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
              className={`w-full h-full object-cover transition-opacity duration-300 ${useWebcam ? 'scale-x-[-1]' : ''} ${modeLoading ? 'opacity-0' : 'opacity-100'}`}
            />
          ) : (
            <img ref={imageRef} src={imageURL} alt="Uploaded" className="w-full h-full object-cover" />
          )}
          <canvas
              ref={canvasRef}
              className={`absolute inset-0 w-full h-full object-cover pointer-events-none ${useWebcam ? 'scale-x-[-1]' : ''}`}
            />

            {/* 3D Canvas */}
            <canvas
              ref={threeCanvasRef}
              className={`absolute inset-0 w-full h-full object-cover pointer-events-none ${useWebcam ? 'scale-x-[-1]' : ''}`}
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