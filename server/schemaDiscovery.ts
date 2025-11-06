import { getDb } from "./db";

export interface TableColumn {
  tableName: string;
  columnName: string;
  dataType: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  referencedTable?: string;
  referencedColumn?: string;
}

export interface TableRelationship {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
}

export interface DatabaseSchema {
  tables: string[];
  columns: TableColumn[];
  relationships: TableRelationship[];
}

export interface ColumnMatch {
  column: TableColumn;
  score: number;
}

function formatIdentifier(value: string): string {
  if (!value) {
    throw new Error("Database name is required");
  }
  if (!/^[\w-]+$/i.test(value)) {
    throw new Error(`Invalid database name: ${value}`);
  }
  return `[${value.replace(/]/g, "]]")}]`;
}

/**
 * Discover the complete schema of a database
 */
export async function discoverDatabaseSchema(
  databaseName: string
): Promise<DatabaseSchema | null> {
  try {
    const db = await getDb();
    if (!db) {
      console.log(
        "[SchemaDiscovery] No database connection available, using mock schema"
      );
      return generateMockDatabaseSchema();
    }

    const dbIdentifier = formatIdentifier(databaseName);

    const tablesQuery = `
      SELECT TABLE_SCHEMA, TABLE_NAME
      FROM ${dbIdentifier}.INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_SCHEMA, TABLE_NAME;
    `;

    const columnsQuery = `
      SELECT
        c.TABLE_SCHEMA,
        c.TABLE_NAME,
        c.COLUMN_NAME,
        c.DATA_TYPE,
        c.IS_NULLABLE,
        c.CHARACTER_MAXIMUM_LENGTH
      FROM ${dbIdentifier}.INFORMATION_SCHEMA.COLUMNS c
      ORDER BY c.TABLE_SCHEMA, c.TABLE_NAME, c.ORDINAL_POSITION;
    `;

    const primaryKeysQuery = `
      SELECT
        ku.TABLE_SCHEMA,
        ku.TABLE_NAME,
        ku.COLUMN_NAME
      FROM ${dbIdentifier}.INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
      JOIN ${dbIdentifier}.INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku
        ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
      WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY';
    `;

    const foreignKeysQuery = `
      SELECT
        fk.TABLE_SCHEMA AS FK_SCHEMA,
        fk.TABLE_NAME AS FK_TABLE,
        fk.COLUMN_NAME AS FK_COLUMN,
        pk.TABLE_SCHEMA AS PK_SCHEMA,
        pk.TABLE_NAME AS PK_TABLE,
        pk.COLUMN_NAME AS PK_COLUMN
      FROM ${dbIdentifier}.INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
      JOIN ${dbIdentifier}.INFORMATION_SCHEMA.KEY_COLUMN_USAGE fk
        ON rc.CONSTRAINT_NAME = fk.CONSTRAINT_NAME
      JOIN ${dbIdentifier}.INFORMATION_SCHEMA.KEY_COLUMN_USAGE pk
        ON rc.UNIQUE_CONSTRAINT_NAME = pk.CONSTRAINT_NAME
       AND fk.ORDINAL_POSITION = pk.ORDINAL_POSITION;
    `;

    const [tablesResult, columnsResult, pkResult, fkResult] = await Promise.all([
      db.request().query(tablesQuery),
      db.request().query(columnsQuery),
      db.request().query(primaryKeysQuery),
      db.request().query(foreignKeysQuery),
    ]);

    const pkSet = new Set<string>();
    pkResult.recordset.forEach((row: any) => {
      pkSet.add(`${row.TABLE_SCHEMA}.${row.TABLE_NAME}.${row.COLUMN_NAME}`);
    });

    const fkMap = new Map<
      string,
      { referencedTable: string; referencedColumn: string }
    >();
    const relationships: TableRelationship[] = fkResult.recordset.map(
      (row: any) => {
        const key = `${row.FK_SCHEMA}.${row.FK_TABLE}.${row.FK_COLUMN}`;
        const referencedTable = `${row.PK_SCHEMA}.${row.PK_TABLE}`;
        fkMap.set(key, {
          referencedTable,
          referencedColumn: row.PK_COLUMN,
        });

        return {
          fromTable: `${row.FK_SCHEMA}.${row.FK_TABLE}`,
          fromColumn: row.FK_COLUMN,
          toTable: referencedTable,
          toColumn: row.PK_COLUMN,
        };
      }
    );

    const columns: TableColumn[] = columnsResult.recordset.map((row: any) => {
      const tableName = `${row.TABLE_SCHEMA}.${row.TABLE_NAME}`;
      const key = `${row.TABLE_SCHEMA}.${row.TABLE_NAME}.${row.COLUMN_NAME}`;
      const fkInfo = fkMap.get(key);
      const maxLength = row.CHARACTER_MAXIMUM_LENGTH;
      const dataType =
        maxLength && maxLength > 0
          ? `${row.DATA_TYPE}(${maxLength === -1 ? "max" : maxLength})`
          : row.DATA_TYPE;

      return {
        tableName,
        columnName: row.COLUMN_NAME,
        dataType,
        isNullable: row.IS_NULLABLE === "YES",
        isPrimaryKey: pkSet.has(key),
        isForeignKey: Boolean(fkInfo),
        referencedTable: fkInfo?.referencedTable,
        referencedColumn: fkInfo?.referencedColumn,
      };
    });

    const tables = tablesResult.recordset.map(
      (row: any) => `${row.TABLE_SCHEMA}.${row.TABLE_NAME}`
    );

    return {
      tables,
      columns,
      relationships,
    };
  } catch (error) {
    console.error("[SchemaDiscovery] Error discovering schema:", error);
    return generateMockDatabaseSchema();
  }
}

