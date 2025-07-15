import { useCart } from '../context/CartContext';

export default function Cart() {
  const {
    cartItems,
    removeFromCart,
    increaseQuantity,
    decreaseQuantity
  } = useCart();

  const total = cartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background */}
      <img
        src="/background.png"
        alt="Background"
        className="absolute inset-0 w-full h-full object-cover -z-20"
      />
      <div className="absolute inset-0 bg-white/60 backdrop-blur-md -z-10" />

      {/* Content */}
      <div className="relative z-10 p-6 max-w-3xl mx-auto min-h-screen">
        <h2 className="text-3xl font-bold mb-6 text-center text-gray-800">🛒 Your Cart</h2>

        {cartItems.length === 0 ? (
          <div className="text-center text-gray-500 text-lg">Your cart is empty.</div>
        ) : (
          <>
            <ul className="space-y-4">
              {cartItems.map((item, index) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-4 border border-gray-200 rounded-lg p-4 shadow-md bg-white/90 backdrop-blur-sm transition hover:shadow-lg"
                >
                  <img
                    src={item.image}
                    alt={item.name}
                    className="h-20 w-20 object-contain rounded"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-lg text-gray-800">{item.name}</p>

                    <div className="flex items-center gap-3 mt-1">
                      <button
                        onClick={() => decreaseQuantity(item.id)}
                        className="text-lg px-2 py-0.5 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
                        disabled={item.quantity <= 1}
                      >
                        –
                      </button>
                      <span className="font-semibold">{item.quantity}</span>
                      <button
                        onClick={() => increaseQuantity(item.id)}
                        className="text-lg px-2 py-0.5 bg-gray-200 rounded hover:bg-gray-300"
                      >
                        +
                      </button>
                    </div>

                    <p className="text-sm text-gray-600 mt-1">
                      Price: PKR {(item.price * item.quantity).toLocaleString()}
                    </p>
                  </div>

                  <button
                    onClick={() => removeFromCart(index)}
                    className="text-sm text-red-600 border border-red-500 px-3 py-1 rounded hover:bg-red-50 transition"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>

            <div className="mt-8 border-t pt-4 flex justify-end">
              <div className="bg-white/90 backdrop-blur-sm border border-gray-200 p-4 rounded-lg w-full md:w-1/2 text-right shadow">
                <p className="text-lg font-semibold text-gray-700">Total:</p>
                <p className="text-xl font-bold text-blue-700">
                  PKR {total.toLocaleString()}
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
