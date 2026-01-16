import { ipcMain, BrowserWindow } from 'electron'
import * as models from '../models'
import * as bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import * as fs from 'fs'
import * as path from 'path'

// Helper to ensure data is cloneable for Electron IPC (Structured Clone Algorithm)
// Mongoose ObjectIds and other internal types can cause "An object could not be cloned" errors.
const toJSON = (data: any) => {
  if (data === undefined || data === null) return data
  try {
    return JSON.parse(JSON.stringify(data))
  } catch (error) {
    console.error('Serialization error:', error)
    return data
  }
}

export function registerIpcHandlers() {
  console.log('📡 Registering IPC handlers...')
  console.log('Available models:', mongoose.modelNames())

  // Auth Handlers
  ipcMain.handle('auth:login', async (_event, { email, password }) => {
    try {
      console.log(email, password)
      const user = await models.User.findOne({ email }).populate('role')
      if (!user) {
        return { success: false, error: 'Invalid email' }
      }

      const isMatch = await bcrypt.compare(password, user.password)
      if (!isMatch) {
        return { success: false, error: 'Invalid password' }
      }

      if (!user.isActive) {
        return { success: false, error: 'Account is deactivated' }
      }

      // Update last login
      user.lastLogin = new Date()
      await user.save()

      // Don't send password to renderer
      const userObj = user.toObject()
      delete userObj.password

      return toJSON({ success: true, data: userObj })
    } catch (error: any) {
      console.error('Login IPC error:', error)
      return { success: false, error: error.message }
    }
  })

  // Store Handlers
  ipcMain.handle(
    'stores:getAll',
    async (_event, { page = 1, pageSize = 20, includeInactive = false, search = '' } = {}) => {
      try {
        const query: any = {}
        if (!includeInactive) query.isActive = true
        if (search) {
          query.$or = [
            { name: { $regex: search, $options: 'i' } },
            { code: { $regex: search, $options: 'i' } }
          ]
        }

        const total = await models.Store.countDocuments(query)
        const stores = await models.Store.find(query)
          .limit(pageSize)
          .skip((page - 1) * pageSize)
          .sort({ createdAt: -1 })
          .lean()

        return toJSON({
          success: true,
          data: stores,
          total,
          page,
          totalPages: Math.ceil(total / pageSize)
        })
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    }
  )

  ipcMain.handle('stores:create', async (_event, data) => {
    try {
      const store = await models.Store.create(data)
      return toJSON({ success: true, data: store.toObject() })
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('stores:update', async (_event, { id, data }) => {
    try {
      const store = await models.Store.findByIdAndUpdate(id, data, { new: true }).lean()
      return toJSON({ success: true, data: store })
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('stores:getById', async (_event, id) => {
    try {
      const store = await models.Store.findById(id).lean()
      if (!store) return { success: false, error: 'Store not found' }
      return toJSON({ success: true, data: store })
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('stores:toggleStatus', async (_event, id) => {
    try {
      const store = await models.Store.findById(id)
      if (!store) return { success: false, error: 'Store not found' }
      store.isActive = !store.isActive
      await store.save()
      return toJSON({ success: true, data: store.toObject() })
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // User Handlers
  ipcMain.handle('users:getAll', async (_event, { page = 1, pageSize = 12, search = '' } = {}) => {
    try {
      const query: any = {}
      if (search) {
        query.$or = [
          { fullName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ]
      }

      const total = await models.User.countDocuments(query)
      const users = await models.User.find(query)
        .populate('role')
        .limit(pageSize)
        .skip((page - 1) * pageSize)
        .sort({ createdAt: -1 })
        .lean()

      return toJSON({
        success: true,
        data: users,
        total,
        page,
        totalPages: Math.ceil(total / pageSize)
      })
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('users:create', async (_event, data) => {
    try {
      const hashedPassword = await bcrypt.hash(data.password, 10)
      const user = await models.User.create({ ...data, password: hashedPassword })
      const userObj = user.toObject()
      delete userObj.password
      return toJSON({ success: true, data: userObj })
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('users:update', async (_event, { id, data }) => {
    try {
      const updateData = { ...data }
      if (updateData.password) {
        updateData.password = await bcrypt.hash(updateData.password, 10)
      } else {
        delete updateData.password
      }
      const user = await models.User.findByIdAndUpdate(id, updateData, { new: true })
        .populate('role')
        .lean()
      if (user) delete (user as any).password
      return toJSON({ success: true, data: user })
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('users:delete', async (_event, id) => {
    try {
      await models.User.findByIdAndDelete(id)
      await models.UserStore.deleteMany({ user: id })
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('users:getStores', async (_event, userId) => {
    try {
      const userStores = await models.UserStore.find({ user: userId }).populate('store').lean()
      return toJSON({ success: true, data: userStores })
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('users:assignStore', async (_event, { userId, storeId, role }) => {
    try {
      const userStore = await models.UserStore.findOneAndUpdate(
        { user: userId, store: storeId },
        { role },
        { upsert: true, new: true }
      )
        .populate('store')
        .lean()
      return toJSON({ success: true, data: userStore })
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('users:removeStore', async (_event, { userId, storeId }) => {
    try {
      await models.UserStore.findOneAndDelete({ user: userId, store: storeId })
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('users:updateStoreRole', async (_event, { userId, storeId, role }) => {
    try {
      const userStore = await models.UserStore.findOneAndUpdate(
        { user: userId, store: storeId },
        { role },
        { new: true }
      )
        .populate('store')
        .lean()
      return toJSON({ success: true, data: userStore })
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Role Handlers
  ipcMain.handle('roles:getAll', async () => {
    try {
      const roles = await models.Role.find().sort({ name: 1 }).lean()
      return toJSON({ success: true, data: roles })
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('roles:getById', async (_event, id) => {
    try {
      const role = await models.Role.findById(id).lean()
      if (!role) return { success: false, error: 'Role not found' }
      return toJSON({ success: true, data: role })
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('roles:create', async (_event, data) => {
    try {
      const role = await models.Role.create(data)
      return toJSON({ success: true, data: role.toObject() })
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('roles:update', async (_event, { id, data }) => {
    try {
      const role = await models.Role.findByIdAndUpdate(id, data, { new: true }).lean()
      return toJSON({ success: true, data: role })
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('roles:delete', async (_event, id) => {
    try {
      // Check if any user is using this role
      const userCount = await models.User.countDocuments({ role: id })
      if (userCount > 0) {
        return { success: false, error: 'Cannot delete role assigned to users' }
      }
      await models.Role.findByIdAndDelete(id)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Profile Handlers
  ipcMain.handle('profile:update', async (_event, { id, data }) => {
    try {
      const updateData: any = {}
      if (data.fullName) updateData.fullName = data.fullName
      if (data.avatarUrl) updateData.avatarUrl = data.avatarUrl
      if (data.avatar && !data.avatarUrl) updateData.avatarUrl = data.avatar // Compatibility

      if (data.password) {
        updateData.password = await bcrypt.hash(data.password, 10)
      }

      const user = await models.User.findByIdAndUpdate(id, updateData, { new: true }).populate(
        'role'
      )

      if (!user) {
        return { success: false, error: 'User not found' }
      }

      const userObj = user.toObject()
      delete userObj.password
      return toJSON({ success: true, data: userObj })
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('profile:changePassword', async (_event, { id, currentPassword, newPassword }) => {
    try {
      const user = await models.User.findById(id)
      if (!user) return { success: false, error: 'User not found' }

      const isMatch = await bcrypt.compare(currentPassword, user.password)
      if (!isMatch) return { success: false, error: 'Current password does not match' }

      user.password = await bcrypt.hash(newPassword, 10)
      await user.save()
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // --- Inventory Handlers ---

  // Category Handlers
  ipcMain.handle('categories:getAll', async (_event, { storeId, includeInactive = false } = {}) => {
    try {
      const query: any = { store: storeId }
      if (!includeInactive) query.isActive = true
      const categories = await models.Category.find(query)
        .populate('parent')
        .sort({ displayOrder: 1, name: 1 })
        .lean()
      return toJSON({ success: true, data: categories })
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('categories:create', async (_event, data) => {
    try {
      if (!data.slug && data.name) {
        data.slug = data.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '')
      }
      const category = await models.Category.create(data)
      return toJSON({ success: true, data: category.toObject() })
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('categories:update', async (_event, { id, data }) => {
    try {
      if (data.name && !data.slug) {
        data.slug = data.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '')
      }
      const category = await models.Category.findByIdAndUpdate(id, data, { new: true })
        .populate('parent')
        .lean()
      return toJSON({ success: true, data: category })
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('categories:delete', async (_event, id) => {
    try {
      // Check for subcategories or products
      const childCount = await models.Category.countDocuments({ parent: id })
      if (childCount > 0)
        return { success: false, error: 'Cannot delete category with subcategories' }

      const productCount = await models.Product.countDocuments({ category: id })
      if (productCount > 0)
        return { success: false, error: 'Cannot delete category assigned to products' }

      await models.Category.findByIdAndDelete(id)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Brand Handlers
  ipcMain.handle('brands:getAll', async (_event, { storeId, includeInactive = false } = {}) => {
    try {
      const query: any = { store: storeId }
      if (!includeInactive) query.isActive = true
      const brands = await models.Brand.find(query).sort({ name: 1 }).lean()
      return toJSON({ success: true, data: brands })
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('brands:create', async (_event, data) => {
    try {
      if (!data.slug && data.name) {
        data.slug = data.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '')
      }
      const brand = await models.Brand.create(data)
      return toJSON({ success: true, data: brand.toObject() })
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('brands:update', async (_event, { id, data }) => {
    try {
      const brand = await models.Brand.findByIdAndUpdate(id, data, { new: true }).lean()
      return toJSON({ success: true, data: brand })
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('brands:delete', async (_event, id) => {
    try {
      const productCount = await models.Product.countDocuments({ brand: id })
      if (productCount > 0)
        return { success: false, error: 'Cannot delete brand assigned to products' }

      await models.Brand.findByIdAndDelete(id)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Product Handlers
  ipcMain.handle(
    'products:getAll',
    async (
      _event,
      {
        storeId,
        page = 1,
        pageSize = 20,
        search = '',
        categoryId = '',
        brandId = '',
        includeInactive = false
      } = {}
    ) => {
      try {
        const query: any = { store: storeId }
        if (!includeInactive) query.isActive = true
        if (categoryId) query.category = categoryId
        if (brandId) query.brand = brandId
        if (search) {
          query.$or = [
            { name: { $regex: search, $options: 'i' } },
            { sku: { $regex: search, $options: 'i' } },
            { barcode: { $regex: search, $options: 'i' } }
          ]
        }

        const total = await models.Product.countDocuments(query)
        const products = await models.Product.find(query)
          .populate('category')
          .populate('brand')
          .limit(pageSize)
          .skip((page - 1) * pageSize)
          .sort({ name: 1 })
          .lean()

        return toJSON({
          success: true,
          data: products,
          total,
          page,
          totalPages: Math.ceil(total / pageSize)
        })
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    }
  )

  ipcMain.handle('products:create', async (_event, data) => {
    try {
      // Sanitize all fields: convert empty strings to null to prevent BSONError on ObjectIds
      const sanitizedData = Object.keys(data).reduce((acc: any, key) => {
        acc[key] = data[key] === '' ? null : data[key]
        return acc
      }, {})

      const product = await models.Product.create(sanitizedData)
      return toJSON({ success: true, data: product.toObject() })
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('products:update', async (_event, { id, data }) => {
    try {
      // Sanitize all fields: convert empty strings to null to prevent BSONError on ObjectIds
      const sanitizedData = Object.keys(data).reduce((acc: any, key) => {
        acc[key] = data[key] === '' ? null : data[key]
        return acc
      }, {})

      const product = await models.Product.findByIdAndUpdate(id, sanitizedData, { new: true })
        .populate('category')
        .populate('brand')
        .lean()
      return toJSON({ success: true, data: product })
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('products:getById', async (_event, id) => {
    try {
      const product = await models.Product.findById(id)
        .populate('category')
        .populate('brand')
        .lean()
      if (!product) return { success: false, error: 'Product not found' }
      return toJSON({ success: true, data: product })
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('products:delete', async (_event, id) => {
    try {
      // In a real POS, we might want to check for dependency in sales or purchases
      // For now, let's just delete or deactivate
      await models.Product.findByIdAndDelete(id)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('products:getBySku', async (_event, { storeId, sku }) => {
    try {
      const product = await models.Product.findOne({ store: storeId, sku: sku.toUpperCase() })
        .populate('category')
        .populate('brand')
        .lean()
      return toJSON({ success: true, data: product })
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('products:getByBarcode', async (_event, { storeId, barcode }) => {
    try {
      const product = await models.Product.findOne({ store: storeId, barcode })
        .populate('category')
        .populate('brand')
        .lean()
      return toJSON({ success: true, data: product })
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Suppliers Handlers
  ipcMain.handle(
    'suppliers:getAll',
    async (_event, { storeId, page = 1, pageSize = 20, search = '' }) => {
      try {
        const query: any = { store: storeId }
        if (search) {
          query.$or = [
            { name: { $regex: search, $options: 'i' } },
            { contactPerson: { $regex: search, $options: 'i' } },
            { phone: { $regex: search, $options: 'i' } }
          ]
        }
        const suppliers = await models.Supplier.find(query)
          .sort({ name: 1 })
          .skip((page - 1) * pageSize)
          .limit(pageSize)
          .lean()
        const total = await models.Supplier.countDocuments(query)
        return toJSON({
          success: true,
          data: suppliers,
          total,
          totalPages: Math.ceil(total / pageSize)
        })
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    }
  )

  ipcMain.handle('suppliers:create', async (_event, data) => {
    try {
      const supplier = await models.Supplier.create(data)
      return toJSON({ success: true, data: supplier })
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('suppliers:update', async (_event, { id, data }) => {
    try {
      const supplier = await models.Supplier.findByIdAndUpdate(id, data, { new: true })
      return toJSON({ success: true, data: supplier })
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('suppliers:delete', async (_event, id) => {
    try {
      await models.Supplier.findByIdAndDelete(id)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Purchase Orders Handlers
  ipcMain.handle(
    'purchaseOrders:getAll',
    async (_event, { storeId, page = 1, pageSize = 20, search = '', status }) => {
      try {
        const query: any = { store: storeId }
        if (search) {
          query.poNumber = { $regex: search, $options: 'i' }
        }
        if (status) {
          query.status = status
        }
        const pos = await models.PurchaseOrder.find(query)
          .populate('supplier')
          .sort({ createdAt: -1 })
          .skip((page - 1) * pageSize)
          .limit(pageSize)
          .lean()
        const total = await models.PurchaseOrder.countDocuments(query)
        return toJSON({ success: true, data: pos, total, totalPages: Math.ceil(total / pageSize) })
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    }
  )

  ipcMain.handle('purchaseOrders:getById', async (_event, id) => {
    try {
      const po = await models.PurchaseOrder.findById(id)
        .populate('supplier')
        .populate('items.product')
        .lean()
      return toJSON({ success: true, data: po })
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('purchaseOrders:create', async (_event, data) => {
    try {
      if (!data.poNumber) {
        data.poNumber = `PO-${Date.now()}`
      }

      const po = await models.PurchaseOrder.create(data)

      // Update product stock and prices
      if (po.items && po.items.length > 0) {
        for (const item of po.items) {
          const updateData: any = {
            $inc: { stockLevel: item.quantity },
            $set: { buyingPrice: item.unitCost }
          }

          if (item.sellingPrice && item.sellingPrice > 0) {
            updateData.$set.sellingPrice = item.sellingPrice
          }

          await models.Product.findByIdAndUpdate(item.product, updateData)
        }
      }

      return toJSON({ success: true, data: po })
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('purchaseOrders:update', async (_event, { id, data }) => {
    try {
      // 1. Get the existing PO to revert stock changes
      const oldPO = await models.PurchaseOrder.findById(id)

      if (oldPO && oldPO.items && oldPO.items.length > 0) {
        // Revert stock from old items
        for (const item of oldPO.items) {
          await models.Product.findByIdAndUpdate(item.product, {
            $inc: { stockLevel: -item.quantity }
          })
        }
      }

      // 2. Update the PO
      const po = await models.PurchaseOrder.findByIdAndUpdate(id, data, { new: true })

      // 3. Apply new stock and price changes
      if (po && po.items && po.items.length > 0) {
        for (const item of po.items) {
          const updateData: any = {
            $inc: { stockLevel: item.quantity },
            $set: { buyingPrice: item.unitCost }
          }

          if (item.sellingPrice && item.sellingPrice > 0) {
            updateData.$set.sellingPrice = item.sellingPrice
          }

          await models.Product.findByIdAndUpdate(item.product, updateData)
        }
      }

      return toJSON({ success: true, data: po })
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('purchaseOrders:delete', async (_event, id) => {
    try {
      await models.PurchaseOrder.findByIdAndDelete(id)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Sales Handlers
  ipcMain.handle(
    'sales:getAll',
    async (_event, { storeId, page = 1, pageSize = 20, search = '' } = {}) => {
      try {
        const query: any = { store: storeId }
        if (search) {
          query.$or = [
            { invoiceNumber: { $regex: search, $options: 'i' } },
            { customerName: { $regex: search, $options: 'i' } }
          ]
        }

        const sales = await models.Sale.find(query)
          .populate('items.product')
          .sort({ createdAt: -1 })
          .skip((page - 1) * pageSize)
          .limit(pageSize)
          .lean()

        const total = await models.Sale.countDocuments(query)

        return toJSON({
          success: true,
          data: sales,
          total,
          totalPages: Math.ceil(total / pageSize)
        })
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    }
  )

  ipcMain.handle('sales:getById', async (_event, id) => {
    try {
      const sale = await models.Sale.findById(id).lean()
      return toJSON({ success: true, data: sale })
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('sales:create', async (_event, data) => {
    try {
      // 1. Create Sale
      const sale = await models.Sale.create(data)

      // 2. Update Product Stock (Decrease)
      if (sale.items && sale.items.length > 0) {
        for (const item of sale.items) {
          if (item.product) {
            await models.Product.findByIdAndUpdate(item.product, {
              $inc: { stockLevel: -item.quantity }
            })
          }
        }
      }

      return toJSON({ success: true, data: sale })
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('sales:delete', async (_event, id) => {
    try {
      const sale = await models.Sale.findById(id)
      if (!sale) return { success: false, error: 'Sale record not found' }

      // Revert stock (Increase back)
      if (sale.items && sale.items.length > 0) {
        for (const item of sale.items) {
          if (item.product) {
            await models.Product.findByIdAndUpdate(item.product, {
              $inc: { stockLevel: item.quantity }
            })
          }
        }
      }

      await models.Sale.findByIdAndDelete(id)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Accounts Handlers
  ipcMain.handle(
    'accounts:getAll',
    async (_event, { storeId, page = 1, pageSize = 20, search = '' }) => {
      try {
        const query: any = { store: storeId }
        if (search) {
          query.accountName = { $regex: search, $options: 'i' }
        }

        const total = await models.Account.countDocuments(query)
        const data = await models.Account.find(query)
          .skip((page - 1) * pageSize)
          .limit(pageSize)
          .sort({ accountCode: 1 })
          .lean()

        // Calculate Summary
        const allAccounts = await models.Account.find({ store: storeId }).lean()
        const summary = {
          totalAssets: 0,
          totalRevenue: 0,
          totalExpenses: 0
        }

        allAccounts.forEach((acc) => {
          if (acc.accountType === 'ASSET') summary.totalAssets += acc.currentBalance
          if (acc.accountType === 'REVENUE') summary.totalRevenue += acc.currentBalance
          if (acc.accountType === 'EXPENSE') summary.totalExpenses += acc.currentBalance
        })

        return toJSON({
          success: true,
          data,
          total,
          totalPages: Math.ceil(total / pageSize),
          summary
        })
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    }
  )

  ipcMain.handle('accounts:create', async (_event, data) => {
    try {
      // Set opening balance as initial current balance
      const accountData = {
        ...data,
        currentBalance: data.currentBalance || 0,
        openingBalance: data.currentBalance || 0
      }
      const account = await models.Account.create(accountData)
      return toJSON({ success: true, data: account })
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('accounts:update', async (_event, { id, data }) => {
    try {
      const account = await models.Account.findByIdAndUpdate(id, data, { new: true })
      return toJSON({ success: true, data: account })
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('accounts:delete', async (_event, id) => {
    try {
      // Check for transactions (optional but recommended)
      const hasExpenses = await models.Expense.exists({ account: id })
      if (hasExpenses) {
        return { success: false, error: 'Cannot delete account with existing transactions' }
      }
      await models.Account.findByIdAndDelete(id)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Expenses Handlers
  ipcMain.handle(
    'expenses:getAll',
    async (_event, { storeId, page = 1, pageSize = 20, search = '' }) => {
      try {
        const query: any = { store: storeId }
        if (search) {
          query.description = { $regex: search, $options: 'i' }
        }

        const total = await models.Expense.countDocuments(query)
        const data = await models.Expense.find(query)
          .populate('account')
          .skip((page - 1) * pageSize)
          .limit(pageSize)
          .sort({ createdAt: -1 })
          .lean()

        return toJSON({
          success: true,
          data,
          total,
          totalPages: Math.ceil(total / pageSize)
        })
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    }
  )

  ipcMain.handle('expenses:create', async (_event, data) => {
    try {
      // Generate unique expense number
      const count = await models.Expense.countDocuments()
      const expenseNumber = `EXP-${Date.now()}-${count + 1}`

      const expense = await models.Expense.create({ ...data, expenseNumber })

      // Update Account Balance (Decrease)
      if (data.account) {
        await models.Account.findByIdAndUpdate(data.account, {
          $inc: { currentBalance: -data.amount }
        })
      }

      return toJSON({ success: true, data: expense })
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Raw Thermal Printer Handler
  ipcMain.handle('printer:printRawReceipt', async (_event, data) => {
    const { ThermalPrinter, PrinterTypes } = require('node-thermal-printer')
    console.log('🖨️ printer:printRawReceipt handler called with data:', data)

    try {
      const printer = new ThermalPrinter({
        type: PrinterTypes.EPSON, // POS80 is usually Epson compatible
        interface: `printer:STMicroelectronics_POS80_Printer_USB`,
        characterSet: 'PC437_USA',
        removeSpecialCharacters: false,
        options: {
          timeout: 5000
        }
      })

      const isConnected = await printer.isPrinterConnected()
      console.log('🔌 Printer connected:', isConnected)

      printer.alignCenter()
      printer.bold(true)
      printer.setTextSize(1, 1)
      printer.println('RexPOS')
      printer.bold(false)
      printer.setTextNormal()

      if (data.storeAddress) printer.println(data.storeAddress)
      if (data.storePhone) printer.println(`Tel: ${data.storePhone}`)

      printer.newLine()
      printer.println(`${data.saleDate} - ${data.invoiceNumber}`)
      printer.drawLine()

      if (data.customerName) {
        printer.alignLeft()
        printer.println(`Customer: ${data.customerName}`)
        if (data.customerPhone) printer.println(`Phone: ${data.customerPhone}`)
        printer.drawLine()
      }

      printer.alignLeft()
      data.items.forEach((item: any) => {
        printer.println(`${item.productName}`)
        printer.tableCustom([
          {
            text: `  ${item.quantity} x ${item.sellingPrice.toLocaleString()}`,
            align: 'LEFT',
            width: 0.6
          },
          { text: item.totalAmount.toLocaleString(), align: 'RIGHT', width: 0.4 }
        ])
      })

      printer.drawLine()
      printer.tableCustom([
        { text: 'Subtotal', align: 'LEFT', width: 0.5 },
        { text: data.subtotal.toLocaleString(), align: 'RIGHT', width: 0.5 }
      ])
      printer.tableCustom([
        { text: 'Tax', align: 'LEFT', width: 0.5 },
        { text: data.taxAmount.toLocaleString(), align: 'RIGHT', width: 0.5 }
      ])
      if (data.discountAmount > 0) {
        printer.tableCustom([
          { text: 'Discount', align: 'LEFT', width: 0.5 },
          { text: `-${data.discountAmount.toLocaleString()}`, align: 'RIGHT', width: 0.5 }
        ])
      }

      printer.bold(true)
      printer.setTextSize(1, 1)
      printer.tableCustom([
        { text: 'TOTAL', align: 'LEFT', width: 0.5 },
        { text: `Rs. ${data.totalAmount.toLocaleString()}`, align: 'RIGHT', width: 0.5 }
      ])
      printer.setTextNormal()
      printer.bold(false)

      printer.newLine()
      printer.alignCenter()
      printer.println('Thank you for visiting!')
      printer.newLine()
      printer.cut()

      await printer.execute()
      console.log('✅ Print job sent successfully')
      return { success: true }
    } catch (error: any) {
      console.error('❌ Print failed:', error)
      return { success: false, error: error.message }
    }
  })

  // Old Printer Handler (keeping for backward compatibility or as fallback)
  ipcMain.handle('printer:printReceipt', async (_event, html) => {
    console.log('🖨️ printer:printReceipt IPC handler called')
    return new Promise((resolve) => {
      const win = new BrowserWindow({
        show: true, // Must be true for print dialog to show on Mac
        width: 400,
        height: 600,
        title: 'Printing Receipt...',
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      })

      // Write to a temp file to ensure proper loading/rendering
      const tempPath = path.join(require('os').tmpdir(), `receipt-${Date.now()}.html`)
      fs.writeFileSync(tempPath, html, 'utf-8')

      // Use pathToFileURL to ensure valid URL on Windows
      const fileUrl = require('url').pathToFileURL(tempPath).href
      win.loadURL(fileUrl)

      win.webContents.on('did-finish-load', () => {
        // More robust delay to ensure fonts and styles are loaded
        setTimeout(() => {
          win.webContents.print(
            {
              silent: false, // SHOW DIALOG so you can select 80mm paper size
              printBackground: true,
              deviceName: '',
              pageSize: {
                width: 80000, // 80mm in microns
                height: 100000 // 100mm in microns
              },
              margins: { marginType: 'none' }
            },
            (success, errorType) => {
              if (!success) {
                console.error('Print failed:', errorType)
                resolve({ success: false, error: errorType })
              } else {
                resolve({ success: true })
              }
              // Close window after a small delay to prevent crashing on some OS
              setTimeout(() => {
                if (!win.isDestroyed()) win.close()
              }, 500)

              // Clean up temp file
              try {
                if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath)
              } catch (e) {
                console.error('Failed to cleanup temp print file:', e)
              }
            }
          )
        }, 800)
      })

      // Handle load errors
      win.webContents.on('did-fail-load', (_event, _errorCode, errorDescription) => {
        console.error('Print window failed to load:', errorDescription)
        resolve({ success: false, error: errorDescription })
        win.close()
        try {
          if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath)
        } catch (e) {
          console.error(e)
        }
      })
    })
  })

  // Image Upload Handler
  ipcMain.handle('app:uploadImage', async (_event, { base64Data, fileName }) => {
    try {
      const { app } = require('electron')
      const uploadsDir = path.join(app.getPath('userData'), 'Uploads')
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true })
      }

      // Extract extension from fileName or default to .png
      const ext = path.extname(fileName) || '.png'
      const uniqueFileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`
      const filePath = path.join(uploadsDir, uniqueFileName)

      // Convert base64 to buffer
      const buffer = Buffer.from(base64Data, 'base64')
      fs.writeFileSync(filePath, buffer)

      // Return the public URL path (we'll serve this via protocol or dev server)
      return { success: true, url: `media://${uniqueFileName}` }
    } catch (error: any) {
      console.error('Image upload error:', error)
      return { success: false, error: error.message }
    }
  })

  // Dashboard Handlers
  ipcMain.handle('dashboard:getStats', async (_event, storeId) => {
    try {
      const sales = await models.Sale.find({ store: storeId })
      const products = await models.Product.find({ store: storeId })

      const revenue = sales.reduce((acc, sale) => acc + (sale.totalAmount || 0), 0)
      const profit = sales.reduce((acc, sale) => acc + (sale.profitAmount || 0), 0)
      const salesCount = sales.length

      const lowStockCount = products.filter((p) => p.stockLevel <= p.minStockLevel).length

      // Get last 7 days chart data
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
      sevenDaysAgo.setHours(0, 0, 0, 0)

      const recentSalesForChart = await models.Sale.find({
        store: storeId,
        createdAt: { $gte: sevenDaysAgo }
      }).lean()

      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      const chartDataMap = new Map()

      // Initialize last 7 days
      for (let i = 0; i < 7; i++) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        const dayName = days[date.getDay()]
        chartDataMap.set(dayName, 0)
      }

      recentSalesForChart.forEach((sale) => {
        const dayName = days[new Date(sale.createdAt).getDay()]
        if (chartDataMap.has(dayName)) {
          chartDataMap.set(dayName, chartDataMap.get(dayName) + (sale.totalAmount || 0))
        }
      })

      const chartData = Array.from(chartDataMap.entries())
        .map(([name, sales]) => ({ name, sales }))
        .reverse()

      const recentSales = await models.Sale.find({ store: storeId })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean()
        .then((sales) =>
          sales.map((s) => ({
            customerName: s.customerName,
            createdAt: s.createdAt,
            totalAmount: s.totalAmount,
            paymentStatus: s.paymentStatus
          }))
        )

      return toJSON({
        success: true,
        data: {
          revenue,
          profit,
          salesCount,
          lowStockCount,
          recentSales,
          chartData
        }
      })
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  console.log('✅ IPC handlers registered')
}