/**
 * Generate mock schema for testing without database
 */
export function generateMockDatabaseSchema(): DatabaseSchema {
  return {
    tables: ["PurchaseOrders", "Locations", "Items", "Inventory", "Transfers", "Waste", "Usage"],
    columns: [
      // PurchaseOrders
      { tableName: "PurchaseOrders", columnName: "OrderId", dataType: "int", isNullable: false, isPrimaryKey: true, isForeignKey: false },
      { tableName: "PurchaseOrders", columnName: "Date", dataType: "date", isNullable: false, isPrimaryKey: false, isForeignKey: false },
      { tableName: "PurchaseOrders", columnName: "OrderNumber", dataType: "nvarchar", isNullable: false, isPrimaryKey: false, isForeignKey: false },
      { tableName: "PurchaseOrders", columnName: "LocationId", dataType: "int", isNullable: false, isPrimaryKey: false, isForeignKey: true, referencedTable: "Locations", referencedColumn: "LocationId" },
      { tableName: "PurchaseOrders", columnName: "ItemId", dataType: "int", isNullable: false, isPrimaryKey: false, isForeignKey: true, referencedTable: "Items", referencedColumn: "ItemId" },
      { tableName: "PurchaseOrders", columnName: "SuggestedQuantity", dataType: "decimal", isNullable: false, isPrimaryKey: false, isForeignKey: false },
      { tableName: "PurchaseOrders", columnName: "ActualOrderQuantity", dataType: "decimal", isNullable: true, isPrimaryKey: false, isForeignKey: false },
      { tableName: "PurchaseOrders", columnName: "ConsumptionDays", dataType: "int", isNullable: false, isPrimaryKey: false, isForeignKey: false },
      { tableName: "PurchaseOrders", columnName: "BufferDays", dataType: "int", isNullable: false, isPrimaryKey: false, isForeignKey: false },
      { tableName: "PurchaseOrders", columnName: "EstimatedNeed", dataType: "decimal", isNullable: false, isPrimaryKey: false, isForeignKey: false },
      
      // Locations
      { tableName: "Locations", columnName: "LocationId", dataType: "int", isNullable: false, isPrimaryKey: true, isForeignKey: false },
      { tableName: "Locations", columnName: "LocationName", dataType: "nvarchar", isNullable: false, isPrimaryKey: false, isForeignKey: false },
      
      // Items
      { tableName: "Items", columnName: "ItemId", dataType: "int", isNullable: false, isPrimaryKey: true, isForeignKey: false },
      { tableName: "Items", columnName: "ItemName", dataType: "nvarchar", isNullable: false, isPrimaryKey: false, isForeignKey: false },
      { tableName: "Items", columnName: "OrderingUnitOfMeasure", dataType: "nvarchar", isNullable: false, isPrimaryKey: false, isForeignKey: false },
      { tableName: "Items", columnName: "InventoryUnitOfMeasure", dataType: "nvarchar", isNullable: false, isPrimaryKey: false, isForeignKey: false },
      { tableName: "Items", columnName: "CaseSize", dataType: "int", isNullable: false, isPrimaryKey: false, isForeignKey: false },
      
      // Inventory
      { tableName: "Inventory", columnName: "InventoryId", dataType: "int", isNullable: false, isPrimaryKey: true, isForeignKey: false },
      { tableName: "Inventory", columnName: "OrderId", dataType: "int", isNullable: false, isPrimaryKey: false, isForeignKey: true, referencedTable: "PurchaseOrders", referencedColumn: "OrderId" },
      { tableName: "Inventory", columnName: "ActualOnHand", dataType: "decimal", isNullable: false, isPrimaryKey: false, isForeignKey: false },
      { tableName: "Inventory", columnName: "TheoreticalOnHand", dataType: "decimal", isNullable: false, isPrimaryKey: false, isForeignKey: false },
      { tableName: "Inventory", columnName: "PostConsumptionSuggested", dataType: "decimal", isNullable: false, isPrimaryKey: false, isForeignKey: false },
      { tableName: "Inventory", columnName: "PostConsumptionOrdered", dataType: "decimal", isNullable: false, isPrimaryKey: false, isForeignKey: false },
      { tableName: "Inventory", columnName: "PostConsumptionVariance", dataType: "decimal", isNullable: false, isPrimaryKey: false, isForeignKey: false },
      
      // Transfers
      { tableName: "Transfers", columnName: "TransferId", dataType: "int", isNullable: false, isPrimaryKey: true, isForeignKey: false },
      { tableName: "Transfers", columnName: "OrderId", dataType: "int", isNullable: false, isPrimaryKey: false, isForeignKey: true, referencedTable: "PurchaseOrders", referencedColumn: "OrderId" },
      { tableName: "Transfers", columnName: "TransferQuantity", dataType: "decimal", isNullable: false, isPrimaryKey: false, isForeignKey: false },
      
      // Waste
      { tableName: "Waste", columnName: "WasteId", dataType: "int", isNullable: false, isPrimaryKey: true, isForeignKey: false },
      { tableName: "Waste", columnName: "OrderId", dataType: "int", isNullable: false, isPrimaryKey: false, isForeignKey: true, referencedTable: "PurchaseOrders", referencedColumn: "OrderId" },
      { tableName: "Waste", columnName: "WasteQuantity", dataType: "decimal", isNullable: false, isPrimaryKey: false, isForeignKey: false },
      
      // Usage
      { tableName: "Usage", columnName: "UsageId", dataType: "int", isNullable: false, isPrimaryKey: true, isForeignKey: false },
      { tableName: "Usage", columnName: "OrderId", dataType: "int", isNullable: false, isPrimaryKey: false, isForeignKey: true, referencedTable: "PurchaseOrders", referencedColumn: "OrderId" },
      { tableName: "Usage", columnName: "EstimatedUsage", dataType: "decimal", isNullable: false, isPrimaryKey: false, isForeignKey: false },
    ],
    relationships: [
      { fromTable: "PurchaseOrders", fromColumn: "LocationId", toTable: "Locations", toColumn: "LocationId" },
      { fromTable: "PurchaseOrders", fromColumn: "ItemId", toTable: "Items", toColumn: "ItemId" },
      { fromTable: "Inventory", fromColumn: "OrderId", toTable: "PurchaseOrders", toColumn: "OrderId" },
      { fromTable: "Transfers", fromColumn: "OrderId", toTable: "PurchaseOrders", toColumn: "OrderId" },
      { fromTable: "Waste", fromColumn: "OrderId", toTable: "PurchaseOrders", toColumn: "OrderId" },
      { fromTable: "Usage", fromColumn: "OrderId", toTable: "PurchaseOrders", toColumn: "OrderId" },
    ],
  };
}

