import { useState, useRef, useEffect } from 'react'
import {
  Search,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  Package,
  CheckCircle2,
  Printer,
  ShoppingBag,
  SearchX
} from 'lucide-react'
import { LoadingButton } from '@renderer/components/ui/loading-button'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@renderer/components/ui/card'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { Badge } from '@renderer/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@renderer/components/ui/dialog'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { z } from 'zod'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Form, FormControl, FormField, FormItem, FormMessage } from '@renderer/components/ui/form'
import { useNavigate } from 'react-router-dom'
import { printContent } from '@renderer/lib/print-utils'

// Color mapping (named colors to hex values)
const COLOR_MAP: { [key: string]: string } = {
  Green: '#4ade80',
  Blue: '#60a5fa',
  Red: '#f87171',
  Amber: '#fbbf24',
  Violet: '#a78bfa',
  Pink: '#f472b6',
  Orange: '#fb923c',
  Teal: '#2dd4bf',
  Indigo: '#818cf8',
  Emerald: '#34d399',
  Yellow: '#fde047',
  Fuchsia: '#e879f9',
  Purple: '#c084fc',
  Slate: '#94a3b8',
  Stone: '#a8a29e',
  Black: '#000000',
  White: '#ffffff',
  Gray: '#475569',
  Crimson: '#ef4444',
  Sky: '#3b82f6'
}

const checkoutSchema = z.object({
  customerName: z.string().optional().or(z.literal('')),
  customerPhone: z.string().optional().or(z.literal('')),
  customerEmail: z.string().email('Invalid email').optional().or(z.literal('')),
  discountPercent: z.number().min(0).max(100),
  discountAmount: z.number().min(0),
  taxAmount: z.number().min(0),
  paymentMethod: z.enum(['Cash', 'Card', 'Bank Transfer', 'Installment', 'Credit'])
})

type CheckoutFormValues = z.infer<typeof checkoutSchema>

