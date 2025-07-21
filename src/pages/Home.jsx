import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const heroImages = [
  { src: '/glasses1.png', name: 'Concept' },
  { src: '/glasses2.png', name: 'Rotem' },
  { src: '/glasses3.png', name: 'PrimRose' },
  { src: '/glasses4.png', name: 'Terminal' },
  { src: '/glasses5.png', name: 'Identity' },
  { src: '/glasses6.png', name: 'Roaring' },
];

export default function Home() {
  const [currentImage, setCurrentImage] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (isHovered) return;
    const interval = setInterval(() => {
      setCurrentImage((prev) => (prev + 1) % heroImages.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [isHovered]);

  const handlePrev = () => {
    setCurrentImage((prev) => (prev - 1 + heroImages.length) % heroImages.length);
  };

  const handleNext = () => {
    setCurrentImage((prev) => (prev + 1) % heroImages.length);
  };

  const handleClick = () => {
  navigate('/tryon'); 
};


  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background Image */}
      <img
        src="/background.png"
        alt="Background"
        className="absolute inset-0 w-full h-full object-cover -z-20"
      />

      {/* Overlay */}
      <div className="absolute inset-0 bg-white/70 backdrop-blur-md -z-10" />

      {/* Centered Content */}
      <div className="relative z-10 flex items-center justify-center min-h-screen px-6">
        <div className="flex flex-col-reverse lg:flex-row items-center justify-center gap-16 w-full max-w-6xl">
          {/* Text Section */}
          <div className="max-w-xl text-center lg:text-left space-y-6">
            <h1 className="text-5xl font-extrabold text-gray-800 leading-tight">
              Welcome to <span className="text-blue-600">EyeMate</span>
            </h1>
            <p className="text-lg text-gray-600">
              Explore our collection of stylish eyeglass frames and experience the future of eyewear shopping.
              Try on frames in real-time with your webcam or an uploaded photo.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start pt-2">
              <button
              onClick={() => navigate('/products')}
              className="flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg shadow-md hover:bg-blue-700 transition"
            >
              Browse Frames
            </button>
            <button
              onClick={() => navigate('/tryon')}
              className="flex items-center justify-center gap-2 border border-blue-600 text-blue-600 px-6 py-3 rounded-lg hover:bg-blue-100 transition"
            >
              Try Now
            </button>

            </div>
          </div>

          {/* Slider */}
          <div
            className="relative w-full max-w-md h-80 overflow-hidden rounded-2xl shadow-md border border-gray-200 bg-white/80 backdrop-blur-sm group transition-all duration-300"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            {heroImages.map((img, index) => (
              <img
                key={index}
                src={img.src}
                alt={img.name}
                onClick={() => handleClick(img.src)}
                className={`absolute top-0 left-0 w-full h-full object-contain cursor-pointer transition-all duration-700 ease-in-out transform ${
                  index === currentImage
                    ? 'opacity-100 scale-100 z-20'
                    : 'opacity-0 scale-95 pointer-events-none z-10'
                }`}
              />
            ))}

            {/* Navigation Buttons */}
            <button
              onClick={handlePrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-30 bg-white/70 hover:bg-white text-black rounded-full p-2 shadow-sm transition hidden group-hover:block"
            >
              ‹
            </button>
            <button
              onClick={handleNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-30 bg-white/70 hover:bg-white text-black rounded-full p-2 shadow-sm transition hidden group-hover:block"
            >
              ›
            </button>

            {/* Dots */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 z-30">
              {heroImages.map((_, i) => (
                <div
                  key={i}
                  className={`h-2.5 w-2.5 rounded-full transition duration-300 ${
                    i === currentImage ? 'bg-blue-600 scale-110' : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
