import products from '../data/products'

export default function Products() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6">
      {products.map((p) => (
        <div key={p.id} className="border rounded shadow p-4 text-center">
          <img src={p.image} alt={p.name} className="h-32 mx-auto" />
          <h3 className="mt-2 font-semibold">{p.name}</h3>
        </div>
      ))}
    </div>
  )
}
