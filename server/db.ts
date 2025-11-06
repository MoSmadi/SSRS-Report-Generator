import mssql from "mssql";
import type {
  DataSource,
  InsertDataSource,
  InsertReport,
  InsertUser,
  Report,
  User,
} from "@shared/dbTypes";
import { ENV } from "./_core/env";

let _pool: mssql.ConnectionPool | null = null;

export async function getDb() {
  if (!_pool) {
    const {
      SQLSERVER_HOST,
      SQLSERVER_DATABASE,
      SQLSERVER_USER,
      SQLSERVER_PASSWORD,
      SQLSERVER_PORT,
    } = process.env;

    if (!SQLSERVER_HOST || !SQLSERVER_DATABASE || !SQLSERVER_USER || !SQLSERVER_PASSWORD) {
      console.warn("[Database] SQL Server environment variables are not fully configured");
      return null;
    }

    const config: mssql.config = {
      server: SQLSERVER_HOST,
      database: SQLSERVER_DATABASE,
      user: SQLSERVER_USER,
      password: SQLSERVER_PASSWORD,
      port: Number(SQLSERVER_PORT ?? 1433),
      options: {
        encrypt: true,
        trustServerCertificate: true,
      },
    };

    try {
      _pool = await mssql.connect(config);
    } catch (error) {
      console.warn("[Database] Failed to connect to SQL Server:", error);
      _pool = null;
    }
  }
  return _pool;
}

const NVARCHAR_MAX = mssql.NVarChar(mssql.MAX);

function mapUserRow(row: any): User {
  return {
    id: row.id,
    openId: row.openId,
    name: row.name ?? null,
    email: row.email ?? null,
    loginMethod: row.loginMethod ?? null,
    role: row.role ?? "user",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastSignedIn: row.lastSignedIn,
  };
}