/**
 * Find the best matching column for a field name using fuzzy matching
 */
const MATCH_THRESHOLD = 0.35;

function normalizeIdentifier(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function scoreColumnMatch(normalizedField: string, column: TableColumn): number {
  const normalizedColumn = normalizeIdentifier(column.columnName);
  let score = 0;

  if (normalizedColumn === normalizedField) {
    score = 1;
  } else if (normalizedColumn.includes(normalizedField)) {
    score = normalizedField.length / normalizedColumn.length;
  } else if (normalizedField.includes(normalizedColumn)) {
    score = (normalizedColumn.length / normalizedField.length) * 0.8;
  }

  if (
    normalizedField.includes(normalizedColumn) ||
    normalizedColumn.includes(normalizedField)
  ) {
    score += 0.3;
  }

  if (normalizedField.includes("qty") && normalizedColumn.includes("quantity")) score += 0.2;
  if (normalizedField.includes("uom") && normalizedColumn.includes("unitofmeasure")) score += 0.2;
  if (normalizedField.includes("onhand") && normalizedColumn.includes("onhand")) score += 0.3;
  if (normalizedField.includes("revenue") && normalizedColumn.includes("amount")) score += 0.15;
  if (normalizedField.includes("customer") && normalizedColumn.includes("customer")) score += 0.15;
  if (normalizedField.includes("sales") && normalizedColumn.includes("sales")) score += 0.15;

  return score;
}

export function getTopColumnMatches(
  fieldName: string,
  schema: DatabaseSchema,
  limit: number = 3
): ColumnMatch[] {
  const normalizedField = normalizeIdentifier(fieldName);
  const scored: ColumnMatch[] = [];

  for (const col of schema.columns) {
    const score = scoreColumnMatch(normalizedField, col);
    if (score > 0) {
      scored.push({ column: col, score });
    }
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function findColumnMatch(fieldName: string, schema: DatabaseSchema): ColumnMatch | null {
  const [best] = getTopColumnMatches(fieldName, schema, 1);
  if (best && best.score >= MATCH_THRESHOLD) {
    return best;
  }
  return null;
}
