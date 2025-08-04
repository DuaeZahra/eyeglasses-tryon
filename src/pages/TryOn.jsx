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
  const [modelsLoaded, setModelsLoaded] = useState(false);


  const { selectedImage, setSelectedImage } = useSelectedGlasses();
  const allOptions = [{ label: 'Glasses 1', value: '/oculos.obj'                     
   }];

useEffect(() => {
  let isMounted = true;
  if (!threeCanvasRef.current) return;

  const init = async () => {
    // === FaceMesh ===
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
      faceCache.current =
        results.multiFaceLandmarks?.map((landmarks) => ({ landmarks })) || [];
    });

    faceMeshRef.current = faceMesh;
    setFaceMeshReady(true);

    // === Scene Setup ===
    sceneRef.current = new THREE.Scene();

    const canvas = threeCanvasRef.current;
    const video = videoRef.current;

    // Wait a bit for DOM layout to finalize
    await new Promise((res) => setTimeout(res, 100));

    // Use actual visible video size, NOT intrinsic resolution
    const bounds = video.getBoundingClientRect();
    const canvasWidth = bounds.width;
    const canvasHeight = bounds.height;
    const aspect = canvasWidth / canvasHeight;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // === Camera ===
    const fov = 15;
    const near = 0.1;
    const far = 1000;
    threeCameraRef.current = new THREE.PerspectiveCamera(fov, aspect, near, far);
    threeCameraRef.current.position.z = 2.5;

    // === Renderer ===
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

    threeCameraRef.current.aspect = aspect;
    threeCameraRef.current.updateProjectionMatrix();
    rendererRef.current.setSize(canvasWidth, canvasHeight);

    // === Lighting ===
    sceneRef.current.add(new THREE.AmbientLight(0xffffff, 0.8));
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight.position.set(0, 1, 1);
    sceneRef.current.add(directionalLight);

    // === Load Glasses Models ===
    const loader = new OBJLoader();
    const loadModel = (path) =>
      new Promise((resolve, reject) => {
        loader.load(
          path,
          (obj) => {
            const box = new THREE.Box3().setFromObject(obj);
            const center = box.getCenter(new THREE.Vector3());
            obj.position.sub(center);

            // Lift model upward slightly
            const size = box.getSize(new THREE.Vector3());
            obj.position.y += size.y * 0.5;

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
        setModelsLoaded(true);
        console.log("Cached models:", Object.keys(cachedModels.current));
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

  
  useEffect(() => {
    const canvas = threeCanvasRef.current;
    const renderer = rendererRef.current;
    const camera = threeCameraRef.current;
    const video = videoRef.current;

    const container = canvas?.parentElement;
    if (!container || !canvas || !renderer || !camera) return;

    const resize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      const bounds = video?.getBoundingClientRect() || { width, height };

      // Update canvas sizes
      canvas.width = width;
      canvas.height = height;
      canvas.style.width = "100%";
      canvas.style.height = "100%";

      if (canvasRef.current) {
        canvasRef.current.width = bounds.width;
        canvasRef.current.height = bounds.height;
        canvasRef.current.style.width = "100%";
        canvasRef.current.style.height = "100%";
        threeCanvasRef.current.style.width = '100%';
        threeCanvasRef.current.style.height = '100%';
      }

      if (useWebcam && video) {
        // Match video dimensions if available
        const videoWidth = video.videoWidth || width;
        const videoHeight = video.videoHeight || height;
        canvas.width = videoWidth;
        canvas.height = videoHeight;
        canvasRef.current.width = videoWidth;
        canvasRef.current.height = videoHeight;
      }

      // Update renderer and camera
      renderer.setSize(width, height, false);
      renderer.setPixelRatio(window.devicePixelRatio);

      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize(); // Initial call

    return () => observer.disconnect();
  }, [useWebcam]);

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

    if (!faceMeshRef.current) {
      console.warn("FaceMesh not initialized yet.");
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    if (!videoRef.current) return;

    videoRef.current.srcObject = stream;

    return new Promise((resolve) => {
      videoRef.current.onloadedmetadata = () => {
        videoRef.current.play().catch((e) => console.error('Video play failed:', e));

        // Wait a moment for DOM to render and get accurate size
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

          if (rendererRef.current) {
            rendererRef.current.setSize(videoWidth, videoHeight, false);
            rendererRef.current.setPixelRatio(window.devicePixelRatio);
          }

          threeCameraRef.current = new THREE.PerspectiveCamera(45, videoWidth / videoHeight, 0.01, 1000);
          threeCameraRef.current.position.set(0, 0, 2);
          threeCameraRef.current.lookAt(0, 0, 0);

          // Mirror
          videoRef.current.style.transform = "scaleX(-1)";
          threeCanvasRef.current.style.transform = "scaleX(-1)";
          canvasRef.current.style.transform = "scaleX(-1)";

          // Start FaceMesh stream
          cameraRef.current = new mpCameraUtils.Camera(videoRef.current, {
            onFrame: async () => {
              try {
                await faceMeshRef.current.send({ image: videoRef.current });
              } catch (err) {
                console.error("FaceMesh send error (webcam):", err);
              }
            },
            width: videoWidth,
            height: videoHeight,
          });

          cameraRef.current.start();

          resolve();
        });
      };
    });
  } catch (e) {
    console.error('Failed to start webcam:', e);
    throw e;
  }
};


  useEffect(() => {
    if (useWebcam && faceMeshReady && modelsLoaded) {
      setModeLoading(true);
      setImageURL(null);
      startWebcam()
        .then(() => setModeLoading(false))
        .catch((e) => {
          console.error("Webcam initialization failed:", e);
          setModeLoading(false);
        });
    } else if (!useWebcam) {
      console.log("Switching to uploaded image mode...");
      stopWebcam();
    }
  }, [useWebcam, faceMeshReady, modelsLoaded]);

  const stopWebcam = () => {
    console.log("Stopping webcam...");
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }

    if (cameraRef.current) {
      cameraRef.current.stop();
      cameraRef.current = null;
    }
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
      threeCanvasRef.current.width = bounds.width;
      threeCanvasRef.current.height = bounds.height;
    }
    
    rendererRef.current.setSize(naturalWidth, naturalHeight);
    
    // Update camera aspect
    const aspect = naturalWidth / naturalHeight;
    const frustumSize = 2;
    threeCameraRef.current.left = -frustumSize * aspect / 2;
    threeCameraRef.current.aspect = aspect;
    threeCameraRef.current.updateProjectionMatrix();


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

  // Draw Loop
  const drawLoop3D = () => {
    const modelKey = selectedImage || allOptions[0]?.value;
    const glassesModel = cachedModels.current[modelKey];
    const landmarks = faceCache.current[0]?.landmarks || [];

    if (!glassesModel || landmarks.length === 0 || !threeCanvasRef.current) return;

    const canvas = threeCanvasRef.current;
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const aspect = canvasWidth / canvasHeight;
    const frustumSize = 1.6;

    const convertCoords = (lm, videoWidth, videoHeight) => {
  // Normalized device coordinates [-1, 1]
      const ndcX = (lm.x - 0.5) * 2;
      const ndcY = (0.5 - lm.y) * 2; // y is flipped
      const ndcZ = 0.0 ; 

      // Convert to 3D world space using unprojection
      const vec = new THREE.Vector3(ndcX, ndcY, ndcZ);
      vec.unproject(threeCameraRef.current); // Converts from NDC to world coordinates

      return vec;
    };


    // === GLASSES SETUP ===
    glassesModel.visible = true;

    const get = (i) => landmarks[i];
    const leftPos = convertCoords(get(133));
    const rightPos = convertCoords(get(362));
    const foreheadPos = convertCoords(get(168));
    const chinPos = convertCoords(get(175));
    const leftOuterPos = convertCoords(get(143));
    const rightOuterPos = convertCoords(get(372));

    const eyeCenter = {
      x: (leftPos.x + rightPos.x) / 2,
      y: ((leftPos.y + rightPos.y) / 2 + foreheadPos.y) / 2,
      z: (leftPos.z + rightPos.z) / 2,
    };
    glassesModel.position.set(eyeCenter.x, eyeCenter.y, eyeCenter.z);

    const eyeDist = Math.hypot(rightPos.x - leftPos.x, rightPos.y - leftPos.y);
    const baseEyeDistance = 0.3;
    const scale = (eyeDist / baseEyeDistance) * 1.2;
    glassesModel.scale.set(scale, scale, scale);

    const roll = Math.atan2(rightPos.y - leftPos.y, rightPos.x - leftPos.x);
    const pitch = Math.atan2(chinPos.y - foreheadPos.y, Math.abs(chinPos.z - foreheadPos.z)) * 0.2;
    const yaw = (Math.abs(rightOuterPos.z) - Math.abs(leftOuterPos.z)) * 0.2;
    glassesModel.rotation.set(pitch, yaw, roll);
    
    // === FACIAL LANDMARK SPHERES ===

    // Cleanup old landmark spheres
    if (!sceneRef.current._landmarkSpheres) sceneRef.current._landmarkSpheres = [];
    sceneRef.current._landmarkSpheres.forEach((sphere) => {
      sceneRef.current.remove(sphere);
      sphere.geometry.dispose();
      sphere.material.dispose();
    });
    sceneRef.current._landmarkSpheres = [];

    // Create new spheres for each landmark
    const sphereGeometry = new THREE.SphereGeometry(0.00005,8,8);
    const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

    landmarks.forEach((lm, index) => {
      const pos = convertCoords(lm);
      const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial.clone());
      sphere.position.set(pos.x, pos.y, pos.z);
      sphere.material.color.setHSL(index / 468, 1.0, 0.5); // optional: color gradient
      sceneRef.current.add(sphere);
      sceneRef.current._landmarkSpheres.push(sphere);
    });

    // === RENDER ===
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
          className="absolute inset-0 w-full h-full object-contain transition-opacity duration-300 bg-black"
        />

        ) : (
          <img
            ref={imageRef}
            src={imageURL}
            alt="Uploaded try-on image"
            className="absolute inset-0 w-full h-full object-contain"
          />
        )}
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full pointer-events-none"
        />
        <canvas
          ref={threeCanvasRef}
          className="absolute top-0 left-0 w-full h-full pointer-events-none"
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