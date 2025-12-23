/**
 * Response utility functions for consistent API responses.
 * These helpers ensure all endpoints return properly formatted responses.
 */

import { Response } from 'express';
import {
	ApiResponse,
	ApiErrorResponse,
	PaginationMeta,
	ValidationError
} from '../types/api.types';

/**
 * Sends a successful response with data.
 *
 * @param res - Express response object
 * @param data - Data to send in the response
 * @param statusCode - HTTP status code (default: 200)
 * @param message - Optional success message
 */
export function sendSuccess<T>(
	res: Response,
	data: T,
	statusCode: number = 200,
	message?: string
): void {
	const response: ApiResponse<T> = {
		success: true,
		data,
		...(message && { message })
	};
	res.status(statusCode).json(response);
}

/**
 * Sends an error response.
 *
 * @param res - Express response object
 * @param message - Error message
 * @param statusCode - HTTP status code (default: 400)
 * @param errors - Optional array of validation errors
 */
export function sendError(
	res: Response,
	message: string,
	statusCode: number = 400,
	errors?: ValidationError[]
): void {
	const response: ApiErrorResponse = {
		success: false,
		message,
		...(errors && { errors })
	};
	res.status(statusCode).json(response);
}

/**
 * Calculates pagination metadata from query parameters and total count.
 *
 * @param page - Current page number (1-indexed)
 * @param limit - Items per page
 * @param totalResults - Total number of items
 * @returns Pagination metadata object
 */
export function getPaginationMeta(
	page: number,
	limit: number,
	totalResults: number
): PaginationMeta {
	return {
		currentPage: page,
		totalPages: Math.ceil(totalResults / limit),
		totalResults,
		limit
	};
}

/**
 * Parses and validates pagination query parameters.
 *
 * @param page - Page query parameter (string)
 * @param limit - Limit query parameter (string)
 * @param defaultLimit - Default limit if not specified (default: 10)
 * @returns Parsed page and limit values
 */
export function parsePaginationParams(
	page?: string,
	limit?: string,
	defaultLimit: number = 10
): { page: number; limit: number } {
	const parsedPage = Math.max(1, parseInt(page || '1', 10) || 1);
	const parsedLimit = Math.min(100, Math.max(1, parseInt(limit || String(defaultLimit), 10) || defaultLimit));

	return { page: parsedPage, limit: parsedLimit };
}

