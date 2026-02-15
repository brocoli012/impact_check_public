import '@testing-library/jest-dom';

// jsdom에 ResizeObserver가 없으므로 mock 추가
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
