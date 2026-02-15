import React from 'react';

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    price: number;
    imageUrl: string;
  };
}

// 정책: 상품 카드에는 반드시 상품 이미지, 이름, 가격이 표시되어야 합니다.
export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  return (
    <div className="product-card">
      <img src={product.imageUrl} alt={product.name} />
      <h3>{product.name}</h3>
      <span className="price">{product.price.toLocaleString()}원</span>
    </div>
  );
};
