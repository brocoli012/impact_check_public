/**
 * @module web/components/cross-project/__tests__/SharedEntityMap.test
 * @description SharedEntityMap 컴포넌트 단위 테스트 (Phase D: TASK-109)
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import SharedEntityMap from '../SharedEntityMap';

describe('SharedEntityMap', () => {
  it('should show empty message when no data', () => {
    render(<SharedEntityMap tables={[]} events={[]} />);
    expect(screen.getByTestId('shared-entity-map-empty')).toBeInTheDocument();
  });

  it('should render map container with tables data', () => {
    const tables = [
      { name: 'orders', projects: ['proj-a', 'proj-b'], referenceCount: 2 },
    ];
    render(<SharedEntityMap tables={tables} events={[]} />);
    expect(screen.getByTestId('shared-entity-map')).toBeInTheDocument();
  });

  it('should render map container with events data', () => {
    const events = [
      { name: 'order-created', publishers: ['proj-a'], subscribers: ['proj-b'], referenceCount: 2 },
    ];
    render(<SharedEntityMap tables={[]} events={events} />);
    expect(screen.getByTestId('shared-entity-map')).toBeInTheDocument();
  });

  it('should render map with both tables and events', () => {
    const tables = [
      { name: 'users', projects: ['proj-a', 'proj-b'], referenceCount: 2 },
    ];
    const events = [
      { name: 'user-registered', publishers: ['proj-a'], subscribers: ['proj-b'], referenceCount: 2 },
    ];
    render(<SharedEntityMap tables={tables} events={events} />);
    expect(screen.getByTestId('shared-entity-map')).toBeInTheDocument();
  });
});
