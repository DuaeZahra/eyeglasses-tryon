import React, { useRef, useEffect, useState } from 'react'
import * as faceapi from 'face-api.js'

export default function TryOn() {
  const videoRef = useRef()
  const canvasRef = useRef()
  const [glasses, setGlasses] = useState('/glasses1.png')
  const [glassesImg, setGlassesImg] = useState(null)

  // Load models once
  useEffect(() => {
    const loadModels = async () => {
      const MODEL_URL = '/models'
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL)
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL)
      console.log('Models loaded')
    }
    loadModels()
  }, [])

  // Start webcam
  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: {} }).then((stream) => {
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    })
  }, [])

  // Load glasses image when selection changes
  useEffect(() => {
    const img = new Image()
    img.src = glasses
    img.onload = () => {
      setGlassesImg(img)
    }
  }, [glasses])

  // Run detection and draw overlay
  const handlePlay = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    const displaySize = { width: video.width, height: video.height }

    faceapi.matchDimensions(canvas, displaySize)

    setInterval(async () => {
      const detections = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()

      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      if (detections && glassesImg) {
        const resized = faceapi.resizeResults(detections, displaySize)
        const landmarks = resized.landmarks

        const leftEye = landmarks.getLeftEye()
        const rightEye = landmarks.getRightEye()

        const eyeMidX = (leftEye[0].x + rightEye[3].x) / 2
        const eyeMidY = (leftEye[0].y + rightEye[3].y) / 2
        const eyeWidth = Math.abs(rightEye[3].x - leftEye[0].x) * 1.6

        ctx.drawImage(
          glassesImg,
          eyeMidX - eyeWidth / 2,
          eyeMidY - eyeWidth / 3,
          eyeWidth,
          eyeWidth / 2
        )
      }
    }, 300)
  }

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-4">Try on Glasses (Live Camera)</h2>

      <div className="relative inline-block">
        <video
          ref={videoRef}
          autoPlay
          muted
          width="640"
          height="480"
          onPlay={handlePlay}
          className="rounded border"
        />
        <canvas
          ref={canvasRef}
          width="640"
          height="480"
          className="absolute top-0 left-0 pointer-events-none"
        />
      </div>

      <div className="mt-4">
        <label className="mr-2">Choose Glasses:</label>
        <select
          onChange={(e) => setGlasses(e.target.value)}
          className="border p-1 rounded"
          value={glasses}
        >
          <option value="/glasses1.png">Classic Black</option>
          <option value="/glasses2.png">Retro Round</option>
        </select>
      </div>
    </div>
  )
}
