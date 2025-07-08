import products from '../data/products'
import { useCart } from '../context/CartContext'
import { useNavigate } from 'react-router-dom'
import { useSelectedGlasses } from '../context/SelectedGlassesContext'

export default function Products() {
  const { addToCart } = useCart()
  const { setSelectedImage } = useSelectedGlasses()
  const navigate = useNavigate()

  const handleTryOn = (image) => {
    setSelectedImage(image)
    navigate('/tryon')
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6">
      {products.map((p) => (
        <div key={p.id} className="border rounded shadow p-4 text-center bg-white">
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
              onClick={() => handleTryOn(p.image)}
              className="border border-blue-600 text-blue-600 py-1 rounded hover:bg-blue-50"
            >
              Try On
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
