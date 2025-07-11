import React, { useRef, useState, useEffect } from 'react';
import * as faceapi from 'face-api.js';
import { useSelectedGlasses } from '../context/SelectedGlassesContext';

export default function TryOn() {
  const videoRef = useRef();
  const imageRef = useRef();
  const canvasRef = useRef();
  const [inputMode, setInputMode] = useState('webcam');
  const [selectedGlasses, setSelectedGlasses] = useState('/glasses1.png');
  const [glassesImg, setGlassesImg] = useState(null);
  const [mirror, setMirror] = useState(true);
  const { selectedImage } = useSelectedGlasses();

  useEffect(() => {
    const loadModels = async () => {
      await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
      await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
    };
    loadModels();
  }, []);

  useEffect(() => {
    if (selectedImage) setSelectedGlasses(selectedImage);
  }, [selectedImage]);

  useEffect(() => {
    const img = new Image();
    img.src = selectedGlasses;
    img.onload = () => setGlassesImg(img);
  }, [selectedGlasses]);

  useEffect(() => {
    if (inputMode === 'upload' && imageRef.current?.complete && glassesImg) {
      detectFaceAndDraw();
    }
  }, [inputMode, glassesImg]);

  const startWebcam = async () => {
    setInputMode('webcam');
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    videoRef.current.srcObject = stream;
  };
  
  useEffect(() => {
    let interval;
    if (inputMode === 'webcam' && videoRef.current && glassesImg) {
      interval = setInterval(detectFaceAndDraw, 200);
    }
    return () => clearInterval(interval);
  }, [inputMode, glassesImg]);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    const url = URL.createObjectURL(file);
    setInputMode('upload');
    imageRef.current.onload = () => detectFaceAndDraw();
    imageRef.current.src = url;
  };

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

  const handleSnapshot = () => {
    const canvas = canvasRef.current;
    const link = document.createElement('a');
    link.download = 'tryon-snapshot.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="min-h-screen flex justify-center items-start py-10 px-4 bg-gradient-to-b from-blue-100 via-blue-50 to-white">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-lg p-6 space-y-6 border border-blue-100">
        <h2 className="text-3xl font-bold text-blue-700 text-center">👓 AI Glasses Try-On</h2>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex flex-wrap gap-3">
            <button
              onClick={startWebcam}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow"
            >
              Use Webcam
            </button>
            <label className="cursor-pointer bg-white border border-gray-300 hover:bg-gray-100 px-4 py-2 rounded-lg shadow-sm">
              Upload Image
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </label>
            <select
              onChange={(e) => setSelectedGlasses(e.target.value)}
              value={selectedGlasses}
              className="border border-gray-300 px-3 py-2 rounded-lg shadow-sm bg-white text-gray-800"
            >
              <option value="/glasses1.png">Concept</option>
              <option value="/glasses2.png">Rotem</option>
              <option value="/glasses3.png">PrimRose</option>
              <option value="/glasses4.png">Terminal</option>
              <option value="/glasses5.png">Identity</option>
              <option value="/glasses6.png">Roaring</option>
            </select>
            <button
              onClick={handleSnapshot}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg shadow"
            >
              Save Snapshot
            </button>
          </div>
        </div>

        <div className="relative w-full aspect-video rounded-xl overflow-hidden border-2 border-blue-200 bg-gray-50">
          {inputMode === 'webcam' ? (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              onPlay={detectFaceAndDraw}
              className={`w-full h-full object-cover ${mirror ? 'scale-x-[-1]' : ''}`}
            />
          ) : (
            <img
              ref={imageRef}
              alt="Uploaded preview"
              className="w-full h-full object-cover"
            />
          )}
          <canvas
            ref={canvasRef}
            className={`absolute top-0 left-0 w-full h-full pointer-events-none ${inputMode === 'webcam' && mirror ? 'scale-x-[-1]' : ''}`}
          />
        </div>
      </div>
    </div>
  );
}
