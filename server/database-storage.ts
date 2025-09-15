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
  type InsertProcessingJob,
  users,
  customers,
  documents,
  testCases,
  processingJobs
} from "@shared/schema";
import { db } from "./db";
import { eq, and, like, count, desc, asc } from "drizzle-orm";
import type { IStorage } from "./storage";

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  // Customer operations
  async getCustomers(): Promise<Customer[]> {
    return await db.select().from(customers);
  }

  async getCustomer(id: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id));
    return customer || undefined;
  }

  async getCustomerBySolutionId(solutionId: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.solutionId, solutionId));
    return customer || undefined;
  }

  async createCustomer(insertCustomer: InsertCustomer): Promise<Customer> {
    const [customer] = await db
      .insert(customers)
      .values(insertCustomer)
      .returning();
    return customer;
  }

  async updateCustomer(id: string, updates: Partial<Customer>): Promise<Customer> {
    const [customer] = await db
      .update(customers)
      .set(updates)
      .where(eq(customers.id, id))
      .returning();
    return customer;
  }

  async deleteCustomer(id: string): Promise<void> {
    await db.delete(customers).where(eq(customers.id, id));
  }

  // Document operations
  async getDocuments(customerId?: string): Promise<Document[]> {
    if (customerId) {
      return await db.select().from(documents).where(eq(documents.customerId, customerId));
    }
    return await db.select().from(documents);
  }

  async getDocument(id: string): Promise<Document | undefined> {
    const [document] = await db.select().from(documents).where(eq(documents.id, id));
    return document || undefined;
  }

  async createDocument(insertDocument: InsertDocument): Promise<Document> {
    const [document] = await db
      .insert(documents)
      .values(insertDocument)
      .returning();
    return document;
  }

  async createDocuments(insertDocuments: InsertDocument[]): Promise<Document[]> {
    const createdDocuments = await db
      .insert(documents)
      .values(insertDocuments)
      .returning();
    return createdDocuments;
  }

  async updateDocument(id: string, updates: Partial<Document>): Promise<Document> {
    const [document] = await db
      .update(documents)
      .set(updates)
      .where(eq(documents.id, id))
      .returning();
    return document;
  }

  async deleteDocument(id: string): Promise<void> {
    await db.delete(documents).where(eq(documents.id, id));
  }

  // Test case operations
  async getTestCases(documentId?: string): Promise<TestCase[]> {
    if (documentId) {
      return await db.select().from(testCases).where(eq(testCases.documentId, documentId));
    }
    return await db.select().from(testCases);
  }

  async getTestCasesPaginated(options: {
    documentId?: string;
    page?: number;
    pageSize?: number;
    category?: string;
    priority?: string;
    source?: string;
  }): Promise<{ testCases: TestCase[]; total: number; }> {
    const {
      documentId,
      page = 1,
      pageSize = 20,
      category,
      priority,
      source
    } = options;

    // Build where conditions
    const conditions = [];
    if (documentId) {
      conditions.push(eq(testCases.documentId, documentId));
    }
    if (category) {
      conditions.push(like(testCases.category, `%${category}%`));
    }
    if (priority) {
      conditions.push(eq(testCases.priority, priority));
    }
    if (source) {
      conditions.push(eq(testCases.source, source));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [totalResult] = await db
      .select({ count: count() })
      .from(testCases)
      .where(whereClause);
    const total = totalResult.count;

    // Get paginated results
    const offset = (page - 1) * pageSize;
    const results = await db
      .select()
      .from(testCases)
      .where(whereClause)
      .orderBy(desc(testCases.createdAt))
      .limit(pageSize)
      .offset(offset);

    return {
      testCases: results,
      total: total
    };
  }

  async getTestCase(id: string): Promise<TestCase | undefined> {
    const [testCase] = await db.select().from(testCases).where(eq(testCases.id, id));
    return testCase || undefined;
  }

  async createTestCase(insertTestCase: InsertTestCase): Promise<TestCase> {
    const [testCase] = await db
      .insert(testCases)
      .values(insertTestCase)
      .returning();
    return testCase;
  }

  async createTestCases(insertTestCases: InsertTestCase[]): Promise<TestCase[]> {
    const createdTestCases = await db
      .insert(testCases)
      .values(insertTestCases)
      .returning();
    return createdTestCases;
  }

  async updateTestCase(id: string, updates: Partial<TestCase>): Promise<TestCase> {
    const [testCase] = await db
      .update(testCases)
      .set(updates)
      .where(eq(testCases.id, id))
      .returning();
    return testCase;
  }

  async deleteTestCase(id: string): Promise<void> {
    await db.delete(testCases).where(eq(testCases.id, id));
  }

  // Processing job operations
  async getProcessingJobs(documentId?: string): Promise<ProcessingJob[]> {
    if (documentId) {
      return await db.select().from(processingJobs).where(eq(processingJobs.documentId, documentId));
    }
    return await db.select().from(processingJobs);
  }

  async getProcessingJob(id: string): Promise<ProcessingJob | undefined> {
    const [job] = await db.select().from(processingJobs).where(eq(processingJobs.id, id));
    return job || undefined;
  }

  async createProcessingJob(insertJob: InsertProcessingJob): Promise<ProcessingJob> {
    const [job] = await db
      .insert(processingJobs)
      .values(insertJob)
      .returning();
    return job;
  }

  async updateProcessingJob(id: string, updates: Partial<ProcessingJob>): Promise<ProcessingJob> {
    const [job] = await db
      .update(processingJobs)
      .set(updates)
      .where(eq(processingJobs.id, id))
      .returning();
    return job;
  }
}