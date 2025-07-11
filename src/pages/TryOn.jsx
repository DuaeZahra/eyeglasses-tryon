import React, { useRef, useState, useEffect } from 'react';
import * as faceapi from 'face-api.js';

export default function TryOn() {
  const videoRef = useRef();
  const imageRef = useRef();
  const canvasRef = useRef();
  const [inputMode, setInputMode] = useState('webcam');
  const [selectedGlasses, setSelectedGlasses] = useState('/glasses1.png');
  const [glassesImg, setGlassesImg] = useState(null);
  const [mirror, setMirror] = useState(true); // true = mirror webcam


  // Load models once
  useEffect(() => {
    const loadModels = async () => {
      await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
      await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
    };
    loadModels();
  }, []);

  // Load selected glasses
  useEffect(() => {
  const img = new Image();
  img.src = selectedGlasses;
  img.onload = () => {
    setGlassesImg(img); // we rely on the useEffect above to trigger drawing
  };
}, [selectedGlasses]);

  // Start webcam
  const startWebcam = async () => {
    setInputMode('webcam');
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    videoRef.current.srcObject = stream;
  };

  useEffect(() => {
  if (
    inputMode === 'upload' &&
    imageRef.current?.complete &&
    glassesImg
  ) {
    detectFaceAndDraw();
  }
}, [inputMode, glassesImg]);

  // Loop detection for webcam
  useEffect(() => {
    let interval;
    if (inputMode === 'webcam' && videoRef.current && glassesImg) {
      interval = setInterval(detectFaceAndDraw, 200);
    }
    return () => clearInterval(interval);
  }, [inputMode, glassesImg]);


  // Handle image upload
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    const url = URL.createObjectURL(file);
    setInputMode('upload');

    // Set handler before setting src
    imageRef.current.onload = () => {
      detectFaceAndDraw();
    };

    imageRef.current.src = url;
  };


  // Core detection and drawing
  const detectFaceAndDraw = async () => {
  const input = inputMode === 'upload' ? imageRef.current : videoRef.current;
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
    .withFaceLandmarks();

  detections.forEach((det) => {
    const landmarks = det.landmarks;
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();

    // Average of eye center points
    const left = leftEye.reduce((acc, pt) => ({
      x: acc.x + pt.x,
      y: acc.y + pt.y
    }), { x: 0, y: 0 });
    const right = rightEye.reduce((acc, pt) => ({
      x: acc.x + pt.x,
      y: acc.y + pt.y
    }), { x: 0, y: 0 });

    const eyeCenterX = (left.x / leftEye.length + right.x / rightEye.length) / 2;
    const eyeCenterY = (left.y / leftEye.length + right.y / rightEye.length) / 2;

    const dx = (right.x / rightEye.length) - (left.x / leftEye.length);
    const dy = (right.y / rightEye.length) - (left.y / leftEye.length);
    const angle = Math.atan2(dy, dx);

    const glassesWidth = Math.sqrt(dx * dx + dy * dy) * 2.5;
    const glassesHeight = glassesWidth / 2.5;

    if (glassesImg) {
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
    }
  });
};
  // Snapshot
  const handleSnapshot = () => {
      const canvas = canvasRef.current;
      const link = document.createElement('a');
      link.download = 'tryon-snapshot.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    };

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold">AI Glasses Try-On</h2>

      <div className="flex space-x-4 items-center">
        <button onClick={startWebcam} className="bg-blue-500 text-white px-4 py-2 rounded">Use Webcam</button>
        <input type="file" accept="image/*" onChange={handleImageUpload} />
        <select onChange={e => setSelectedGlasses(e.target.value)} value={selectedGlasses} className="border px-2 py-1">
          <option value="/glasses1.png">Concept</option>
          <option value="/glasses2.png">Rotem</option>
          <option value="/glasses3.png">PrimRose</option>
          <option value="/glasses4.png">Terminal</option>
          <option value="/glasses5.png">Identity</option>
          <option value="/glasses6.png">Roaring</option>
        </select>
        <button onClick={handleSnapshot} className="bg-green-600 text-white px-4 py-2 rounded">Save Snapshot</button>
      </div>

      <div className="relative w-full max-w-[600px]">
        {inputMode === 'webcam' ? (
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            onPlay={detectFaceAndDraw}
            className={`w-full rounded ${mirror ? 'scale-x-[-1]' : ''}`}
          />
        ) : (
          <img
            ref={imageRef}
            alt="Uploaded preview"
            className="w-full rounded"
          />
        )}
        <canvas
          ref={canvasRef}
          className={`absolute top-0 left-0 w-full h-full pointer-events-none ${inputMode === 'webcam' && mirror ? 'scale-x-[-1]' : ''}`}
        />
      </div>

    </div>
  );
}