function mapDataSourceRow(row: any): DataSource {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    connectionString: row.connectionString,
    schema: row.schema ?? null,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapReportRow(row: any): Report {
  return {
    id: row.id,
    title: row.title,
    naturalLanguageRequest: row.naturalLanguageRequest,
    inferredMetrics: row.inferredMetrics ?? null,
    inferredDimensions: row.inferredDimensions ?? null,
    inferredFilters: row.inferredFilters ?? null,
    dataSourceId: row.dataSourceId,
    generatedSQL: row.generatedSQL ?? null,
    resultFields: row.resultFields ?? null,
    renderLink: row.renderLink ?? null,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// Utility to get all databases for dropdown
export async function getAllDatabases(): Promise<string[]> {
  const pool = await getDb();
  if (!pool) return [];
  try {
    const result = await pool
      .request()
      .query(
        "SELECT name FROM sys.databases WHERE database_id > 4 ORDER BY name"
      );
    return result.recordset.map((row: any) => row.name);
  } catch (e) {
    console.error("[Database] Failed to fetch databases:", e);
    return [];
  }
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  const normalized = {
    openId: user.openId,
    name: user.name ?? null,
    email: user.email ?? null,
    loginMethod: user.loginMethod ?? null,
    role:
      user.role ?? (user.openId === ENV.ownerOpenId ? ("admin" as const) : "user"),
    lastSignedIn: user.lastSignedIn ?? new Date(),
  };

  try {
    const updateResult = await db
      .request()
      .input("openId", mssql.VarChar(64), normalized.openId)
      .input("name", mssql.NVarChar(255), normalized.name)
      .input("email", mssql.NVarChar(320), normalized.email)
      .input("loginMethod", mssql.NVarChar(64), normalized.loginMethod)
      .input("role", mssql.NVarChar(16), normalized.role)
      .input("lastSignedIn", mssql.DateTime2, normalized.lastSignedIn)
      .query(`
        UPDATE dbo.Users
        SET
          name = @name,
          email = @email,
          loginMethod = @loginMethod,
          role = @role,
          lastSignedIn = @lastSignedIn,
          updatedAt = SYSUTCDATETIME()
        WHERE openId = @openId;
      `);

    if (updateResult.rowsAffected[0] === 0) {
      await db
        .request()
        .input("openId", mssql.VarChar(64), normalized.openId)
        .input("name", mssql.NVarChar(255), normalized.name)
        .input("email", mssql.NVarChar(320), normalized.email)
        .input("loginMethod", mssql.NVarChar(64), normalized.loginMethod)
        .input("role", mssql.NVarChar(16), normalized.role)
        .input("lastSignedIn", mssql.DateTime2, normalized.lastSignedIn)
        .query(`
          INSERT INTO dbo.Users (
            openId,
            name,
            email,
            loginMethod,
            role,
            lastSignedIn,
            createdAt,
            updatedAt
          )
          VALUES (
            @openId,
            @name,
            @email,
            @loginMethod,
            @role,
            @lastSignedIn,
            SYSUTCDATETIME(),
            SYSUTCDATETIME()
          );
        `);
    }
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db
    .request()
    .input("openId", mssql.VarChar(64), openId)
    .query(
      "SELECT TOP (1) * FROM dbo.Users WHERE openId = @openId ORDER BY id DESC;"
    );

  return result.recordset.length > 0
    ? mapUserRow(result.recordset[0])
    : undefined;
}

export async function getDataSources(): Promise<DataSource[]> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get data sources: database not available");
    return [];
  }

  try {
    const result = await db
      .request()
      .query("SELECT * FROM dbo.DataSources ORDER BY name ASC;");
    return result.recordset.map(mapDataSourceRow);
  } catch (error) {
    console.error("[Database] Failed to get data sources:", error);
    return [];
  }
}

export async function getDataSourceById(
  id: number
): Promise<DataSource | undefined> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get data source: database not available");
    return undefined;
  }

  try {
    const result = await db
      .request()
      .input("id", mssql.Int, id)
      .query("SELECT TOP (1) * FROM dbo.DataSources WHERE id = @id;");
    return result.recordset.length ? mapDataSourceRow(result.recordset[0]) : undefined;
  } catch (error) {
    console.error("[Database] Failed to get data source:", error);
    return undefined;
  }
}

export async function createDataSource(
  data: InsertDataSource
): Promise<DataSource | undefined> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot create data source: database not available");
    return undefined;
  }

  try {
    const result = await db
      .request()
      .input("name", mssql.NVarChar(255), data.name)
      .input("description", NVARCHAR_MAX, data.description ?? null)
      .input("connectionString", NVARCHAR_MAX, data.connectionString)
      .input("schema", NVARCHAR_MAX, data.schema ?? null)
      .input("createdBy", mssql.Int, data.createdBy)
      .query(`
        INSERT INTO dbo.DataSources (
          name,
          description,
          connectionString,
          schema,
          createdBy,
          createdAt,
          updatedAt
        )
        OUTPUT INSERTED.*
        VALUES (
          @name,
          @description,
          @connectionString,
          @schema,
          @createdBy,
          SYSUTCDATETIME(),
          SYSUTCDATETIME()
        );
      `);

    return result.recordset.length ? mapDataSourceRow(result.recordset[0]) : undefined;
  } catch (error) {
    console.error("[Database] Failed to create data source:", error);
    throw error;
  }
}

