/**
 * Homestays Controller
 *
 * Handles all CRUD operations for homestay listings.
 * Uses MongoDB via Mongoose for data persistence.
 */

import { Request, Response } from 'express';
import {
	HomestayModel,
	CreateHomestayInput,
	UpdateHomestayInput
} from '../models/homestays/Homestay.model';
import {
	sendSuccess,
	sendError,
	getPaginationMeta,
	parsePaginationParams
} from '../utils/response.utils';

/**
 * GET /api/homestays
 *
 * Retrieves all homestays with pagination and optional filters.
 *
 * Query params:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 10, max: 100)
 * - district: Filter by district name
 * - minPrice: Minimum base price filter
 * - maxPrice: Maximum base price filter
 */
export async function getAllHomestays(req: Request, res: Response): Promise<void> {
	try {
		const { page, limit } = parsePaginationParams(
			req.query.page as string,
			req.query.limit as string
		);
		const district = req.query.district as string | undefined;
		const minPrice = req.query.minPrice ? parseInt(req.query.minPrice as string, 10) : undefined;
		const maxPrice = req.query.maxPrice ? parseInt(req.query.maxPrice as string, 10) : undefined;

		// Build query filter
		const filter: Record<string, unknown> = { status: 'active' };

		if (district) {
			filter['location.district'] = new RegExp(`^${district}$`, 'i');
		}

		if (minPrice !== undefined || maxPrice !== undefined) {
			filter['pricing.basePrice'] = {};
			if (minPrice !== undefined) {
				(filter['pricing.basePrice'] as Record<string, number>).$gte = minPrice;
			}
			if (maxPrice !== undefined) {
				(filter['pricing.basePrice'] as Record<string, number>).$lte = maxPrice;
			}
		}

		// Execute query with pagination
		const [homestays, totalResults] = await Promise.all([
			HomestayModel.find(filter)
				.skip((page - 1) * limit)
				.limit(limit)
				.sort({ createdAt: -1 }),
			HomestayModel.countDocuments(filter)
		]);

		sendSuccess(res, {
			homestays,
			pagination: getPaginationMeta(page, limit, totalResults)
		});
	} catch (error) {
		console.error('Error fetching homestays:', error);
		sendError(res, 'Failed to fetch homestays', 500);
	}
}

/**
 * GET /api/homestays/:id
 *
 * Retrieves a single homestay by ID.
 */
export async function getHomestayById(req: Request, res: Response): Promise<void> {
	try {
		const { id } = req.params;
		const homestay = await HomestayModel.findById(id);

		if (!homestay) {
			sendError(res, 'Homestay not found', 404);
			return;
		}

		sendSuccess(res, homestay);
	} catch (error) {
		console.error('Error fetching homestay:', error);
		sendError(res, 'Failed to fetch homestay', 500);
	}
}

/**
 * POST /api/homestays
 *
 * Creates a new homestay listing.
 *
 * Request body: CreateHomestayInput
 */
export async function createHomestay(req: Request, res: Response): Promise<void> {
	try {
		const input: CreateHomestayInput = req.body;

		// Create new homestay document
		const newHomestay = new HomestayModel({
			...input,
			status: 'active'
		});

		// Save to database (validation happens automatically via schema)
		await newHomestay.save();

		sendSuccess(res, newHomestay, 201, 'Homestay created successfully');
	} catch (error: unknown) {
		console.error('Error creating homestay:', error);

		// Handle Mongoose validation errors
		if (error instanceof Error && error.name === 'ValidationError') {
			const mongooseError = error as unknown as { errors: Record<string, { message: string }> };
			const validationErrors = Object.keys(mongooseError.errors).map(field => ({
				field,
				message: mongooseError.errors[field].message
			}));
			sendError(res, 'Validation failed', 400, validationErrors);
			return;
		}

		sendError(res, 'Failed to create homestay', 500);
	}
}

/**
 * PUT /api/homestays/:id
 *
 * Updates an existing homestay.
 * Supports partial updates.
 *
 * Request body: UpdateHomestayInput
 */
export async function updateHomestay(req: Request, res: Response): Promise<void> {
	try {
		const { id } = req.params;
		const updates: UpdateHomestayInput = req.body;

		const updatedHomestay = await HomestayModel.findByIdAndUpdate(
			id,
			{ $set: updates },
			{ new: true, runValidators: true }
		);

		if (!updatedHomestay) {
			sendError(res, 'Homestay not found', 404);
			return;
		}

		sendSuccess(res, updatedHomestay, 200, 'Homestay updated successfully');
	} catch (error: unknown) {
		console.error('Error updating homestay:', error);

		if (error instanceof Error && error.name === 'ValidationError') {
			const mongooseError = error as unknown as { errors: Record<string, { message: string }> };
			const validationErrors = Object.keys(mongooseError.errors).map(field => ({
				field,
				message: mongooseError.errors[field].message
			}));
			sendError(res, 'Validation failed', 400, validationErrors);
			return;
		}

		sendError(res, 'Failed to update homestay', 500);
	}
}

/**
 * DELETE /api/homestays/:id
 *
 * Deletes a homestay listing.
 */
export async function deleteHomestay(req: Request, res: Response): Promise<void> {
	try {
		const { id } = req.params;
		const deletedHomestay = await HomestayModel.findByIdAndDelete(id);

		if (!deletedHomestay) {
			sendError(res, 'Homestay not found', 404);
			return;
		}

		sendSuccess(res, null, 200, 'Homestay deleted successfully');
	} catch (error) {
		console.error('Error deleting homestay:', error);
		sendError(res, 'Failed to delete homestay', 500);
	}
}
