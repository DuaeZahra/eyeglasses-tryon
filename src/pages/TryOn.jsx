import React, { useRef, useState, useEffect } from 'react';
import * as faceapi from 'face-api.js';
import { useSelectedGlasses } from '../context/SelectedGlassesContext';
import { useLocation } from 'react-router-dom';

export default function TryOn() {
  const videoRef = useRef();
  const imageRef = useRef();
  const canvasRef = useRef();

  const { selectedImage, setSelectedImage } = useSelectedGlasses();
  const [glassesImg, setGlassesImg] = useState(null);
  const [imageURL, setImageURL] = useState(null);
  const [useWebcam, setUseWebcam] = useState(true);
  const [modelsLoaded, setModelsLoaded] = useState(false);

  const location = useLocation();
  const product = location.state?.product;

  const glassesOptions = [
    { value: '/glasses1.png', name: 'Concept' },
    { value: '/glasses2.png', name: 'Rotem' },
    { value: '/glasses3.png', name: 'PrimRose' },
    { value: '/glasses4.png', name: 'Terminal' },
    { value: '/glasses5.png', name: 'Identity' },
    { value: '/glasses6.png', name: 'Roaring' },
  ];

  useEffect(() => {
    const loadModels = async () => {
      const MODEL_URL = '/models';
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        ]);
        setModelsLoaded(true);
      } catch (err) {
        console.error("Model load failed:", err);
      }
    };
    loadModels();
  }, []);

  useEffect(() => {
    if (!selectedImage) {
      const fallback = product?.image || '/glasses1.png';
      setSelectedImage(fallback);
    }
  }, [product, selectedImage, setSelectedImage]);

  useEffect(() => {
    if (!selectedImage) return;
    const img = new Image();
    img.src = selectedImage;
    img.onload = () => {
      console.log('Glasses image loaded:', selectedImage);
      setGlassesImg(img);
    };
    img.onerror = () => console.error('Failed to load glasses image:', selectedImage);
  }, [selectedImage]);

  useEffect(() => {
    if (useWebcam) {
      let stream;
      const startWebcam = async () => {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480 }
          });
          if (videoRef.current) videoRef.current.srcObject = stream;
        } catch (err) {
          console.error("Webcam access failed:", err);
        }
      };
      startWebcam();
      return () => {
        if (stream) stream.getTracks().forEach((track) => track.stop());
        if (videoRef.current) videoRef.current.srcObject = null;
      };
    }
  }, [useWebcam]);

  useEffect(() => {
    if (!useWebcam || !glassesImg || !modelsLoaded || !videoRef.current) return;

    let animationFrameId;
    const render = async () => {
      if (
        videoRef.current &&
        videoRef.current.readyState === 4 && // Ensure video is fully loaded
        modelsLoaded &&
        glassesImg
      ) {
        await detectFaceAndDraw(videoRef.current);
      }
      animationFrameId = requestAnimationFrame(render);
    };

    const handleVideoCanPlay = () => {
      render();
    };

    videoRef.current.addEventListener('canplay', handleVideoCanPlay);

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      videoRef.current?.removeEventListener('canplay', handleVideoCanPlay);
    };
  }, [glassesImg, useWebcam, modelsLoaded]);

  useEffect(() => {
    if (!useWebcam && imageRef.current?.complete && glassesImg && modelsLoaded) {
      detectFaceAndDraw(imageRef.current);
    }
  }, [glassesImg, imageURL, modelsLoaded, useWebcam]);

  const drawGlasses = (ctx, landmarks) => {
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();

    const leftEyeCenter = leftEye.reduce((sum, pt) => ({ x: sum.x + pt.x, y: sum.y + pt.y }), { x: 0, y: 0 });
    leftEyeCenter.x /= leftEye.length;
    leftEyeCenter.y /= leftEye.length;

    const rightEyeCenter = rightEye.reduce((sum, pt) => ({ x: sum.x + pt.x, y: sum.y + pt.y }), { x: 0, y: 0 });
    rightEyeCenter.x /= rightEye.length;
    rightEyeCenter.y /= rightEye.length;

    const eyeCenterX = (leftEyeCenter.x + rightEyeCenter.x) / 2;
    const eyeCenterY = (leftEyeCenter.y + rightEyeCenter.y) / 2;
    const eyeDist = Math.abs(rightEyeCenter.x - leftEyeCenter.x);

    const glassesWidth = eyeDist * 2.5;
    const glassesHeight = glassesWidth * 0.4;
    const angle = Math.atan2(rightEyeCenter.y - leftEyeCenter.y, rightEyeCenter.x - leftEyeCenter.x);

    ctx.save();
    ctx.translate(eyeCenterX, eyeCenterY);
    ctx.rotate(angle);
    ctx.drawImage(glassesImg, -glassesWidth / 2, -glassesHeight / 2, glassesWidth, glassesHeight);
    ctx.restore();
  };

  const detectFaceAndDraw = async (input) => {
    const canvas = canvasRef.current;
    if (!canvas || !input || !glassesImg) return;

    const displayWidth = input.videoWidth || input.width;
    const displayHeight = input.videoHeight || input.height;

    canvas.width = displayWidth;
    canvas.height = displayHeight;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.resetTransform(); // Reset transformations to avoid issues

    if (useWebcam) {
      ctx.save();
      ctx.scale(-1, 1); // Mirror webcam feed
      ctx.translate(-canvas.width, 0);
      ctx.drawImage(input, 0, 0, canvas.width, canvas.height);
      ctx.restore();
    } else {
      ctx.drawImage(input, 0, 0, canvas.width, canvas.height);
    }

    try {
      const detections = await faceapi
        .detectAllFaces(input, new faceapi.TinyFaceDetectorOptions({
          inputSize: 512,
          scoreThreshold: 0.5,
        }))
        .withFaceLandmarks();

      if (detections.length === 0) {
        console.warn('No faces detected');
        return;
      }

      const resized = faceapi.resizeResults(detections, {
        width: displayWidth,
        height: displayHeight,
      });

      resized.forEach(({ landmarks }) => {
        if (useWebcam) {
          const flippedPositions = landmarks.positions.map((pt) =>
            new faceapi.Point(displayWidth - pt.x, pt.y)
          );
          const flippedLandmarks = new faceapi.FaceLandmarks68(flippedPositions, {
            width: displayWidth,
            height: displayHeight,
          });
          drawGlasses(ctx, flippedLandmarks, canvas.width, canvas.height);
        } else {
          drawGlasses(ctx, landmarks, canvas.width, canvas.height);
        }
      });
    } catch (err) {
      console.error('Face detection error:', err);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setUseWebcam(false);
        setImageURL(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageLoad = () => {
    if (glassesImg && modelsLoaded && imageRef.current) {
      detectFaceAndDraw(imageRef.current);
    }
  };

  const handleSnapshot = () => {
    const canvas = canvasRef.current;
    const link = document.createElement('a');
    link.download = `tryon_${Date.now()}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  if (!modelsLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-8 shadow-lg text-center max-w-md w-full">
          <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
            <span className="text-2xl animate-pulse">🕶️</span>
          </div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">Loading Try-On</h3>
          <p className="text-gray-600">Preparing AI models...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Virtual Try-Room</h1>
          <p className="text-gray-600">Try on glasses using your camera or upload a photo</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex gap-2">
              <button
                onClick={() => setUseWebcam(true)}
                className={`px-4 py-2 rounded-lg font-medium transition ${useWebcam ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                📹 Camera
              </button>

              <label className={`px-4 py-2 rounded-lg font-medium cursor-pointer transition ${!useWebcam ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                📸 Upload
                <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              </label>
            </div>

            <select
              value={selectedImage}
              onChange={(e) => setSelectedImage(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {glassesOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.name}
                </option>
              ))}
            </select>

            <button
              onClick={handleSnapshot}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
            >
              📸 Save Photo
            </button>
          </div>

          <div className="relative w-full aspect-video rounded-lg overflow-hidden shadow-md bg-gray-100">
            {useWebcam ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="absolute top-0 left-0 w-full h-full object-cover opacity-0"
                />
                <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full object-cover" />
              </>
            ) : (
              <>
                {imageURL && (
                  <img
                    ref={imageRef}
                    src={imageURL}
                    alt="Uploaded"
                    onLoad={handleImageLoad}
                    className="hidden"
                  />
                )}
                <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full object-cover" />
                {!imageURL && (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                    <div className="text-center">
                      <div className="text-4xl mb-2">📸</div>
                      <p>Upload a photo to get started</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}