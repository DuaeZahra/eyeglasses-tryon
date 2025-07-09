import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSelectedGlasses } from '../context/SelectedGlassesContext'

const heroImages = [
  { src: '/glasses1.png', name: 'Concept' },
  { src: '/glasses2.png', name: 'Rotem' },
  { src: '/glasses3.png', name: 'PrimRose' },
  { src: '/glasses4.png', name: 'Terminal' },
  { src: '/glasses5.png', name: 'Identity' },
  { src: '/glasses6.png', name: 'Roaring' },
]


export default function Home() {
  const [currentImage, setCurrentImage] = useState(0)
  const [isHovered, setIsHovered] = useState(false)
  const navigate = useNavigate()
  const { setSelectedImage } = useSelectedGlasses()

  useEffect(() => {
    if (isHovered) return
    const interval = setInterval(() => {
      setCurrentImage((prev) => (prev + 1) % heroImages.length)
    }, 2500)
    return () => clearInterval(interval)
  }, [isHovered])

  const handlePrev = () => {
    setCurrentImage((prev) => (prev - 1 + heroImages.length) % heroImages.length)
  }

  const handleNext = () => {
    setCurrentImage((prev) => (prev + 1) % heroImages.length)
  }

  const handleClick = (imgSrc) => {
    setSelectedImage(imgSrc)
    navigate('/tryon')
  }

  return (
    <div className="min-h-[85vh] px-6 py-12 flex flex-col-reverse lg:flex-row items-center justify-center gap-12 overflow-hidden">
      {/* Text Section */}
      <div className="max-w-xl text-center lg:text-left">
        <h1 className="text-4xl md:text-5xl font-extrabold text-gray-800 leading-tight">
          Welcome to <span className="text-blue-600">EyeGlasses Store</span>
        </h1>
        <p className="mt-4 text-lg md:text-xl text-gray-600">
          Explore our collection of stylish eyeglass frames and experience the future of eyewear shopping.
          <br />
          With our <span className="font-medium text-black"> Virtual tryroom</span>, you can preview frames in real-time using your webcam or uploaded image — all before making a purchase.
        </p>

        <div className="mt-6 flex flex-col sm:flex-row sm:justify-start gap-4">
          <a
            href="/products"
            className="bg-blue-600 text-white px-6 py-3 rounded-lg shadow hover:bg-blue-700 transition"
          >
            Browse Frames
          </a>
          <a
            href="/tryon"
            className="border border-blue-600 text-blue-600 px-6 py-3 rounded-lg hover:bg-blue-50 transition"
          >
            Try Now
          </a>
        </div>
      </div>

      {/* Slider */}
      <div
        className="relative w-full max-w-md h-72 overflow-hidden rounded-xl shadow-lg border border-gray-200 bg-white group"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Slide Images */}
        {heroImages.map((img, index) => (
          <img
            key={index}
            src={img.src}
            alt={img.name}
            onClick={() => handleClick(img.src)}
            className={`absolute top-0 left-0 w-full h-full object-contain transition-opacity duration-700 cursor-pointer ${
              index === currentImage ? 'opacity-100 z-20' : 'opacity-0 pointer-events-none z-10'
            }`}
          />
        ))}

        {/* Left Button */}
        <button
          onClick={handlePrev}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-30 bg-white/70 hover:bg-white text-black rounded-full p-2 shadow hidden group-hover:block"
        >
          ‹
        </button>

        {/* Right Button */}
        <button
          onClick={handleNext}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-30 bg-white/70 hover:bg-white text-black rounded-full p-2 shadow hidden group-hover:block"
        >
          ›
        </button>

        {/* Dots */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 z-30">
          {heroImages.map((_, i) => (
            <div
              key={i}
              className={`h-2 w-2 rounded-full ${
                i === currentImage ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
