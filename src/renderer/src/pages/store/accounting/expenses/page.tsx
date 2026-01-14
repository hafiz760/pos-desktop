"use client";

import { useEffect, useState } from "react";
import { DataPage } from "@/components/shared/data-page";
import { getExpenses, createExpense, getAccounts } from "@/actions/expense";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoadingButton } from "@/components/ui/loading-button";
import { Button } from "@/components/ui/button";
import { z } from "zod";
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const expenseSchema = z.object({
  description: z.string().min(2, "Description must be at least 2 characters"),
  amount: z.coerce.number().min(1, "Amount must be greater than 0"),
  category: z.string().min(1, "Category is required"),
  account: z.string().min(1, "Payment account is required"),
  expenseDate: z.string().min(1, "Date is required"),
});

type ExpenseFormValues = z.infer<typeof expenseSchema>;

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema) as any,
    defaultValues: {
      description: "",
      amount: 0,
      category: "Other Expenses",
      account: "",
      expenseDate: new Date().toISOString().split('T')[0]
    },
  });

  const loadData = async () => {
    setIsLoading(true);
    const [expData, accData] = await Promise.all([getExpenses(), getAccounts()]);
    setExpenses(expData.data);
    setAccounts(accData.data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const onSubmit: SubmitHandler<ExpenseFormValues> = async (values) => {
    setIsSaving(true);
    const result = await createExpense(values);
    setIsSaving(false);

    if (result.success) {
      toast.success("Expense recorded successfully");
      setIsAddOpen(false);
      form.reset();
      loadData();
    } else {
      toast.error("Error: " + result.error);
    }
  };

  const columns = [
    {
      header: "Date",
      accessor: "expenseDate",
      render: (item: any) => format(new Date(item.expenseDate), 'MMM dd, yyyy')
    },
    {
      header: "Category",
      accessor: "category",
      render: (item: any) => (
        <Badge variant="outline" className="border-border text-muted-foreground uppercase text-[10px]">
          {item.category}
        </Badge>
      )
    },
    {
      header: "Description",
      accessor: "description",
      render: (item: any) => <span className="text-foreground font-medium">{item.description}</span>
    },
    { header: "Account", accessor: "account.accountName" },
    {
      header: "Amount",
      accessor: "amount",
      render: (item: any) => (
        <span className="text-red-400 font-bold">-Rs. {item.amount?.toLocaleString()}</span>
      )
    }
  ];

  return (
    <>
      <DataPage
        title="Expenses"
        description="Track your business expenditures and categorize costs."
        data={expenses}
        columns={columns}
        searchPlaceholder="Search description or category..."
        fileName="business_expenses_export"
        addLabel="Record Expense"
        onAdd={() => setIsAddOpen(true)}
      />

      <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) form.reset(); }}>
        <DialogContent className="bg-background border-border text-foreground">
          <DialogHeader>
            <DialogTitle>Record New Expense</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="expenseDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          className="bg-muted border-border"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          className="bg-muted border-border"
                          placeholder="0.00"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        className="bg-muted border-border"
                        placeholder="e.g. Utility Bill, Rent"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-muted border-border">
                            <SelectValue placeholder="Select Category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-popover border-border text-popover-foreground">
                          <SelectItem value="Utilities">Utilities</SelectItem>
                          <SelectItem value="Rent">Rent</SelectItem>
                          <SelectItem value="Salaries">Salaries</SelectItem>
                          <SelectItem value="Marketing">Marketing</SelectItem>
                          <SelectItem value="Other Expenses">Other Expenses</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="account"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Account</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-muted border-border">
                            <SelectValue placeholder="Select Account" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-popover border-border text-white">
                          {accounts.map(acc => (
                            <SelectItem key={acc._id} value={acc._id}>{acc.accountName}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)} className="border-border">Cancel</Button>
                <LoadingButton
                  type="submit"
                  isLoading={isSaving}
                  loadingText="Recording..."
                  className="bg-red-500 hover:bg-red-600 text-white font-semibold"
                >
                  Save Expense
                </LoadingButton>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
