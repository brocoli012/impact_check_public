/**
 * @module tests/unit/utils/analysis-status
 * @description AnalysisStatus 유틸리티 단위 테스트 (TASK-058)
 */

import {
  AnalysisStatus,
  VALID_TRANSITIONS,
  getEffectiveStatus,
  isValidTransition,
  isAnalysisStatus,
  getTransitionError,
} from '../../../src/utils/analysis-status';

describe('analysis-status', () => {
  describe('AnalysisStatus type values', () => {
    it('should define four valid status values', () => {
      const validStatuses: AnalysisStatus[] = ['active', 'completed', 'on-hold', 'archived'];
      expect(Object.keys(VALID_TRANSITIONS)).toEqual(validStatuses);
    });
  });

  describe('getEffectiveStatus', () => {
    it('should return "active" when status is undefined', () => {
      expect(getEffectiveStatus(undefined)).toBe('active');
    });

    it('should return the given status when defined', () => {
      expect(getEffectiveStatus('completed')).toBe('completed');
      expect(getEffectiveStatus('on-hold')).toBe('on-hold');
      expect(getEffectiveStatus('archived')).toBe('archived');
      expect(getEffectiveStatus('active')).toBe('active');
    });
  });

  describe('isValidTransition', () => {
    // active transitions
    it('should allow active -> completed', () => {
      expect(isValidTransition('active', 'completed')).toBe(true);
    });

    it('should allow active -> on-hold', () => {
      expect(isValidTransition('active', 'on-hold')).toBe(true);
    });

    it('should allow active -> archived', () => {
      expect(isValidTransition('active', 'archived')).toBe(true);
    });

    it('should not allow active -> active (same state)', () => {
      expect(isValidTransition('active', 'active')).toBe(false);
    });

    // completed transitions
    it('should allow completed -> archived', () => {
      expect(isValidTransition('completed', 'archived')).toBe(true);
    });

    it('should not allow completed -> active', () => {
      expect(isValidTransition('completed', 'active')).toBe(false);
    });

    it('should not allow completed -> on-hold', () => {
      expect(isValidTransition('completed', 'on-hold')).toBe(false);
    });

    // on-hold transitions
    it('should allow on-hold -> active', () => {
      expect(isValidTransition('on-hold', 'active')).toBe(true);
    });

    it('should allow on-hold -> archived', () => {
      expect(isValidTransition('on-hold', 'archived')).toBe(true);
    });

    it('should not allow on-hold -> completed', () => {
      expect(isValidTransition('on-hold', 'completed')).toBe(false);
    });

    // archived transitions
    it('should not allow archived -> active', () => {
      expect(isValidTransition('archived', 'active')).toBe(false);
    });

    it('should not allow archived -> completed', () => {
      expect(isValidTransition('archived', 'completed')).toBe(false);
    });

    it('should not allow archived -> on-hold', () => {
      expect(isValidTransition('archived', 'on-hold')).toBe(false);
    });
  });

  describe('isAnalysisStatus', () => {
    it('should return true for valid status strings', () => {
      expect(isAnalysisStatus('active')).toBe(true);
      expect(isAnalysisStatus('completed')).toBe(true);
      expect(isAnalysisStatus('on-hold')).toBe(true);
      expect(isAnalysisStatus('archived')).toBe(true);
    });

    it('should return false for invalid strings', () => {
      expect(isAnalysisStatus('pending')).toBe(false);
      expect(isAnalysisStatus('ACTIVE')).toBe(false);
      expect(isAnalysisStatus('')).toBe(false);
      expect(isAnalysisStatus('on_hold')).toBe(false);
    });

    it('should return false for non-string values', () => {
      expect(isAnalysisStatus(null)).toBe(false);
      expect(isAnalysisStatus(undefined)).toBe(false);
      expect(isAnalysisStatus(123)).toBe(false);
      expect(isAnalysisStatus(true)).toBe(false);
      expect(isAnalysisStatus({})).toBe(false);
    });
  });

  describe('getTransitionError', () => {
    it('should return specific message for archived state', () => {
      const msg = getTransitionError('archived', 'active');
      expect(msg).toContain('폐기된 분석');
    });

    it('should return specific message for completed -> active', () => {
      const msg = getTransitionError('completed', 'active');
      expect(msg).toContain('완료된 분석');
      expect(msg).toContain('보완 분석');
    });

    it('should return generic message for other invalid transitions', () => {
      const msg = getTransitionError('on-hold', 'completed');
      expect(msg).toContain('on-hold');
      expect(msg).toContain('completed');
      expect(msg).toContain('전환');
    });
  });

  describe('VALID_TRANSITIONS completeness', () => {
    it('should have entries for all four states', () => {
      expect(VALID_TRANSITIONS).toHaveProperty('active');
      expect(VALID_TRANSITIONS).toHaveProperty('completed');
      expect(VALID_TRANSITIONS).toHaveProperty('on-hold');
      expect(VALID_TRANSITIONS).toHaveProperty('archived');
    });

    it('archived should have no valid transitions', () => {
      expect(VALID_TRANSITIONS['archived']).toEqual([]);
    });

    it('completed should only allow archived', () => {
      expect(VALID_TRANSITIONS['completed']).toEqual(['archived']);
    });
  });
});
