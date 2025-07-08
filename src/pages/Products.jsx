import products from '../data/products'
import { useCart } from '../context/CartContext'

export default function Products() {
  const { addToCart } = useCart()

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6">
      {products.map((p) => (
        <div key={p.id} className="border rounded shadow p-4 text-center">
          <img src={p.image} alt={p.name} className="h-32 mx-auto" />
          <h3 className="mt-2 font-semibold text-lg">{p.name}</h3>
          <p className="text-gray-600 text-sm mt-1">PKR {p.price.toLocaleString()}</p>
          <button
            onClick={() => addToCart(p)}
            className="mt-3 bg-blue-600 text-white px-4 py-1 rounded hover:bg-blue-700"
          >
            Add to Cart
          </button>
        </div>
      ))}
    </div>
  )
}
