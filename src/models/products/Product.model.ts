/**
 * Product Model
 *
 * Defines the Product entity structure using Mongoose ODM.
 * Products are local handicrafts and merchandise for sale.
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Pricing structure for products.
 */
export interface ProductPricing {
	amount: number;
	originalAmount?: number;
	discount?: number;
}

/**
 * Product specifications (flexible key-value pairs).
 */
export interface ProductSpecifications {
	material?: string;
	dimensions?: string;
	weight?: string;
	careInstructions?: string;
	[key: string]: string | undefined;
}

/**
 * Complete Product entity interface.
 */
export interface IProduct {
	title: string;
	description: string;
	category: string;
	subcategory?: string;
	price: ProductPricing;
	stock: number;
	images: string[];
	specifications?: ProductSpecifications;
	createdAt: Date;
	updatedAt: Date;
}

/**
 * Product document type (includes Mongoose Document properties).
 */
export interface IProductDocument extends IProduct, Document {}

/**
 * Input type for creating a new product.
 * Excludes auto-generated fields.
 */
export type CreateProductInput = Omit<IProduct, 'createdAt' | 'updatedAt'>;

/**
 * Input type for updating a product.
 * All fields are optional.
 */
export type UpdateProductInput = Partial<Omit<IProduct, 'createdAt' | 'updatedAt'>>;

// ============================================================================
// Mongoose Schemas
// ============================================================================

/**
 * Pricing subdocument schema.
 */
const pricingSchema = new Schema({
	amount: { type: Number, required: true, min: 0 },
	originalAmount: { type: Number, required: false },
	discount: { type: Number, required: false, min: 0, max: 100 }
}, { _id: false });

/**
 * Main Product schema.
 */
const productSchema = new Schema<IProductDocument>({
	title: {
		type: String,
		required: [true, 'Title is required'],
		trim: true,
		maxlength: 200
	},
	description: {
		type: String,
		required: [true, 'Description is required'],
		trim: true
	},
	category: {
		type: String,
		required: [true, 'Category is required'],
		trim: true
	},
	subcategory: {
		type: String,
		required: false,
		trim: true
	},
	price: {
		type: pricingSchema,
		required: true
	},
	stock: {
		type: Number,
		required: true,
		min: 0,
		default: 0
	},
	images: {
		type: [String],
		default: []
	},
	specifications: {
		type: Schema.Types.Mixed, // Flexible key-value pairs
		required: false
	}
}, {
	timestamps: true,
	collection: 'products'
});

// ============================================================================
// Indexes
// ============================================================================

productSchema.index({ category: 1 });
productSchema.index({ subcategory: 1 });
productSchema.index({ 'price.amount': 1 });
productSchema.index({ stock: 1 });
productSchema.index({ title: 'text', description: 'text' }); // Text search index

// ============================================================================
// Model Export
// ============================================================================

/**
 * Product Mongoose model.
 */
export const ProductModel: Model<IProductDocument> = mongoose.model<IProductDocument>('Product', productSchema);
