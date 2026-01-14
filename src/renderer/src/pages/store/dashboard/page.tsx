"use client";

import { useSession } from "next-auth/react";
import {
  TrendingUp,
  TrendingDown,
  Package,
  ShoppingCart,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Users,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { getDashboardStats } from "@/actions/dashboard";
import { useEffect, useState } from "react";
import { format } from "date-fns";

export default function DashboardPage() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const data = await getDashboardStats();
      setStats(data);
      setIsLoading(false);
    };
    fetchStats();
  }, []);

  const dashboardStats = [
    {
      title: "Total Revenue",
      value: `Rs. ${stats?.revenue?.toLocaleString() || 0}`,
      change: "Lifetime cumulative",
      icon: DollarSign,
      trend: "up",
      color: "text-[#4ade80]",
    },
    {
      title: "Sales Count",
      value: stats?.salesCount || 0,
      change: "Total transactions",
      icon: ShoppingCart,
      trend: "up",
      color: "text-blue-400",
    },
    {
      title: "Profit",
      value: `Rs. ${stats?.profit?.toLocaleString() || 0}`,
      change: "Net profit from sales",
      icon: TrendingUp,
      trend: "up",
      color: "text-purple-400",
    },
    {
      title: "Low Stock",
      value: `${stats?.lowStockCount || 0} Items`,
      change: "Inventory alerts",
      icon: AlertCircle,
      trend: "down",
      color: "text-red-400",
    },
  ];

  // Dummy chart data for now as we don't have daily aggregation yet
  const chartData = [
    { name: "Mon", sales: 4000 },
    { name: "Tue", sales: 3000 },
    { name: "Wed", sales: (stats?.revenue || 10000) * 0.2 },
    { name: "Thu", sales: 2780 },
    { name: "Fri", sales: 1890 },
    { name: "Sat", sales: 2390 },
    { name: "Sun", sales: 3490 },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4ade80]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            Overview
          </h2>
          <p className="text-muted-foreground">
            Welcome back, {session?.user?.name || "User"}. Here's what's
            happening today.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="border-border hover:bg-accent text-foreground"
          >
            Download Report
          </Button>
          <Button className="bg-[#4ade80] hover:bg-[#22c55e] text-black font-semibold">
            Generate Invoice
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {dashboardStats.map((stat) => (
          <Card
            key={stat.title}
            className="bg-card border-border text-foreground"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                {stat.trend === "up" ? (
                  <ArrowUpRight className="w-3 h-3 text-[#4ade80]" />
                ) : (
                  <ArrowDownRight className="w-3 h-3 text-red-500" />
                )}
                {stat.change}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 bg-card border-border text-foreground">
          <CardHeader>
            <CardTitle>Sales Revenue</CardTitle>
            <CardDescription className="text-muted-foreground">
              Revenue generated over the past 7 days
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4ade80" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#4ade80" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#9ca3af", fontSize: 12 }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#9ca3af", fontSize: 12 }}
                    tickFormatter={(value) => `Rs.${value}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    itemStyle={{ color: "hsl(var(--foreground))" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="sales"
                    stroke="#4ade80"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorSales)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3 bg-card border-border text-foreground">
          <CardHeader>
            <CardTitle>Recent Sales</CardTitle>
            <CardDescription className="text-muted-foreground">
              Latest transactions from your store
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {stats?.recentSales?.length > 0 ? (
                stats.recentSales.map((sale: any, i: number) => (
                  <div key={i} className="flex items-center">
                    <Avatar className="h-9 w-9 border border-border">
                      <AvatarFallback className="bg-muted text-sm text-muted-foreground">
                        {(sale.customerName || "Walk-In")
                          .split(" ")
                          .map((n: any) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="ml-4 space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {sale.customerName || "Walk-In Customer"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(sale.createdAt), "MMM dd, HH:mm")}
                      </p>
                    </div>
                    <div className="ml-auto text-right">
                      <p className="text-sm font-bold">
                        Rs. {sale.totalAmount.toLocaleString()}
                      </p>
                      <p
                        className={`text-[10px] font-medium uppercase tracking-wider text-[#4ade80]`}
                      >
                        {sale.paymentStatus}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground italic py-8">
                  No recent sales found
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
