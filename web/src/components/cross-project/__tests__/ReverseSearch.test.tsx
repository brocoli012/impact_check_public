/**
 * @module web/components/cross-project/__tests__/ReverseSearch.test
 * @description ReverseSearch 컴포넌트 단위 테스트 (Phase D: TASK-110)
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ReverseSearch from '../ReverseSearch';
import { useSharedEntityStore } from '../../../stores/sharedEntityStore';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ReverseSearch', () => {
  beforeEach(() => {
    useSharedEntityStore.getState().reset();
    mockFetch.mockReset();
  });

  it('should render search input and button', () => {
    render(<ReverseSearch />);
    expect(screen.getByTestId('reverse-search-input')).toBeInTheDocument();
    expect(screen.getByTestId('reverse-search-btn')).toBeInTheDocument();
  });

  it('should disable search button when input is empty', () => {
    render(<ReverseSearch />);
    const btn = screen.getByTestId('reverse-search-btn');
    expect(btn).toBeDisabled();
  });

  it('should enable search button when input has text', () => {
    render(<ReverseSearch />);
    const input = screen.getByTestId('reverse-search-input');
    fireEvent.change(input, { target: { value: 'orders' } });
    const btn = screen.getByTestId('reverse-search-btn');
    expect(btn).not.toBeDisabled();
  });

  it('should trigger search on button click', async () => {
    const mockData = {
      query: 'orders',
      tables: [{ name: 'orders', refs: [{ projectId: 'proj-a', entityName: 'Order', filePath: 'Order.java', columns: [], accessPattern: 'read-write' }] }],
      events: [],
      totalTables: 1,
      totalEvents: 0,
    };
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve(mockData),
    });

    render(<ReverseSearch />);

    const input = screen.getByTestId('reverse-search-input');
    fireEvent.change(input, { target: { value: 'orders' } });
    fireEvent.click(screen.getByTestId('reverse-search-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('reverse-search-results')).toBeInTheDocument();
    });
  });

  it('should trigger search on Enter key', async () => {
    const mockData = {
      query: 'events',
      tables: [],
      events: [],
      totalTables: 0,
      totalEvents: 0,
    };
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve(mockData),
    });

    render(<ReverseSearch />);

    const input = screen.getByTestId('reverse-search-input');
    fireEvent.change(input, { target: { value: 'events' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  it('should show no-results message when search returns empty', async () => {
    const mockData = {
      query: 'zzzzz',
      tables: [],
      events: [],
      totalTables: 0,
      totalEvents: 0,
    };
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve(mockData),
    });

    render(<ReverseSearch />);

    const input = screen.getByTestId('reverse-search-input');
    fireEvent.change(input, { target: { value: 'zzzzz' } });
    fireEvent.click(screen.getByTestId('reverse-search-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('reverse-search-no-results')).toBeInTheDocument();
    });
  });

  it('should show clear button after search', async () => {
    const mockData = {
      query: 'order',
      tables: [],
      events: [],
      totalTables: 0,
      totalEvents: 0,
    };
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve(mockData),
    });

    render(<ReverseSearch />);

    const input = screen.getByTestId('reverse-search-input');
    fireEvent.change(input, { target: { value: 'order' } });
    fireEvent.click(screen.getByTestId('reverse-search-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('reverse-search-clear')).toBeInTheDocument();
    });
  });

  it('should clear search results on clear button click', async () => {
    const mockData = {
      query: 'order',
      tables: [],
      events: [],
      totalTables: 0,
      totalEvents: 0,
    };
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve(mockData),
    });

    render(<ReverseSearch />);

    const input = screen.getByTestId('reverse-search-input');
    fireEvent.change(input, { target: { value: 'order' } });
    fireEvent.click(screen.getByTestId('reverse-search-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('reverse-search-clear')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('reverse-search-clear'));

    await waitFor(() => {
      expect(screen.queryByTestId('reverse-search-results')).not.toBeInTheDocument();
    });
  });
});
