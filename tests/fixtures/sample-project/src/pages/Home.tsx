import React, { useEffect, useState } from 'react';
import { ProductCard } from '../components/ProductCard';
import { fetchProducts } from '../api/products';

interface Product {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
}

// 정책: 홈 화면은 최대 20개의 상품만 표시합니다.
export const Home: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    const loadProducts = async () => {
      const data = await fetchProducts();
      setProducts(data.slice(0, 20));
    };
    loadProducts();
  }, []);

  return (
    <div className="home">
      <h1>Welcome to Kurly</h1>
      <div className="product-grid">
        {products.map(product => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
};
