import { describe, expect, it } from 'vitest';
import {
    ALWAYS_KEEP_TOTAL_THRESHOLD_BYTES,
    getTotalMemoryBytes,
    LARGE_ENTRY_BYTES,
    LARGE_ENTRY_MAX_AGE,
    TOTAL_THRESHOLD_BYTES,
    trimOldestEntries,
} from './trim-oldest-entries';
import { THistoryEntry } from './history.types';

// a fully composed state
function makeOldestEntry(bytes: number): THistoryEntry {
    return {
        timestamp: 100,
        memoryEstimateBytes: bytes,
        description: 'oldest',
        data: {
            projectId: { value: 'test' },
            size: { width: 1, height: 1 },
            selection: {},
            activeLayerId: 'layer-1',
            layerMap: {},
        },
    };
}

function makeEntry(bytes: number): THistoryEntry {
    return {
        timestamp: 200,
        memoryEstimateBytes: bytes,
        data: {},
    };
}

// bytes needed for a large entry
const largeEntryBytes = LARGE_ENTRY_BYTES + 1;

describe('trimOldestEntries', () => {
    describe('given total is <= ALWAYS_KEEP_THRESHOLD_BYTES', () => {
        it('keeps everything, even when large entry exceeds max age', () => {
            const entries = [
                makeOldestEntry(0),
                makeEntry(largeEntryBytes),
                ...Array.from({ length: LARGE_ENTRY_MAX_AGE * 2 }, () => makeEntry(0)),
            ];
            expect(getTotalMemoryBytes(entries)).toBeLessThan(ALWAYS_KEEP_TOTAL_THRESHOLD_BYTES);
            expect(trimOldestEntries(entries).length).toBe(entries.length);
        });
    });

    describe('given total is > ALWAYS_KEEP_THRESHOLD_BYTES', () => {
        it('does not trim when a large entry is exactly LARGE_ENTRY_MAX_AGE steps in the past', () => {
            const entries = [
                // so the large entry pushes over the base threshold
                makeOldestEntry(ALWAYS_KEEP_TOTAL_THRESHOLD_BYTES),
                makeEntry(largeEntryBytes),
                ...Array.from({ length: LARGE_ENTRY_MAX_AGE }, () => makeEntry(0)),
            ];
            const result = trimOldestEntries(entries);
            expect(result.length).toBe(entries.length);
        });

        it('trims when a large entry is LARGE_ENTRY_MAX_AGE + 1 steps in the past', () => {
            const entries = [
                // so the large entry pushes over the base threshold
                makeOldestEntry(ALWAYS_KEEP_TOTAL_THRESHOLD_BYTES),
                makeEntry(largeEntryBytes),
                ...Array.from({ length: LARGE_ENTRY_MAX_AGE + 1 }, () => makeEntry(0)),
            ];
            const result = trimOldestEntries(entries);
            expect(result.length).toBe(entries.length - 1);
        });

        it('uses the most-recent violating large entry as the merge boundary', () => {
            const entries = [
                // so the large entry pushes over the base threshold
                makeOldestEntry(ALWAYS_KEEP_TOTAL_THRESHOLD_BYTES),
                makeEntry(largeEntryBytes),
                makeEntry(largeEntryBytes),
                makeEntry(largeEntryBytes), // <- new oldest
                ...Array.from({ length: LARGE_ENTRY_MAX_AGE + 1 }, () => makeEntry(0)),
            ];
            const result = trimOldestEntries(entries);
            expect(result.length).toBe(entries.length - 3);
        });

        it('trim old entries when total exceeds TOTAL_THRESHOLD_BYTES', () => {
            // 4 chunks to exceed limit
            const chunk = Math.floor(TOTAL_THRESHOLD_BYTES / 3);
            const entries = [
                makeOldestEntry(0),
                makeEntry(chunk), // e1 -> new oldest
                makeEntry(chunk), // e2
                makeEntry(chunk), // e3
                makeEntry(chunk), // e4 (newest)
            ];
            expect(getTotalMemoryBytes(entries)).toBeGreaterThan(TOTAL_THRESHOLD_BYTES);
            const result = trimOldestEntries(entries);
            expect(result.length).toBe(4); // [composed(e0+e1), e2, e3, e4]
            expect(getTotalMemoryBytes(result)).toBeLessThanOrEqual(TOTAL_THRESHOLD_BYTES);
        });

        it('trims when regular entries together exceed ALWAYS_KEEP_THRESHOLD_BYTES', () => {
            const entryBytes = Math.floor(LARGE_ENTRY_BYTES / 2);
            const entriesThatWillFit = Math.floor(ALWAYS_KEEP_TOTAL_THRESHOLD_BYTES / entryBytes);
            const extra = 5;
            const entries = [
                makeOldestEntry(0),
                ...Array.from({ length: entriesThatWillFit + extra }, () => makeEntry(entryBytes)),
            ];
            const result = trimOldestEntries(entries);
            expect(result.length).toBe(entriesThatWillFit + 1);
            expect(getTotalMemoryBytes(result)).toBeLessThanOrEqual(
                ALWAYS_KEEP_TOTAL_THRESHOLD_BYTES,
            );
        });

        it('does not trim when total is above ALWAYS_KEEP_THRESHOLD_BYTES but below TOTAL_THRESHOLD_BYTES with no large-entry violations', () => {
            const chunk = Math.floor(
                (ALWAYS_KEEP_TOTAL_THRESHOLD_BYTES + TOTAL_THRESHOLD_BYTES) / 2 / 5,
            );
            const entries = [
                makeOldestEntry(0),
                ...Array.from({ length: 500 }, () => makeEntry(1)),
                ...Array.from({ length: 5 }, () => makeEntry(chunk)),
            ];
            const totalBefore = entries.reduce((sum, e) => sum + e.memoryEstimateBytes, 0);
            expect(totalBefore).toBeGreaterThan(ALWAYS_KEEP_TOTAL_THRESHOLD_BYTES); // guard
            expect(totalBefore).toBeLessThan(TOTAL_THRESHOLD_BYTES); // guard
            const result = trimOldestEntries(entries);
            expect(result.length).toBe(entries.length);
        });
    });
});
