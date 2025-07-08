export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center text-center min-h-[80vh] px-6">
      <h1 className="text-4xl md:text-5xl font-extrabold text-gray-800">
        Welcome to <span className="text-blue-600">Shades TryRoom</span>
      </h1>
      <p className="mt-4 text-lg md:text-xl text-gray-600 max-w-xl">
         Try on stylish eyeglass frames in real-time using your webcam or an uploaded image — powered by AI face detection and virtual overlays.  
  We offer you a seamless virtual try-on experience, helping you find the perfect frame that suits your style — effortlessly and confidently.
      </p>

      <div className="mt-6 space-x-4">
        <a
          href="/products"
          className="bg-blue-600 text-white px-6 py-2 rounded-lg shadow hover:bg-blue-700 transition"
        >
          Browse Frames
        </a>
        <a
          href="/tryon"
          className="border border-blue-600 text-blue-600 px-6 py-2 rounded-lg hover:bg-blue-50 transition"
        >
          Try Now
        </a>
      </div>
    </div>
  )
}
