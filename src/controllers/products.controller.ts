/**
 * Products Controller
 *
 * Handles all CRUD operations for product listings.
 * Uses MongoDB via Mongoose for data persistence.
 */

import { Request, Response } from 'express';
import {
	ProductModel,
	CreateProductInput,
	UpdateProductInput
} from '../models/products/Product.model';
import {
	sendSuccess,
	sendError,
	getPaginationMeta,
	parsePaginationParams
} from '../utils/response.utils';

/**
 * GET /api/products
 *
 * Retrieves all products with pagination and optional filters.
 *
 * Query params:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 12, max: 100)
 * - category: Filter by category
 */
export async function getAllProducts(req: Request, res: Response): Promise<void> {
	try {
		const { page, limit } = parsePaginationParams(
			req.query.page as string,
			req.query.limit as string,
			12 // Default limit for products
		);
		const category = req.query.category as string | undefined;

		// Build query filter
		const filter: Record<string, unknown> = {};

		if (category) {
			filter.category = new RegExp(`^${category}$`, 'i');
		}

		// Execute query with pagination
		const [products, totalResults] = await Promise.all([
			ProductModel.find(filter)
				.skip((page - 1) * limit)
				.limit(limit)
				.sort({ createdAt: -1 }),
			ProductModel.countDocuments(filter)
		]);

		sendSuccess(res, {
			products,
			pagination: getPaginationMeta(page, limit, totalResults)
		});
	} catch (error) {
		console.error('Error fetching products:', error);
		sendError(res, 'Failed to fetch products', 500);
	}
}

/**
 * GET /api/products/:id
 *
 * Retrieves a single product by ID.
 */
export async function getProductById(req: Request, res: Response): Promise<void> {
	try {
		const { id } = req.params;
		const product = await ProductModel.findById(id);

		if (!product) {
			sendError(res, 'Product not found', 404);
			return;
		}

		sendSuccess(res, product);
	} catch (error) {
		console.error('Error fetching product:', error);
		sendError(res, 'Failed to fetch product', 500);
	}
}

/**
 * POST /api/products
 *
 * Creates a new product listing.
 *
 * Request body: CreateProductInput
 */
export async function createProduct(req: Request, res: Response): Promise<void> {
	try {
		const input: CreateProductInput = req.body;

		// Create new product document
		const newProduct = new ProductModel(input);

		// Save to database
		await newProduct.save();

		sendSuccess(res, newProduct, 201, 'Product created successfully');
	} catch (error: unknown) {
		console.error('Error creating product:', error);

		if (error instanceof Error && error.name === 'ValidationError') {
			const mongooseError = error as unknown as { errors: Record<string, { message: string }> };
			const validationErrors = Object.keys(mongooseError.errors).map(field => ({
				field,
				message: mongooseError.errors[field].message
			}));
			sendError(res, 'Validation failed', 400, validationErrors);
			return;
		}

		sendError(res, 'Failed to create product', 500);
	}
}

/**
 * PUT /api/products/:id
 *
 * Updates an existing product.
 * Supports partial updates.
 *
 * Request body: UpdateProductInput
 */
export async function updateProduct(req: Request, res: Response): Promise<void> {
	try {
		const { id } = req.params;
		const updates: UpdateProductInput = req.body;

		const updatedProduct = await ProductModel.findByIdAndUpdate(
			id,
			{ $set: updates },
			{ new: true, runValidators: true }
		);

		if (!updatedProduct) {
			sendError(res, 'Product not found', 404);
			return;
		}

		sendSuccess(res, updatedProduct, 200, 'Product updated successfully');
	} catch (error: unknown) {
		console.error('Error updating product:', error);

		if (error instanceof Error && error.name === 'ValidationError') {
			const mongooseError = error as unknown as { errors: Record<string, { message: string }> };
			const validationErrors = Object.keys(mongooseError.errors).map(field => ({
				field,
				message: mongooseError.errors[field].message
			}));
			sendError(res, 'Validation failed', 400, validationErrors);
			return;
		}

		sendError(res, 'Failed to update product', 500);
	}
}

/**
 * DELETE /api/products/:id
 *
 * Deletes a product listing.
 */
export async function deleteProduct(req: Request, res: Response): Promise<void> {
	try {
		const { id } = req.params;
		const deletedProduct = await ProductModel.findByIdAndDelete(id);

		if (!deletedProduct) {
			sendError(res, 'Product not found', 404);
			return;
		}

		sendSuccess(res, null, 200, 'Product deleted successfully');
	} catch (error) {
		console.error('Error deleting product:', error);
		sendError(res, 'Failed to delete product', 500);
	}
}
