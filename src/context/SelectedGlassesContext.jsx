import { createContext, useContext, useState } from 'react';

const SelectedGlassesContext = createContext();

export const SelectedGlassesProvider = ({ children }) => {
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedImage, setSelectedImage] = useState('/glasses1.obj'); // Set to a valid model path

  return (
    <SelectedGlassesContext.Provider value={{ selectedProduct, setSelectedProduct, selectedImage, setSelectedImage }}>
      {children}
    </SelectedGlassesContext.Provider>
  );
};

export const useSelectedGlasses = () => useContext(SelectedGlassesContext);