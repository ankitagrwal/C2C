import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Shield } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema } from "@shared/schema";
import { z } from "zod";

type LoginFormData = z.infer<typeof insertUserSchema>;

interface LoginFormProps {
  onLogin: (credentials: LoginFormData) => void;
  isLoading?: boolean;
  error?: string;
}

export default function LoginForm({ onLogin, isLoading = false, error }: LoginFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const onSubmit = (data: LoginFormData) => {
    console.log('Login attempt:', data.username);
    onLogin(data);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4" data-testid="login-container">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-primary/10 p-3 rounded-lg">
              <Shield className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-semibold">Clause2Case</CardTitle>
          <CardDescription>
            AI Test Case Generation Platform
            <br />
            <span className="text-xs text-muted-foreground">Admin Access Required</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <Alert variant="destructive" data-testid="alert-error">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter admin username"
                data-testid="input-username"
                {...register("username")}
              />
              {errors.username && (
                <p className="text-sm text-destructive" data-testid="error-username">
                  {errors.username.message}
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter password"
                data-testid="input-password"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-sm text-destructive" data-testid="error-password">
                  {errors.password.message}
                </p>
              )}
            </div>
            
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
              data-testid="button-login"
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLoading ? "Signing In..." : "Sign In"}
            </Button>
          </form>
          
          <div className="mt-6 pt-4 border-t text-center">
            <p className="text-xs text-muted-foreground">
              Demo credentials: admin / admin123!
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}