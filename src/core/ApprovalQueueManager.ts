import { App } from 'obsidian';

export interface ApprovalRequest {
	id: string;
	persona: string;
	summary: string;
	reason: string;
	historyPayload: unknown[];
	timestamp: string;
	status: 'pending' | 'approved' | 'rejected';
}

export class ApprovalQueueManager {
	private app: App;
	private agenticVaultPath: string;
	private queuePath: string;
	private queue: ApprovalRequest[] = [];

	constructor(app: App, agenticVaultPath: string) {
		this.app = app;
		this.agenticVaultPath = agenticVaultPath;
		this.queuePath = `${this.agenticVaultPath}/logs/approval_queue.json`;
	}

	async loadQueue() {
		try {
			if (await this.app.vault.adapter.exists(this.queuePath)) {
				const content = await this.app.vault.adapter.read(this.queuePath);
				this.queue = JSON.parse(content);
			} else {
				this.queue = [];
			}
		} catch (e) {
			console.error("Failed to load approval queue", e);
			this.queue = [];
		}
	}

	async saveQueue() {
		try {
			const dir = `${this.agenticVaultPath}/logs`;
			if (!(await this.app.vault.adapter.exists(dir))) {
				await this.app.vault.adapter.mkdir(dir);
			}
			await this.app.vault.adapter.write(this.queuePath, JSON.stringify(this.queue, null, 2));
		} catch (e) {
			console.error("Failed to save approval queue", e);
		}
	}

	async addRequest(req: Omit<ApprovalRequest, 'id' | 'status'>) {
		await this.loadQueue();
		const newReq: ApprovalRequest = {
			...req,
			id: `req_${Date.now()}`,
			status: 'pending'
		};
		this.queue.push(newReq);
		await this.saveQueue();
		return newReq.id;
	}

	async resolveRequest(id: string, status: 'approved' | 'rejected') {
		await this.loadQueue();
		const req = this.queue.find(r => r.id === id);
		if (req) {
			req.status = status;
			await this.saveQueue();
			return req;
		}
		return null;
	}

	getPendingRequests() {
		return this.queue.filter(r => r.status === 'pending');
	}
}
