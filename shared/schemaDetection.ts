import type {
  SchemaField,
  SemanticRole,
  DataFormat,
  AggregationType,
  ValidationBadge,
  FieldSample,
} from "@shared/schemaTypes";

/**
 * Auto-detect semantic role based on field name and data type
 */
export function detectSemanticRole(
  fieldName: string,
  dataType: string,
  cardinality?: number
): { role: SemanticRole; confidence: number } {
  const nameLower = fieldName.toLowerCase();
  const typeLower = dataType.toLowerCase();

  // Time detection
  if (
    typeLower.includes("date") ||
    typeLower.includes("time") ||
    typeLower.includes("timestamp") ||
    nameLower.includes("date") ||
    nameLower.includes("time") ||
    nameLower.match(/\b(year|month|day|quarter)\b/)
  ) {
    return { role: "time", confidence: 0.95 };
  }

  // Measure detection (numeric types that suggest aggregation)
  if (
    typeLower.includes("money") ||
    typeLower.includes("decimal") ||
    typeLower.includes("numeric") ||
    typeLower.includes("float") ||
    typeLower.includes("double") ||
    (typeLower.includes("int") &&
      (nameLower.includes("amount") ||
        nameLower.includes("total") ||
        nameLower.includes("sum") ||
        nameLower.includes("count") ||
        nameLower.includes("quantity") ||
        nameLower.includes("price") ||
        nameLower.includes("cost") ||
        nameLower.includes("revenue") ||
        nameLower.includes("sales")))
  ) {
    return { role: "measure", confidence: 0.9 };
  }

  // Dimension detection (low cardinality strings or IDs that are categorical)
  if (
    cardinality !== undefined &&
    cardinality < 1000 &&
    (typeLower.includes("varchar") ||
      typeLower.includes("char") ||
      typeLower.includes("text") ||
      typeLower.includes("string"))
  ) {
    return { role: "dimension", confidence: 0.85 };
  }

  // Default to dimension for non-numeric types
  if (
    typeLower.includes("varchar") ||
    typeLower.includes("char") ||
    typeLower.includes("text") ||
    typeLower.includes("string")
  ) {
    return { role: "dimension", confidence: 0.7 };
  }

  // Default to measure for numeric types
  if (
    typeLower.includes("int") ||
    typeLower.includes("decimal") ||
    typeLower.includes("numeric")
  ) {
    return { role: "measure", confidence: 0.6 };
  }

  // Fallback
  return { role: "dimension", confidence: 0.5 };
}

/**
 * Auto-detect data format based on type and field name
 */
export function detectDataFormat(
  fieldName: string,
  dataType: string,
  semanticRole: SemanticRole
): DataFormat {
  const nameLower = fieldName.toLowerCase();
  const typeLower = dataType.toLowerCase();

  // Date/Time formats
  if (semanticRole === "time") {
    return typeLower.includes("date") && !typeLower.includes("time")
      ? "date"
      : "datetime";
  }

  // Currency format
  if (
    typeLower.includes("money") ||
    nameLower.includes("price") ||
    nameLower.includes("cost") ||
    nameLower.includes("amount") ||
    nameLower.includes("revenue") ||
    nameLower.includes("sales")
  ) {
    return "currency";
  }

  // Percentage format
  if (
    nameLower.includes("percent") ||
    nameLower.includes("rate") ||
    nameLower.includes("ratio")
  ) {
    return "percentage";
  }

  // Number format
  if (
    typeLower.includes("int") ||
    typeLower.includes("decimal") ||
    typeLower.includes("numeric") ||
    typeLower.includes("float")
  ) {
    return "number";
  }

  // Default to text
  return "text";
}

/**
 * Suggest aggregation type based on semantic role and field characteristics
 */
