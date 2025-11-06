import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { invokeLLM } from "./_core/llm";
import {
  createReport,
  getAllDatabases,
  updateReport,
} from "./db";
import { discoverDatabaseSchema, getTopColumnMatches } from "./schemaDiscovery";
import type { DatabaseSchema, TableColumn } from "./schemaDiscovery";

function summarizeSchema(databaseName: string, schema: DatabaseSchema | null) {
  if (!schema) {
    return `Schema information for ${databaseName} is unavailable.`;
  }

  const grouped = schema.columns.reduce<Map<string, TableColumn[]>>(
    (acc, col) => {
      const next = acc.get(col.tableName) ?? [];
      next.push(col);
      acc.set(col.tableName, next);
      return acc;
    },
    new Map()
  );

  const lines: string[] = [];
  const tablesToDescribe = schema.tables.slice(0, 12);

  tablesToDescribe.forEach(tableName => {
    const columns = (grouped.get(tableName) ?? [])
      .slice(0, 6)
      .map(col => {
        const decorators = [
          col.isPrimaryKey ? "PK" : null,
          col.isForeignKey ? "FK" : null,
        ].filter(Boolean);
        const suffix = decorators.length ? ` ${decorators.join("/")}` : "";
        return `${col.columnName} (${col.dataType})${suffix}`;
      })
      .join(", ");

    lines.push(`${tableName}: ${columns || "columns not available"}`);
  });

  if (schema.tables.length > tablesToDescribe.length) {
    lines.push(`...and ${schema.tables.length - tablesToDescribe.length} more tables`);
  }

  return `Database: ${databaseName}\n${lines.join("\n")}`;
}

