import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeminiProvider } from '../../src/llm/GeminiProvider';
import { INetwork, INetworkRequestOptions, INetworkResponse } from '../../src/core/interfaces/Environment';

describe('GeminiProvider Resilience', () => {
    let mockNetwork: INetwork;
    let provider: GeminiProvider;

    beforeEach(() => {
        mockNetwork = {
            request: vi.fn()
        };
        provider = new GeminiProvider('fake-key', 'gemini-3.1-pro-preview', mockNetwork);
    });

    it('should retry twice on 429 and then fail', async () => {
        (mockNetwork.request as any).mockResolvedValue({
            status: 429,
            text: 'Rate limited'
        });

        const start = Date.now();
        await expect(provider.generateResponse([{ role: 'user', content: 'test' }], [])).rejects.toThrow('Gemini API Error (429)');
        const elapsed = Date.now() - start;
        
        // Wait 2000ms + 4000ms = 6000ms total
        expect(elapsed).toBeGreaterThanOrEqual(5900);
        expect(mockNetwork.request).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    }, 10000);

    it('should fallback on 503 if allowFallback is true and models are available', async () => {
        (mockNetwork.request as any)
            .mockResolvedValueOnce({ status: 503, text: 'Overloaded' })
            .mockResolvedValueOnce({
                status: 200,
                json: {
                    candidates: [{ content: { parts: [{ text: 'Success on fallback' }] } }]
                }
            });

        const res = await provider.generateResponse([{ role: 'user', content: 'test' }], [], {
            allowFallback: true,
            availableModels: ['gemini-2.5-pro']
        });

        expect(res.content).toBe('Success on fallback');
        expect(mockNetwork.request).toHaveBeenCalledTimes(2);
        
        const firstCallUrl = (mockNetwork.request as any).mock.calls[0][0].url;
        const secondCallUrl = (mockNetwork.request as any).mock.calls[1][0].url;

        expect(firstCallUrl).toContain('gemini-3.1-pro-preview');
        expect(secondCallUrl).toContain('gemini-2.5-pro');
    });

    it('should throw immediately on 503 if allowFallback is false', async () => {
        (mockNetwork.request as any).mockResolvedValue({ status: 503, text: 'Overloaded' });

        await expect(provider.generateResponse([{ role: 'user', content: 'test' }], [], {
            allowFallback: false,
            availableModels: ['gemini-2.5-pro']
        })).rejects.toThrow('Gemini API Error (503)');

        expect(mockNetwork.request).toHaveBeenCalledTimes(1);
    });

    it('should throw immediately on 400 Bad Request', async () => {
        (mockNetwork.request as any).mockResolvedValue({ status: 400, text: 'Bad schema' });

        await expect(provider.generateResponse([{ role: 'user', content: 'test' }], [])).rejects.toThrow('Gemini API Error (400)');
        expect(mockNetwork.request).toHaveBeenCalledTimes(1);
    });
});
