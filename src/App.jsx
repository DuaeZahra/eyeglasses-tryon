import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import GenderSelection from './pages/genderselection';
import Products from './pages/Products';
import TryOn from './pages/TryOn';
import Cart from './pages/Cart';
import Header from './components/Header'; 

function App() {
  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/products" element={<GenderSelection />} />
        <Route path="/products/:gender" element={<Products />} />
        <Route path="/tryon" element={<TryOn />} />
        <Route path="/cart" element={<Cart />} />
      </Routes>
    </>
  );
}

export default App;
