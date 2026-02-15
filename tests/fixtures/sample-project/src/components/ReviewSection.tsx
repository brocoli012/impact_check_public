import React, { useEffect, useState } from 'react';
import { fetchReviews, submitReview } from '../api/reviews';

interface Review {
  id: string;
  author: string;
  rating: number;
  content: string;
}

interface ReviewSectionProps {
  productId: string;
}

// 정책: 리뷰는 최소 10자 이상이어야 합니다.
// @policy 리뷰 작성 시 비속어 필터링을 적용해야 합니다.

export const ReviewSection: React.FC<ReviewSectionProps> = ({ productId }) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [newReview, setNewReview] = useState('');

  useEffect(() => {
    loadReviews();
  }, [productId]);

  async function loadReviews(): Promise<void> {
    const data = await fetchReviews(productId);
    setReviews(data);
  }

  async function handleSubmit(): Promise<void> {
    if (newReview.length < 10) {
      alert('리뷰는 최소 10자 이상이어야 합니다.');
      return;
    }
    await submitReview(productId, newReview);
    setNewReview('');
    await loadReviews();
  }

  return (
    <div className="review-section">
      <h2>Reviews</h2>
      {reviews.map(review => (
        <div key={review.id} className="review">
          <strong>{review.author}</strong>
          <span>{review.rating}/5</span>
          <p>{review.content}</p>
        </div>
      ))}
      <textarea
        value={newReview}
        onChange={e => setNewReview(e.target.value)}
        placeholder="Write a review..."
      />
      <button onClick={handleSubmit}>Submit Review</button>
    </div>
  );
};
