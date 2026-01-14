"use client";

import { useSession, signOut } from "next-auth/react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Smartphone,
  Truck,
  Wallet,
  ChevronRight,
  Search,
  Bell,
  User,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/shared/mode-toggle";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { StoreSwitcher } from "@/components/shared/store-switcher";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const storeMenuItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: ShoppingCart, label: "POS", href: "/pos" },
  {
    icon: Package,
    label: "Inventory",
    href: "/inventory/products",
    submenu: [
      { label: "Products", href: "/inventory/products" },
      { label: "Categories", href: "/inventory/categories" },
      { label: "Brands", href: "/inventory/brands" },
    ],
  },
  { icon: Truck, label: "Purchase Orders", href: "/purchases/orders" },
  { icon: Users, label: "Suppliers", href: "/purchases/suppliers" },
  {
    icon: Wallet,
    label: "Accounting",
    href: "/accounting/accounts",
    submenu: [
      { label: "Chart of Accounts", href: "/accounting/accounts" },
      { label: "Expenses", href: "/accounting/expenses" },
    ],
  },
  { icon: BarChart3, label: "Reports", href: "/reports/sales" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

export default function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  console.log("🔍 STORE LAYOUT DEBUG:");
  console.log("👤 User:", session?.user);
  console.log("🔑 GlobalRole:", (session?.user as any)?.globalRole);
  const pathname = usePathname();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [expandedMenus, setExpandedMenus] = useState<string[]>([
    "Inventory",
    "Accounting",
  ]);

  // Redirect admins to admin panel
  useEffect(() => {
    if (status === "loading") return;

    console.log("🔍 STORE LAYOUT DEBUG:");
    console.log("👤 User:", session?.user);
    console.log("🔑 GlobalRole:", (session?.user as any)?.globalRole);

    if (!session?.user) {
      router.push("/login");
      return;
    }

    const globalRole = (session.user as any)?.globalRole;
    if (globalRole === "ADMIN") {
      console.log("🚀 Redirecting ADMIN to /admin");
      router.push("/admin");
    }
  }, [session, status, router]);

  const toggleMenu = (label: string) => {
    setExpandedMenus((prev) =>
      prev.includes(label)
        ? prev.filter((item) => item !== label)
        : [...prev, label]
    );
  };

  if (status === "loading") {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-[#4ade80]" />
      </div>
    );
  }

  // Don't render layout if user is admin (prevent flash)
  if ((session?.user as any)?.globalRole === "ADMIN") {
    return null;
  }
  if (pathname === "/select-store") {
    return <div className="min-h-screen bg-background">{children}</div>;
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 bg-card border-r border-border transition-all duration-300 ease-in-out ${
          isSidebarOpen ? "w-64" : "w-20"
        }`}
      >
        <div className="flex h-16 items-center justify-between px-4 border-b border-border">
          {isSidebarOpen ? (
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-[#4ade80] flex items-center justify-center">
                <Smartphone className="h-5 w-5 text-black" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-green-400 to-emerald-600 bg-clip-text text-transparent">
                ShopPOS
              </span>
            </div>
          ) : (
            <div className="h-8 w-8 rounded-lg bg-[#4ade80] flex items-center justify-center mx-auto">
              <Smartphone className="h-5 w-5 text-black" />
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <ScrollArea className="h-[calc(100vh-144px)] py-4">
          <div className="px-3 space-y-1">
            {storeMenuItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              const hasSubmenu = item.submenu && item.submenu.length > 0;
              const isExpanded = expandedMenus.includes(item.label);

              return (
                <div key={item.label}>
                  {!hasSubmenu ? (
                    <Link href={item.href}>
                      <Button
                        variant={isActive ? "secondary" : "ghost"}
                        className={`w-full justify-start mb-1 ${
                          isActive
                            ? "bg-[#4ade80]/10 text-[#4ade80] hover:bg-[#4ade80]/20 font-semibold"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        } ${!isSidebarOpen && "px-2 justify-center"}`}
                      >
                        <item.icon
                          className={`h-5 w-5 ${isSidebarOpen && "mr-3"}`}
                        />
                        {isSidebarOpen && <span>{item.label}</span>}
                      </Button>
                    </Link>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        className={`w-full justify-between mb-1 ${
                          isActive ? "text-foreground" : "text-muted-foreground"
                        } ${!isSidebarOpen && "px-2 justify-center"}`}
                        onClick={() => toggleMenu(item.label)}
                      >
                        <div className="flex items-center">
                          <item.icon
                            className={`h-5 w-5 ${isSidebarOpen && "mr-3"}`}
                          />
                          {isSidebarOpen && <span>{item.label}</span>}
                        </div>
                        {isSidebarOpen && (
                          <ChevronRight
                            className={`h-4 w-4 transition-transform ${
                              isExpanded ? "rotate-90" : ""
                            }`}
                          />
                        )}
                      </Button>

                      {isSidebarOpen && isExpanded && (
                        <div className="ml-9 space-y-1 border-l border-border/50 pl-3 my-1">
                          {item.submenu.map((subItem) => (
                            <Link key={subItem.href} href={subItem.href}>
                              <Button
                                variant="ghost"
                                size="sm"
                                className={`w-full justify-start h-9 ${
                                  pathname === subItem.href
                                    ? "text-[#4ade80] bg-[#4ade80]/5"
                                    : "text-muted-foreground hover:text-foreground"
                                }`}
                              >
                                {subItem.label}
                              </Button>
                            </Link>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border bg-card">
          <Button
            variant="ghost"
            className={`w-full justify-start text-red-500 hover:text-red-500 hover:bg-red-500/10 ${
              !isSidebarOpen && "px-2 justify-center"
            }`}
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <LogOut className={`h-5 w-5 ${isSidebarOpen && "mr-3"}`} />
            {isSidebarOpen && <span>Log out</span>}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main
        className={`flex-1 transition-all duration-300 ease-in-out ${
          isSidebarOpen ? "ml-64" : "ml-20"
        }`}
      >
        {/* Store Header */}
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border bg-background/95 backdrop-blur px-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="text-muted-foreground hover:text-foreground"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="relative w-96 hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search everything..."
                className="pl-10 bg-muted/50 border-border focus:bg-background transition-colors"
              />
            </div>
            <StoreSwitcher />
          </div>

          <div className="flex items-center gap-4">
            <ModeToggle />

            <Button
              variant="ghost"
              size="icon"
              className="relative text-muted-foreground hover:text-foreground"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-[#4ade80]" />
            </Button>

            <div className="flex items-center gap-3 pl-4 border-l border-border">
              <div className="text-right hidden md:block">
                <p className="text-sm font-medium leading-none">
                  {session?.user?.name}
                </p>
                <p className="text-xs text-muted-foreground mt-1 uppercase">
                  {(session?.user as any)?.role || "STAFF"}
                </p>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="relative h-10 w-10 rounded-full hover:bg-transparent"
                  >
                    <Avatar className="h-10 w-10 border border-border cursor-pointer transition-transform hover:scale-105">
                      <AvatarImage src={(session?.user as any)?.avatarUrl} />
                      <AvatarFallback className="bg-[#4ade80]/10 text-[#4ade80] font-bold">
                        {session?.user?.name?.charAt(0) || "U"}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {session?.user?.name}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {session?.user?.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link
                      href="/settings/profile"
                      className="cursor-pointer flex items-center"
                    >
                      <User className="mr-2 h-4 w-4" />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="text-red-500 focus:text-red-500 focus:bg-red-500/10 cursor-pointer"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <div className="p-6 max-w-[1600px] mx-auto space-y-6">{children}</div>
      </main>
    </div>
  );
}
