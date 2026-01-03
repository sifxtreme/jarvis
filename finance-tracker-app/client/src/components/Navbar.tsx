import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { TrendingUp, DollarSign, Calendar, Menu, Wrench, Sun, Moon } from "lucide-react";
import { useState } from "react";
import { useTheme } from "@/hooks/useTheme";
import { getGoogleCalendarAuthUrl } from "@/lib/api";

const navItems = [
  { path: "/", label: "Transactions", icon: DollarSign },
  { path: "/trends", label: "Trends", icon: TrendingUp },
  { path: "/yearly-budget", label: "Budget", icon: Calendar },
  { path: "/teller-repair", label: "Teller", icon: Wrench },
];

export function Navbar() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const [calendarConnecting, setCalendarConnecting] = useState(false);

  const connectCalendar = async () => {
    setCalendarConnecting(true);
    try {
      const url = await getGoogleCalendarAuthUrl();
      window.location.href = url;
    } catch (e) {
      console.error("Calendar connect failed", e);
      setCalendarConnecting(false);
    }
  };

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-10 items-center px-4">
        {/* Logo / Brand */}
        <Link to="/" className="font-bold text-sm mr-6 text-primary">
          Jarvis
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="ml-auto hidden md:flex items-center gap-2">
          <button
            onClick={connectCalendar}
            className="px-2.5 py-1.5 text-xs font-medium rounded-md border border-border text-foreground hover:bg-muted transition-colors"
            disabled={calendarConnecting}
          >
            {calendarConnecting ? "Connecting..." : "Connect Calendar"}
          </button>
          <button
            onClick={toggleTheme}
            className="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors"
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>
        </div>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden ml-auto p-1.5 hover:bg-muted rounded-md"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          <Menu className="h-4 w-4" />
        </button>
      </div>

      {/* Mobile Nav */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t px-4 py-2 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
          <button
            onClick={connectCalendar}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors text-muted-foreground hover:text-foreground hover:bg-muted w-full"
            disabled={calendarConnecting}
          >
            {calendarConnecting ? "Connecting..." : "Connect Calendar"}
          </button>
          <button
            onClick={toggleTheme}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors text-muted-foreground hover:text-foreground hover:bg-muted w-full"
          >
            {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
          </button>
        </div>
      )}
    </nav>
  );
}
