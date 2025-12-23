/**
 * Bookings Controller
 *
 * Handles all operations for booking management.
 * Uses MongoDB via Mongoose for data persistence.
 */

import { Request, Response } from 'express';
import {
	BookingModel,
	CreateBookingInput,
	CancelBookingInput,
	IBookingDocument
} from '../models/bookings/Booking.model';
import { getNextBookingNumber } from '../models/counters/Counter.model';
import { HomestayModel } from '../models/homestays/Homestay.model';
import { GuideModel } from '../models/guides/Guide.model';
import {
	sendSuccess,
	sendError,
	getPaginationMeta,
	parsePaginationParams
} from '../utils/response.utils';

/**
 * Gets the listing title based on type and ID.
 */
async function getListingTitle(listingType: string, listingId: string): Promise<string | undefined> {
	try {
		if (listingType === 'homestay') {
			const homestay = await HomestayModel.findById(listingId).select('title');
			return homestay?.title;
		} else if (listingType === 'guide') {
			const guide = await GuideModel.findById(listingId).select('name');
			return guide?.name;
		}
		return undefined;
	} catch {
		return undefined;
	}
}

/**
 * Checks if dates conflict with existing bookings.
 */
async function hasDateConflict(
	listingId: string,
	checkIn: Date,
	checkOut: Date,
	excludeBookingId?: string
): Promise<IBookingDocument | null> {
	const query: Record<string, unknown> = {
		listingId,
		status: { $ne: 'cancelled' },
		$and: [
			{ checkIn: { $lt: checkOut } },
			{ checkOut: { $gt: checkIn } }
		]
	};

	if (excludeBookingId) {
		query._id = { $ne: excludeBookingId };
	}

	return BookingModel.findOne(query);
}

/**
 * GET /api/bookings
 *
 * Retrieves all bookings with pagination and optional filters.
 *
 * Query params:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 10, max: 100)
 * - status: Filter by booking status
 */
export async function getAllBookings(req: Request, res: Response): Promise<void> {
	try {
		const { page, limit } = parsePaginationParams(
			req.query.page as string,
			req.query.limit as string
		);
		const status = req.query.status as string | undefined;

		// Build query filter
		const filter: Record<string, unknown> = {};

		if (status) {
			filter.status = status;
		}

		// Execute query with pagination
		const [bookings, totalResults] = await Promise.all([
			BookingModel.find(filter)
				.skip((page - 1) * limit)
				.limit(limit)
				.sort({ createdAt: -1 }),
			BookingModel.countDocuments(filter)
		]);

		sendSuccess(res, {
			bookings,
			pagination: getPaginationMeta(page, limit, totalResults)
		});
	} catch (error) {
		console.error('Error fetching bookings:', error);
		sendError(res, 'Failed to fetch bookings', 500);
	}
}

/**
 * GET /api/bookings/:id
 *
 * Retrieves a single booking by ID.
 */
export async function getBookingById(req: Request, res: Response): Promise<void> {
	try {
		const { id } = req.params;
		const booking = await BookingModel.findById(id);

		if (!booking) {
			sendError(res, 'Booking not found', 404);
			return;
		}

		sendSuccess(res, booking);
	} catch (error) {
		console.error('Error fetching booking:', error);
		sendError(res, 'Failed to fetch booking', 500);
	}
}

/**
 * POST /api/bookings
 *
 * Creates a new booking.
 *
 * Request body: CreateBookingInput
 */
