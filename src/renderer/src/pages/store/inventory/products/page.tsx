import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { DataPage } from '@renderer/components/shared/data-page'
import { Badge } from '@renderer/components/ui/badge'
import { LoadingButton } from '@renderer/components/ui/loading-button'
import { Button } from '@renderer/components/ui/button'
import { MoreVertical, Edit, Trash2, Eye, Upload, X, Package as PackageIcon } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@renderer/components/ui/dialog'
import { Input } from '@renderer/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { toast } from 'sonner'
import { DeleteConfirm } from '@renderer/components/shared/delete-confirm'
import { z } from 'zod'
import { useForm, SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@renderer/components/ui/form'

const productSchema = z.object({
  name: z.string().min(2, 'Product name is required'),
  sku: z.string().min(2, 'SKU is required'),
  category: z.string().min(1, 'Category is required'),
  brand: z.string().optional().or(z.literal('')),
  barcode: z.string().optional().or(z.literal('')),
  description: z.string().optional().or(z.literal('')),
  unit: z.string().min(1, 'Unit is required')
})

type ProductFormValues = z.infer<typeof productSchema>

export default function ProductsPage() {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [searchTerm, setSearchTerm] = useState('')
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const navigate = useNavigate()
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])

  const [products, setProducts] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [brands, setBrands] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [totalRecords, setTotalRecords] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Get current store from local storage (managed by StoreSwitcher or similar)
  const [currentStore, setCurrentStore] = useState<any>(null)

  useEffect(() => {
    const storeData = localStorage.getItem('selectedStore')
    if (storeData) {
      setCurrentStore(JSON.parse(storeData))
    }
  }, [])

  const loadInitialData = async () => {
    if (!currentStore?._id) return
    try {
      const [catsRes, brandsRes] = await Promise.all([
        window.api.categories.getAll({ storeId: currentStore._id }),
        window.api.brands.getAll({ storeId: currentStore._id })
      ])
      if (catsRes.success) setCategories(catsRes.data)
      if (brandsRes.success) setBrands(brandsRes.data)
    } catch (error) {
      console.error('Failed to load initial data:', error)
    }
  }

  const loadProducts = async () => {
    if (!currentStore?._id) return
    setIsLoading(true)
    try {
      const result = await window.api.products.getAll({
        storeId: currentStore._id,
        page,
        pageSize,
        search: searchTerm
      })
      if (result.success) {
        setProducts(result.data)
        setTotalRecords(result.total)
        setTotalPages(result.totalPages)
      } else {
        toast.error('Failed to load products: ' + result.error)
      }
    } catch (error) {
      toast.error('Failed to load products')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadInitialData()
  }, [currentStore?._id])

  useEffect(() => {
    loadProducts()
  }, [currentStore?._id, page, pageSize, searchTerm])

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '',
      sku: '',
      category: '',
      brand: '',
      barcode: '',
      description: '',
      unit: 'pcs'
    }
  })

  const handleDelete = async () => {
    if (!deleteId) return
    setIsDeleting(true)
    try {
      const result = await window.api.products.delete(deleteId)
      if (result.success) {
        toast.success('Product deleted successfully')
        setDeleteId(null)
        loadProducts()
      } else {
        toast.error('Failed to delete product: ' + result.error)
      }
    } catch (error: any) {
      toast.error('Failed to delete product: ' + error.message)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files)
      setSelectedFiles((prev) => [...prev, ...files])

      // Create previews using base64 for better compatibility in Electron
      const newPreviews: string[] = []
      for (const file of files) {
        try {
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.readAsDataURL(file)
            reader.onload = () => resolve(reader.result as string)
            reader.onerror = (error) => reject(error)
          })
          newPreviews.push(base64)
        } catch (err) {
          console.error('Failed to generate preview for', file.name, err)
        }
      }
      setImagePreviews((prev) => [...prev, ...newPreviews])
    }
  }

  const removeImage = (index: number) => {
    setImagePreviews((prev) => {
      const targetUrl = prev[index]

      // If it's a new file (not from media storage), remove from selectedFiles
      if (!targetUrl.startsWith('media://')) {
        // Find the index among non-media previews to match with selectedFiles
        const nonMediaPreviews = prev.filter((u) => !u.startsWith('media://'))
        const previewRelativeIndex = nonMediaPreviews.indexOf(targetUrl)

        if (previewRelativeIndex !== -1) {
          setSelectedFiles((currentFiles) =>
            currentFiles.filter((_, i) => i !== previewRelativeIndex)
          )
        }
      }

      return prev.filter((_, i) => i !== index)
    })
  }

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1]
        resolve(base64)
      }
      reader.onerror = (error) => reject(error)
    })
  }

  const onSubmit: SubmitHandler<ProductFormValues> = async (values) => {
    if (!currentStore?._id) {
      toast.error('No store selected')
      return
    }
    setIsSubmitting(true)
    try {
      const uploadedUrls: string[] = [...imagePreviews.filter((url) => url.startsWith('media://'))]

      // Upload new files
      for (const file of selectedFiles) {
        try {
          const base64Data = await fileToBase64(file)
          const uploadRes = await window.api.app.uploadImage({
            base64Data,
            fileName: file.name
          })
          if (uploadRes.success) {
            uploadedUrls.push(uploadRes.url)
          }
        } catch (err) {
          console.error('Failed to upload file:', file.name, err)
          toast.error(`Failed to upload ${file.name}`)
        }
      }

      const data = {
        ...values,
        store: currentStore._id,
        images: uploadedUrls,
        brand: values.brand || null
      }

      let result
      if (isEditOpen && selectedProduct) {
        result = await window.api.products.update(selectedProduct._id, data)
      } else {
        result = await window.api.products.create(data)
      }

      if (result.success) {
        toast.success(`Product ${isEditOpen ? 'updated' : 'created'} successfully`)
        setIsAddOpen(false)
        setIsEditOpen(false)
        resetForm()
        loadProducts()
      } else {
        toast.error('Error: ' + result.error)
      }
    } catch (error: any) {
      toast.error(error.message || 'An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetForm = () => {
    form.reset({
      name: '',
      sku: `PRD-${Date.now()}`,
      category: '',
      brand: '',
      barcode: '',
      description: '',
      unit: 'pcs'
    })
    setSelectedProduct(null)
    setImagePreviews([])
    setSelectedFiles([])
  }

  const openAdd = () => {
    resetForm()
    setIsAddOpen(true)
  }

  const openEdit = (product: any) => {
    setSelectedProduct(product)
    form.reset({
      name: product.name,
      sku: product.sku,
      category: product.category?._id || product.category,
      brand: product.brand?._id || product.brand || '',
      barcode: product.barcode || '',
      description: product.description || '',
      unit: product.unit || 'pcs'
    })
    setImagePreviews(product.images || [])
    setSelectedFiles([])
    setIsEditOpen(true)
  }

  const openDetail = (product: any) => {
    navigate(`/dashboard/inventory/products/${product._id}`)
  }

  const columns = [
    {
      header: 'Sr #',
      accessor: '_id',
      render: (_: any, index: number) => (
        <span className="text-muted-foreground font-mono text-xs">
          {(page - 1) * pageSize + index + 1}
        </span>
      )
    },
    {
      header: 'Product',
      accessor: 'name',
      render: (item: any) => (
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded border border-border bg-muted flex items-center justify-center overflow-hidden shrink-0">
            {item.images && item.images.length > 0 ? (
              <img src={item.images[0]} alt={item.name} className="h-full w-full object-cover" />
            ) : (
              <PackageIcon className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-foreground leading-tight">{item.name}</span>
            <span className="text-[10px] text-muted-foreground uppercase font-mono">
              {item.sku}
            </span>
          </div>
        </div>
      )
    },
    { header: 'Category', accessor: 'category.name' },
    {
      header: 'Brand',
      accessor: 'brand.name',
      render: (item: any) =>
        item.brand?.name || <span className="text-muted-foreground italic">No Brand</span>
    },
    {
      header: 'Price',
      accessor: 'sellingPrice',
      render: (item: any) => (
        <span className="text-[#4ade80] font-bold">
          Rs. {(item.sellingPrice || 0).toLocaleString()}
        </span>
      )
    },
    {
      header: 'Stock',
      accessor: 'stockLevel',
      render: (item: any) => (
        <Badge
          className={
            (item.stockLevel || 0) < (item.minStockLevel || 5)
              ? 'bg-red-500/10 text-red-500 border-red-500/20'
              : 'bg-muted text-muted-foreground border-border'
          }
        >
          {item.stockLevel || 0} pcs
        </Badge>
      )
    },
    {
      header: 'Actions',
      accessor: '_id',
      render: (item: any) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="hover:bg-accent">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="bg-popover border-border text-popover-foreground"
            align="end"
          >
            <DropdownMenuItem
              onClick={() => openDetail(item)}
              className="focus:bg-[#4ade80] focus:text-black cursor-pointer"
            >
              <Eye className="w-4 h-4 mr-2" />
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => openEdit(item)}
              className="focus:bg-[#4ade80] focus:text-black cursor-pointer"
            >
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setDeleteId(item._id)}
              className="focus:bg-red-500 focus:text-white cursor-pointer text-red-400"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }
  ]

  if (!currentStore) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <h2 className="text-2xl font-bold">No Store Selected</h2>
        <p className="text-muted-foreground">Please select a store to manage products.</p>
      </div>
    )
  }

  return (
    <>
      <DataPage
        title="Products"
        description="Manage your product inventory and stock levels."
        data={products}
        columns={columns}
        searchPlaceholder="Search products, SKU..."
        fileName="products_export"
        addLabel="Add Product"
        onAdd={openAdd}
        isLoading={isLoading}
        currentPage={page}
        totalPages={totalPages}
        totalRecords={totalRecords}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize)
          setPage(1)
        }}
        searchTerm={searchTerm}
        onSearchChange={(term) => {
          setSearchTerm(term)
          setPage(1)
        }}
      />

      <DeleteConfirm
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={handleDelete}
        isDeleting={isDeleting}
        description="This will permanently delete this product and remove it from your inventory."
      />

      {/* Add/Edit Modal */}
      <Dialog
        open={isAddOpen || isEditOpen}
        onOpenChange={(open) => {
          if (!open) resetForm()
          setIsAddOpen(false)
          setIsEditOpen(false)
        }}
      >
        <DialogContent className="bg-background border-border text-foreground max-w-2xl">
          <DialogHeader>
            <DialogTitle>{isEditOpen ? 'Edit Product' : 'Add New Product'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4 py-4"
              autoComplete="off"
            >
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel>Product Name</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          className="bg-muted border-border"
                          placeholder="iPhone 15 Pro"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="sku"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel>SKU / Model</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          className="bg-muted border-border"
                          placeholder="Auto-generated"
                          disabled={isEditOpen}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="barcode"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel>Barcode (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          className="bg-muted border-border"
                          placeholder="Scan or enter barcode"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-muted border-border text-foreground">
                            <SelectValue placeholder="Select Category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-popover border-border text-popover-foreground">
                          {categories?.map((c: any) => (
                            <SelectItem key={c._id} value={c._id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="brand"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel>Brand</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-muted border-border text-foreground">
                            <SelectValue placeholder="Select Brand" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-popover border-border text-popover-foreground">
                          {brands?.map((b: any) => (
                            <SelectItem key={b._id} value={b._id}>
                              {b.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem className="col-span-2 space-y-2">
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          className="bg-muted border-border"
                          placeholder="Product description..."
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="unit"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel>Unit</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          className="bg-muted border-border"
                          placeholder="pcs, box, etc."
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Image Upload Section */}
                <div className="col-span-2 space-y-2">
                  <FormLabel>Product Images</FormLabel>
                  <div className="flex flex-wrap gap-4">
                    {imagePreviews.map((url, index) => (
                      <div
                        key={index}
                        className="relative w-24 h-24 rounded border border-border overflow-hidden group"
                      >
                        <img src={url} alt="Preview" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute top-1 right-1 bg-black/50 hover:bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    <label className="w-24 h-24 rounded border border-dashed border-muted-foreground/50 hover:border-[#4ade80] flex flex-col items-center justify-center cursor-pointer transition-colors bg-muted/20 hover:bg-muted/40">
                      <Upload className="w-6 h-6 text-muted-foreground mb-1" />
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                        Add Image
                      </span>
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileChange}
                      />
                    </label>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Supported formats: PNG, JPG, JPEG, WEBP
                  </p>
                </div>
                {isEditOpen && selectedProduct && (
                  <div className="col-span-2 bg-muted p-4 rounded-lg border border-[#4ade80]/20">
                    <p className="text-xs text-muted-foreground mb-2 uppercase font-bold">
                      Current Pricing (Set via Purchase Orders)
                    </p>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Buying Price:</span>
                        <span className="ml-2 font-bold text-blue-400">
                          Rs. {(selectedProduct.buyingPrice || 0).toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Selling Price:</span>
                        <span className="ml-2 font-bold text-[#4ade80]">
                          Rs. {(selectedProduct.sellingPrice || 0).toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Stock Level:</span>
                        <span className="ml-2 font-bold text-foreground">
                          {selectedProduct.stockLevel || 0} pcs
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                <DialogFooter className="col-span-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      resetForm()
                      setIsAddOpen(false)
                      setIsEditOpen(false)
                    }}
                    className="border-border"
                  >
                    Cancel
                  </Button>
                  <LoadingButton
                    type="submit"
                    isLoading={isSubmitting}
                    loadingText={isEditOpen ? 'Updating...' : 'Creating...'}
                    className="bg-[#4ade80] hover:bg-[#22c55e] text-black font-semibold"
                  >
                    {isEditOpen ? 'Update Product' : 'Create Product'}
                  </LoadingButton>
                </DialogFooter>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  )
}
