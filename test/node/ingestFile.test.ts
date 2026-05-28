import { describe, it, expect, vi } from 'vitest';
import { ingestFileNode } from '../../src/node';
import { ColumnConfig } from '../../src/types';

// Mock the CSV adapter
vi.mock('../../src/adapters/csvAdapter', () => {
  return {
    parseCsvToRows: async (content: any) => {
      if (content === 'empty') return [];
      if (content === 'error') throw new Error('CSV Parse Error');
      return [
        { name: 'John', age: '30', email: 'john@example.com' },
        { name: 'Jane', age: 'invalid', email: 'jane@example.com' }
      ];
    }
  };
});

describe('ingestFileNode', () => {
  const columnConfigs: ColumnConfig[] = [
    { key: 'name', displayNames: ['name', 'Full Name'], type: 'string', validationRequired: true },
    { key: 'age', displayNames: ['age'], type: 'number', validationRequired: true },
    { key: 'email', displayNames: ['email'], type: 'string', validationRequired: false }
  ];

  it('should process a valid file and return output', async () => {
    const result = await ingestFileNode({
      fileContent: 'valid_content',
      columnConfigs,
      chunkSize: 2
    });

    expect('error' in result).toBe(false);

    if (!('error' in result)) {
      expect(result.totalRows).toBe(2);
      expect(result.validRowsCount).toBe(1);
      expect(result.invalidRowsCount).toBe(1);
      expect(result.validRows[0].name).toBe('John');
      expect(result.validRows[0].age).toBe(30);

      expect(result.invalidRows[0].name).toBe('Jane');
      expect(result.errorsData.rowWiseErrors.length).toBeGreaterThan(0);
      expect(result.errorsData.rowWiseErrors[0].columnKey).toBe('age');
    }
  });

  it('should return error if no rows found', async () => {
    const result = await ingestFileNode({
      fileContent: 'empty',
      columnConfigs,
      chunkSize: 2
    });

    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toBe('No rows found or parsed successfully.');
    }
  });

  it('should handle headers mismatch', async () => {
    const missingConfig: ColumnConfig[] = [
      ...columnConfigs,
      { key: 'missing', displayNames: ['missing_header'], type: 'string', validationRequired: true }
    ];

    const result = await ingestFileNode({
      fileContent: 'valid_content',
      columnConfigs: missingConfig,
      chunkSize: 2
    });

    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toBe('Headers mismatch');
      expect(result.headersMismatch?.headersRequired).toContain('missing_header');
    }
  });

  it('should return error if parsing fails', async () => {
    const result = await ingestFileNode({
      fileContent: 'error',
      columnConfigs,
      chunkSize: 2
    });

    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toBe('CSV Parse Error');
    }
  });
});