export async function createBooking(req: Request, res: Response): Promise<void> {
	try {
		const input: CreateBookingInput = req.body;

		// Basic validation
		const errors = [];
		if (!input.listingType || !['homestay', 'guide'].includes(input.listingType)) {
			errors.push({ field: 'listingType', message: 'Listing type must be "homestay" or "guide"' });
		}
		if (!input.listingId) {
			errors.push({ field: 'listingId', message: 'Listing ID is required' });
		}
		if (!input.checkIn) {
			errors.push({ field: 'checkIn', message: 'Check-in date is required' });
		}
		if (!input.checkOut) {
			errors.push({ field: 'checkOut', message: 'Check-out date is required' });
		}
		if (!input.guests?.adults || input.guests.adults < 1) {
			errors.push({ field: 'guests.adults', message: 'At least 1 adult guest is required' });
		}
		if (!input.guestDetails?.name) {
			errors.push({ field: 'guestDetails.name', message: 'Guest name is required' });
		}
		if (!input.guestDetails?.email) {
			errors.push({ field: 'guestDetails.email', message: 'Guest email is required' });
		}

		if (errors.length > 0) {
			sendError(res, 'Validation failed', 400, errors);
			return;
		}

		const checkInDate = new Date(input.checkIn);
		const checkOutDate = new Date(input.checkOut);
		const now = new Date();

		// Validate dates
		if (checkInDate <= now) {
			sendError(res, 'Validation failed', 400, [
				{ field: 'checkIn', message: 'Check-in date must be in the future' }
			]);
			return;
		}

		if (checkOutDate <= checkInDate) {
			sendError(res, 'Validation failed', 400, [
				{ field: 'checkOut', message: 'Check-out date must be after check-in date' }
			]);
			return;
		}

		// Check for date conflicts
		const conflictingBooking = await hasDateConflict(input.listingId, checkInDate, checkOutDate);
		if (conflictingBooking) {
			res.status(409).json({
				success: false,
				message: 'The selected dates are not available',
				details: {
					requestedCheckIn: input.checkIn,
					requestedCheckOut: input.checkOut,
					conflictingBooking: {
						id: conflictingBooking._id,
						checkIn: conflictingBooking.checkIn.toISOString().split('T')[0],
						checkOut: conflictingBooking.checkOut.toISOString().split('T')[0]
					}
				}
			});
			return;
		}

		// Get listing title and booking number
		const [listingTitle, bookingNumber] = await Promise.all([
			getListingTitle(input.listingType, input.listingId),
			getNextBookingNumber()
		]);

		// Create new booking document
		const newBooking = new BookingModel({
			bookingNumber,
			listingType: input.listingType,
			listingId: input.listingId,
			listingTitle,
			checkIn: checkInDate,
			checkOut: checkOutDate,
			guests: input.guests,
			guestDetails: input.guestDetails,
			specialRequests: input.specialRequests,
			pricing: input.pricing,
			status: 'pending',
			paymentStatus: 'pending'
		});

		// Save to database (pre-save hook calculates nights and total guests)
		await newBooking.save();

		sendSuccess(res, newBooking, 201, 'Booking created successfully');
	} catch (error: unknown) {
		console.error('Error creating booking:', error);

		if (error instanceof Error && error.name === 'ValidationError') {
			const mongooseError = error as unknown as { errors: Record<string, { message: string }> };
			const validationErrors = Object.keys(mongooseError.errors).map(field => ({
				field,
				message: mongooseError.errors[field].message
			}));
			sendError(res, 'Validation failed', 400, validationErrors);
			return;
		}

		sendError(res, 'Failed to create booking', 500);
	}
}

/**
 * PUT /api/bookings/:id/cancel
 *
 * Cancels an existing booking.
 *
 * Request body: CancelBookingInput
 */
export async function cancelBooking(req: Request, res: Response): Promise<void> {
	try {
		const { id } = req.params;
		const input: CancelBookingInput = req.body;

		const booking = await BookingModel.findById(id);

		if (!booking) {
			sendError(res, 'Booking not found', 404);
			return;
		}

		if (booking.status === 'cancelled') {
			sendError(res, 'This booking is already cancelled', 400);
			return;
		}

		if (booking.status === 'completed') {
			sendError(res, 'Cannot cancel a completed booking', 400);
			return;
		}

		const now = new Date();
		booking.status = 'cancelled';
		booking.cancellationReason = input.reason;
		booking.cancelledAt = now;

		await booking.save();

		sendSuccess(res, {
			_id: booking._id,
			status: booking.status,
			cancellationReason: booking.cancellationReason,
			cancelledAt: booking.cancelledAt,
			refundAmount: booking.pricing.total,
			refundStatus: 'pending'
		}, 200, 'Booking cancelled successfully');
	} catch (error) {
		console.error('Error cancelling booking:', error);
		sendError(res, 'Failed to cancel booking', 500);
	}
}
