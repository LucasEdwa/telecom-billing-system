import { describe, it, expect, beforeEach } from '@jest/globals';

const mockQuery = jest.fn();

jest.mock('../../src/database/connection', () => ({
  pool: {
    query: mockQuery,
  },
}));

jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

import { DeadLetterService } from '../../src/services/deadLetterService';

describe('DeadLetterService', () => {
  let service: DeadLetterService;

  beforeEach(() => {
    service = new DeadLetterService();
    jest.clearAllMocks();
  });

  describe('enqueue', () => {
    it('should insert a failed CDR into the dead letter queue', async () => {
      mockQuery.mockResolvedValueOnce([{ insertId: 1 }]);

      const id = await service.enqueue(
        'CALL',
        { userId: 'bad', duration: -5 },
        'duration must be a positive number',
        'VALIDATION_ERROR'
      );

      expect(id).toBe(1);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO dead_letter_queue'),
        expect.arrayContaining(['CALL', expect.any(String), 'duration must be a positive number', 'VALIDATION_ERROR'])
      );
    });

    it('should return -1 instead of crashing when DLQ write fails', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB down'));

      const id = await service.enqueue('SMS', { bad: 'data' }, 'parse error');

      // Must NOT throw — DLQ failure must never crash the main request
      expect(id).toBe(-1);
    });

    it('should store raw payload as JSON', async () => {
      mockQuery.mockResolvedValueOnce([{ insertId: 5 }]);

      const payload = { userId: 123, duration: 'not-a-number', extra: true };
      await service.enqueue('CALL', payload, 'invalid type');

      const insertedPayload = mockQuery.mock.calls[0][1][1];
      expect(JSON.parse(insertedPayload)).toEqual(payload);
    });

    it('should handle missing errorCode gracefully', async () => {
      mockQuery.mockResolvedValueOnce([{ insertId: 2 }]);

      await service.enqueue('DATA', {}, 'empty payload');

      const params = mockQuery.mock.calls[0][1];
      expect(params[3]).toBeNull(); // errorCode defaults to null
    });
  });

  describe('getPending', () => {
    it('should return paginated pending items', async () => {
      mockQuery
        .mockResolvedValueOnce([[{ total: 15 }]])
        .mockResolvedValueOnce([
          [
            { id: 1, source_type: 'CALL', status: 'PENDING' },
            { id: 2, source_type: 'SMS', status: 'PENDING' },
          ],
        ]);

      const result = await service.getPending(1, 10);

      expect(result.total).toBe(15);
      expect(result.items).toHaveLength(2);
    });

    it('should only query PENDING status items', async () => {
      mockQuery
        .mockResolvedValueOnce([[{ total: 0 }]])
        .mockResolvedValueOnce([[]]);

      await service.getPending();

      const countQuery = mockQuery.mock.calls[0][0];
      const selectQuery = mockQuery.mock.calls[1][0];
      expect(countQuery).toContain("status = 'PENDING'");
      expect(selectQuery).toContain("status = 'PENDING'");
    });
  });

  describe('resolve', () => {
    it('should mark a pending DLQ item as resolved', async () => {
      mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]);

      const result = await service.resolve(1, 42);

      expect(result).toBe(true);
      const query = mockQuery.mock.calls[0][0];
      expect(query).toContain("status = 'RESOLVED'");
    });

    it('should return false if item not found or already resolved', async () => {
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }]);

      const result = await service.resolve(999, 42);

      expect(result).toBe(false);
    });
  });

  describe('discard', () => {
    it('should mark a pending DLQ item as discarded', async () => {
      mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]);

      const result = await service.discard(1, 42);

      expect(result).toBe(true);
      const query = mockQuery.mock.calls[0][0];
      expect(query).toContain("status = 'DISCARDED'");
    });

    it('should return false if item not found or already handled', async () => {
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }]);

      const result = await service.discard(999, 42);

      expect(result).toBe(false);
    });
  });
});
