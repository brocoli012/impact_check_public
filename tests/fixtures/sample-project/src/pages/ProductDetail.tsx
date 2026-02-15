import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ReviewSection } from '../components/ReviewSection';
import { fetchProductById } from '../api/products';
import { fetchReviews } from '../api/reviews';

interface ProductDetailData {
  id: string;
  name: string;
  price: number;
  description: string;
}

/* Policy: 상품 상세 페이지는 리뷰와 함께 표시되어야 합니다. */

export const ProductDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<ProductDetailData | null>(null);

  useEffect(() => {
    if (id) {
      loadProduct(id);
    }
  }, [id]);

  async function loadProduct(productId: string): Promise<void> {
    const data = await fetchProductById(productId);
    setProduct(data);
  }

  if (!product) return <div>Loading...</div>;

  return (
    <div className="product-detail">
      <h1>{product.name}</h1>
      <p className="price">{product.price.toLocaleString()}원</p>
      <p>{product.description}</p>
      <ReviewSection productId={product.id} />
    </div>
  );
};
