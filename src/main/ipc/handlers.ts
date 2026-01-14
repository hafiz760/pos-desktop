import { ipcMain, BrowserWindow } from 'electron';
import * as models from '../models';
import * as bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';

// Helper to ensure data is cloneable for Electron IPC (Structured Clone Algorithm)
// Mongoose ObjectIds and other internal types can cause "An object could not be cloned" errors.
const toJSON = (data: any) => {
  if (data === undefined || data === null) return data;
  try {
    return JSON.parse(JSON.stringify(data));
  } catch (error) {
    console.error('Serialization error:', error);
    return data;
  }
};

export function registerIpcHandlers() {
  console.log('📡 Registering IPC handlers...');
  console.log('Available models:', mongoose.modelNames());

  // Auth Handlers
  ipcMain.handle('auth:login', async (_event, { email, password }) => {
    try {
      const user = await models.User.findOne({ email }).populate('role');
      if (!user) {
        return { success: false, error: 'Invalid email or password' };
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return { success: false, error: 'Invalid email or password' };
      }

      if (!user.isActive) {
        return { success: false, error: 'Account is deactivated' };
      }

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      // Don't send password to renderer
      const userObj = user.toObject();
      delete userObj.password;

      return toJSON({ success: true, data: userObj });
    } catch (error: any) {
      console.error('Login IPC error:', error);
      return { success: false, error: error.message };
    }
  });

  // Store Handlers
  ipcMain.handle('stores:getAll', async (_event, { page = 1, pageSize = 20, includeInactive = false, search = '' } = {}) => {
    try {
      const query: any = {};
      if (!includeInactive) query.isActive = true;
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { code: { $regex: search, $options: 'i' } }
        ];
      }

      const total = await models.Store.countDocuments(query);
      const stores = await models.Store.find(query)
        .limit(pageSize)
        .skip((page - 1) * pageSize)
        .sort({ createdAt: -1 })
        .lean();

      return toJSON({
        success: true,
        data: stores,
        total,
        page,
        totalPages: Math.ceil(total / pageSize)
      });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('stores:create', async (_event, data) => {
    try {
      const store = await models.Store.create(data);
      return toJSON({ success: true, data: store.toObject() });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('stores:update', async (_event, { id, data }) => {
    try {
      const store = await models.Store.findByIdAndUpdate(id, data, { new: true }).lean();
      return toJSON({ success: true, data: store });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('stores:getById', async (_event, id) => {
    try {
      const store = await models.Store.findById(id).lean();
      if (!store) return { success: false, error: 'Store not found' };
      return toJSON({ success: true, data: store });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('stores:toggleStatus', async (_event, id) => {
    try {
      const store = await models.Store.findById(id);
      if (!store) return { success: false, error: 'Store not found' };
      store.isActive = !store.isActive;
      await store.save();
      return toJSON({ success: true, data: store.toObject() });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // User Handlers
  ipcMain.handle('users:getAll', async (_event, { page = 1, pageSize = 12, search = '' } = {}) => {
    try {
      const query: any = {};
      if (search) {
        query.$or = [
          { fullName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ];
      }

      const total = await models.User.countDocuments(query);
      const users = await models.User.find(query)
        .populate('role')
        .limit(pageSize)
        .skip((page - 1) * pageSize)
        .sort({ createdAt: -1 })
        .lean();

      return toJSON({
        success: true,
        data: users,
        total,
        page,
        totalPages: Math.ceil(total / pageSize)
      });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('users:create', async (_event, data) => {
    try {
      const hashedPassword = await bcrypt.hash(data.password, 10);
      const user = await models.User.create({ ...data, password: hashedPassword });
      const userObj = user.toObject();
      delete userObj.password;
      return toJSON({ success: true, data: userObj });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('users:update', async (_event, { id, data }) => {
    try {
      const updateData = { ...data };
      if (updateData.password) {
        updateData.password = await bcrypt.hash(updateData.password, 10);
      } else {
        delete updateData.password;
      }
      const user = await models.User.findByIdAndUpdate(id, updateData, { new: true }).populate('role').lean();
      if (user) delete (user as any).password;
      return toJSON({ success: true, data: user });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('users:delete', async (_event, id) => {
    try {
      await models.User.findByIdAndDelete(id);
      await models.UserStore.deleteMany({ user: id });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('users:getStores', async (_event, userId) => {
    try {
      const userStores = await models.UserStore.find({ user: userId }).populate('store').lean();
      return toJSON({ success: true, data: userStores });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('users:assignStore', async (_event, { userId, storeId, role }) => {
    try {
      const userStore = await models.UserStore.findOneAndUpdate(
        { user: userId, store: storeId },
        { role },
        { upsert: true, new: true }
      ).populate('store').lean();
      return toJSON({ success: true, data: userStore });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('users:removeStore', async (_event, { userId, storeId }) => {
    try {
      await models.UserStore.findOneAndDelete({ user: userId, store: storeId });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('users:updateStoreRole', async (_event, { userId, storeId, role }) => {
    try {
      const userStore = await models.UserStore.findOneAndUpdate(
        { user: userId, store: storeId },
        { role },
        { new: true }
      ).populate('store').lean();
      return toJSON({ success: true, data: userStore });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Role Handlers
  ipcMain.handle('roles:getAll', async () => {
    try {
      const roles = await models.Role.find().sort({ name: 1 }).lean();
      return toJSON({ success: true, data: roles });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('roles:getById', async (_event, id) => {
    try {
      const role = await models.Role.findById(id).lean();
      if (!role) return { success: false, error: 'Role not found' };
      return toJSON({ success: true, data: role });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('roles:create', async (_event, data) => {
    try {
      const role = await models.Role.create(data);
      return toJSON({ success: true, data: role.toObject() });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('roles:update', async (_event, { id, data }) => {
    try {
      const role = await models.Role.findByIdAndUpdate(id, data, { new: true }).lean();
      return toJSON({ success: true, data: role });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('roles:delete', async (_event, id) => {
    try {
      // Check if any user is using this role
      const userCount = await models.User.countDocuments({ role: id });
      if (userCount > 0) {
        return { success: false, error: 'Cannot delete role assigned to users' };
      }
      await models.Role.findByIdAndDelete(id);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Profile Handlers
  ipcMain.handle('profile:update', async (_event, { id, data }) => {
    try {
      // For now, only fullName can be updated via this handler
      // avatar update will need file handling logic which we might add later
      const user = await models.User.findByIdAndUpdate(id, { fullName: data.fullName }, { new: true }).populate('role');
      const userObj = user.toObject();
      delete userObj.password;
      return toJSON({ success: true, data: userObj });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('profile:changePassword', async (_event, { id, currentPassword, newPassword }) => {
    try {
      const user = await models.User.findById(id);
      if (!user) return { success: false, error: 'User not found' };

      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) return { success: false, error: 'Current password does not match' };

      user.password = await bcrypt.hash(newPassword, 10);
      await user.save();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // --- Inventory Handlers ---

  // Category Handlers
  ipcMain.handle('categories:getAll', async (_event, { storeId, includeInactive = false } = {}) => {
    try {
      const query: any = { store: storeId };
      if (!includeInactive) query.isActive = true;
      const categories = await models.Category.find(query).populate('parent').sort({ displayOrder: 1, name: 1 }).lean();
      return toJSON({ success: true, data: categories });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('categories:create', async (_event, data) => {
    try {
      if (!data.slug && data.name) {
        data.slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      }
      const category = await models.Category.create(data);
      return toJSON({ success: true, data: category.toObject() });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('categories:update', async (_event, { id, data }) => {
    try {
      if (data.name && !data.slug) {
         data.slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      }
      const category = await models.Category.findByIdAndUpdate(id, data, { new: true }).populate('parent').lean();
      return toJSON({ success: true, data: category });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('categories:delete', async (_event, id) => {
    try {
      // Check for subcategories or products
      const childCount = await models.Category.countDocuments({ parent: id });
      if (childCount > 0) return { success: false, error: 'Cannot delete category with subcategories' };
      
      const productCount = await models.Product.countDocuments({ category: id });
      if (productCount > 0) return { success: false, error: 'Cannot delete category assigned to products' };

      await models.Category.findByIdAndDelete(id);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Brand Handlers
  ipcMain.handle('brands:getAll', async (_event, { storeId, includeInactive = false } = {}) => {
    try {
      const query: any = { store: storeId };
      if (!includeInactive) query.isActive = true;
      const brands = await models.Brand.find(query).sort({ name: 1 }).lean();
      return toJSON({ success: true, data: brands });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('brands:create', async (_event, data) => {
    try {
      if (!data.slug && data.name) {
        data.slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      }
      const brand = await models.Brand.create(data);
      return toJSON({ success: true, data: brand.toObject() });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('brands:update', async (_event, { id, data }) => {
    try {
      const brand = await models.Brand.findByIdAndUpdate(id, data, { new: true }).lean();
      return toJSON({ success: true, data: brand });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('brands:delete', async (_event, id) => {
    try {
      const productCount = await models.Product.countDocuments({ brand: id });
      if (productCount > 0) return { success: false, error: 'Cannot delete brand assigned to products' };

      await models.Brand.findByIdAndDelete(id);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Product Handlers
  ipcMain.handle('products:getAll', async (_event, { storeId, page = 1, pageSize = 20, search = '', categoryId = '', brandId = '', includeInactive = false } = {}) => {
    try {
      const query: any = { store: storeId };
      if (!includeInactive) query.isActive = true;
      if (categoryId) query.category = categoryId;
      if (brandId) query.brand = brandId;
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { sku: { $regex: search, $options: 'i' } },
          { barcode: { $regex: search, $options: 'i' } }
        ];
      }

      const total = await models.Product.countDocuments(query);
      const products = await models.Product.find(query)
        .populate('category')
        .populate('brand')
        .limit(pageSize)
        .skip((page - 1) * pageSize)
        .sort({ name: 1 })
        .lean();

      return toJSON({
        success: true,
        data: products,
        total,
        page,
        totalPages: Math.ceil(total / pageSize)
      });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('products:create', async (_event, data) => {
    try {
      const product = await models.Product.create(data);
      return toJSON({ success: true, data: product.toObject() });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('products:update', async (_event, { id, data }) => {
    try {
      const product = await models.Product.findByIdAndUpdate(id, data, { new: true })
        .populate('category')
        .populate('brand')
        .lean();
      return toJSON({ success: true, data: product });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('products:getById', async (_event, id) => {
    try {
      const product = await models.Product.findById(id)
        .populate('category')
        .populate('brand')
        .lean();
      if (!product) return { success: false, error: 'Product not found' };
      return toJSON({ success: true, data: product });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('products:delete', async (_event, id) => {
    try {
      // In a real POS, we might want to check for dependency in sales or purchases
      // For now, let's just delete or deactivate
      await models.Product.findByIdAndDelete(id);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('products:getBySku', async (_event, { storeId, sku }) => {
    try {
      const product = await models.Product.findOne({ store: storeId, sku: sku.toUpperCase() })
        .populate('category')
        .populate('brand')
        .lean();
      return toJSON({ success: true, data: product });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('products:getByBarcode', async (_event, { storeId, barcode }) => {
    try {
      const product = await models.Product.findOne({ store: storeId, barcode })
        .populate('category')
        .populate('brand')
        .lean();
      return toJSON({ success: true, data: product });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Suppliers Handlers
  ipcMain.handle('suppliers:getAll', async (_event, { storeId, page = 1, pageSize = 20, search = '' }) => {
    try {
      const query: any = { store: storeId };
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { contactPerson: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } },
        ];
      }
      const suppliers = await models.Supplier.find(query)
        .sort({ name: 1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean();
      const total = await models.Supplier.countDocuments(query);
      return toJSON({ success: true, data: suppliers, total, totalPages: Math.ceil(total / pageSize) });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('suppliers:create', async (_event, data) => {
    try {
      const supplier = await models.Supplier.create(data);
      return toJSON({ success: true, data: supplier });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('suppliers:update', async (_event, { id, data }) => {
    try {
      const supplier = await models.Supplier.findByIdAndUpdate(id, data, { new: true });
      return toJSON({ success: true, data: supplier });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('suppliers:delete', async (_event, id) => {
    try {
      await models.Supplier.findByIdAndDelete(id);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Purchase Orders Handlers
  ipcMain.handle('purchaseOrders:getAll', async (_event, { storeId, page = 1, pageSize = 20, search = '', status }) => {
    try {
      const query: any = { store: storeId };
      if (search) {
        query.poNumber = { $regex: search, $options: 'i' };
      }
      if (status) {
        query.status = status;
      }
      const pos = await models.PurchaseOrder.find(query)
        .populate('supplier')
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean();
      const total = await models.PurchaseOrder.countDocuments(query);
      return toJSON({ success: true, data: pos, total, totalPages: Math.ceil(total / pageSize) });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('purchaseOrders:getById', async (_event, id) => {
    try {
      const po = await models.PurchaseOrder.findById(id)
        .populate('supplier')
        .populate('items.product')
        .lean();
      return toJSON({ success: true, data: po });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('purchaseOrders:create', async (_event, data) => {
    try {
      if (!data.poNumber) {
        data.poNumber = `PO-${Date.now()}`;
      }
      
      const po = await models.PurchaseOrder.create(data);
      
      // Update product stock and prices
      if (po.items && po.items.length > 0) {
        for (const item of po.items) {
          const updateData: any = {
            $inc: { stockLevel: item.quantity },
            $set: { buyingPrice: item.unitCost }
          };
          
          if (item.sellingPrice && item.sellingPrice > 0) {
            updateData.$set.sellingPrice = item.sellingPrice;
          }
          
          await models.Product.findByIdAndUpdate(item.product, updateData);
        }
      }

      return toJSON({ success: true, data: po });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('purchaseOrders:update', async (_event, { id, data }) => {
    try {
      // 1. Get the existing PO to revert stock changes
      const oldPO = await models.PurchaseOrder.findById(id);
      
      if (oldPO && oldPO.items && oldPO.items.length > 0) {
        // Revert stock from old items
        for (const item of oldPO.items) {
           await models.Product.findByIdAndUpdate(item.product, {
             $inc: { stockLevel: -item.quantity }
           });
        }
      }

      // 2. Update the PO
      const po = await models.PurchaseOrder.findByIdAndUpdate(id, data, { new: true });
      
      // 3. Apply new stock and price changes
      if (po && po.items && po.items.length > 0) {
        for (const item of po.items) {
          const updateData: any = {
            $inc: { stockLevel: item.quantity },
            $set: { buyingPrice: item.unitCost }
          };
          
          if (item.sellingPrice && item.sellingPrice > 0) {
            updateData.$set.sellingPrice = item.sellingPrice;
          }
          
          await models.Product.findByIdAndUpdate(item.product, updateData);
        }
      }

      return toJSON({ success: true, data: po });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('purchaseOrders:delete', async (_event, id) => {
    try {
      await models.PurchaseOrder.findByIdAndDelete(id);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Sales Handlers
  ipcMain.handle('sales:getAll', async (_event, { storeId, page = 1, pageSize = 20, search = '' } = {}) => {
    try {
      const query: any = { store: storeId };
      if (search) {
        query.$or = [
          { invoiceNumber: { $regex: search, $options: 'i' } },
          { customerName: { $regex: search, $options: 'i' } }
        ];
      }
      
      const sales = await models.Sale.find(query)
        .populate('items.product')
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean();
        
      const total = await models.Sale.countDocuments(query);
      
      return toJSON({ 
        success: true, 
        data: sales, 
        total, 
        totalPages: Math.ceil(total / pageSize) 
      });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('sales:getById', async (_event, id) => {
    try {
      const sale = await models.Sale.findById(id).lean();
      return toJSON({ success: true, data: sale });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('sales:create', async (_event, data) => {
    try {
      // 1. Create Sale
      const sale = await models.Sale.create(data);
      
      // 2. Update Product Stock (Decrease)
      if (sale.items && sale.items.length > 0) {
        for (const item of sale.items) {
          if (item.product) {
            await models.Product.findByIdAndUpdate(item.product, {
              $inc: { stockLevel: -item.quantity }
            });
          }
        }
      }
      
      return toJSON({ success: true, data: sale });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Printer Handler
  ipcMain.handle('printer:printReceipt', async (_event, html) => {
    return new Promise((resolve) => {
      const win = new BrowserWindow({
        show: true, // Must be true for print preview to work reliably on some systems
        width: 800,
        height: 600,
        title: 'Printing Receipt...',
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      });

      // Write to a temp file to ensure proper loading/rendering
      const tempPath = path.join(require('os').tmpdir(), `receipt-${Date.now()}.html`);
      fs.writeFileSync(tempPath, html, 'utf-8');

      // Use pathToFileURL to ensure valid URL on Windows
      const fileUrl = require('url').pathToFileURL(tempPath).href;
      win.loadURL(fileUrl);

      win.webContents.on('did-finish-load', () => {
         // Small delay to ensure rendering is complete
         setTimeout(() => {
            win.webContents.print({
              silent: false,
              printBackground: true,
              deviceName: '' 
            }, (success, errorType) => {
              if (!success) {
                console.error('Print failed:', errorType);
                resolve({ success: false, error: errorType });
              } else {
                resolve({ success: true });
              }
              win.close();
              // Clean up temp file
              try {
                  if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
              } catch (e) {
                  console.error('Failed to cleanup temp print file:', e);
              }
            });
         }, 500);
      });
      
      // Handle load errors
      win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
         console.error('Print window failed to load:', errorDescription);
         resolve({ success: false, error: errorDescription });
         win.close();
         try {
             if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
         } catch (e) { console.error(e); }
      });
    });
  });

  // Image Upload Handler
  ipcMain.handle('app:uploadImage', async (_event, { base64Data, fileName }) => {
    try {
      const uploadsDir = path.join(process.cwd(), 'Uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      // Extract extension from fileName or default to .png
      const ext = path.extname(fileName) || '.png';
      const uniqueFileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      const filePath = path.join(uploadsDir, uniqueFileName);

      // Convert base64 to buffer
      const buffer = Buffer.from(base64Data, 'base64');
      fs.writeFileSync(filePath, buffer);

      // Return the public URL path (we'll serve this via protocol or dev server)
      return { success: true, url: `media://${uniqueFileName}` };
    } catch (error: any) {
      console.error('Image upload error:', error);
      return { success: false, error: error.message };
    }
  });

  console.log('✅ IPC handlers registered');
}
