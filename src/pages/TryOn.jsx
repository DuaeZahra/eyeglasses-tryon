import React, { useRef, useState, useEffect } from 'react';
import * as faceapi from 'face-api.js';
import { useSelectedGlasses } from '../context/SelectedGlassesContext';

export default function TryOn() {
  const videoRef = useRef();
  const imageRef = useRef();
  const canvasRef = useRef();
  const { selectedImage, setSelectedImage } = useSelectedGlasses();
  const [glassesImg, setGlassesImg] = useState(null);
  const [imageURL, setImageURL] = useState(null);
  const [useWebcam, setUseWebcam] = useState(true);
  const [modelsLoaded, setModelsLoaded] = useState(false);

  useEffect(() => {
    const loadModels = async () => {
      const MODEL_URL = '/models';
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        ]);
        setModelsLoaded(true);
      } catch (error) {
        console.error('Model loading error:', error);
      }
    };
    loadModels();

    return () => {
      faceapi.nets.tinyFaceDetector.dispose();
      faceapi.nets.faceLandmark68Net.dispose();
    };
  }, []);

  useEffect(() => {
    if (!selectedImage) return;
    const img = new Image();
    img.src = selectedImage;
    img.onload = () => {
      setGlassesImg(img);
    };
  }, [selectedImage]);

  useEffect(() => {
    if (useWebcam) {
      let stream;
      const startWebcam = async () => {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480 },
          });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } catch (error) {
          console.error('Webcam error:', error);
        }
      };
      startWebcam();
      return () => {
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
        }
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
      };
    }
  }, [useWebcam]);

  useEffect(() => {
  if (!useWebcam || !glassesImg || !modelsLoaded || !videoRef.current) return;

  let animationFrameId;

  const render = async () => {
    if (videoRef.current.readyState >= 2) {
      await detectFaceAndDraw(videoRef.current); // Detect and draw glasses
    }
    animationFrameId = requestAnimationFrame(render);
  };

  render();

  return () => cancelAnimationFrame(animationFrameId);
  }, [glassesImg, useWebcam, modelsLoaded]);


  const drawGlasses = (ctx, landmarks) => {
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();
    const eyeCenterX = (leftEye[0].x + rightEye[3].x) / 2;
    const eyeCenterY = (leftEye[0].y + rightEye[3].y) / 2;
    const eyeDist = Math.abs(rightEye[3].x - leftEye[0].x);
    const glassesWidth = eyeDist * 2;
    const glassesHeight = glassesWidth / 3;
    const angle = Math.atan2(
      rightEye[3].y - leftEye[0].y,
      rightEye[3].x - leftEye[0].x
    );

    ctx.save();
    if (useWebcam) {
      ctx.translate(canvasRef.current.width - eyeCenterX, eyeCenterY);
      ctx.scale(-1, 1);
    } else {
      ctx.translate(eyeCenterX, eyeCenterY);
    }
    ctx.rotate(angle);
    ctx.drawImage(
      glassesImg,
      -glassesWidth / 2,
      -glassesHeight / 2,
      glassesWidth,
      glassesHeight
    );
    ctx.restore();
  };

const detectFaceAndDraw = async (input) => {
  const canvas = canvasRef.current;
  if (!canvas || !input) return;

  const width = input.videoWidth || input.width;
  const height = input.videoHeight || input.height;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);  // reset transform
  ctx.clearRect(0, 0, width, height); // clear canvas

  // mirror if using webcam
  if (useWebcam) ctx.setTransform(-1, 0, 0, 1, width, 0);
  ctx.drawImage(input, 0, 0, width, height); // draw video or image

  if (!glassesImg) return;

  try {
    const detections = await faceapi
      .detectAllFaces(input, new faceapi.TinyFaceDetectorOptions({ inputSize: 512, scoreThreshold: 0.5 }))
      .withFaceLandmarks();

    if (!detections.length) return;

    const resized = faceapi.resizeResults(detections, { width, height });

    resized.forEach(({ landmarks }) => {
      drawGlasses(ctx, landmarks);  // <- this must be called!
    });
  } catch (err) {
    console.error('Face detection error:', err);
  }
};


  useEffect(() => {
    if (!useWebcam && imageRef.current?.complete && glassesImg && modelsLoaded) {
      detectFaceAndDraw(imageRef.current);
    }
  }, [glassesImg, imageURL, modelsLoaded, useWebcam]);

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
    link.download = 'tryon_snapshot.png';
    link.href = canvas.toDataURL();
    link.click();
  };

  return (
    <div className="min-h-screen py-10 px-4 flex flex-col items-center">
      <h2 className="text-4xl font-bold text-gray-800 mb-6">🕶️ Try-Room</h2>
      <div className="bg-white shadow-xl rounded-xl p-6 w-full max-w-3xl">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
          <div className="flex gap-3">
            <button
              onClick={() => setUseWebcam(true)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition duration-200 ${
                useWebcam ? 'bg-black text-white' : 'bg-gray-200 hover:bg-gray-300 text-black'
              }`}
            >
              Use Webcam
            </button>
            <label className="cursor-pointer px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-xl text-sm font-medium">
              Upload Image
              <input type="file" accept="image/*" onChange={handleFileChange} hidden />
            </label>
          </div>

          <select
            value={selectedImage}
            onChange={(e) => setSelectedImage(e.target.value)}
            className="border border-gray-300 rounded-xl px-4 py-2 text-sm bg-white"
          >
            <option value="/glasses1.png">Concept</option>
            <option value="/glasses2.png">Rotem</option>
            <option value="/glasses3.png">PrimRose</option>
            <option value="/glasses4.png">Terminal</option>
            <option value="/glasses5.png">Identity</option>
            <option value="/glasses6.png">Roaring</option>
          </select>
        </div>

        <div className="relative w-full aspect-video rounded-lg overflow-hidden shadow-md border border-gray-300 bg-gray-100">
          {useWebcam ? (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="absolute top-0 left-0 w-full h-full object-cover opacity-0 transform -scale-x-100"
              />
              <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full z-10" />
            </>
          ) : (
            <>
              {imageURL && (
                <img
                  ref={imageRef}
                  src={imageURL}
                  alt="Uploaded"
                  onLoad={handleImageLoad}
                  style={{ display: 'none' }}
                />
              )}
              <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full z-10" />
            </>
          )}
        </div>

        <button
          onClick={handleSnapshot}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition"
        >
          📸 Take Snapshot
        </button>
      </div>
    </div>
  );
}
