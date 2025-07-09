export default function Home() {
  return (
    <div className="min-h-[85vh] px-6 py-12 flex flex-col-reverse lg:flex-row items-center justify-center gap-12">
      {/* Text Section */}
      <div className="max-w-xl text-center lg:text-left">
        <h1 className="text-4xl md:text-5xl font-extrabold text-gray-800 leading-tight">
          Welcome to <span className="text-blue-600">EyeGlasses Store</span>
        </h1>
        <p className="mt-4 text-lg md:text-xl text-gray-600">
          Explore our collection of stylish eyeglass frames and experience the future of eyewear shopping.
          <br />
          With our <span className="font-medium text-black">Virtual tryroom</span>, you can preview frames in real-time using your webcam or uploaded image — all before making a purchase.
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

      {/* Image Section */}
      <div className="w-full max-w-md">
        <img
          src="/glasses.jpg"
          alt="Eyeglasses Preview"
          className="w-full object-contain"
        />
      </div>
    </div>
  )
}
