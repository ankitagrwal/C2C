import { useState } from "react";
import { Switch, Route } from "wouter";
import LoginForm from "../auth/LoginForm";
import MainLayout from "../layout/MainLayout";
import DashboardOverview from "../dashboard/DashboardOverview";
import InternalToolsManager from "../tools/InternalToolsManager";
import DocumentUpload from "../documents/DocumentUpload";
import TestCaseManager from "../testcases/TestCaseManager";
import { insertUserSchema } from "@shared/schema";
import { z } from "zod";

type LoginFormData = z.infer<typeof insertUserSchema>;

interface User {
  username: string;
  role: string;
}

// Mock authentication for demo //todo: remove mock functionality
const DEMO_CREDENTIALS = {
  username: 'admin',
  password: 'password'
};

export default function Clause2CaseApp() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState<string>('');

  const handleLogin = async (credentials: LoginFormData) => {
    setIsLoading(true);
    setLoginError('');
    
    console.log('Login attempt with:', credentials.username);
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Demo authentication logic //todo: remove mock functionality
    if (credentials.username === DEMO_CREDENTIALS.username && 
        credentials.password === DEMO_CREDENTIALS.password) {
      setUser({
        username: credentials.username,
        role: 'administrator'
      });
      console.log('Login successful');
    } else {
      setLoginError('Invalid credentials. Use admin/password for demo.');
      console.log('Login failed: Invalid credentials');
    }
    
    setIsLoading(false);
  };

  const handleLogout = () => {
    console.log('User logged out');
    setUser(null);
    setLoginError('');
  };

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
        <Route path="/documents" component={DocumentUpload} />
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