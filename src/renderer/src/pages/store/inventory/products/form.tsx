import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { Button } from '@renderer/components/ui/button'
import { LoadingButton } from '@renderer/components/ui/loading-button'
import { Input } from '@renderer/components/ui/input'
import { SearchableSelect } from '@renderer/components/shared/searchable-select'

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@renderer/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui/popover'
import { Upload, X, ChevronRight, Check, ChevronsUpDown } from 'lucide-react'
import { toast } from 'sonner'
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
import { cn } from '@renderer/lib/utils'

const PRODUCT_COLORS = [
  { name: 'Green', value: '#4ade80' },
  { name: 'Blue', value: '#60a5fa' },
  { name: 'Red', value: '#f87171' },
  { name: 'Amber', value: '#fbbf24' },
  { name: 'Violet', value: '#a78bfa' },
  { name: 'Pink', value: '#f472b6' },
  { name: 'Orange', value: '#fb923c' },
  { name: 'Teal', value: '#2dd4bf' },
  { name: 'Indigo', value: '#818cf8' },
  { name: 'Emerald', value: '#34d399' },
  { name: 'Yellow', value: '#fde047' },
  { name: 'Fuchsia', value: '#e879f9' },
  { name: 'Purple', value: '#c084fc' },
  { name: 'Slate', value: '#94a3b8' },
  { name: 'Stone', value: '#a8a29e' },
  { name: 'Black', value: '#000000' },
  { name: 'White', value: '#ffffff' },
  { name: 'Gray', value: '#475569' },
  { name: 'Crimson', value: '#ef4444' },
  { name: 'Sky', value: '#3b82f6' }
]

const productSchema = z.object({
  name: z.string().min(2, 'Product name is required'),
  sku: z.string().min(2, 'SKU is required'),
  category: z.string().min(1, 'Category is required'),
  brand: z.string().optional().or(z.literal('')),
  barcode: z.string().optional().or(z.literal('')),
  description: z.string().optional().or(z.literal('')),
  unit: z.string().min(1, 'Unit is required'),
  color: z.string().optional().or(z.literal(''))
})

type ProductFormValues = z.infer<typeof productSchema>

