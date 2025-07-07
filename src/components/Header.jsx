import { Link } from 'react-router-dom'

export default function Header() {
  return (
    <nav className="bg-black text-white p-4 flex justify-between">
      <h1 className="text-xl font-bold">🕶️ AI Eyewear</h1>
      <div className="space-x-4">
        <Link to="/">Home</Link>
        <Link to="/products">Products</Link>
        <Link to="/tryon">Try Room</Link>
      </div>
    </nav>
  )
}
