import React, { useRef, useState, useEffect } from 'react';
import * as faceapi from 'face-api.js';

export default function TryOn() {
  const videoRef = useRef();
  const imageRef = useRef();
  const canvasRef = useRef();

  const [maleGlasses, setMaleGlasses] = useState('/glasses1.png');
  const [femaleGlasses, setFemaleGlasses] = useState('/glasses4.png');
  const [imageURL, setImageURL] = useState(null);
  const [useWebcam, setUseWebcam] = useState(true);
  const [mirror, setMirror] = useState(true);
  const [loadingWebcam, setLoadingWebcam] = useState(false);
  

  // Load face-api models
  useEffect(() => {
    const loadModels = async () => {
      await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
      await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
      await faceapi.nets.ageGenderNet.loadFromUri('/models');
    };
    loadModels();
  }, []);

  useEffect(() => () => stopWebcam(), []);

  //webcam controls
  useEffect(() => {
    if (useWebcam) {
      setImageURL(null);
      startWebcam();
    } else {
      stopWebcam();
    }
  }, [useWebcam]);

  useEffect(() => {
    if (!useWebcam && imageURL) detectFaceAndDraw();
  }, [useWebcam, imageURL]);

  useEffect(() => {
    let interval;
    if (useWebcam && videoRef.current) {
      interval = setInterval(detectFaceAndDraw, 250);
    }
    return () => clearInterval(interval);
  }, [useWebcam, maleGlasses, femaleGlasses]);

  // Trigger re-draw on glasses dropdown change
  useEffect(() => {
    if (useWebcam) {
      detectFaceAndDraw(); 
    } else if (imageURL) {
      detectFaceAndDraw(); 
    }
  }, [maleGlasses, femaleGlasses]);

  const startWebcam = async () => {
    try {
      setLoadingWebcam(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stopWebcam();
      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current.play();
        detectFaceAndDraw();
        setLoadingWebcam(false);
      };
    } catch (err) {
      console.error('Webcam access error:', err);
      setLoadingWebcam(false);
    }
  };

  const stopWebcam = () => {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
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

  const handleSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const snapshotCanvas = document.createElement('canvas');
    snapshotCanvas.width = canvas.width;
    snapshotCanvas.height = canvas.height;
    const ctx = snapshotCanvas.getContext('2d');

    if (useWebcam && mirror) {
      ctx.translate(snapshotCanvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(canvas, 0, 0);
    const link = document.createElement('a');
    link.download = 'tryon-snapshot.png';
    link.href = snapshotCanvas.toDataURL('image/png');
    link.click();
  };

  const detectFaceAndDraw = async () => {
    const input = useWebcam ? videoRef.current : imageRef.current;
    if (!input) return;

    const canvas = canvasRef.current;
    const width = input.videoWidth || input.naturalWidth;
    const height = input.videoHeight || input.naturalHeight;
    if (!width || !height) return;

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(input, 0, 0, width, height);

    const detections = await faceapi
      .detectAllFaces(input, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withAgeAndGender();

    for (const det of detections) {
      const { gender, landmarks } = det;

      const leftEye = landmarks.getLeftEye();
      const rightEye = landmarks.getRightEye();

      const left = leftEye.reduce((acc, pt) => ({ x: acc.x + pt.x, y: acc.y + pt.y }), { x: 0, y: 0 });
      const right = rightEye.reduce((acc, pt) => ({ x: acc.x + pt.x, y: acc.y + pt.y }), { x: 0, y: 0 });

      const eyeCenterX = (left.x / leftEye.length + right.x / rightEye.length) / 2;
      const eyeCenterY = (left.y / leftEye.length + right.y / rightEye.length) / 2;
      const dx = (right.x / rightEye.length) - (left.x / leftEye.length);
      const dy = (right.y / rightEye.length) - (left.y / leftEye.length);
      const angle = Math.atan2(dy, dx);

      const glassesWidth = Math.sqrt(dx * dx + dy * dy) * 2.5;
      const glassesHeight = glassesWidth / 2.5;

      const glassesImg = new Image();
      glassesImg.src = gender === 'male' ? maleGlasses : femaleGlasses;

      await new Promise((resolve) => {
        glassesImg.onload = () => {
          ctx.save();
          ctx.translate(eyeCenterX, eyeCenterY);
          ctx.rotate(angle);
          ctx.drawImage(
            glassesImg,
            -glassesWidth / 2,
            -glassesHeight / 2,
            glassesWidth,
            glassesHeight
          );
          ctx.restore();
          resolve();
        };
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-100 via-blue-50 to-white flex flex-col items-center py-10 px-4">
      <h1 className="text-3xl font-bold text-blue-700 mb-6">TryRoom for the EyeGlasses</h1>

      <div className="flex flex-wrap gap-4 justify-center mb-6">
        <button
          onClick={() => setUseWebcam(true)}
          className={`px-5 py-2 rounded-lg text-white shadow ${
            useWebcam ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          Use Webcam
        </button>

        <label className="cursor-pointer bg-white border border-gray-300 hover:bg-gray-100 px-5 py-2 rounded-lg shadow text-gray-800">
          Upload Image
          <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
        </label>

        <div className="flex gap-3 items-center">
          <label className="text-sm">Male Glasses:</label>
          <select
            value={maleGlasses}
            onChange={(e) => setMaleGlasses(e.target.value)}
            className="px-3 py-2 rounded-lg border shadow"
          >
            <option value="/glasses1.png">Concept</option>
            <option value="/glasses2.png">Rotem</option>
            <option value="/glasses3.png">PrimRose</option>
          </select>
        </div>

        <div className="flex gap-3 items-center">
          <label className="text-sm">Female Glasses:</label>
          <select
            value={femaleGlasses}
            onChange={(e) => setFemaleGlasses(e.target.value)}
            className="px-3 py-2 rounded-lg border shadow"
          >
            <option value="/glasses4.png">Terminal</option>
            <option value="/glasses5.png">Identity</option>
            <option value="/glasses6.png">Roaring</option>
          </select>
        </div>

        <button
          onClick={handleSnapshot}
          className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg shadow"
        >
          Save Snapshot
        </button>
      </div>

      <div className="relative w-full max-w-3xl aspect-video border rounded-xl overflow-hidden bg-white shadow">
        {useWebcam ? (
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className={`w-full h-full object-cover ${mirror ? 'scale-x-[-1]' : ''}`}
          />
        ) : (
          <img
            ref={imageRef}
            src={imageURL}
            alt="Uploaded"
            className="w-full h-full object-cover"
            onLoad={detectFaceAndDraw}
          />
        )}

        <canvas
          ref={canvasRef}
          className={`absolute top-0 left-0 w-full h-full pointer-events-none ${
            useWebcam && mirror ? 'scale-x-[-1]' : ''
          }`}
        />

        {loadingWebcam && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 z-30">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}
