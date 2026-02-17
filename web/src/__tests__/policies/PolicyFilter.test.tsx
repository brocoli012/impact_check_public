/**
 * @module web/__tests__/policies/PolicyFilter.test
 * @description PolicyFilter 컴포넌트 렌더링 테스트
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import PolicyFilter from '../../components/policies/PolicyFilter';
import { usePolicyStore } from '../../stores/policyStore';

describe('PolicyFilter', () => {
  beforeEach(() => {
    usePolicyStore.setState({
      policies: [],
      selectedPolicy: null,
      categories: ['장바구니', '결제', '배송'],
      searchQuery: '',
      selectedCategory: null,
      loading: false,
      error: null,
    });
  });

  it('should render search input', () => {
    render(<PolicyFilter resultCount={5} totalCount={10} />);

    const input = screen.getByPlaceholderText('정책명, 설명 검색...');
    expect(input).toBeInTheDocument();
  });

  it('should render category label', () => {
    render(<PolicyFilter resultCount={5} totalCount={10} />);

    expect(screen.getByText('카테고리:')).toBeInTheDocument();
  });

  it('should render all category buttons', () => {
    render(<PolicyFilter resultCount={5} totalCount={10} />);

    expect(screen.getByText('전체')).toBeInTheDocument();
    expect(screen.getByText('장바구니')).toBeInTheDocument();
    expect(screen.getByText('결제')).toBeInTheDocument();
    expect(screen.getByText('배송')).toBeInTheDocument();
  });

  it('should render result count', () => {
    render(<PolicyFilter resultCount={3} totalCount={10} />);

    expect(screen.getByText('3 / 10건')).toBeInTheDocument();
  });

  it('should update search input on type', () => {
    render(<PolicyFilter resultCount={5} totalCount={10} />);

    const input = screen.getByPlaceholderText('정책명, 설명 검색...');
    fireEvent.change(input, { target: { value: '장바구니' } });

    expect(input).toHaveValue('장바구니');
  });

  it('should click category filter button', () => {
    render(<PolicyFilter resultCount={5} totalCount={10} />);

    const categoryButton = screen.getByText('결제');
    fireEvent.click(categoryButton);

    const state = usePolicyStore.getState();
    expect(state.selectedCategory).toBe('결제');
  });

  it('should click all button to clear category filter', () => {
    usePolicyStore.setState({ selectedCategory: '결제' });

    render(<PolicyFilter resultCount={5} totalCount={10} />);

    fireEvent.click(screen.getByText('전체'));

    const state = usePolicyStore.getState();
    expect(state.selectedCategory).toBeNull();
  });

  it('should highlight active category button', () => {
    usePolicyStore.setState({ selectedCategory: '배송' });

    render(<PolicyFilter resultCount={5} totalCount={10} />);

    const deliveryButton = screen.getByText('배송');
    expect(deliveryButton.className).toContain('bg-purple-100');
    expect(deliveryButton.className).toContain('text-purple-700');
  });

  it('should clear search on Escape key', () => {
    render(<PolicyFilter resultCount={5} totalCount={10} />);

    const input = screen.getByPlaceholderText('정책명, 설명 검색...');
    fireEvent.change(input, { target: { value: '테스트' } });
    expect(input).toHaveValue('테스트');

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input).toHaveValue('');
  });

  it('should show clear button when search has value', () => {
    render(<PolicyFilter resultCount={5} totalCount={10} />);

    const input = screen.getByPlaceholderText('정책명, 설명 검색...');
    fireEvent.change(input, { target: { value: '테스트' } });

    const clearButton = screen.getByLabelText('검색 초기화');
    expect(clearButton).toBeInTheDocument();
  });

  it('should clear search when clear button is clicked', () => {
    render(<PolicyFilter resultCount={5} totalCount={10} />);

    const input = screen.getByPlaceholderText('정책명, 설명 검색...');
    fireEvent.change(input, { target: { value: '테스트' } });

    const clearButton = screen.getByLabelText('검색 초기화');
    fireEvent.click(clearButton);

    expect(input).toHaveValue('');
  });
});