function evaluateFieldCoverage(schema: DatabaseSchema | null, fieldNames: string[]) {
  if (!schema || fieldNames.length === 0) {
    return {
      coveragePercent: fieldNames.length === 0 ? 100 : 0,
      matchedFields: [] as Array<{ name: string; column: string; confidence: number }>,
      missingFields: [] as Array<{ name: string; suggestions: string[] }>,
    };
  }

  const uniqueFields = Array.from(
    new Set(fieldNames.map(field => field.trim()).filter(Boolean))
  );

  let matchedCount = 0;
  const matchedFields: Array<{ name: string; column: string; confidence: number }> = [];
  const missingFields: Array<{ name: string; suggestions: string[] }> = [];

  uniqueFields.forEach(field => {
    const matches = getTopColumnMatches(field, schema, 3);
    const best = matches[0];

    if (best && best.score >= 0.35) {
      matchedCount++;
      matchedFields.push({
        name: field,
        column: `${best.column.tableName}.${best.column.columnName}`,
        confidence: Number((best.score * 100).toFixed(1)),
      });
    } else {
      missingFields.push({
        name: field,
        suggestions: matches.map(match => `${match.column.tableName}.${match.column.columnName}`),
      });
    }
  });

  const coveragePercent =
    uniqueFields.length === 0 ? 100 : Math.round((matchedCount / uniqueFields.length) * 100);

  return {
    coveragePercent,
    matchedFields,
    missingFields,
  };
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  report: router({
    // Surface available SQL Server databases/customers
    customerDatabases: protectedProcedure.query(async () => {
      const databases = await getAllDatabases();
      if (!databases || databases.length === 0) {
        return ["SampleInventory"];
      }
      return databases;
    }),

    // Infer metrics, dimensions, and filters from natural language
    inferFromNaturalLanguage: protectedProcedure
      .input(z.object({
        request: z.string(),
        databaseName: z.string().min(1),
      }))
      .mutation(async ({ input }) => {
        try {
          const schema = await discoverDatabaseSchema(input.databaseName);
          const schemaContext = summarizeSchema(input.databaseName, schema);

          const response = await invokeLLM({
            messages: [
              {
                role: "system",
                content: `You are a data analyst assistant. Extract metrics, dimensions, and filters from natural language requests.
                Return a JSON object with three arrays: metrics, dimensions, and filters.
                Example: {"metrics": ["revenue", "count"], "dimensions": ["date", "category"], "filters": [{"field": "status", "operator": "equals", "value": "active"}]}
                Be concise and practical.

                Schema context for database "${input.databaseName}":
                ${schemaContext}`,
              },
              {
                role: "user",
                content: input.request,
              },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "inference",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    metrics: {
                      type: "array",
                      items: { type: "string" },
                      description: "Metrics/measures to calculate",
                    },
                    dimensions: {
                      type: "array",
                      items: { type: "string" },
                      description: "Dimensions/grouping fields",
                    },
                    filters: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          field: { type: "string" },
                          operator: { type: "string" },
                          value: { type: "string" },
                        },
                        required: ["field", "operator", "value"],
                        additionalProperties: false,
                      },
                      description: "Filter conditions",
                    },
                  },
                  required: ["metrics", "dimensions", "filters"],
                  additionalProperties: false,
                },
              },
            },
          });

          const content = response.choices[0].message.content;
          console.log("[Report] LLM response content:", content);
          console.log("[Report] Content type:", typeof content);
          
          const parsed = typeof content === "string" ? JSON.parse(content) : content;
          console.log("[Report] Parsed inference result:", parsed);
          console.log("[Report] - Metrics:", parsed.metrics);
          console.log("[Report] - Dimensions:", parsed.dimensions);
          console.log("[Report] - Filters:", parsed.filters);

          const coverageFields = [
            ...(parsed.metrics ?? []),
            ...(parsed.dimensions ?? []),
            ...((parsed.filters ?? []).map((f: any) => f.field) ?? []),
          ];
          const schemaInsights = evaluateFieldCoverage(schema, coverageFields);

          if (schemaInsights.missingFields.length > 0) {
            console.warn(
              "[Report] Missing schema fields detected:",
              schemaInsights.missingFields
            );
          }
          
          return {
            ...parsed,
            schemaInsights,
          };
        } catch (error) {
          console.error("LLM inference error:", error);
          return {
            metrics: [],
            dimensions: [],
            filters: [],
            schemaInsights: {
              coveragePercent: 0,
              matchedFields: [],
              missingFields: [],
            },
          };
        }
      }),

    // Generate SQL from natural language and data source
    generateSQL: protectedProcedure
      .input(z.object({
        request: z.string(),
        databaseName: z.string().min(1),
        metrics: z.array(z.string()),
        dimensions: z.array(z.string()),
        filters: z.array(z.object({
          field: z.string(),
          operator: z.string(),
          value: z.string(),
        })),
      }))
      .mutation(async ({ input }) => {
        try {
          const schema = await discoverDatabaseSchema(input.databaseName);
          const schemaInfo = schema
            ? {
                tables: schema.tables,
                columns: schema.columns.map(col => ({
                  table: col.tableName,
                  column: col.columnName,
                  dataType: col.dataType,
                  isNullable: col.isNullable,
                })),
                relationships: schema.relationships,
              }
            : {};

          const response = await invokeLLM({
            messages: [
              {
                role: "system",
                content: `You are a SQL expert. Generate a SQL SELECT query based on the user's request.
                Available schema: ${JSON.stringify(schemaInfo)}
                Return ONLY the SQL query, no explanation.`,
              },
              {
                role: "user",
                content: `Generate SQL for: ${input.request}\nMetrics: ${input.metrics.join(", ")}\nDimensions: ${input.dimensions.join(", ")}\nFilters: ${JSON.stringify(input.filters)}`,
              },
            ],
          });

          const sql = response.choices[0].message.content as string;
          return {
            sql: sql.trim(),
            metrics: input.metrics,
            dimensions: input.dimensions,
            filters: input.filters,
          };
        } catch (error) {
          console.error("SQL generation error:", error);
          throw error;
        }
      }),

    // Get field metadata from data source
    getFieldMetadata: protectedProcedure
      .input(z.object({
        databaseName: z.string().min(1),
      }))
      .query(async ({ input }) => {
        try {
          const schema = await discoverDatabaseSchema(input.databaseName);
          if (!schema) {
            console.log("[Report] No schema discovered, returning empty metadata");
            return [];
          }
          return schema.columns.map(col => ({
            name: `${col.tableName}.${col.columnName}`,
            type: col.dataType,
            description: col.isForeignKey
              ? `References ${col.referencedTable}.${col.referencedColumn}`
              : col.isPrimaryKey
                ? "Primary key"
                : undefined,
          }));
        } catch (error) {
          console.error("Field metadata error:", error);
          return [];
        }
      }),

    // Get schema review data for a generated SQL query
    getSchemaReview: protectedProcedure
      .input(z.object({
        sql: z.string(),
        reportTitle: z.string().optional(),
      }))
      .query(async ({ input }) => {
        console.log("[Report] Generating schema review for SQL query");
        console.log("[Report] SQL:", input.sql);
        console.log("[Report] Report Title:", input.reportTitle);
        
        // Import mock data generator
        const { generateMockSchemaReview } = await import("./mockSchemaData");
        
        // Return mock schema review data
        const mockData = generateMockSchemaReview();
        console.log("[Report] Generated mock schema review:");
        console.log("[Report] - Fields count:", mockData.fields?.length);
        console.log("[Report] - Parameters count:", mockData.parameters?.length);
        console.log("[Report] - Chart config:", mockData.chartConfig);
        console.log("[Report] - Full data:", JSON.stringify(mockData, null, 2));
        
        return mockData;
      }),

    // Publish report and generate render link
    publishReport: protectedProcedure
      .input(z.object({
        title: z.string(),
        naturalLanguageRequest: z.string(),
        databaseName: z.string().min(1),
        dataSourceId: z.number().optional(),
        generatedSQL: z.string(),
        inferredMetrics: z.array(z.string()),
        inferredDimensions: z.array(z.string()),
        inferredFilters: z.array(z.any()),
        resultFields: z.array(z.any()),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          const resolvedDataSourceId = input.dataSourceId ?? 0;
          const result = await createReport({
            title: input.title,
            naturalLanguageRequest: input.naturalLanguageRequest,
            dataSourceId: resolvedDataSourceId,
            generatedSQL: input.generatedSQL,
            inferredMetrics: JSON.stringify(input.inferredMetrics),
            inferredDimensions: JSON.stringify(input.inferredDimensions),
            inferredFilters: JSON.stringify(input.inferredFilters),
            resultFields: JSON.stringify(input.resultFields),
            createdBy: ctx.user.id,
            renderLink: `/reports/${Date.now()}`,
          });

          return {
            success: true,
            renderLink: `/reports/${Date.now()}`,
          };
        } catch (error) {
          console.error("Publish error:", error);
          throw error;
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
