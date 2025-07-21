import { Link } from 'react-router-dom'
import { useCart } from '../context/CartContext'

export default function Header() {
  const { cartItems } = useCart()

  return (
    <nav className="bg-black text-white p-4 flex justify-between items-center">
      <h1 className="text-xl font-bold"> EyeMate </h1>
      <div className="flex items-center gap-6">
        <Link to="/">Home</Link>
        <Link to="/products">Products</Link>
        <Link to="/tryon">Try Room</Link>
        <Link to="/cart" className="relative">
          🛒 
          {cartItems.length > 0 && (
            <span className="ml-1 bg-red-600 text-white text-xs px-2 rounded-full">
              {cartItems.length}
            </span>
          )}
        </Link>
      </div>
    </nav>
  )
}
