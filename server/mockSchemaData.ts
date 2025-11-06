import { createSchemaField } from "../shared/schemaDetection";
import type { SchemaField, SchemaReview, ReportParameter, ChartConfiguration } from "../shared/schemaTypes";

/**
 * Generate mock schema review data for PO Suggested Order Quantities Report
 */
export function generateMockSchemaReview(): SchemaReview {
  const fields: SchemaField[] = [
    createSchemaField(
      "Date",
      "date",
      "dbo.PurchaseOrders.OrderDate",
      [
        { value: "2024-10-09", count: 45 },
        { value: "2024-10-16", count: 42 },
        { value: "2024-10-23", count: 48 },
        { value: "2024-10-30", count: 50 },
      ],
      0,
      28
    ),
    createSchemaField(
      "Location",
      "nvarchar(100)",
      "dbo.Locations.LocationName",
      [
        { value: "Warehouse A", count: 120 },
        { value: "Warehouse B", count: 95 },
        { value: "Distribution Center 1", count: 88 },
        { value: "Store 001", count: 72 },
      ],
      0,
      12
    ),
    createSchemaField(
      "Order",
      "nvarchar(50)",
      "dbo.PurchaseOrders.OrderNumber",
      [
        { value: "PO-2024-001234", count: 1 },
        { value: "PO-2024-001235", count: 1 },
        { value: "PO-2024-001236", count: 1 },
      ],
      0,
      185
    ),
    createSchemaField(
      "Item",
      "nvarchar(100)",
      "dbo.Items.ItemName",
      [
        { value: "Widget A-100", count: 15 },
        { value: "Component B-250", count: 12 },
        { value: "Part C-500", count: 10 },
        { value: "Assembly D-750", count: 8 },
      ],
      0.5,
      450
    ),
    createSchemaField(
      "OrderingUoM",
      "nvarchar(20)",
      "dbo.Items.OrderingUnitOfMeasure",
      [
        { value: "Case", count: 280 },
        { value: "Pallet", count: 120 },
        { value: "Each", count: 85 },
      ],
      0,
      3
    ),
    createSchemaField(
      "InventoryUoM",
      "nvarchar(20)",
      "dbo.Items.InventoryUnitOfMeasure",
      [
        { value: "Each", count: 350 },
        { value: "Unit", count: 100 },
        { value: "Piece", count: 35 },
      ],
      0,
      3
    ),
    createSchemaField(
      "CaseSize",
      "int",
      "dbo.Items.CaseSize",
      [
        { value: "24", count: 180 },
        { value: "12", count: 150 },
        { value: "48", count: 95 },
        { value: "6", count: 60 },
      ],
      0,
      15
    ),
    createSchemaField(
      "ConsumptionDays",
      "int",
      "dbo.PurchaseOrders.ConsumptionDays",
      [
        { value: "28", count: 485 },
      ],
      0,
      1
    ),
    createSchemaField(
      "BufferDays",
      "int",
      "dbo.PurchaseOrders.BufferDays",
      [
        { value: "7", count: 320 },
        { value: "14", count: 165 },
      ],
      0,
      2
    ),
    createSchemaField(
      "OrderDateActualOnHand",
      "decimal(18,2)",
      "dbo.Inventory.ActualOnHand",
      [
        { value: "1,250", count: 15 },
        { value: "890", count: 12 },
        { value: "2,100", count: 8 },
        { value: "450", count: 18 },
      ],
      2,
      485
    ),
    createSchemaField(
      "OrderDateTheoOnHand",
      "decimal(18,2)",
      "dbo.Inventory.TheoreticalOnHand",
      [
        { value: "1,300", count: 15 },
        { value: "920", count: 12 },
        { value: "2,150", count: 8 },
        { value: "480", count: 18 },
      ],
      1.5,
      485
    ),
    createSchemaField(
      "SuggestedQty",
      "decimal(18,2)",
      "dbo.PurchaseOrders.SuggestedQuantity",
      [
        { value: "240", count: 28 },
        { value: "480", count: 22 },
        { value: "120", count: 35 },
        { value: "360", count: 18 },
      ],
      0,
      325
    ),
    createSchemaField(
      "ActualOrderQty",
      "decimal(18,2)",
      "dbo.PurchaseOrders.ActualOrderQuantity",
      [
        { value: "240", count: 25 },
        { value: "480", count: 20 },
        { value: "120", count: 32 },
        { value: "0", count: 45 },
      ],
      8,
      280
    ),
    createSchemaField(
      "ConsumptionPeriodTransfers",
      "decimal(18,2)",
      "dbo.Transfers.TransferQuantity",
      [
        { value: "50", count: 18 },
        { value: "100", count: 12 },
        { value: "0", count: 255 },
        { value: "25", count: 22 },
      ],
      52,
      45
    ),
    createSchemaField(
      "ConsumptionPeriodWaste",
      "decimal(18,2)",
      "dbo.Waste.WasteQuantity",
      [
        { value: "5", count: 28 },
        { value: "10", count: 15 },
        { value: "0", count: 380 },
        { value: "2", count: 35 },
      ],
      78,
      25
    ),
    createSchemaField(
      "ConsumptionPeriodEstimatedUsage",
      "decimal(18,2)",
      "dbo.Usage.EstimatedUsage",
      [
        { value: "850", count: 22 },
        { value: "1,200", count: 18 },
        { value: "450", count: 28 },
        { value: "620", count: 25 },
      ],
      0.5,
      485
    ),
    createSchemaField(
      "EstimatedNeed",
      "decimal(18,2)",
      "dbo.PurchaseOrders.EstimatedNeed",
      [
        { value: "900", count: 20 },
        { value: "1,250", count: 18 },
        { value: "500", count: 25 },
        { value: "680", count: 22 },
      ],
      0,
      485
    ),
    createSchemaField(
      "PostConsumptionOnHandSuggested",
      "decimal(18,2)",
      "dbo.Inventory.PostConsumptionSuggested",
      [
        { value: "400", count: 28 },
        { value: "550", count: 22 },
        { value: "200", count: 35 },
        { value: "320", count: 18 },
      ],
      1,
      485
    ),
    createSchemaField(
      "PostConsumptionOnHandOrdered",
      "decimal(18,2)",
      "dbo.Inventory.PostConsumptionOrdered",
      [
        { value: "380", count: 25 },
        { value: "520", count: 20 },
        { value: "190", count: 32 },
        { value: "0", count: 65 },
      ],
      12,
      420
    ),
    createSchemaField(
      "PostConsumptionOnHandVariance",
      "decimal(18,2)",
      "dbo.Inventory.PostConsumptionVariance",
      [
        { value: "20", count: 45 },
        { value: "-30", count: 38 },
        { value: "10", count: 55 },
        { value: "0", count: 125 },
      ],
      12,
      180
    ),
  ];

  const parameters: ReportParameter[] = [
    {
      name: "Start Date",
      technicalName: "StartDate",
      type: "date",
      defaultValue: "2024-10-01",
      promptText: "Select the start date for the report period (4 weeks)",
      allowMultiple: false,
      isRange: true,
      rangeStart: "2024-10-01",
      rangeEnd: "2024-10-28",
    },
    {
      name: "Location Filter",
      technicalName: "LocationFilter",
      type: "string",
      defaultValue: null,
      promptText: "Filter by specific location (optional)",
      allowMultiple: true,
      isRange: false,
      options: ["All Locations", "Warehouse A", "Warehouse B", "Distribution Center 1"],
    },
    {
      name: "Minimum Suggested Qty",
      technicalName: "MinSuggestedQty",
      type: "number",
      defaultValue: 0,
      promptText: "Show only items with suggested quantity above this threshold",
      allowMultiple: false,
      isRange: false,
    },
  ];

  const chartConfig: ChartConfiguration = {
    type: "column",
    xAxis: "Location",
    series: "Item",
    values: ["SuggestedQty", "ActualOrderQty"],
    sortBy: "value",
    sortDirection: "desc",
    showDataLabels: true,
    showLegend: true,
    title: "Suggested vs Actual Order Quantities by Location",
  };

  return {
    fields,
    parameters,
    chartConfig,
    dataPreview: null,
  };
}
