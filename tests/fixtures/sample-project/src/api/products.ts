import axios from 'axios';

const API_BASE = '/api/v1';

export async function fetchProducts() {
  const response = await axios.get(`${API_BASE}/products`);
  return response.data;
}

export async function fetchProductById(id: string) {
  const response = await axios.get(`${API_BASE}/products/${id}`);
  return response.data;
}

export async function createProduct(data: { name: string; price: number }) {
  const response = await axios.post(`${API_BASE}/products`, data);
  return response.data;
}