export function suggestAggregation(
  semanticRole: SemanticRole,
  dataFormat: DataFormat,
  fieldName: string
): AggregationType {
  if (semanticRole !== "measure") {
    return "NONE";
  }

  const nameLower = fieldName.toLowerCase();

  // Count aggregations
  if (
    nameLower.includes("count") ||
    nameLower.includes("quantity") ||
    nameLower.includes("number")
  ) {
    return "SUM";
  }

  // Average aggregations
  if (
    nameLower.includes("average") ||
    nameLower.includes("avg") ||
    nameLower.includes("mean") ||
    nameLower.includes("rate")
  ) {
    return "AVG";
  }

  // Currency/amounts typically use SUM
  if (dataFormat === "currency") {
    return "SUM";
  }

  // Default to SUM for measures
  return "SUM";
}

/**
 * Generate a friendly display name from technical field name
 */
export function generateDisplayName(technicalName: string): string {
  // Remove prefixes like tbl_, fld_, etc.
  let name = technicalName.replace(/^(tbl_|fld_|col_)/i, "");

  // Split on underscores or camelCase
  name = name.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2");

  // Capitalize first letter of each word
  name = name
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");

  return name;
}

/**
 * Generate a description based on field characteristics
 */
export function generateDescription(
  displayName: string,
  semanticRole: SemanticRole,
  aggregation: AggregationType,
  dataFormat: DataFormat
): string {
  if (semanticRole === "measure") {
    const aggText = aggregation === "NONE" ? "" : `${aggregation} of `;
    const formatText = dataFormat === "currency" ? "in currency" : "";
    return `${aggText}${displayName.toLowerCase()} ${formatText}`.trim();
  }

  if (semanticRole === "time") {
    return `Time dimension: ${displayName.toLowerCase()}`;
  }

  return `Categorical dimension: ${displayName.toLowerCase()}`;
}

/**
 * Create validation badges based on field characteristics
 */
export function createValidationBadges(
  nullPercentage: number,
  cardinality?: number,
  semanticRole?: SemanticRole
): ValidationBadge[] {
  const badges: ValidationBadge[] = [];

  // High null percentage
  if (nullPercentage > 50) {
    badges.push({
      type: "error",
      message: "High null percentage",
      metric: `${nullPercentage.toFixed(0)}% null`,
    });
  } else if (nullPercentage > 20) {
    badges.push({
      type: "warning",
      message: "Moderate null percentage",
      metric: `${nullPercentage.toFixed(0)}% null`,
    });
  }

  // High cardinality for dimensions
  if (
    cardinality !== undefined &&
    semanticRole === "dimension" &&
    cardinality > 10000
  ) {
    badges.push({
      type: "warning",
      message: "Very high cardinality",
      metric: `${(cardinality / 1000).toFixed(1)}k+ values`,
    });
  } else if (
    cardinality !== undefined &&
    semanticRole === "dimension" &&
    cardinality > 1000
  ) {
    badges.push({
      type: "info",
      message: "High cardinality",
      metric: `${cardinality} distinct values`,
    });
  }

  // Very low cardinality might indicate a boolean or flag
  if (
    cardinality !== undefined &&
    cardinality <= 2 &&
    semanticRole === "measure"
  ) {
    badges.push({
      type: "info",
      message: "Low cardinality for measure",
      metric: "Consider as dimension",
    });
  }

  return badges;
}

/**
 * Create a default SchemaField with smart detection
 */
export function createSchemaField(
  technicalName: string,
  dataType: string,
  source: string,
  samples: FieldSample[] = [],
  nullPercentage: number = 0,
  cardinality?: number
): SchemaField {
  const displayName = generateDisplayName(technicalName);
  const detection = detectSemanticRole(technicalName, dataType, cardinality);
  const dataFormat = detectDataFormat(
    technicalName,
    dataType,
    detection.role
  );
  const aggregation = suggestAggregation(
    detection.role,
    dataFormat,
    technicalName
  );
  const description = generateDescription(
    displayName,
    detection.role,
    aggregation,
    dataFormat
  );
  const validationBadges = createValidationBadges(
    nullPercentage,
    cardinality,
    detection.role
  );

  return {
    technicalName,
    displayName,
    source,
    included: true,
    description,
    semanticRole: detection.role,
    dataType,
    dataFormat,
    aggregation,
    samples,
    nullPercentage,
    cardinality,
    validationBadges,
    isDetected: true,
    detectionConfidence: detection.confidence,
  };
}
