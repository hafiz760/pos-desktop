"use client";

import { useState } from "react";
import { DataPage } from "@/components/shared/data-page";
import { useSales, useDeleteSale } from "@/hooks/useSales";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Eye, Trash2, Printer, MoreVertical } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { printContent } from "@/lib/print-utils";

export default function SalesReportsPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // TanStack Query Hooks
  const { data: salesData, isLoading } = useSales(page, pageSize, searchTerm);
  const deleteMutation = useDeleteSale();

  const sales = salesData?.data || [];
  const totalRecords = salesData?.total || 0;
  const totalPages = salesData?.totalPages || 0;

  const handleDelete = async () => {
    if (!selectedSale) return;
    try {
      const result = await deleteMutation.mutateAsync(selectedSale._id);
      if (result.success) {
        toast.success("Sale deleted successfully");
        setIsDeleteOpen(false);
      } else {
        toast.error(result.error || "Failed to delete sale");
      }
    } catch (error: any) {
      toast.error("Error: " + error.message);
    }
  };

  const columns = [
    {
      header: "Sale #",
      accessor: "_id",
      render: (item: any) => (
        <span className="font-mono text-[10px] text-muted-foreground uppercase">
          {item._id.substring(item._id.length - 8)}
        </span>
      ),
    },
    {
      header: "Date",
      accessor: "createdAt",
      render: (item: any) =>
        format(new Date(item.createdAt), "MMM dd, yyyy HH:mm"),
    },
    {
      header: "Items",
      accessor: "items",
      render: (item: any) => (
        <span className="text-foreground">{item.items.length} Product(s)</span>
      ),
    },
    {
      header: "Total",
      accessor: "totalAmount",
      render: (item: any) => (
        <span className="text-[#4ade80] font-bold">
          Rs. {item.totalAmount?.toLocaleString()}
        </span>
      ),
    },
    {
      header: "Status",
      accessor: "status",
      render: (item: any) => (
        <Badge className="bg-[#4ade80]/10 text-[#4ade80] border-[#4ade80]/20">
          {item.paymentStatus}
        </Badge>
      ),
    },
    {
      header: "Seller",
      accessor: "soldBy.fullName",
      render: (item: any) => (
        <span className="text-muted-foreground capitalize">
          {item.soldBy?.fullName || "Admin"}
        </span>
      ),
    },
    {
      header: "Actions",
      accessor: "_id",
      render: (item: any) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="hover:bg-accent h-8 w-8"
            >
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="bg-popover border-border text-popover-foreground"
            align="end"
          >
            <DropdownMenuItem
              onClick={() => {
                setSelectedSale(item);
                setIsDetailsOpen(true);
              }}
              className="focus:bg-[#4ade80] focus:text-black cursor-pointer"
            >
              <Eye className="w-4 h-4 mr-2" />
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setSelectedSale(item);
                setIsDeleteOpen(true);
              }}
              className="focus:bg-red-500 focus:text-white cursor-pointer text-red-400"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <>
      <DataPage
        title="Sales Reports"
        description="View and export all transactions recorded by the system."
        data={sales}
        columns={columns}
        searchPlaceholder="Search by sale ID or total..."
        fileName="sales_history_export"
        isLoading={isLoading}
        currentPage={page}
        totalPages={totalPages}
        totalRecords={totalRecords}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize);
          setPage(1);
        }}
        searchTerm={searchTerm}
        onSearchChange={(val) => {
          setSearchTerm(val);
          setPage(1);
        }}
      />

      {/* Sale Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="bg-background border-border text-foreground sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between pr-6">
              <span>Sale Details: #{selectedSale?.invoiceNumber}</span>
              <Badge className="bg-[#4ade80] text-black uppercase">
                {selectedSale?.paymentStatus}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          {selectedSale && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Date</p>
                  <p className="font-semibold">
                    {format(
                      new Date(selectedSale.createdAt),
                      "MMMM dd, yyyy HH:mm"
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Seller</p>
                  <p className="font-semibold">
                    {selectedSale.soldBy?.fullName || "Admin"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Customer</p>
                  <p className="font-semibold">
                    {selectedSale.customerName || "Walk-in Customer"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Payment Method</p>
                  <p className="font-semibold">{selectedSale.paymentMethod}</p>
                </div>
              </div>

              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 text-left">Product</th>
                      <th className="px-4 py-2 text-center">Qty</th>
                      <th className="px-4 py-2 text-right">Price</th>
                      <th className="px-4 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {selectedSale.items.map((item: any, idx: number) => (
                      <tr key={idx}>
                        <td className="px-4 py-2">{item.productName}</td>
                        <td className="px-4 py-2 text-center">
                          {item.quantity}
                        </td>
                        <td className="px-4 py-2 text-right">
                          Rs. {item.sellingPrice.toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-right font-medium">
                          Rs. {item.totalAmount.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-1 text-right text-sm">
                <div className="flex justify-between px-4">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span>Rs. {selectedSale.subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between px-4">
                  <span className="text-muted-foreground">Tax (10%):</span>
                  <span>Rs. {selectedSale.taxAmount.toLocaleString()}</span>
                </div>
                {selectedSale.discountAmount > 0 && (
                  <div className="flex justify-between px-4 text-red-400">
                    <span>Discount:</span>
                    <span>
                      -Rs. {selectedSale.discountAmount.toLocaleString()}
                    </span>
                  </div>
                )}
                <div className="flex justify-between px-4 text-lg font-bold border-t border-border pt-2 mt-2">
                  <span>Total:</span>
                  <span className="text-[#4ade80]">
                    Rs. {selectedSale.totalAmount.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDetailsOpen(false)}
              className="border-border"
            >
              Close
            </Button>
            <Button
              className="bg-[#4ade80] hover:bg-[#22c55e] text-black"
              onClick={() => {
                if (!selectedSale) return;
                const content = `
                                <div style="font-family: 'Courier New', Courier, monospace; padding: 20px; text-align: center;">
                                    <div style="border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 20px;">
                                        <h2 style="font-size: 24px; font-weight: bold; margin: 0;">Mobile Shop POS</h2>
                                        <p style="margin: 5px 0;">123 Market Street, City</p>
                                        <p style="margin: 5px 0;">Tel: +123 456 789</p>
                                    </div>

                                    <div style="text-align: left; margin-bottom: 20px;">
                                        <p style="margin: 2px 0;"><strong>Invoice:</strong> ${
                                          selectedSale.invoiceNumber ||
                                          selectedSale._id
                                            .substring(0, 8)
                                            .toUpperCase()
                                        }</p>
                                        <p style="margin: 2px 0;"><strong>Date:</strong> ${format(
                                          new Date(selectedSale.createdAt),
                                          "MMM dd, yyyy HH:mm"
                                        )}</p>
                                        ${
                                          selectedSale.customerName
                                            ? `<p style="margin: 2px 0;"><strong>Customer:</strong> ${selectedSale.customerName}</p>`
                                            : ""
                                        }
                                    </div>

                                    <div style="margin-bottom: 20px;">
                                        ${selectedSale.items
                                          .map(
                                            (item: any) => `
                                            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                                                <span style="text-align: left;">${
                                                  item.productName
                                                } <br/><span style="font-size: 11px;">x${
                                              item.quantity
                                            }</span></span>
                                                <span>Rs. ${item.totalAmount.toLocaleString()}</span>
                                            </div>
                                        `
                                          )
                                          .join("")}
                                    </div>

                                    <div style="border-top: 1px dashed #000; padding-top: 10px;">
                                        <div style="display: flex; justify-content: space-between;">
                                            <span>Subtotal:</span>
                                            <span>Rs. ${selectedSale.subtotal.toLocaleString()}</span>
                                        </div>
                                        <div style="display: flex; justify-content: space-between;">
                                            <span>Tax:</span>
                                            <span>Rs. ${selectedSale.taxAmount.toLocaleString()}</span>
                                        </div>
                                        ${
                                          selectedSale.discountAmount > 0
                                            ? `
                                        <div style="display: flex; justify-content: space-between;">
                                            <span>Discount:</span>
                                            <span>-Rs. ${selectedSale.discountAmount.toLocaleString()}</span>
                                        </div>
                                        `
                                            : ""
                                        }
                                        <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 18px; margin-top: 10px;">
                                            <span>TOTAL:</span>
                                            <span>Rs. ${selectedSale.totalAmount.toLocaleString()}</span>
                                        </div>
                                    </div>

                                    <div style="margin-top: 30px; font-size: 12px;">
                                        <p>Thank you for your purchase!</p>
                                        <p>Software by Hafiz Hasnain</p>
                                    </div>
                                </div>
                            `;
                printContent({ title: "Receipt", content });
              }}
            >
              <Printer className="w-4 h-4 mr-2" />
              Print Receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="bg-background border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-red-500">
              Delete Sale Record?
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-muted-foreground">
              Are you sure you want to delete sale{" "}
              <strong>#{selectedSale?.invoiceNumber}</strong>? This will reverse
              the stock levels and accounting balances. This action cannot be
              undone.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteOpen(false)}
              className="border-border"
            >
              Cancel
            </Button>
            <LoadingButton
              variant="destructive"
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleDelete}
              isLoading={deleteMutation.isPending}
              loadingText="Deleting..."
            >
              Delete Permanently
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
