import { describe, it, expect, vi } from 'vitest';
import { processRowsInChunks } from '../../src/core';
import { ColumnConfig, IngestionController } from '../../src/types';

describe('processRowsInChunks - Pause, Resume, Cancel', () => {
  const columnConfigs: ColumnConfig[] = [
    { key: 'name', type: 'string', validationRequired: true, displayNames: ["Name"] }
  ];

  const createRows = (count: number) => Array.from({ length: count }, (_, i) => ({ name: `User ${i}` }));

  it('should process normally when not paused or cancelled', async () => {
    const controller: IngestionController = { isPaused: false, isCancelled: false };
    const rows = createRows(10);
    const onChunkProcessed = vi.fn().mockResolvedValue(undefined);

    const result = await processRowsInChunks({
      rows,
      columnConfigs,
      chunkSize: 5,
      onChunkProcessed,
      ingestionController: controller,
    });

    expect(result.validRowsCount).toBe(10);
    expect(onChunkProcessed).toHaveBeenCalledTimes(2);
  });

  it('should pause and resume processing', async () => {
    const controller: IngestionController = { isPaused: false, isCancelled: false };
    const rows = createRows(10);
    let chunkCount = 0;
    const onChunkProcessed = vi.fn().mockImplementation(async () => {
      chunkCount++;
      if (chunkCount === 1) {
        // Pause after first chunk
        controller.isPaused = true;

        // Resume after a short delay
        setTimeout(() => {
          controller.isPaused = false;
        }, 150);
      }
    });

    const startTime = Date.now();
    const result = await processRowsInChunks({
      rows,
      columnConfigs,
      chunkSize: 5,
      onChunkProcessed,
      ingestionController: controller,
    });
    const duration = Date.now() - startTime;

    // Should take at least 150ms due to the pause
    expect(duration).toBeGreaterThanOrEqual(100);
    expect(result.validRowsCount).toBe(10);
    expect(onChunkProcessed).toHaveBeenCalledTimes(2);
  });

  it('should cancel processing early', async () => {
    const controller: IngestionController = { isPaused: false, isCancelled: false };
    const rows = createRows(10);
    const onChunkProcessed = vi.fn().mockImplementation(async () => {
      // Cancel after first chunk
      controller.isCancelled = true;
    });

    const result = await processRowsInChunks({
      rows,
      columnConfigs,
      chunkSize: 5,
      onChunkProcessed,
      ingestionController: controller,
    });

    expect(result.validRowsCount).toBe(5); // Only first chunk processed
    expect(result.totalRows).toBe(10); // Original rows length
    expect(onChunkProcessed).toHaveBeenCalledTimes(1);
  });

  it('should cancel while paused', async () => {
    const controller: IngestionController = { isPaused: false, isCancelled: false };
    const rows = createRows(10);
    const onChunkProcessed = vi.fn().mockImplementation(async () => {
      // Pause and cancel after first chunk
      controller.isPaused = true;
      setTimeout(() => {
        controller.isCancelled = true;
      }, 150);
    });

    const startTime = Date.now();
    const result = await processRowsInChunks({
      rows,
      columnConfigs,
      chunkSize: 5,
      onChunkProcessed,
      ingestionController: controller,
    });
    const duration = Date.now() - startTime;

    expect(duration).toBeGreaterThanOrEqual(100);
    expect(result.validRowsCount).toBe(5); // Only first chunk
    expect(onChunkProcessed).toHaveBeenCalledTimes(1);
  });
});
