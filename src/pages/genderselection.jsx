import { useNavigate } from 'react-router-dom';

export default function GenderSelection() {
  const navigate = useNavigate();

  const handleSelect = (gender) => {
    navigate(`/products/${gender}`);
  };

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center gap-6 text-center p-6">
      <h2 className="text-3xl font-bold">Choose Your Collection</h2>
      <div className="flex gap-6">
        <button
          onClick={() => handleSelect('men')}
          className="px-6 py-3 border border-blue-600 text-blue-600 rounded hover:bg-blue-50 transition"
        >
          For Men
        </button>
        <button
          onClick={() => handleSelect('women')}
          className="px-6 py-3 border border-blue-600 text-blue-600 rounded hover:bg-blue-50 transition"
        >
          For Women
        </button>
      </div>
    </div>
  );
}
