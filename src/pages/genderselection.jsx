import { useNavigate } from 'react-router-dom';

export default function GenderSelection() {
  const navigate = useNavigate();

  const handleSelect = (gender) => {
    navigate(`/products/${gender}`);
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background Image */}
      <img
        src="/background.png"
        alt="Background"
        className="absolute inset-0 w-full h-full object-cover -z-20"
      />

      {/* Optional soft overlay for contrast */}
      <div className="absolute inset-0 bg-white/60 backdrop-blur-md -z-10" />

      {/* Page Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen gap-10 text-center p-8">
        <h2 className="text-4xl font-bold text-gray-800">Choose Your Collection</h2>

        <div className="flex flex-col sm:flex-row gap-8">
          {/* Men */}
          <div
            onClick={() => handleSelect('men')}
            className="w-64 cursor-pointer border border-blue-200 rounded-xl shadow-md hover:shadow-lg transition transform hover:-translate-y-1 bg-white/90 backdrop-blur-sm group"
          >
            <img
              src="/men.png"
              alt="Men's Collection"
              className="rounded-t-xl w-full h-48 object-cover group-hover:brightness-90 transition"
            />
            <div className="p-4">
              <h3 className="text-xl font-semibold text-blue-700 group-hover:text-blue-800 transition">
                For Men
              </h3>
              <p className="text-sm text-gray-500 mt-1">Explore bold, confident frames</p>
            </div>
          </div>

          {/* Women */}
          <div
            onClick={() => handleSelect('women')}
            className="w-64 cursor-pointer border border-pink-200 rounded-xl shadow-md hover:shadow-lg transition transform hover:-translate-y-1 bg-white/90 backdrop-blur-sm group"
          >
            <img
              src="/women.png"
              alt="Women's Collection"
              className="rounded-t-xl w-full h-48 object-cover group-hover:brightness-90 transition"
            />
            <div className="p-4">
              <h3 className="text-xl font-semibold text-pink-600 group-hover:text-pink-700 transition">
                For Women
              </h3>
              <p className="text-sm text-gray-500 mt-1">Discover elegant, trendy styles</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
