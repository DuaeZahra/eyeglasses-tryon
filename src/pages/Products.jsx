import { useParams } from 'react-router-dom';
import products from '../data/products';
import { useCart } from '../context/CartContext';
import { useNavigate } from 'react-router-dom';
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
  <div className="flex flex-col gap-6 p-6 items-center">
    {filtered.map((p) => (
      <div key={p.id} className="w-full max-w-md border rounded shadow p-4 text-center bg-white">
        <img src={p.image} alt={p.name} className="h-32 mx-auto" />
        <h3 className="mt-2 font-semibold text-lg">{p.name}</h3>
        <p className="text-gray-600 text-sm">PKR {p.price.toLocaleString()}</p>

        <div className="mt-4 flex flex-col gap-2">
          <button
            onClick={() => addToCart(p)}
            className="bg-blue-600 text-white py-1 rounded hover:bg-blue-700"
          >
            Add to Cart
          </button>
          <button
            onClick={() => handleTryOn(p.image, p.gender)}
            className="border border-blue-600 text-blue-600 py-1 rounded hover:bg-blue-50"
          >
            Try On
          </button>
        </div>
      </div>
    ))}
  </div>
  );

}
