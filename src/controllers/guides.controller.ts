/**
 * Guides Controller
 *
 * Handles all CRUD operations for guide profiles.
 * Uses MongoDB via Mongoose for data persistence.
 */

import { Request, Response } from 'express';
import {
	GuideModel,
	CreateGuideInput,
	UpdateGuideInput
} from '../models/guides/Guide.model';
import {
	sendSuccess,
	sendError,
	getPaginationMeta,
	parsePaginationParams
} from '../utils/response.utils';

/**
 * GET /api/guides
 *
 * Retrieves all guides with pagination and optional filters.
 *
 * Query params:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 10, max: 100)
 * - specialization: Filter by specialization
 */
export async function getAllGuides(req: Request, res: Response): Promise<void> {
	try {
		const { page, limit } = parsePaginationParams(
			req.query.page as string,
			req.query.limit as string
		);
		const specialization = req.query.specialization as string | undefined;

		// Build query filter
		const filter: Record<string, unknown> = {};

		if (specialization) {
			filter.specializations = new RegExp(`^${specialization}$`, 'i');
		}

		// Execute query with pagination
		const [guides, totalResults] = await Promise.all([
			GuideModel.find(filter)
				.skip((page - 1) * limit)
				.limit(limit)
				.sort({ createdAt: -1 }),
			GuideModel.countDocuments(filter)
		]);

		sendSuccess(res, {
			guides,
			pagination: getPaginationMeta(page, limit, totalResults)
		});
	} catch (error) {
		console.error('Error fetching guides:', error);
		sendError(res, 'Failed to fetch guides', 500);
	}
}

/**
 * GET /api/guides/:id
 *
 * Retrieves a single guide by ID.
 */
export async function getGuideById(req: Request, res: Response): Promise<void> {
	try {
		const { id } = req.params;
		const guide = await GuideModel.findById(id);

		if (!guide) {
			sendError(res, 'Guide not found', 404);
			return;
		}

		sendSuccess(res, guide);
	} catch (error) {
		console.error('Error fetching guide:', error);
		sendError(res, 'Failed to fetch guide', 500);
	}
}

/**
 * POST /api/guides
 *
 * Creates a new guide profile.
 *
 * Request body: CreateGuideInput
 */
export async function createGuide(req: Request, res: Response): Promise<void> {
	try {
		const input: CreateGuideInput = req.body;

		// Create new guide document
		const newGuide = new GuideModel(input);

		// Save to database
		await newGuide.save();

		sendSuccess(res, newGuide, 201, 'Guide profile created successfully');
	} catch (error: unknown) {
		console.error('Error creating guide:', error);

		if (error instanceof Error && error.name === 'ValidationError') {
			const mongooseError = error as unknown as { errors: Record<string, { message: string }> };
			const validationErrors = Object.keys(mongooseError.errors).map(field => ({
				field,
				message: mongooseError.errors[field].message
			}));
			sendError(res, 'Validation failed', 400, validationErrors);
			return;
		}

		sendError(res, 'Failed to create guide', 500);
	}
}

/**
 * PUT /api/guides/:id
 *
 * Updates an existing guide profile.
 * Supports partial updates.
 *
 * Request body: UpdateGuideInput
 */
export async function updateGuide(req: Request, res: Response): Promise<void> {
	try {
		const { id } = req.params;
		const updates: UpdateGuideInput = req.body;

		const updatedGuide = await GuideModel.findByIdAndUpdate(
			id,
			{ $set: updates },
			{ new: true, runValidators: true }
		);

		if (!updatedGuide) {
			sendError(res, 'Guide not found', 404);
			return;
		}

		sendSuccess(res, updatedGuide, 200, 'Guide profile updated successfully');
	} catch (error: unknown) {
		console.error('Error updating guide:', error);

		if (error instanceof Error && error.name === 'ValidationError') {
			const mongooseError = error as unknown as { errors: Record<string, { message: string }> };
			const validationErrors = Object.keys(mongooseError.errors).map(field => ({
				field,
				message: mongooseError.errors[field].message
			}));
			sendError(res, 'Validation failed', 400, validationErrors);
			return;
		}

		sendError(res, 'Failed to update guide', 500);
	}
}

/**
 * DELETE /api/guides/:id
 *
 * Deletes a guide profile.
 */
export async function deleteGuide(req: Request, res: Response): Promise<void> {
	try {
		const { id } = req.params;
		const deletedGuide = await GuideModel.findByIdAndDelete(id);

		if (!deletedGuide) {
			sendError(res, 'Guide not found', 404);
			return;
		}

		sendSuccess(res, null, 200, 'Guide profile deleted successfully');
	} catch (error) {
		console.error('Error deleting guide:', error);
		sendError(res, 'Failed to delete guide', 500);
	}
}