export default function POSPage() {
  const navigate = useNavigate()
  const [cart, setCart] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [products, setProducts] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentStore, setCurrentStore] = useState<any>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  console.log(currentStore)
  // Receipt state
  const [lastSale, setLastSale] = useState<any>(null)
  const [showReceipt, setShowReceipt] = useState(false)
  const receiptRef = useRef<HTMLDivElement>(null)

  // Low Stock Alert State
  const [stockAlert, setStockAlert] = useState<{
    open: boolean
    message: string
    product: any | null
  }>({
    open: false,
    message: '',
    product: null
  })

  useEffect(() => {
    const storeData = localStorage.getItem('selectedStore')
    if (storeData) {
      setCurrentStore(JSON.parse(storeData))
    }
  }, [])

  const loadProducts = async () => {
    if (!currentStore?._id) return
    setIsLoading(true)
    try {
      const result = await window.api.products.getAll({
        storeId: currentStore._id,
        pageSize: 1000
      })
      if (result.success) {
        setProducts(result.data)
      } else {
        toast.error('Failed to load products')
      }
    } catch (error) {
      toast.error('Error loading products')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (currentStore?._id) {
      loadProducts()
    }
  }, [currentStore?._id])

  const manualRefresh = async () => {
    await loadProducts()
    toast.success('Product prices refreshed')
  }

  const filteredProducts = products.filter(
    (p: any) =>
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.sku?.toLowerCase().includes(search.toLowerCase()) ||
      p.barcode?.toLowerCase().includes(search.toLowerCase())
  )

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && search.trim()) {
      // Find exact match by SKU or Barcode
      const exactMatch = products.find(
        (p: any) =>
          p.sku?.toLowerCase() === search.toLowerCase() ||
          p.barcode?.toLowerCase() === search.toLowerCase()
      )

      if (exactMatch) {
        addToCart(exactMatch)
        setSearch('')
        e.preventDefault()
      }
    }
  }

  const addToCart = (product: any) => {
    const stock = product.stockLevel || 0
    if (stock <= 0) {
      setStockAlert({
        open: true,
        message: 'This item is currently out of stock.',
        product: product
      })
      return
    }

    const existingItem = cart.find((item: any) => item._id === product._id)
    if (existingItem) {
      if (existingItem.quantity >= stock) {
        setStockAlert({
          open: true,
          message: 'You cannot add more of this item. Maximum stock level reached.',
          product: product
        })
        return
      }
      setCart(
        cart.map((item) =>
          item._id === product._id ? { ...item, quantity: item.quantity + 1 } : item
        )
      )
    } else {
      setCart([
        ...cart,
        { ...product, quantity: 1, sellingPrice: product.sellingPrice || product.buyingPrice || 0 }
      ])
    }
  }

  const updateQuantity = (id: string, delta: number) => {
    setCart(
      cart.map((item: any) => {
        if (item._id === id) {
          const newQty = item.quantity + delta
          const product = products.find((p: any) => p._id === id)
          if (!product) return item

          if (newQty > (product.stockLevel || 0)) {
            setStockAlert({
              open: true,
              message: 'Maximum available stock reached for this item.',
              product: product
            })
            return item
          }
          return newQty > 0 ? { ...item, quantity: newQty } : item
        }
        return item
      })
    )
  }

  const updatePrice = (id: string, newPrice: number) => {
    setCart(cart.map((item: any) => (item._id === id ? { ...item, sellingPrice: newPrice } : item)))
  }

  const removeFromCart = (id: string) => {
    setCart(cart.filter((item) => item._id !== id))
  }

  const form = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      customerName: '',
      customerPhone: '',
      customerEmail: '',
      discountPercent: 0,
      discountAmount: 0,
      taxAmount: 0,
      paymentMethod: 'Cash'
    }
  })

  const formValues = useWatch({ control: form.control })
  const { discountPercent, discountAmount, taxAmount } = formValues

  const subtotal = cart.reduce((sum, item) => sum + item.sellingPrice * item.quantity, 0)
  const effectiveDiscount =
    (discountAmount || 0) > 0 ? discountAmount || 0 : subtotal * ((discountPercent || 0) / 100)
  const total = subtotal - effectiveDiscount + (taxAmount || 0)

  const onSubmit = async (values: CheckoutFormValues) => {
    if (cart.length === 0) return
    if (!currentStore?._id) return

    // Get user from local storage
    const userStr = localStorage.getItem('user')
    const user = userStr ? JSON.parse(userStr) : null
    if (!user) {
      toast.error('User session not found. Please login again.')
      return
    }

    setIsSubmitting(true)
    try {
      // Calculate total profit
      let totalProfit = 0

      const items = cart.map((item) => {
        const costPrice = item.buyingPrice || 0
        const profit = (item.sellingPrice - costPrice) * item.quantity
        totalProfit += profit

        return {
          product: item._id,
          productName: item.name,
          quantity: item.quantity,
          sellingPrice: item.sellingPrice,
          costPrice: costPrice,
          totalAmount: item.sellingPrice * item.quantity,
          profitAmount: profit,
          discountAmount: 0 // Item level discount (can be implemented later)
        }
      })

      // Adjust total profit with global discount
      if (effectiveDiscount > 0) {
        totalProfit -= effectiveDiscount
      }

      const paidAmount = values.paymentMethod === 'Credit' ? 0 : total
      const paymentStatus = values.paymentMethod === 'Credit' ? 'PENDING' : 'PAID'

      const salePayload = {
        store: currentStore._id,
        soldBy: user.id || user._id,
        invoiceNumber: `INV-${Date.now()}`,
        customerName: values.customerName || undefined,
        customerPhone: values.customerPhone || undefined,
        customerEmail: values.customerEmail || undefined,
        items: items,
        totalAmount: total,
        subtotal: subtotal,
        taxAmount: values.taxAmount,
        discountAmount: effectiveDiscount,
        discountPercent: values.discountPercent,
        paidAmount: paidAmount,
        paymentMethod: values.paymentMethod,
        paymentStatus: paymentStatus,
        profitAmount: totalProfit,
        saleDate: new Date()
      }

      const result = await window.api.sales.create(salePayload)

      if (result.success) {
        toast.success('Sale completed successfully!')
        setCart([])
        form.reset()
        setLastSale(salePayload)
        setShowReceipt(true)
        loadProducts() // Refresh stock levels
      } else {
        toast.error('Sale failed: ' + result.error)
      }
    } catch (error: any) {
      toast.error('Error: ' + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handlePrint = async () => {
    console.log('🔘 Print Receipt button clicked')
    const content = receiptRef.current
    if (!content) return

    await printContent({
      title: 'Receipt',
      content: content.innerHTML
    })

    // Auto close after print command is sent
    setTimeout(() => {
      setShowReceipt(false)
      setLastSale(null)
    }, 1000)
  }

  const handleCloseReceipt = () => {
    setShowReceipt(false)
    setLastSale(null)
  }

  if (!currentStore) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-120px)] text-muted-foreground p-8">
        <h2 className="text-2xl font-bold mb-2">No Store Selected</h2>
        <p>Please select a store to access the POS system.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col lg:flex-row h-screen gap-6 animate-in fade-in duration-500 overflow-hidden bg-background p-4">
      {/* Left Side: Product Selection */}
      <div className="flex-1 flex flex-col gap-4 overflow-hidden h-full">
        <div className="flex gap-2 shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-muted-foreground" />
            <Input
              placeholder="Search product name, SKU or barcode..."
              className="bg-card text-foreground border-border pl-14 h-14 text-xl focus:border-[#4ade80] focus:ring-[#4ade80]/20 rounded-xl"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              autoFocus
            />
          </div>
          <Button
            onClick={manualRefresh}
            className="h-14 w-14 bg-card hover:bg-accent text-foreground border border-border rounded-xl"
            title="Refresh prices"
          >
            <Package className="w-6 h-6" />
          </Button>
          <Button
            onClick={() => navigate('/dashboard')}
            className="h-14 px-6 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-xl font-bold"
          >
            Exit POS
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto rounded-2xl border border-border bg-card/30 p-6 custom-scrollbar">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
              <div className="animate-spin h-10 w-10 border-4 border-[#4ade80] border-t-transparent rounded-full" />
              <span className="text-lg font-medium">Loading products...</span>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 animate-in fade-in zoom-in duration-500">
              <div className="w-24 h-24 bg-muted/50 rounded-full flex items-center justify-center mb-6">
                <SearchX className="w-12 h-12 text-muted-foreground/50" />
              </div>
              <h3 className="text-2xl font-black uppercase text-foreground mb-2 tracking-tight">
                No Products Found
              </h3>
              <p className="text-muted-foreground mb-8 max-w-md mx-auto font-medium">
                We couldn't find any products matching{' '}
                <span className="text-foreground font-bold">"{search}"</span>. Try a different
                search term or clear the search.
              </p>
              <Button
                onClick={() => setSearch('')}
                className="bg-[#4ade80] hover:bg-[#22c55e] text-black font-black uppercase tracking-widest px-8 h-12 rounded-xl shadow-lg shadow-[#4ade80]/20"
              >
                Clear Search & Show All
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
              {filteredProducts.map((product: any) => (
                <Card
                  key={product._id}
                  className="bg-card border-border hover:border-[#4ade80] cursor-pointer transition-all group overflow-hidden shadow-sm active:scale-95 duration-200"
                  onClick={() => addToCart(product)}
                >
                  <CardContent className="p-3">
                    {/* Image - Rounded at top */}
                    <div className="flex justify-center mb-3">
                      {product.images && product.images.length > 0 ? (
                        <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-border bg-muted/40 flex items-center justify-center">
                          <img
                            src={product.images[0]}
                            alt={product.name}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                          />
                        </div>
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-muted/40 flex items-center justify-center border-2 border-border">
                          <Package className="w-7 h-7 text-muted-foreground/50" />
                        </div>
                      )}
                    </div>

                    {/* Product Name */}
                    <h3 className="font-bold text-sm text-foreground text-center mb-2 leading-tight group-hover:text-[#4ade80] transition-colors line-clamp-2 min-h-[2.5rem]">
                      {product.name}
                    </h3>

                    {/* Details - Only show if values exist */}
                    <div className="space-y-1 mb-3">
                      {product.category?.name && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] text-muted-foreground uppercase font-bold">
                            Cat:
                          </span>
                          <span className="text-[10px] text-foreground font-semibold truncate">
                            {product.category.name}
                          </span>
                        </div>
                      )}
                      {product.brand?.name && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] text-muted-foreground uppercase font-bold">
                            Brand:
                          </span>
                          <span className="text-[10px] text-foreground font-semibold truncate">
                            {product.brand.name}
                          </span>
                        </div>
                      )}
                      {product.color && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] text-muted-foreground uppercase font-bold">
                            Color:
                          </span>
                          <div className="flex items-center gap-1">
                            <div
                              className="h-3 w-3 rounded-full border border-border"
                              style={{ backgroundColor: COLOR_MAP[product.color] || product.color }}
                            />
                            <span className="text-[10px] text-foreground font-semibold">
                              {product.color}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between border-t border-border pt-2">
                      <div className="flex flex-col">
                        <span className="text-base font-black text-[#4ade80]">
                          Rs. {(product.sellingPrice || 0).toLocaleString()}
                        </span>
                        {(product.buyingPrice || 0) > 0 && (
                          <span className="text-[10px] text-muted-foreground uppercase font-bold">
                            Cost: Rs. {product.buyingPrice?.toLocaleString()}
                          </span>
                        )}
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 h-4 font-bold w-fit mt-0.5 ${
                            (product.stockLevel || 0) -
                              (cart.find((c) => c._id === product._id)?.quantity || 0) <
                            5
                              ? 'text-red-500 border-red-500/30 bg-red-50'
                              : 'text-green-500 border-green-500/30 bg-green-50'
                          }`}
                        >
                          {(product.stockLevel || 0) -
                            (cart.find((c) => c._id === product._id)?.quantity || 0)}{' '}
                          QTY
                        </Badge>
                      </div>
                      <div className="h-8 w-8 rounded-full bg-[#4ade80]/10 flex items-center justify-center group-hover:bg-[#4ade80] transition-colors">
                        <Plus className="w-4 h-4 text-[#4ade80] group-hover:text-black" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <Card className="w-full lg:w-[380px] h-full bg-card border-border flex flex-col shadow-2xl overflow-hidden shrink-0 rounded-2xl">
        <CardHeader className="border-b border-border py-3 bg-muted/30 shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-foreground text-lg font-black uppercase tracking-tighter">
              <ShoppingCart className="w-5 h-5 text-[#4ade80]" />
              Current Order
            </CardTitle>
            <Badge className="bg-[#4ade80] text-black hover:bg-[#4ade80] font-black h-7 px-3 text-xs">
              {cart.length} {cart.length === 1 ? 'ITEM' : 'ITEMS'}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="flex-1 p-0 overflow-hidden">
          <ScrollArea className="h-full">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-muted-foreground italic gap-4">
                <div className="relative">
                  <ShoppingCart className="w-20 h-20 opacity-10" />
                  <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-muted border-2 border-background flex items-center justify-center font-bold text-xs opacity-50">
                    0
                  </div>
                </div>
                <p className="text-lg font-black uppercase tracking-widest opacity-20">
                  Cart is empty
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {cart.map((item) => (
                  <div
                    key={item._id}
                    className="p-2 flex gap-2 hover:bg-muted/30 transition-colors group relative"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="font-black text-foreground text-xs leading-tight truncate pr-6">
                          {item.name}
                        </h4>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 text-red-500/50 hover:text-red-500 hover:bg-red-500/10 absolute top-1 right-1"
                          onClick={() => removeFromCart(item._id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>

                      <div className="flex items-end justify-between gap-2">
                        <div className="flex-1 space-y-0.5">
                          <label className="text-[8px] font-black uppercase text-muted-foreground tracking-widest pl-1">
                            Unit Price
                          </label>
                          <div className="flex items-center gap-1 bg-muted/50 rounded-md p-1 border border-border">
                            <span className="text-xs font-black text-[#4ade80]">Rs.</span>
                            <input
                              type="number"
                              className="w-full bg-transparent text-xl font-black text-[#4ade80] focus:outline-none placeholder:opacity-30"
                              value={item.sellingPrice === 0 ? '' : item.sellingPrice}
                              onChange={(e) =>
                                updatePrice(
                                  item._id,
                                  e.target.value === '' ? 0 : Number(e.target.value)
                                )
                              }
                              onFocus={(e) => e.target.select()}
                              placeholder="0"
                            />
                          </div>
                        </div>

                        <div className="shrink-0 flex flex-col items-center gap-0.5">
                          <label className="text-[8px] font-black uppercase text-muted-foreground tracking-widest">
                            Qty
                          </label>
                          <div className="flex items-center bg-card rounded-md border border-border p-0.5 shadow-sm">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                updateQuantity(item._id, -1)
                              }}
                              className="h-6 w-6 rounded hover:bg-muted flex items-center justify-center transition-colors text-[#4ade80]"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-8 text-center text-sm font-black text-foreground">
                              {item.quantity}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                updateQuantity(item._id, 1)
                              }}
                              className="h-6 w-6 rounded hover:bg-muted flex items-center justify-center transition-colors text-[#4ade80]"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="mt-1 flex justify-between items-center bg-[#4ade80]/5 p-1.5 rounded-md border border-[#4ade80]/10">
                        <span className="text-[8px] font-black uppercase text-[#4ade80] tracking-widest">
                          Subtotal
                        </span>
                        <span className="text-sm font-black text-foreground">
                          Rs. {(item.sellingPrice * item.quantity).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>

        <CardFooter className="border-t border-border p-4 bg-muted/50 flex flex-col gap-3 shrink-0">
          <div className="space-y-2 w-full">
            <div className="flex justify-between text-muted-foreground text-xs font-bold uppercase">
              <span>Subtotal</span>
              <span>Rs. {(subtotal || 0).toLocaleString()}</span>
            </div>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase text-muted-foreground">
                      Tax Amount
                    </span>
                    <FormField
                      control={form.control}
                      name="taxAmount"
                      render={({ field }) => (
                        <FormControl>
                          <Input
                            type="number"
                            value={field.value === 0 ? '' : field.value}
                            onChange={(e) =>
                              field.onChange(e.target.value === '' ? 0 : Number(e.target.value))
                            }
                            onFocus={(e) => e.target.select()}
                            className="h-7 w-20 bg-muted/50 border-border text-right text-xs font-bold"
                            placeholder="0"
                          />
                        </FormControl>
                      )}
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase text-muted-foreground">
                        Discount (Rs.)
                      </span>
                    </div>
                    <FormField
                      control={form.control}
                      name="discountAmount"
                      render={({ field }) => (
                        <div className="flex items-center gap-2 bg-muted/50 p-1.5 rounded-lg border border-border">
                          <span className="text-xs text-red-500 font-black">Rs.</span>
                          <FormControl>
                            <Input
                              type="number"
                              value={field.value === 0 ? '' : field.value}
                              onChange={(e) => {
                                field.onChange(
                                  e.target.value === '' ? 0 : Math.max(0, Number(e.target.value))
                                )
                                form.setValue('discountPercent', 0)
                              }}
                              onFocus={(e) => e.target.select()}
                              className="flex-1 h-6 bg-transparent border-none text-right text-base font-black text-red-500 focus-visible:ring-0 focus-visible:ring-offset-0 p-0"
                              placeholder="0"
                            />
                          </FormControl>
                        </div>
                      )}
                    />
                  </div>
                  <div className="flex justify-between text-foreground text-xl font-black mt-1 pt-2 border-t border-border">
                    <span className="uppercase text-xs tracking-widest mt-2">Total</span>
                    <span className="text-[#4ade80]">Rs. {(total || 0).toLocaleString()}</span>
                  </div>

                  <div className="space-y-3 pt-3 border-t border-border">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-bold uppercase text-muted-foreground mr-4">
                        Payment Method
                      </span>
                      <FormField
                        control={form.control}
                        name="paymentMethod"
                        render={({ field }) => (
                          <div className="grid grid-cols-2 gap-1.5">
                            {['Cash', 'Card', 'Bank Transfer', 'Credit'].map((method) => (
                              <Button
                                key={method}
                                type="button"
                                size="sm"
                                variant="outline"
                                className={`h-8 px-2 text-[10px] font-black border-border transition-all duration-300 ${
                                  field.value === method
                                    ? 'bg-[#4ade80]! text-black border-[#4ade80] shadow-[0_0_15px_rgba(74,222,128,0.4)] scale-[1.02] ring-1 ring-[#4ade80]/50'
                                    : 'hover:border-[#4ade80] hover:text-[#4ade80] bg-card text-muted-foreground'
                                }`}
                                onClick={() => field.onChange(method)}
                              >
                                {method.toUpperCase()}
                              </Button>
                            ))}
                          </div>
                        )}
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-2 border-t border-border pt-2">
                  <div className="space-y-2 mb-4">
                    <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                      Customer Info
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      <FormField
                        control={form.control}
                        name="customerName"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input
                                placeholder="Customer Name"
                                {...field}
                                className="h-8 bg-muted/50 border-border text-xs font-bold placeholder:text-muted-foreground/50"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="customerPhone"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input
                                placeholder="Phone Number"
                                {...field}
                                className="h-8 bg-muted/50 border-border text-xs font-bold placeholder:text-muted-foreground/50"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <LoadingButton
                    type="submit"
                    className="w-full bg-[#4ade80] hover:bg-[#22c55e] text-black font-black uppercase text-sm tracking-widest h-12 shadow-lg shadow-[#4ade80]/20"
                    isLoading={isSubmitting}
                    loadingText="PROCESSING..."
                    disabled={cart.length === 0}
                  >
                    <ShoppingBag className="w-4 h-4 mr-2" />
                    Complete Sale
                  </LoadingButton>
                </div>
              </form>
            </Form>
          </div>
        </CardFooter>
      </Card>

      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="bg-background border-border text-foreground sm:max-w-md max-h-[90vh] flex flex-col">
          <div className="flex flex-col items-center justify-center pt-4 shrink-0">
            <div className="w-16 h-16 bg-[#4ade80]/20 rounded-full flex items-center justify-center mb-4 border border-[#4ade80]/50 animate-pulse">
              <CheckCircle2 className="w-10 h-10 text-[#4ade80]" />
            </div>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight text-center">
              Sale Successful!
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs font-bold uppercase mt-1 text-center">
              Transaction completed successfully.
            </DialogDescription>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0 mt-6 rounded-lg shadow-inner">
            <div className="p-6 bg-white text-black font-mono text-sm" ref={receiptRef}>
              <div className="text-center border-bottom">
                <div className="fs-lg uppercase">{currentStore?.name}</div>
                <div className="fs-sm uppercase mt-1">{currentStore?.address}</div>
                <div className="fs-sm mt-1 ">Tel: {currentStore?.phone}</div>
                <div className="fs-xs mt-2 uppercase">
                  {lastSale && format(new Date(lastSale.saleDate), 'MMM dd, yyyy - HH:mm:ss')}
                </div>
                <div className="fs-xs uppercase">INV: {lastSale?.invoiceNumber}</div>
              </div>
              {lastSale?.customerName && (
                <div className="border-bottom">
                  <div className="fs-xs uppercase font-bold">Customer</div>
                  <div className="fs-sm font-bold">{lastSale.customerName}</div>
                  {lastSale.customerPhone && <div className="fs-sm">{lastSale.customerPhone}</div>}
                </div>
              )}
              <div className="mb-3">
                {lastSale?.items.map((item: any, idx: number) => (
                  <div key={idx} className="flex fs-sm mt-1">
                    <div>
                      <div className="font-bold">{item.productName}</div>
                      <div className="fs-xs font-bold ">
                        Qty: {item.quantity} x {item.sellingPrice}
                      </div>
                    </div>
                    <div className="font-bold">{(item.totalAmount || 0).toLocaleString()}</div>
                  </div>
                ))}
              </div>
              <div className="border-top fs-sm">
                <div className="flex">
                  <span>Subtotal</span>
                  <span>{(lastSale?.subtotal || 0).toLocaleString()}</span>
                </div>
                <div className="flex">
                  <span>Tax</span>
                  <span>{(lastSale?.taxAmount || 0).toLocaleString()}</span>
                </div>
                {lastSale?.discountAmount > 0 && (
                  <div className="flex font-bold">
                    <span>Discount</span>
                    <span>-{lastSale.discountAmount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex fs-lg border-top mt-2">
                  <span>TOTAL</span>
                  <span>Rs. {lastSale?.totalAmount.toLocaleString()}</span>
                </div>
                <div className="flex fs-sm mt-1">
                  <span>Paid Amount</span>
                  <span>Rs. {(lastSale?.paidAmount || 0).toLocaleString()}</span>
                </div>
                {lastSale?.totalAmount - lastSale?.paidAmount > 0 && (
                  <div className="flex fs-sm font-bold border-top mt-1 pt-1 text-red-500">
                    <span>Balance Due</span>
                    <span>Rs. {(lastSale.totalAmount - lastSale.paidAmount).toLocaleString()}</span>
                  </div>
                )}
              </div>
              <div className="text-center fs-xs mt-3">THANK YOU FOR VISITING!</div>
              <div className="border-top text-center mt-3">
                <div className="fs-xs font-bold uppercase">Powered by REX POS</div>
                <div className="fs-xs font-bold">Developed by Hafiz Hasnain</div>
                <div className="fs-xs font-bold">+92 321 4233028</div>
                <div className="fs-xs font-bold">hafizhasnain.dev@gmail.com</div>
                <div className="fs-xs font-bold">codyxa.com</div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-4 shrink-0">
            <Button
              variant="outline"
              className="flex-1 border-border font-black uppercase text-xs"
              onClick={handleCloseReceipt}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Done
            </Button>
            <Button
              className="flex-1 bg-[#4ade80] hover:bg-[#22c55e] text-black font-black uppercase text-xs shadow-lg shadow-[#4ade80]/20"
              onClick={handlePrint}
            >
              <Printer className="w-4 h-4 mr-2" />
              Print Receipt
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Stock Alert Dialog */}
      <Dialog
        open={stockAlert.open}
        onOpenChange={(open) => setStockAlert((prev) => ({ ...prev, open }))}
      >
        <DialogContent className="border-red-500/20">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500 font-black uppercase">
              <Trash2 className="w-5 h-5" />
              Stock Limit Reached
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-foreground font-medium">{stockAlert.message}</p>
            {stockAlert.product && (
              <div className="mt-4 p-4 bg-red-500/5 rounded-lg border border-red-500/10 flex items-center justify-between">
                <span className="text-sm font-bold">{stockAlert.product.name}</span>
                <Badge variant="outline" className="border-red-500 text-red-500 font-black">
                  Max: {stockAlert.product.stockLevel || 0}
                </Badge>
              </div>
            )}
          </div>
          <div className="flex justify-end">
            <Button
              variant="destructive"
              className="font-black uppercase text-xs"
              onClick={() => setStockAlert((prev) => ({ ...prev, open: false }))}
            >
              Okay, Got it
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
