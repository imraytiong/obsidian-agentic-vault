export interface FleetItem {
	filename: string;
	// Raw markdown or script content for bundled items
	content?: string;
	// URL to download the item from a community registry
	downloadUrl?: string;
}

export interface FleetBlueprint {
	id: string;
	name: string;
	description: string;
	author: string;
	personas: FleetItem[];
	tools: FleetItem[];
	skills: FleetItem[];
	routines: FleetItem[];
}
