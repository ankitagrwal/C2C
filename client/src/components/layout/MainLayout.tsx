import { useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { ThemeToggle } from "../theme/ThemeToggle";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { Chatbot } from "@/components/ui/chatbot";

interface MainLayoutProps {
  children: React.ReactNode;
  user?: {
    username: string;
    role: string;
  };
  onLogout?: () => void;
}

export default function MainLayout({ children, user, onLogout }: MainLayoutProps) {
  // Custom sidebar width for enterprise application
  const style = {
    "--sidebar-width": "20rem",       // 320px for better content
    "--sidebar-width-icon": "4rem",   // default icon width
  };

  const handleLogout = () => {
    console.log('Logout requested');
    if (onLogout) {
      onLogout();
    }
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar user={user} onLogout={onLogout} />
        <div className="flex flex-col flex-1">
          <header className="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex items-center space-x-4">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <div className="text-sm text-muted-foreground">
                Welcome back, <span className="font-medium">{user?.username || 'Admin'}</span>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <ThemeToggle />
              {onLogout && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  data-testid="button-header-logout"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              )}
            </div>
          </header>
          <main className="flex-1 p-6">
            {children}
          </main>
        </div>
      </div>
      <Chatbot />
    </SidebarProvider>
  );
}