import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { 
  Settings, 
  Database, 
  Users, 
  FileText, 
  TestTube2, 
  BarChart3, 
  Shield,
  Building2,
  Zap 
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

// Navigation menu items with proper enterprise structure
const mainMenuItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: BarChart3,
    description: "Overview & Analytics",
  },
  {
    title: "Internal Tools",
    url: "/tools",
    icon: Settings,
    description: "Configure integrations",
    badge: "3 Active"
  },
  {
    title: "Customers",
    url: "/customers",
    icon: Building2,
    description: "Manage customer configs",
  },
  {
    title: "Documents",
    url: "/documents",
    icon: FileText,
    description: "Upload & process docs",
  },
  {
    title: "Test Cases",
    url: "/test-cases",
    icon: TestTube2,
    description: "Review & manage tests",
  },
];

const aiMenuItems = [
  {
    title: "AI Processing",
    url: "/ai-processing",
    icon: Zap,
    description: "Monitor AI operations",
  },
];

interface AppSidebarProps {
  user?: {
    username: string;
    role: string;
  };
}

export function AppSidebar({ user }: AppSidebarProps) {
  const [location] = useLocation();

  const isActiveRoute = (url: string) => {
    if (url === "/") return location === "/";
    return location.startsWith(url);
  };

  return (
    <Sidebar data-testid="sidebar-main">
      <SidebarHeader className="border-b p-4">
        <div className="flex items-center space-x-3">
          <div className="bg-primary/10 p-2 rounded-lg">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-lg">Clause2Case</h2>
            <p className="text-xs text-muted-foreground">AI Test Generation</p>
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    data-active={isActiveRoute(item.url)}
                    className={isActiveRoute(item.url) ? "bg-sidebar-accent" : ""}
                    data-testid={`nav-${item.title.toLowerCase().replace(' ', '-')}`}
                  >
                    <a href={item.url} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <item.icon className="h-4 w-4" />
                        <div>
                          <span className="font-medium">{item.title}</span>
                          <p className="text-xs text-muted-foreground">{item.description}</p>
                        </div>
                      </div>
                      {item.badge && (
                        <Badge variant="secondary" className="text-xs">
                          {item.badge}
                        </Badge>
                      )}
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        
        <SidebarGroup>
          <SidebarGroupLabel>AI Operations</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {aiMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    data-active={isActiveRoute(item.url)}
                    className={isActiveRoute(item.url) ? "bg-sidebar-accent" : ""}
                    data-testid={`nav-${item.title.toLowerCase().replace(' ', '-')}`}
                  >
                    <a href={item.url} className="flex items-center space-x-3">
                      <item.icon className="h-4 w-4" />
                      <div>
                        <span className="font-medium">{item.title}</span>
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      </div>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter className="border-t p-4">
        {user && (
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-muted rounded-full p-2">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium text-sm" data-testid="text-username">{user.username}</p>
                <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" data-testid="button-logout">
              Logout
            </Button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}