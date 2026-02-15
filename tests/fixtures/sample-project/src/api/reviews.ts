// 정책: 리뷰 API는 인증된 사용자만 접근 가능합니다.

export async function fetchReviews(productId: string) {
  const response = await fetch(`/api/v1/products/${productId}/reviews`);
  return response.json();
}

export async function submitReview(productId: string, content: string) {
  const response = await fetch(`/api/v1/products/${productId}/reviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  return response.json();
}

export async function deleteReview(reviewId: string) {
  await fetch(`/api/v1/reviews/${reviewId}`, {
    method: 'DELETE',
  });
}
