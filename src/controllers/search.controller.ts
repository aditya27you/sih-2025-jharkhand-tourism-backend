/**
 * Search Controller
 *
 * Handles unified search and autocomplete functionality across all entities.
 */

import { Request, Response } from 'express';
import { homestaysStore } from '../models/homestays/Homestay.model';
import { guidesStore } from '../models/guides/Guide.model';
import { productsStore } from '../models/products/Product.model';
import {
	sendSuccess,
	sendError,
	getPaginationMeta,
	parsePaginationParams
} from '../utils/response.utils';

/**
 * Search result types for type safety.
 */
type SearchType = 'all' | 'homestays' | 'guides' | 'products';

/**
 * Checks if a string contains the search query (case-insensitive).
 */
function matchesQuery(text: string | undefined, query: string): boolean {
	if (!text) return false;
	return text.toLowerCase().includes(query.toLowerCase());
}

/**
 * GET /api/search
 *
 * Performs unified search across homestays, guides, and products.
 *
 * Query params:
 * - q: Search query (minimum 2 characters)
 * - type: Filter by type (all, homestays, guides, products)
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 10, max: 100)
 */
export function unifiedSearch(req: Request, res: Response): void {
	const query = (req.query.q as string || '').trim();
	const type = (req.query.type as SearchType) || 'all';
	const { page, limit } = parsePaginationParams(
		req.query.page as string,
		req.query.limit as string
	);

	// Validate query length
	if (query.length < 2) {
		sendError(res, 'Validation failed', 400, [
			{ field: 'q', message: 'Search query must be at least 2 characters' }
		]);
		return;
	}

	// Search homestays
	const matchedHomestays = (type === 'all' || type === 'homestays')
		? homestaysStore
			.filter(h => h.status === 'active')
			.filter(h =>
				matchesQuery(h.title, query) ||
				matchesQuery(h.description, query) ||
				matchesQuery(h.location.district, query) ||
				matchesQuery(h.location.address, query)
			)
			.map(h => ({
				_id: h._id,
				title: h.title,
				description: h.description,
				type: 'homestay' as const,
				location: {
					district: h.location.district,
					state: h.location.state
				},
				pricing: { basePrice: h.pricing.basePrice },
				images: h.images.slice(0, 1)
			}))
		: [];

	// Search guides
	const matchedGuides = (type === 'all' || type === 'guides')
		? guidesStore
			.filter(g =>
				matchesQuery(g.name, query) ||
				matchesQuery(g.bio, query) ||
				g.specializations.some(s => matchesQuery(s, query)) ||
				matchesQuery(g.location.district, query)
			)
			.map(g => ({
				_id: g._id,
				name: g.name,
				bio: g.bio,
				type: 'guide' as const,
				specializations: g.specializations,
				pricing: { fullDay: g.pricing.fullDay }
			}))
		: [];

	// Search products
	const matchedProducts = (type === 'all' || type === 'products')
		? productsStore
			.filter(p =>
				matchesQuery(p.title, query) ||
				matchesQuery(p.description, query) ||
				matchesQuery(p.category, query)
			)
			.map(p => ({
				_id: p._id,
				title: p.title,
				description: p.description,
				type: 'product' as const,
				category: p.category,
				pricing: { amount: p.price.amount },
				images: p.images.slice(0, 1)
			}))
		: [];

	// Calculate totals
	const total = {
		homestays: matchedHomestays.length,
		guides: matchedGuides.length,
		products: matchedProducts.length,
		overall: matchedHomestays.length + matchedGuides.length + matchedProducts.length
	};

	// Apply pagination across all results
	const startIndex = (page - 1) * limit;
	const paginatedHomestays = matchedHomestays.slice(startIndex, startIndex + limit);
	const paginatedGuides = matchedGuides.slice(startIndex, startIndex + limit);
	const paginatedProducts = matchedProducts.slice(startIndex, startIndex + limit);

	sendSuccess(res, {
		results: {
			homestays: paginatedHomestays,
			guides: paginatedGuides,
			products: paginatedProducts,
			total
		},
		query,
		pagination: getPaginationMeta(page, limit, total.overall)
	});
}

/**
 * GET /api/search/autocomplete
 *
 * Provides search suggestions for autocomplete.
 *
 * Query params:
 * - q: Search query (minimum 2 characters)
 */
export function autocomplete(req: Request, res: Response): void {
	const query = (req.query.q as string || '').trim();

	// Validate query length
	if (query.length < 2) {
		sendError(res, 'Validation failed', 400, [
			{ field: 'q', message: 'Search query must be at least 2 characters' }
		]);
		return;
	}

	const suggestions: Array<{
		text: string;
		type: string;
		id?: string;
		count?: number;
	}> = [];

	// Collect matching locations (districts)
	const locationCounts = new Map<string, number>();
	homestaysStore.forEach(h => {
		if (matchesQuery(h.location.district, query)) {
			const district = h.location.district;
			locationCounts.set(district, (locationCounts.get(district) || 0) + 1);
		}
	});

	locationCounts.forEach((count, location) => {
		suggestions.push({ text: location, type: 'location', count });
	});

	// Add matching homestay titles
	homestaysStore
		.filter(h => h.status === 'active' && matchesQuery(h.title, query))
		.slice(0, 3)
		.forEach(h => {
			suggestions.push({ text: h.title, type: 'homestay', id: h._id });
		});

	// Add matching guide names
	guidesStore
		.filter(g => matchesQuery(g.name, query))
		.slice(0, 3)
		.forEach(g => {
			suggestions.push({ text: g.name, type: 'guide', id: g._id });
		});

	// Add matching product titles
	productsStore
		.filter(p => matchesQuery(p.title, query))
		.slice(0, 3)
		.forEach(p => {
			suggestions.push({ text: p.title, type: 'product', id: p._id });
		});

	// Limit total suggestions
	sendSuccess(res, {
		suggestions: suggestions.slice(0, 10)
	});
}
