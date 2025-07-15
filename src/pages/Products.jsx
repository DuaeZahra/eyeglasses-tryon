import { useParams, useNavigate } from 'react-router-dom';
import products from '../data/products';
import { useCart } from '../context/CartContext';
import { useSelectedGlasses } from '../context/SelectedGlassesContext';

export default function Products() {
  const { gender } = useParams();
  const { addToCart } = useCart();
  const { setSelectedImage } = useSelectedGlasses();
  const navigate = useNavigate();

  const handleTryOn = (image, gender) => {
    setSelectedImage(image);
    navigate('/tryon', { state: { gender } });
  };

  const filtered = products.filter((p) => p.gender === gender);

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background Image */}
      <img
        src="/background.png"
        alt="Background"
        className="absolute inset-0 w-full h-full object-cover -z-20"
      />

      {/* Optional soft overlay */}
      <div className="absolute inset-0 bg-white/60 backdrop-blur-md -z-10" />

      {/* Page Content */}
      <div className="relative z-10 flex flex-col gap-8 px-6 py-12 items-center">
        <h2 className="text-3xl font-bold text-gray-800 capitalize">
          {gender} Collection
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 w-full max-w-6xl">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="bg-white/90 backdrop-blur-sm border border-gray-200 rounded-xl shadow-md p-4 flex flex-col items-center text-center transition hover:shadow-lg"
            >
              <img src={p.image} alt={p.name} className="h-32 object-contain mb-3" />
              <h3 className="text-lg font-semibold text-gray-800">{p.name}</h3>
              <p className="text-gray-600 text-sm mb-4">PKR {p.price.toLocaleString()}</p>

              <div className="flex flex-col w-full gap-2">
                <button
                  onClick={() => addToCart(p)}
                  className="bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition"
                >
                  Add to Cart
                </button>
                <button
                  onClick={() => handleTryOn(p.image, p.gender)}
                  className="border border-blue-600 text-blue-600 py-2 rounded-md hover:bg-blue-50 transition"
                >
                  Try On
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
