import { 
  type User, 
  type InsertUser,
  type Customer,
  type InsertCustomer,
  type Document,
  type InsertDocument,
  type TestCase,
  type InsertTestCase,
  type ProcessingJob,
  type InsertProcessingJob
} from "@shared/schema";
import { randomUUID } from "crypto";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Customer operations
  getCustomers(): Promise<Customer[]>;
  getCustomer(id: string): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: string, updates: Partial<Customer>): Promise<Customer>;
  deleteCustomer(id: string): Promise<void>;
  
  // Document operations
  getDocuments(customerId?: string): Promise<Document[]>;
  getDocument(id: string): Promise<Document | undefined>;
  createDocument(document: InsertDocument): Promise<Document>;
  updateDocument(id: string, updates: Partial<Document>): Promise<Document>;
  deleteDocument(id: string): Promise<void>;
  
  // Test case operations
  getTestCases(documentId?: string): Promise<TestCase[]>;
  getTestCase(id: string): Promise<TestCase | undefined>;
  createTestCase(testCase: InsertTestCase): Promise<TestCase>;
  updateTestCase(id: string, updates: Partial<TestCase>): Promise<TestCase>;
  deleteTestCase(id: string): Promise<void>;
  
  // Processing job operations
  getProcessingJobs(documentId?: string): Promise<ProcessingJob[]>;
  getProcessingJob(id: string): Promise<ProcessingJob | undefined>;
  createProcessingJob(job: InsertProcessingJob): Promise<ProcessingJob>;
  updateProcessingJob(id: string, updates: Partial<ProcessingJob>): Promise<ProcessingJob>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;

  constructor() {
    this.users = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      ...insertUser, 
      id, 
      role: insertUser.role || "admin",
      createdAt: new Date()
    };
    this.users.set(id, user);
    return user;
  }
  
  // Placeholder implementations for other methods
  async getCustomers(): Promise<Customer[]> { return []; }
  async getCustomer(id: string): Promise<Customer | undefined> { return undefined; }
  async createCustomer(customer: InsertCustomer): Promise<Customer> { 
    throw new Error("Not implemented in MemStorage"); 
  }
  async updateCustomer(id: string, updates: Partial<Customer>): Promise<Customer> { 
    throw new Error("Not implemented in MemStorage"); 
  }
  async deleteCustomer(id: string): Promise<void> {}
  
  async getDocuments(customerId?: string): Promise<Document[]> { return []; }
  async getDocument(id: string): Promise<Document | undefined> { return undefined; }
  async createDocument(document: InsertDocument): Promise<Document> { 
    throw new Error("Not implemented in MemStorage"); 
  }
  async updateDocument(id: string, updates: Partial<Document>): Promise<Document> { 
    throw new Error("Not implemented in MemStorage"); 
  }
  async deleteDocument(id: string): Promise<void> {}
  
  async getTestCases(documentId?: string): Promise<TestCase[]> { return []; }
  async getTestCase(id: string): Promise<TestCase | undefined> { return undefined; }
  async createTestCase(testCase: InsertTestCase): Promise<TestCase> { 
    throw new Error("Not implemented in MemStorage"); 
  }
  async updateTestCase(id: string, updates: Partial<TestCase>): Promise<TestCase> { 
    throw new Error("Not implemented in MemStorage"); 
  }
  async deleteTestCase(id: string): Promise<void> {}
  
  async getProcessingJobs(documentId?: string): Promise<ProcessingJob[]> { return []; }
  async getProcessingJob(id: string): Promise<ProcessingJob | undefined> { return undefined; }
  async createProcessingJob(job: InsertProcessingJob): Promise<ProcessingJob> { 
    throw new Error("Not implemented in MemStorage"); 
  }
  async updateProcessingJob(id: string, updates: Partial<ProcessingJob>): Promise<ProcessingJob> { 
    throw new Error("Not implemented in MemStorage"); 
  }
}

// Use database storage in production, memory storage for development
import { DatabaseStorage } from "./database-storage";

export const storage = new DatabaseStorage();
