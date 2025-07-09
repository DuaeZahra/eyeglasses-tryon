import React, { useRef, useState, useEffect } from 'react'
import * as faceapi from 'face-api.js'
import { useSelectedGlasses } from '../context/SelectedGlassesContext'

export default function TryOn() {
  const videoRef = useRef()
  const imageRef = useRef()
  const canvasRef = useRef()
  const { selectedImage, setSelectedImage } = useSelectedGlasses()
  const [glassesImg, setGlassesImg] = useState(null)
  const [imageURL, setImageURL] = useState(null)
  const [useWebcam, setUseWebcam] = useState(true)

  // Load face-api models
  useEffect(() => {
    const loadModels = async () => {
      const MODEL_URL = '/models'
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      ])
    }
    loadModels()
  }, [])

  // Load glasses image
  useEffect(() => {
    const img = new Image()
    img.src = selectedImage
    img.onload = () => setGlassesImg(img)
  }, [selectedImage])

  // Start webcam
  useEffect(() => {
    if (useWebcam) {
      navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
        videoRef.current.srcObject = stream
      })
    }
  }, [useWebcam])

  // Draw glasses on detected face
  const detectFaceAndDraw = async (input) => {
    const canvas = canvasRef.current
    const displaySize = { width: input.width, height: input.height }

    faceapi.matchDimensions(canvas, displaySize)

    const detections = await faceapi
      .detectSingleFace(input, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()

    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(input, 0, 0, canvas.width, canvas.height)

    if (detections && glassesImg) {
      const landmarks = detections.landmarks
      const leftEye = landmarks.getLeftEye()
      const rightEye = landmarks.getRightEye()

      const eyeCenterX = (leftEye[0].x + rightEye[3].x) / 2
      const eyeCenterY = (leftEye[0].y + rightEye[3].y) / 2
      const eyeDist = Math.abs(rightEye[3].x - leftEye[0].x)
      const glassesWidth = eyeDist * 2
      const glassesHeight = glassesWidth / 3

      ctx.drawImage(
        glassesImg,
        eyeCenterX - glassesWidth / 2,
        eyeCenterY - glassesHeight / 2,
        glassesWidth,
        glassesHeight
      )
    }
  }

  // Live webcam draw loop
  useEffect(() => {
    if (!useWebcam || !glassesImg) return

    const interval = setInterval(() => {
      const video = videoRef.current
      if (video && video.readyState === 4) {
        detectFaceAndDraw(video)
      }
    }, 300)

    return () => clearInterval(interval)
  }, [glassesImg, useWebcam])

  // Re-draw glasses on image when selection changes
  useEffect(() => {
    if (!useWebcam && imageRef.current?.complete) {
      detectFaceAndDraw(imageRef.current)
    }
  }, [selectedImage])

  // When a new image is uploaded
  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = () => {
        setUseWebcam(false)
        setImageURL(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleImageLoad = () => {
    detectFaceAndDraw(imageRef.current)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-white py-10 px-4 flex flex-col items-center">
      <h2 className="text-4xl font-bold text-gray-800 mb-6">🕶️ AI Glasses Try-Room</h2>

      <div className="bg-white shadow-xl rounded-xl p-6 w-full max-w-3xl">
        {/* Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
          <div className="flex gap-3">
            <button
              onClick={() => setUseWebcam(true)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition duration-200 ${
                useWebcam
                  ? 'bg-black text-white'
                  : 'bg-gray-200 hover:bg-gray-300 text-black'
              }`}
            >
              Use Webcam
            </button>
            <label className="cursor-pointer px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-xl text-sm font-medium">
              Upload Image
              <input type="file" accept="image/*" onChange={handleFileChange} hidden />
            </label>
          </div>

          {/* Dropdown */}
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

        {/* Preview Area */}
        <div className="relative w-full aspect-video rounded-lg overflow-hidden shadow-md border border-gray-300 bg-gray-100">
          {useWebcam ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              width="640"
              height="480"
              className="absolute top-0 left-0 w-full h-full object-cover"
            />
          ) : (
            imageURL && (
              <img
                ref={imageRef}
                src={imageURL}
                alt="Uploaded"
                onLoad={handleImageLoad}
                className="hidden"
              />
            )
          )}
          <canvas
            ref={canvasRef}
            width="640"
            height="480"
            className="absolute top-0 left-0 w-full h-full z-10"
          />
        </div>
      </div>
    </div>
  )
}
