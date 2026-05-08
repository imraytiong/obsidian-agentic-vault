export type ModelCategory = 'Reasoning' | 'Fast' | 'Light';

export class ModelResolver {
	static classifyModel(model: string): ModelCategory {
		if (/\b(lite|8b|mini|haiku)\b/i.test(model)) return 'Light';
		if (/\b(pro|plus|opus|o1|o3|thinking)\b/i.test(model)) return 'Reasoning';
		// Anything else (flash, sonnet, turbo, base models) falls to Fast by default
		return 'Fast';
	}

	static getBestModelsForTiers(models: string[]): Record<ModelCategory, string> {
		const tiers: Record<ModelCategory, string[]> = { Reasoning: [], Fast: [], Light: [] };
		models.forEach(m => tiers[this.classifyModel(m)].push(m));
		
		const sortModels = (mList: string[]) => mList.sort((a, b) => {
			const getV = (str: string) => parseFloat(str.match(/[\d]+(?:\.[\d]+)?/)?.[0] || '0');
			const vA = getV(a); const vB = getV(b);
			if (vA !== vB) return vB - vA; // Higher version wins
			
			const isExpA = a.toLowerCase().includes('exp') || a.toLowerCase().includes('preview');
			const isExpB = b.toLowerCase().includes('exp') || b.toLowerCase().includes('preview');
			if (isExpA !== isExpB) return isExpA ? 1 : -1; // Prefer stable over experimental
			
			return a.length - b.length; // Shorter name wins
		});
		
		return {
			Reasoning: sortModels(tiers.Reasoning)[0] || '',
			Fast: sortModels(tiers.Fast)[0] || '',
			Light: sortModels(tiers.Light)[0] || ''
		};
	}

	static resolveTargetModel(target: string, availableModels: string[], tierModels?: Record<string, string>): string {
		if (['Reasoning', 'Fast', 'Light'].includes(target)) {
			// 1. User defined tier mapping
			if (tierModels && tierModels[target] && availableModels.includes(tierModels[target])) {
				return tierModels[target];
			}
			
			// 2. Dynamic classification fallback
			const bestModels = this.getBestModelsForTiers(availableModels);
			if (bestModels[target as ModelCategory]) return bestModels[target as ModelCategory];
			
			// 3. Cascading fallback if no models in requested tier are available
			if (target === 'Reasoning') return this.resolveTargetModel('Fast', availableModels, tierModels);
			if (target === 'Fast') return this.resolveTargetModel('Light', availableModels, tierModels);
			
			// If even Light fails, return whatever is available, or the category name
			if (availableModels.length > 0) return availableModels[0] || target;
			return target;
		}
		return target;
	}

	static getFallbackModel(currentModelId: string, availableModels: string[], tierModels?: Record<string, string>): string | undefined {
		const currentTier = this.classifyModel(currentModelId);
		if (currentTier === 'Reasoning') return this.resolveTargetModel('Fast', availableModels, tierModels);
		if (currentTier === 'Fast') return this.resolveTargetModel('Light', availableModels, tierModels);
		return undefined;
	}
}
