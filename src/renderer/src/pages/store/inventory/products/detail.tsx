import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@renderer/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '@renderer/components/ui/card'
import { Badge } from '@renderer/components/ui/badge'
import {
  ArrowLeft,
  Package,
  Tag,
  Smartphone,
  History,
  TrendingUp,
  AlertCircle,
  Edit3,
  BarChart3
} from 'lucide-react'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { toast } from 'sonner'

export default function ProductDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [product, setProduct] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadProduct = async () => {
      if (!id) return
      setIsLoading(true)
      try {
        const result = await window.api.products.getById(id)
        if (result.success) {
          setProduct(result.data)
        } else {
          toast.error('Product not found')
        }
      } catch (error) {
        toast.error('Failed to load product details')
      } finally {
        setIsLoading(false)
      }
    }
    loadProduct()
  }, [id])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#4ade80]"></div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold text-foreground mb-2">Product not found</h2>
        <Button onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="hover:bg-accent"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-foreground">{product.name}</h2>
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Badge
                variant="outline"
                className="border-border text-[10px] uppercase text-muted-foreground"
              >
                {product.category?.name}
              </Badge>
              <span>•</span>
              <span>SKU: {product.sku}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="border-border hover:bg-accent text-foreground"
            onClick={() => navigate(`/dashboard/inventory/products?edit=${product._id}`)}
          >
            <Edit3 className="w-4 h-4 mr-2" />
            Edit Product
          </Button>
          <Button className="bg-[#4ade80] hover:bg-[#22c55e] text-black font-semibold">
            <BarChart3 className="w-4 h-4 mr-2" />
            Stock Report
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Main Stats */}
        <Card className="bg-card border-border text-foreground">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase flex items-center gap-2">
              <TrendingUp className="w-3 h-3 text-[#4ade80]" />
              Selling Price
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[#4ade80]">
              Rs. {(product.sellingPrice || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Suggested Retail Price</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border text-foreground">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase flex items-center gap-2">
              <Tag className="w-3 h-3 text-blue-400" />
              Cost Price
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-400">
              Rs. {(product.buyingPrice || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Last Purchase Unit Cost</p>
          </CardContent>
        </Card>

        <Card
          className={`bg-card border-border text-foreground ${(product.stockLevel || 0) < (product.minStockLevel || 5) ? 'border-red-500/50 ring-1 ring-red-500/20' : ''}`}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase flex items-center gap-2">
              <Package className="w-3 h-3 text-orange-400" />
              Available Stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className="text-3xl font-bold">{product.stockLevel || 0}</div>
              <span className="text-muted-foreground text-sm">pcs</span>
            </div>
            {(product.stockLevel || 0) < (product.minStockLevel || 5) && (
              <div className="flex items-center gap-1 mt-1 text-red-400 text-[10px] font-bold uppercase">
                <AlertCircle className="w-3 h-3" />
                Low stock warning
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-6">
          {product.images && product.images.length > 0 && (
            <Card className="bg-card border-border text-foreground overflow-hidden">
              <CardContent className="p-0">
                <div className="grid md:grid-cols-2">
                  <div className="bg-muted/50 p-6 flex items-center justify-center border-r border-border min-h-[400px]">
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="max-h-[350px] w-auto object-contain rounded-lg shadow-2xl drop-shadow-2xl transition-transform hover:scale-105 duration-500"
                    />
                  </div>
                  <div className="p-6 space-y-4 bg-card/50">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                      Product Gallery
                    </h3>
                    <div className="grid grid-cols-4 gap-3">
                      {product.images.map((img: string, i: number) => (
                        <div
                          key={i}
                          className={`aspect-square rounded-md border-2 overflow-hidden cursor-pointer transition-all hover:border-[#4ade80] ${i === 0 ? 'border-[#4ade80]' : 'border-border'}`}
                        >
                          <img
                            src={img}
                            alt={`View ${i + 1}`}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="bg-card border-border text-foreground">
            <CardHeader className="border-b border-border">
              <CardTitle className="text-lg flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-[#4ade80]" />
                Product Specifications
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                <div className="grid grid-cols-3 p-4">
                  <span className="text-muted-foreground text-sm font-medium">Brand</span>
                  <span className="col-span-2 text-sm text-foreground">
                    {product.brand?.name || 'No Brand'}
                  </span>
                </div>
                <div className="grid grid-cols-3 p-4">
                  <span className="text-muted-foreground text-sm font-medium">Model / SKU</span>
                  <span className="col-span-2 text-sm text-foreground font-mono uppercase">
                    {product.sku}
                  </span>
                </div>
                <div className="grid grid-cols-3 p-4">
                  <span className="text-muted-foreground text-sm font-medium">Description</span>
                  <span className="col-span-2 text-sm text-muted-foreground leading-relaxed">
                    {product.description || 'No description provided for this product.'}
                  </span>
                </div>
                {product.barcode && (
                  <div className="grid grid-cols-3 p-4">
                    <span className="text-muted-foreground text-sm font-medium">Barcode</span>
                    <span className="col-span-2 text-sm text-foreground font-mono">
                      {product.barcode}
                    </span>
                  </div>
                )}
                <div className="grid grid-cols-3 p-4">
                  <span className="text-muted-foreground text-sm font-medium">
                    Minimum Stock Alert
                  </span>
                  <span className="col-span-2 text-sm text-foreground">
                    {product.minStockLevel || 5} items
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar History (Visual Only for now) */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="bg-card border-border text-foreground overflow-hidden">
            <CardHeader className="bg-muted/50 border-b border-border">
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="w-5 h-5 text-orange-400" />
                Inventory History
              </CardTitle>
              <CardDescription className="text-xs">Recent stock movements</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[400px]">
                <div className="p-4 space-y-6">
                  <div className="text-center py-4 text-muted-foreground italic text-sm">
                    Stock history tracking coming soon...
                  </div>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