export async function createReport(
  data: InsertReport
): Promise<Report | undefined> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot create report: database not available");
    return undefined;
  }

  try {
    const result = await db
      .request()
      .input("title", mssql.NVarChar(255), data.title)
      .input("naturalLanguageRequest", NVARCHAR_MAX, data.naturalLanguageRequest)
      .input("inferredMetrics", NVARCHAR_MAX, data.inferredMetrics ?? null)
      .input("inferredDimensions", NVARCHAR_MAX, data.inferredDimensions ?? null)
      .input("inferredFilters", NVARCHAR_MAX, data.inferredFilters ?? null)
      .input("dataSourceId", mssql.Int, data.dataSourceId)
      .input("generatedSQL", NVARCHAR_MAX, data.generatedSQL ?? null)
      .input("resultFields", NVARCHAR_MAX, data.resultFields ?? null)
      .input("renderLink", mssql.NVarChar(512), data.renderLink ?? null)
      .input("createdBy", mssql.Int, data.createdBy)
      .query(`
        INSERT INTO dbo.Reports (
          title,
          naturalLanguageRequest,
          inferredMetrics,
          inferredDimensions,
          inferredFilters,
          dataSourceId,
          generatedSQL,
          resultFields,
          renderLink,
          createdBy,
          createdAt,
          updatedAt
        )
        OUTPUT INSERTED.*
        VALUES (
          @title,
          @naturalLanguageRequest,
          @inferredMetrics,
          @inferredDimensions,
          @inferredFilters,
          @dataSourceId,
          @generatedSQL,
          @resultFields,
          @renderLink,
          @createdBy,
          SYSUTCDATETIME(),
          SYSUTCDATETIME()
        );
      `);

    return result.recordset.length ? mapReportRow(result.recordset[0]) : undefined;
  } catch (error) {
    console.error("[Database] Failed to create report:", error);
    throw error;
  }
}

export async function getReportById(id: number): Promise<Report | undefined> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get report: database not available");
    return undefined;
  }

  try {
    const result = await db
      .request()
      .input("id", mssql.Int, id)
      .query("SELECT TOP (1) * FROM dbo.Reports WHERE id = @id;");
    return result.recordset.length ? mapReportRow(result.recordset[0]) : undefined;
  } catch (error) {
    console.error("[Database] Failed to get report:", error);
    return undefined;
  }
}

export async function updateReport(
  id: number,
  data: Partial<InsertReport>
): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot update report: database not available");
    return false;
  }

  const fields: string[] = [];
  const request = db.request().input("id", mssql.Int, id);

  const addField = (
    key: keyof InsertReport,
    column: string,
    type:
      | mssql.ISqlType
      | mssql.ISqlTypeFactoryWithLength
      | mssql.ISqlTypeFactoryWithNoParams
      | mssql.ISqlTypeFactoryWithPrecisionScale
      | mssql.ISqlTypeFactoryWithScale,
    value: any
  ) => {
    if (value === undefined) return;
    const paramName = key as string;
    fields.push(`[${column}] = @${paramName}`);
    request.input(paramName, type, value);
  };

  addField("title", "title", mssql.NVarChar(255), data.title);
  addField(
    "naturalLanguageRequest",
    "naturalLanguageRequest",
    NVARCHAR_MAX,
    data.naturalLanguageRequest
  );
  addField("inferredMetrics", "inferredMetrics", NVARCHAR_MAX, data.inferredMetrics);
  addField(
    "inferredDimensions",
    "inferredDimensions",
    NVARCHAR_MAX,
    data.inferredDimensions
  );
  addField("inferredFilters", "inferredFilters", NVARCHAR_MAX, data.inferredFilters);
  addField("dataSourceId", "dataSourceId", mssql.Int, data.dataSourceId);
  addField("generatedSQL", "generatedSQL", NVARCHAR_MAX, data.generatedSQL);
  addField("resultFields", "resultFields", NVARCHAR_MAX, data.resultFields);
  addField("renderLink", "renderLink", mssql.NVarChar(512), data.renderLink);

  if (fields.length === 0) {
    return false;
  }

  fields.push("updatedAt = SYSUTCDATETIME()");

  try {
    const result = await request.query(
      `UPDATE dbo.Reports SET ${fields.join(", ")} WHERE id = @id;`
    );
    return result.rowsAffected[0] > 0;
  } catch (error) {
    console.error("[Database] Failed to update report:", error);
    throw error;
  }
}
