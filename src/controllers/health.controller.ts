/**
 * Health Controller
 *
 * Handles health check endpoints for monitoring server status.
 */

import { Request, Response } from 'express';
import { sendSuccess } from '../utils/response.utils';

/**
 * Health check response structure.
 */
interface HealthCheckResponse {
	status: string;
	message: string;
	timestamp: string;
}

/**
 * GET /api/health
 *
 * Returns the current server health status.
 * Used by load balancers and monitoring systems.
 */
export function getHealth(_req: Request, res: Response): void {
	const healthData: HealthCheckResponse = {
		status: 'ok',
		message: 'Server is running',
		timestamp: new Date().toISOString()
	};

	sendSuccess(res, healthData);
}
