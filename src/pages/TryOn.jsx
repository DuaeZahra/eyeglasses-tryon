import React, { useRef, useState, useEffect } from 'react';
import * as faceapi from 'face-api.js';

export default function TryOn() {
  const videoRef = useRef();
  const imageRef = useRef();
  const canvasRef = useRef();
  const cachedImages = useRef({}); // Cache for glasses images
  const cachedFrameRef = useRef(null); // Cache for last drawn frame
  const faceCache = useRef(null); // Cache for detected faces

  const [imageURL, setImageURL] = useState(null);
  const [useWebcam, setUseWebcam] = useState(true);
  const [mirror, setMirror] = useState(true);
  const [loadingWebcam, setLoadingWebcam] = useState(false);
  const [genderSeats, setGenderSeats] = useState([]);

  const allOptions = [
    { label: 'Concept', value: '/glasses1.png', gender: 'male' },
    { label: 'Rotem', value: '/glasses2.png', gender: 'male' },
    { label: 'PrimRose', value: '/glasses3.png', gender: 'male' },
    { label: 'Terminal', value: '/glasses4.png', gender: 'female' },
    { label: 'Identity', value: '/glasses5.png', gender: 'female' },
    { label: 'Roaring', value: '/glasses6.png', gender: 'female' },
  ];

  const [selectedByGender, setSelectedByGender] = useState({
    male: allOptions.find(o => o.gender === 'male')?.value,
    female: allOptions.find(o => o.gender === 'female')?.value,
  });

  // Load models and preload glasses images
  useEffect(() => {
    (async () => {
      await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
      await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
      await faceapi.nets.ageGenderNet.loadFromUri('/models');

      allOptions.forEach(opt => {
        const img = new Image();
        img.src = opt.value;
        img.onload = () => {
          cachedImages.current[opt.value] = img;
        };
      });
    })();
  }, []);

  // Webcam handling
  useEffect(() => {
    if (useWebcam) {
      setImageURL(null);
      startWebcam();
    } else {
      stopWebcam();
    }
  }, [useWebcam]);

  // Detect for uploaded image
  useEffect(() => {
    if (!useWebcam && imageURL) detectAndCacheFaces();
  }, [useWebcam, imageURL]);

  // Redraw if dropdown changes
  useEffect(() => {
    if (!useWebcam && imageURL && faceCache.current) {
      drawLoop();
    }
  }, [selectedByGender]);

  // Webcam detection and draw loop
  useEffect(() => {
    let interval;
    if (useWebcam) {
      interval = setInterval(async () => {
        await detectAndCacheFaces();
        drawLoop();
      }, 200);
    }
    return () => clearInterval(interval);
  }, [useWebcam, selectedByGender]);

  const startWebcam = async () => {
    setLoadingWebcam(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current.play();
        setLoadingWebcam(false);
      };
    } catch {
      setLoadingWebcam(false);
    }
  };

  const stopWebcam = () => {
    const stream = videoRef.current?.srcObject;
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const handleFile = e => {
    const f = e.target.files?.[0];
    if (f) {
      const r = new FileReader();
      r.onload = () => {
        setUseWebcam(false);
        setImageURL(r.result);
      };
      r.readAsDataURL(f);
    }
  };

  const snapshot = () => {
    const c = canvasRef.current;
    if (!c) return;
    const s = document.createElement('canvas');
    s.width = c.width;
    s.height = c.height;
    const ctx = s.getContext('2d');
    if (useWebcam && mirror) {
      ctx.translate(s.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(c, 0, 0);
    const a = document.createElement('a');
    a.download = 'tryon.png';
    a.href = s.toDataURL('image/png');
    a.click();
  };

  const detectAndCacheFaces = async () => {
    const input = useWebcam ? videoRef.current : imageRef.current;
    if (!input) return;

    const w = input.videoWidth || input.naturalWidth;
    const h = input.videoHeight || input.naturalHeight;
    if (!w || !h) return;

    const results = await faceapi
      .detectAllFaces(input, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withAgeAndGender();

    // Cache detected faces
    faceCache.current = results;
    setGenderSeats([...new Set(results.map(det => det.gender))]);
  };

  const drawLoop = () => {
  const input = useWebcam ? videoRef.current : imageRef.current;
  if (!input) return;

  const c = canvasRef.current;
  const ctx = c.getContext('2d');
  const w = input.videoWidth || input.naturalWidth;
  const h = input.videoHeight || input.naturalHeight;

  c.width = w;
  c.height = h;

  // Always draw current input frame
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(input, 0, 0, w, h);

  // If no faces are detected, reuse the last cached frame
  if (!faceCache.current || faceCache.current.length === 0) {
    if (cachedFrameRef.current) {
      ctx.drawImage(cachedFrameRef.current, 0, 0, w, h);
    }
    return;
  }

  // Draw glasses for each detected face
  faceCache.current.forEach(det => {
    const gender = det.gender === 'male' ? 'male' : 'female';
    const le = det.landmarks.getLeftEye();
    const re = det.landmarks.getRightEye();
    const left = le.reduce((a, p) => ({ x: a.x + p.x, y: a.y + p.y }), { x: 0, y: 0 });
    const right = re.reduce((a, p) => ({ x: a.x + p.x, y: a.y + p.y }), { x: 0, y: 0 });

    const cx = (left.x / le.length + right.x / re.length) / 2;
    const cy = (left.y / le.length + right.y / re.length) / 2;
    const dx = right.x / re.length - left.x / le.length;
    const dy = right.y / re.length - left.y / le.length;
    const angle = Math.atan2(dy, dx);
    const gw = Math.hypot(dx, dy) * 2.5;
    const gh = gw / 2.5;

    const glassesImg = cachedImages.current[selectedByGender[gender]];
    if (glassesImg) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.drawImage(glassesImg, -gw / 2, -gh / 2, gw, gh);
      ctx.restore();
    }
  });

  // Cache this fully rendered frame
  cachedFrameRef.current = document.createElement('canvas');
  cachedFrameRef.current.width = w;
  cachedFrameRef.current.height = h;
  cachedFrameRef.current.getContext('2d').drawImage(c, 0, 0, w, h);
};


  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background */}
      <img src="/background.png" alt="Background" className="absolute inset-0 w-full h-full object-cover -z-20" />
      <div className="absolute inset-0 bg-white/60 backdrop-blur-md -z-10" />

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center py-10 px-4">
        <h1 className="text-3xl font-bold text-blue-700 mb-6">TryRoom for the EyeGlasses</h1>

        <div className="flex flex-wrap gap-4 justify-center mb-6">
          <button onClick={() => setUseWebcam(true)}
            className={`px-5 py-2 rounded-lg text-white shadow ${useWebcam ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}>
            Use Webcam
          </button>
          <label className="cursor-pointer bg-white border px-5 py-2 rounded-lg shadow">
            Upload Image
            <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
          </label>
          <button onClick={snapshot}
            className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg shadow">
            Save Snapshot
          </button>
        </div>

        {/* Gender-based Glasses Dropdowns */}
        <div className="flex flex-wrap justify-center gap-6 mb-6">
          {genderSeats.includes('male') && (
            <div className="text-center">
              <label className="block mb-1 font-medium">Male Glasses:</label>
              <select
                value={selectedByGender.male}
                onChange={e => setSelectedByGender(prev => ({ ...prev, male: e.target.value }))}
                className="px-4 py-2 border rounded-md shadow">
                {allOptions.filter(o => o.gender === 'male').map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          )}
          {genderSeats.includes('female') && (
            <div className="text-center">
              <label className="block mb-1 font-medium">Female Glasses:</label>
              <select
                value={selectedByGender.female}
                onChange={e => setSelectedByGender(prev => ({ ...prev, female: e.target.value }))}
                className="px-4 py-2 border rounded-md shadow">
                {allOptions.filter(o => o.gender === 'female').map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Video / Canvas Preview */}
        <div className="relative w-full max-w-3xl aspect-video border rounded-xl overflow-hidden bg-white shadow">
          {useWebcam ? (
            <video ref={videoRef} autoPlay muted playsInline className={`w-full h-full object-cover ${mirror ? 'scale-x-[-1]' : ''}`} />
          ) : (
            <img ref={imageRef} src={imageURL} alt="Uploaded" className="w-full h-full object-cover" />
          )}
          <canvas ref={canvasRef} className={`absolute top-0 left-0 w-full h-full pointer-events-none ${useWebcam && mirror ? 'scale-x-[-1]' : ''}`} />
          {loadingWebcam && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70 z-30">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

  