export default function ProductFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEditMode = !!id

  const [currentStore, setCurrentStore] = useState<any>(null)
  const [categories, setCategories] = useState<any[]>([])
  const [brands, setBrands] = useState<any[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [colorOpen, setColorOpen] = useState(false)

  useEffect(() => {
    const storeData = localStorage.getItem('selectedStore')
    if (storeData) {
      setCurrentStore(JSON.parse(storeData))
    }
  }, [])

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '',
      sku: `PRD-${Date.now()}`,
      category: '',
      brand: '',
      barcode: '',
      description: '',
      unit: 'pcs',
      color: ''
    }
  })

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

  const loadProduct = async () => {
    if (!id) return
    setIsLoading(true)
    try {
      const result = await window.api.products.getById(id)
      if (result.success && result.data) {
        const product = result.data
        form.reset({
          name: product.name,
          sku: product.sku,
          category: product.category?._id || product.category,
          brand: product.brand?._id || product.brand || '',
          barcode: product.barcode || '',
          description: product.description || '',
          unit: product.unit || 'pcs',
          color: product.color || ''
        })
        setImagePreviews(product.images || [])
      } else {
        toast.error('Failed to load product')
        navigate('/dashboard/inventory/products')
      }
    } catch (error) {
      toast.error('Error loading product')
      navigate('/dashboard/inventory/products')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadInitialData()
  }, [currentStore?._id])

  useEffect(() => {
    if (isEditMode) {
      loadProduct()
    }
  }, [id])

  // Watch barcode for real-time validation
  const watchedBarcode = form.watch('barcode')
  useEffect(() => {
    const checkBarcode = async () => {
      if (!watchedBarcode || !currentStore?._id) {
        if (form.getFieldState('barcode').error?.type === 'manual') {
          form.clearErrors('barcode')
        }
        return
      }

      try {
        const result = await window.api.products.checkBarcode({
          storeId: currentStore._id,
          barcode: watchedBarcode,
          excludeId: id
        })

        if (result.success && result.exists) {
          form.setError('barcode', {
            type: 'manual',
            message: `Barcode "${watchedBarcode}" is already used by product: ${result.productName}`
          })
        } else {
          if (form.getFieldState('barcode').error?.type === 'manual') {
            form.clearErrors('barcode')
          }
        }
      } catch (error) {
        console.error('Barcode check failed:', error)
      }
    }

    const timer = setTimeout(checkBarcode, 500)
    return () => clearTimeout(timer)
  }, [watchedBarcode, currentStore?._id, id])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files)
      setSelectedFiles((prev) => [...prev, ...files])

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

      if (!targetUrl.startsWith('media://')) {
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
      if (isEditMode && id) {
        result = await window.api.products.update(id, data)
      } else {
        result = await window.api.products.create(data)
      }

      if (result.success) {
        toast.success(`Product ${isEditMode ? 'updated' : 'created'} successfully`)
        navigate('/dashboard/inventory/products')
      } else {
        toast.error('Error: ' + result.error)
      }
    } catch (error: any) {
      toast.error(error.message || 'An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading product...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/dashboard/inventory/products" className="hover:text-foreground">
          Products
        </Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-foreground font-semibold">
          {isEditMode ? 'Edit Product' : 'Create Product'}
        </span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {isEditMode ? 'Edit Product' : 'Create New Product'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isEditMode
              ? 'Update product details and inventory information'
              : 'Add a new product to your inventory'}
          </p>
        </div>
      </div>

      {/* Form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8" autoComplete="off">
          {/* Images Section */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Product Images</h2>
            <div className="flex flex-wrap gap-4 p-4 bg-muted/30 rounded-lg border-2 border-dashed border-border">
              {imagePreviews.map((url, index) => (
                <div
                  key={index}
                  className="relative w-28 h-28 rounded-lg border-2 border-border overflow-hidden group shadow-md hover:shadow-lg transition-shadow"
                >
                  <img src={url} alt="Preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <label className="w-28 h-28 rounded-lg border-2 border-dashed border-muted-foreground/50 hover:border-[#4ade80] hover:bg-[#4ade80]/10 flex flex-col items-center justify-center cursor-pointer transition-all bg-background shadow-sm hover:shadow-md">
                <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                <span className="text-xs text-muted-foreground font-semibold">Add Image</span>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Supported formats: PNG, JPG, JPEG, WEBP (Max 5MB per image)
            </p>
          </div>

          {/* Basic Information */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Basic Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Name *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        className="bg-muted border-border h-12"
                        placeholder="e.g., iPhone 15 Pro Max"
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
                  <FormItem>
                    <FormLabel>SKU / Model *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        className="bg-muted border-border h-12 font-mono"
                        placeholder="Auto-generated"
                        disabled={isEditMode}
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
                  <FormItem>
                    <FormLabel>Category *</FormLabel>
                    <FormControl>
                      <SearchableSelect
                        value={field.value}
                        onChange={field.onChange}
                        options={categories.map((c) => ({ label: c.name, value: c._id }))}
                        placeholder="Select Category"
                        searchPlaceholder="Search category..."
                        emptyMessage="No category found."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="brand"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Brand</FormLabel>
                    <FormControl>
                      <SearchableSelect
                        value={field.value || ''}
                        onChange={field.onChange}
                        options={brands.map((b) => ({ label: b.name, value: b._id }))}
                        placeholder="Select Brand"
                        searchPlaceholder="Search brand..."
                        emptyMessage="No brand found."
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
                  <FormItem>
                    <FormLabel>Unit *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        className="bg-muted border-border h-12"
                        placeholder="pcs, box, kg, etc."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="color"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Product Color (Optional)</FormLabel>
                    <Popover open={colorOpen} onOpenChange={setColorOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            className={cn(
                              'justify-between h-12 bg-muted border-border',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            {field.value ? (
                              <div className="flex items-center gap-2">
                                <div
                                  className="h-4 w-4 rounded-full border border-white/20"
                                  style={{
                                    backgroundColor:
                                      PRODUCT_COLORS.find((c) => c.name === field.value)?.value ||
                                      '#4ade80'
                                  }}
                                />
                                <span>{field.value}</span>
                              </div>
                            ) : (
                              'Select color'
                            )}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[300px] p-0">
                        <Command>
                          <CommandInput placeholder="Search colors..." />
                          <CommandList>
                            <CommandEmpty>No color found.</CommandEmpty>
                            <CommandGroup>
                              <CommandItem
                                value=""
                                onSelect={() => {
                                  field.onChange('')
                                  setColorOpen(false)
                                }}
                              >
                                <Check
                                  className={cn(
                                    'mr-2 h-4 w-4',
                                    !field.value ? 'opacity-100' : 'opacity-0'
                                  )}
                                />
                                <span className="text-muted-foreground">No Color</span>
                              </CommandItem>
                              {PRODUCT_COLORS.map((color) => (
                                <CommandItem
                                  key={color.name}
                                  value={color.name}
                                  onSelect={(currentValue) => {
                                    field.onChange(currentValue === field.value ? '' : currentValue)
                                    setColorOpen(false)
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      'mr-2 h-4 w-4',
                                      field.value === color.name ? 'opacity-100' : 'opacity-0'
                                    )}
                                  />
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="h-4 w-4 rounded-full border border-white/20"
                                      style={{ backgroundColor: color.value }}
                                    />
                                    <span>{color.name}</span>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="md:col-span-2">
                <FormField
                  control={form.control}
                  name="barcode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Barcode</FormLabel>
                      <FormControl>
                        <Input {...field} className="bg-muted border-border h-12 font-mono" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/dashboard/inventory/products')}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <LoadingButton type="submit" isLoading={isSubmitting}>
              {isEditMode ? 'Update Product' : 'Create Product'}
            </LoadingButton>
          </div>
        </form>
      </Form>
    </div>
  )
}
