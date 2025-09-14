import { useState, useEffect } from "react";
import { Switch, Route } from "wouter";
import LoginForm from "../auth/LoginForm";
import MainLayout from "../layout/MainLayout";
import DashboardOverview from "../dashboard/DashboardOverview";
import InternalToolsManager from "../tools/InternalToolsManager";
import Documents from "@/pages/Documents";
import TestCaseManager from "../testcases/TestCaseManager";
import { insertUserSchema } from "@shared/schema";
import { z } from "zod";

type LoginFormData = z.infer<typeof insertUserSchema>;

interface User {
  username: string;
  role: string;
}

interface SessionData {
  user: User;
  expires: number;
}

// Session management constants
const SESSION_KEY = 'clause2case_session';
const SESSION_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

// Demo credentials reference (for display only)
const DEMO_CREDENTIALS = {
  username: 'admin',
  password: 'admin123!'
};

export default function Clause2CaseApp() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState<string>('');
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  // Check for existing session on component mount
  useEffect(() => {
    const checkSession = () => {
      try {
        const sessionData = localStorage.getItem(SESSION_KEY);
        if (sessionData) {
          const parsed: SessionData = JSON.parse(sessionData);
          const now = Date.now();
          
          if (parsed.expires > now) {
            // Valid session found
            setUser(parsed.user);
            console.log('Session restored for user:', parsed.user.username);
          } else {
            // Expired session
            localStorage.removeItem(SESSION_KEY);
            console.log('Session expired, removed from storage');
          }
        }
      } catch (error) {
        console.error('Error checking session:', error);
        localStorage.removeItem(SESSION_KEY);
      }
      setIsCheckingSession(false);
    };

    checkSession();
  }, []);

  const handleLogin = async (credentials: LoginFormData) => {
    setIsLoading(true);
    setLoginError('');
    
    console.log('Login attempt with:', credentials.username);
    
    try {
      // Call the actual backend login API
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify(credentials),
        credentials: 'include', // Include cookies for session
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Login failed');
      }
      
      const data = await response.json();
      
      const userData: User = {
        username: data.user.username,
        role: data.user.role
      };
      
      // Store session data with expiration for UI state
      const sessionData: SessionData = {
        user: userData,
        expires: Date.now() + SESSION_DURATION
      };
      localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
      setUser(userData);
      console.log('Login successful, server session established');
      
    } catch (error) {
      console.error('Login error:', error);
      setLoginError(error instanceof Error ? error.message : 'Login failed. Please try again.');
    }
    
    setIsLoading(false);
  };

  const handleLogout = async () => {
    console.log('User logged out');
    
    try {
      // Call backend logout API to destroy server session
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include'
      });
    } catch (error) {
      console.error('Logout API call failed:', error);
      // Continue with local logout even if server call fails
    }
    
    // Clear local session and update UI state
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
    setLoginError('');
  };

  // Show loading while checking session
  if (isCheckingSession) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-sm text-muted-foreground">Checking session...</p>
        </div>
      </div>
    );
  }

  // Show login form if not authenticated
  if (!user) {
    return (
      <LoginForm 
        onLogin={handleLogin} 
        isLoading={isLoading}
        error={loginError}
      />
    );
  }

  // Main application with routing
  return (
    <MainLayout user={user} onLogout={handleLogout}>
      <Switch>
        <Route path="/" component={DashboardOverview} />
        <Route path="/tools" component={InternalToolsManager} />
        <Route path="/customers">
          <div className="text-center py-12">
            <h2 className="text-2xl font-semibold mb-2">Customers</h2>
            <p className="text-muted-foreground">Customer management coming soon...</p>
          </div>
        </Route>
        <Route path="/documents" component={Documents} />
        <Route path="/test-cases" component={TestCaseManager} />
        <Route path="/ai-processing">
          <div className="text-center py-12">
            <h2 className="text-2xl font-semibold mb-2">AI Processing</h2>
            <p className="text-muted-foreground">AI operations monitoring coming soon...</p>
          </div>
        </Route>
        {/* 404 fallback */}
        <Route>
          <div className="text-center py-12">
            <h2 className="text-2xl font-semibold mb-2">Page Not Found</h2>
            <p className="text-muted-foreground">The page you're looking for doesn't exist.</p>
          </div>
        </Route>
      </Switch>
    </MainLayout>
  );
}