import { describe, it, expect, beforeEach } from '@jest/globals';
import { Request, Response } from 'express';

// Mock the database pool BEFORE importing controllers
const mockQuery = jest.fn();
jest.mock('../../src/database/connection', () => ({
  pool: {
    query: mockQuery,
  },
}));

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-1234'),
}));

// Import AFTER mocks are set up
import { logCall, logSMS, logData } from '../../src/controllers/usageController';

const mockRes = () => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
};

describe('UsageController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('logCall', () => {
    it('should log a call and return 201 with idempotency key', async () => {
      mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]);
      const req = { body: { userId: 1, duration: 300 } } as Request;
      const res = mockRes();

      await logCall(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Call log saved',
          idempotencyKey: 'test-uuid-1234',
        })
      );
    });

    it('should detect duplicate requests via idempotency key', async () => {
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }]); // INSERT IGNORE - duplicate
      const req = {
        body: { userId: 1, duration: 300, idempotencyKey: 'existing-key' },
      } as Request;
      const res = mockRes();

      await logCall(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Duplicate request ignored' })
      );
    });

    it('should reject missing userId', async () => {
      const req = { body: { duration: 300 } } as Request;
      const res = mockRes();

      await expect(logCall(req, res)).rejects.toThrow('userId and duration are required');
    });

    it('should reject non-positive duration', async () => {
      const req = { body: { userId: 1, duration: -5 } } as Request;
      const res = mockRes();

      await expect(logCall(req, res)).rejects.toThrow('duration must be a positive number');
    });

    it('should reject non-numeric duration', async () => {
      const req = { body: { userId: 1, duration: 'abc' } } as Request;
      const res = mockRes();

      await expect(logCall(req, res)).rejects.toThrow('duration must be a positive number');
    });
  });

  describe('logSMS', () => {
    it('should log SMS and return 201', async () => {
      mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]);
      const req = { body: { userId: 1, count: 50 } } as Request;
      const res = mockRes();

      await logSMS(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'SMS log saved' })
      );
    });

    it('should reject missing count', async () => {
      const req = { body: { userId: 1 } } as Request;
      const res = mockRes();

      await expect(logSMS(req, res)).rejects.toThrow('userId and count are required');
    });

    it('should reject non-positive count', async () => {
      const req = { body: { userId: 1, count: -3 } } as Request;
      const res = mockRes();

      await expect(logSMS(req, res)).rejects.toThrow('count must be a positive number');
    });
  });

  describe('logData', () => {
    it('should log data usage and return 201', async () => {
      mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]);
      const req = { body: { userId: 1, mb: 1024 } } as Request;
      const res = mockRes();

      await logData(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Data log saved' })
      );
    });

    it('should reject non-positive mb', async () => {
      const req = { body: { userId: 1, mb: -100 } } as Request;
      const res = mockRes();

      await expect(logData(req, res)).rejects.toThrow('mb must be a positive number');
    });

    it('should handle custom timestamp', async () => {
      mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]);
      const req = {
        body: { userId: 1, mb: 512, timestamp: '2026-01-15T10:30:00Z' },
      } as Request;
      const res = mockRes();

      await logData(req, res);

      const queryArgs = mockQuery.mock.calls[0][1];
      expect(queryArgs[3]).toEqual(new Date('2026-01-15T10:30:00Z'));
    });
  });
});
