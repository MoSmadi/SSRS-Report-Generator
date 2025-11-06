export type UserRole = "user" | "admin";

export interface User {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
  lastSignedIn: Date;
}

export type InsertUser = {
  openId: string;
  name?: string | null;
  email?: string | null;
  loginMethod?: string | null;
  role?: UserRole;
  lastSignedIn?: Date;
};

export interface DataSource {
  id: number;
  name: string;
  description: string | null;
  connectionString: string;
  schema: string | null;
  createdBy: number;
  createdAt: Date;
  updatedAt: Date;
}

export type InsertDataSource = {
  name: string;
  description?: string | null;
  connectionString: string;
  schema?: string | null;
  createdBy: number;
};

export interface Report {
  id: number;
  title: string;
  naturalLanguageRequest: string;
  inferredMetrics: string | null;
  inferredDimensions: string | null;
  inferredFilters: string | null;
  dataSourceId: number;
  generatedSQL: string | null;
  resultFields: string | null;
  renderLink: string | null;
  createdBy: number;
  createdAt: Date;
  updatedAt: Date;
}

export type InsertReport = {
  title: string;
  naturalLanguageRequest: string;
  inferredMetrics?: string | null;
  inferredDimensions?: string | null;
  inferredFilters?: string | null;
  dataSourceId: number;
  generatedSQL?: string | null;
  resultFields?: string | null;
  renderLink?: string | null;
  createdBy: number;
};
