import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, integer, timestamp, jsonb, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table for admin authentication
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("admin"),
  createdAt: timestamp("created_at").default(sql`now()`),
});

// Internal tools configuration (Salesforce, SAP, HR Portal)
export const internalTools = pgTable("internal_tools", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  toolType: text("tool_type").notNull(), // 'crm', 'erp', 'custom'
  apiEndpoint: text("api_endpoint"),
  authType: text("auth_type").notNull(), // 'api_key', 'oauth', 'basic_auth'
  configFields: jsonb("config_fields"), // Dynamic configuration fields
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`now()`),
});

// Customer management with solution_id
export const customers = pgTable("customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  solutionId: text("solution_id").unique().notNull(), // Unique across all internal tools
  industry: text("industry"),
  internalToolId: varchar("internal_tool_id").references(() => internalTools.id),
  isConfigured: boolean("is_configured").default(false),
  toolConfig: jsonb("tool_config"), // Store tool-specific config data
  lastSync: timestamp("last_sync"),
  status: text("status").default("active"),
  createdAt: timestamp("created_at").default(sql`now()`),
});

// Document storage
export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").references(() => customers.id),
  filename: text("filename").notNull(),
  content: text("content"),
  docType: text("doc_type"), // 'Contract', 'Handbook', 'Tax Filing', etc.
  status: text("status").default("uploaded"),
  fileSize: integer("file_size"),
  createdAt: timestamp("created_at").default(sql`now()`),
});

// Processing jobs for document analysis
export const processingJobs = pgTable("processing_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").references(() => documents.id),
  status: text("status").default("pending"), // 'pending', 'processing', 'completed', 'failed'
  jobType: text("job_type").notNull(), // 'text_extraction', 'test_generation', 'embedding'
  progress: integer("progress").default(0),
  errorMessage: text("error_message"),
  result: jsonb("result"),
  createdAt: timestamp("created_at").default(sql`now()`),
  completedAt: timestamp("completed_at"),
});

// Generated test cases
export const testCases = pgTable("test_cases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").references(() => documents.id),
  content: text("content").notNull(),
  category: text("category"), // 'Functional', 'Compliance', 'Edge Cases', 'Integration'
  source: text("source").default("generated"), // 'generated', 'uploaded', 'manual'
  confidenceScore: real("confidence_score"),
  contextUsed: text("context_used"), // RAG context that was used
  executionStatus: text("execution_status").default("ready"), // 'ready', 'in_progress', 'complete'
  createdAt: timestamp("created_at").default(sql`now()`),
});

// Schema definitions for forms
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  role: true,
});

export const insertInternalToolSchema = createInsertSchema(internalTools).omit({
  id: true,
  createdAt: true,
});

export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
  createdAt: true,
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  createdAt: true,
});

export const insertProcessingJobSchema = createInsertSchema(processingJobs).omit({
  id: true,
  createdAt: true,
});

export const insertTestCaseSchema = createInsertSchema(testCases).omit({
  id: true,
  createdAt: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InternalTool = typeof internalTools.$inferSelect;
export type InsertInternalTool = z.infer<typeof insertInternalToolSchema>;
export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type ProcessingJob = typeof processingJobs.$inferSelect;
export type InsertProcessingJob = z.infer<typeof insertProcessingJobSchema>;
export type TestCase = typeof testCases.$inferSelect;
export type InsertTestCase = z.infer<typeof insertTestCaseSchema>;
