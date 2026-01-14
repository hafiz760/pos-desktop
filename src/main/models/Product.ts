import mongoose, { Schema, Document } from "mongoose";

export interface IProduct extends Document {
  name: string;
  sku: string;
  barcode?: string;
  store: mongoose.Types.ObjectId;
  category: mongoose.Types.ObjectId;
  brand?: mongoose.Types.ObjectId;
  description?: string;
  specifications: {
    [key: string]: any;
  };
  images: string[];
  unit: string;
  buyingPrice: number;
  sellingPrice: number;
  stockLevel: number;
  minStockLevel: number;
  warrantyMonths?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    sku: {
      type: String,
      required: true,
      uppercase: true,
    },
    barcode: {
      type: String,
      sparse: true,
    },
    store: {
      type: Schema.Types.ObjectId,
      ref: "Store",
      required: true,
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    brand: {
      type: Schema.Types.ObjectId,
      ref: "Brand",
      required: false,
    },
    description: {
      type: String,
    },
    specifications: {
      type: Map,
      of: Schema.Types.Mixed,
      default: {},
    },
    images: [
      {
        type: String,
      },
    ],
    unit: {
      type: String,
      default: "piece",
    },
    buyingPrice: {
      type: Number,
      default: 0,
    },
    sellingPrice: {
      type: Number,
      default: 0,
    },
    stockLevel: {
      type: Number,
      default: 0,
    },
    minStockLevel: {
      type: Number,
      default: 5,
    },
    warrantyMonths: {
      type: Number,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for fast queries
ProductSchema.index({ store: 1, sku: 1 }, { unique: true });
ProductSchema.index({ store: 1, barcode: 1 }, { unique: true, sparse: true });
ProductSchema.index({ store: 1 });
ProductSchema.index({ category: 1 });
ProductSchema.index({ brand: 1 });
ProductSchema.index({ name: "text", sku: "text" }); // Full text search
ProductSchema.index({ isActive: 1 });

const ProductModel =
  mongoose.models.Product || mongoose.model<IProduct>("Product", ProductSchema);

if (mongoose.models.Product && !ProductModel.schema.paths["store"]) {
  ProductModel.schema.add({
    store: {
      type: Schema.Types.ObjectId,
      ref: "Store",
      required: true,
    },
  });
}

export default ProductModel;
