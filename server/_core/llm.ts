import { ENV } from "./env";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4" ;
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice =
  | ToolChoicePrimitive
  | ToolChoiceByName
  | ToolChoiceExplicit;

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

const ensureArray = (
  value: MessageContent | MessageContent[]
): MessageContent[] => (Array.isArray(value) ? value : [value]);

const normalizeContentPart = (
  part: MessageContent
): TextContent | ImageContent | FileContent => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }

  if (part.type === "text") {
    return part;
  }

  if (part.type === "image_url") {
    return part;
  }

  if (part.type === "file_url") {
    return part;
  }

  throw new Error("Unsupported message content part");
};

const normalizeMessage = (message: Message) => {
  const { role, name, tool_call_id } = message;

  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content)
      .map(part => (typeof part === "string" ? part : JSON.stringify(part)))
      .join("\n");

    return {
      role,
      name,
      tool_call_id,
      content,
    };
  }

  const contentParts = ensureArray(message.content).map(normalizeContentPart);

  // If there's only text content, collapse to a single string for compatibility
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text,
    };
  }

  return {
    role,
    name,
    content: contentParts,
  };
};

const normalizeToolChoice = (
  toolChoice: ToolChoice | undefined,
  tools: Tool[] | undefined
): "none" | "auto" | ToolChoiceExplicit | undefined => {
  if (!toolChoice) return undefined;

  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }

  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }

    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }

    return {
      type: "function",
      function: { name: tools[0].function.name },
    };
  }

  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name },
    };
  }

  return toolChoice;
};

const resolveApiUrl = () => {
  // Use Azure OpenAI if configured
  if (ENV.azureOpenAIEndpoint && ENV.azureOpenAIEndpoint.trim().length > 0) {
    return ENV.azureOpenAIEndpoint;
  }
  
  // Use Forge API if configured
  if (ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0) {
    return `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions`;
  }
  
  return "https://forge.manus.im/v1/chat/completions";
};

const assertApiKey = () => {
  // Check for Azure OpenAI key first
  if (ENV.azureOpenAIKey && ENV.azureOpenAIKey.trim().length > 0) {
    return true;
  }
  
  // Otherwise check for Forge API key
  if (ENV.forgeApiKey && ENV.forgeApiKey.trim().length > 0) {
    return true;
  }
  
  // Return false if no API key is configured (will use mock data)
  return false;
};

const normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema,
}: {
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
}):
  | { type: "json_schema"; json_schema: JsonSchema }
  | { type: "text" }
  | { type: "json_object" }
  | undefined => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (
      explicitFormat.type === "json_schema" &&
      !explicitFormat.json_schema?.schema
    ) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }

  const schema = outputSchema || output_schema;
  if (!schema) return undefined;

  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }

  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...(typeof schema.strict === "boolean" ? { strict: schema.strict } : {}),
    },
  };
};

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  const hasApiKey = assertApiKey();
  
  // Use mock responses if no API key is configured
  if (!hasApiKey) {
    console.log("[LLM] No API key configured, using mock response");
    return createMockResponse(params);
  }

  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format,
  } = params;

  const isAzure = ENV.azureOpenAIKey && ENV.azureOpenAIKey.trim().length > 0;
  
  const payload: Record<string, unknown> = {
    model: isAzure ? ENV.azureOpenAIDeployment || "gpt-4" : "gemini-2.5-flash",
    messages: messages.map(normalizeMessage),
  };

  if (tools && tools.length > 0) {
    payload.tools = tools;
  }

  const normalizedToolChoice = normalizeToolChoice(
    toolChoice || tool_choice,
    tools
  );
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }

  // Set max_tokens based on model
  payload.max_tokens = isAzure ? 4096 : 32768;
  
  // Only add thinking parameter for non-Azure endpoints
  if (!isAzure) {
    payload.thinking = {
      "budget_tokens": 128
    };
  }

  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema,
  });

  if (normalizedResponseFormat) {
    payload.response_format = normalizedResponseFormat;
  }

  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  
  // Use appropriate authentication header
  if (isAzure) {
    headers["api-key"] = ENV.azureOpenAIKey;
  } else {
    headers["authorization"] = `Bearer ${ENV.forgeApiKey}`;
  }

  const response = await fetch(resolveApiUrl(), {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[LLM] API Error: ${response.status} ${response.statusText}`);
    console.error(`[LLM] Response: ${errorText}`);
    throw new Error(
      `LLM invoke failed: ${response.status} ${response.statusText} – ${errorText}`
    );
  }

  return (await response.json()) as InvokeResult;
}

// Create mock response for testing without API key
function createMockResponse(params: InvokeParams): InvokeResult {
  const lastMessage = params.messages[params.messages.length - 1];
  const userContent = typeof lastMessage.content === 'string' 
    ? lastMessage.content 
    : JSON.stringify(lastMessage.content);
  
  // Check if this is a structured output request
  const responseFormat = params.response_format || params.responseFormat;
  
  let mockContent: string;
  
  if (responseFormat && responseFormat.type === 'json_schema') {
    // Check if this is an inference request (has metrics/dimensions in schema)
    const schemaStr = JSON.stringify(responseFormat);
    const isInferenceRequest = schemaStr.includes('metrics') && schemaStr.includes('dimensions');
    
    if (isInferenceRequest) {
      // ALWAYS return PO report data for ANY request
      console.log("[LLM] Returning PO report inference data (mock mode)");
      mockContent = JSON.stringify({
        metrics: [
          "Suggested Qty",
          "Actual Order Qty",
          "Order Date Actual On Hand",
          "Order Date Theo On Hand",
          "Consumption Period Estimated Usage",
          "Estimated Need",
          "Post Consumption On Hand Suggested",
          "Post Consumption On Hand Ordered",
          "Post Consumption On Hand Variance",
          "Consumption Period Transfers",
          "Consumption Period Waste",
          "Case Size"
        ],
        dimensions: [
          "Location",
          "Order",
          "Item",
          "Ordering U of M",
          "Inventory U of M"
        ],
        filters: [
          { field: "Date", operator: "greater_than_or_equal", value: "previous 4 weeks" },
          { field: "Consumption Days", operator: "equals", value: "28" }
        ]
      });
    } else {
      // Generic structured response
      mockContent = JSON.stringify({
        result: "Mock structured response",
        data: []
      });
    }
  } else {
    // Generate mock SQL or text based on context
    if (userContent.toLowerCase().includes('sql') || userContent.toLowerCase().includes('generate')) {
      // ALWAYS return PO report SQL for testing
      console.log("[LLM] Returning PO report SQL");
      mockContent = `SELECT 
    po.Date,
    l.Location,
    po.OrderNumber as [Order],
    i.ItemName as Item,
    i.OrderingUnitOfMeasure as [Ordering U of M],
    i.InventoryUnitOfMeasure as [Inventory U of M],
    i.CaseSize as [Case Size],
    po.ConsumptionDays as [Consumption Days],
    po.BufferDays as [Buffer Days],
    inv.ActualOnHand as [Order Date Actual On Hand],
    inv.TheoreticalOnHand as [Order Date Theo On Hand],
    po.SuggestedQuantity as [Suggested Qty],
    po.ActualOrderQuantity as [Actual Order Qty],
    t.TransferQuantity as [Consumption Period Transfers],
    w.WasteQuantity as [Consumption Period Waste],
    u.EstimatedUsage as [Consumption Period Estimated Usage],
    po.EstimatedNeed as [Estimated Need],
    inv.PostConsumptionSuggested as [Post Consumption On Hand Suggested],
    inv.PostConsumptionOrdered as [Post Consumption On Hand Ordered],
    inv.PostConsumptionVariance as [Post Consumption On Hand Variance]
FROM dbo.PurchaseOrders po
INNER JOIN dbo.Locations l ON po.LocationId = l.LocationId
INNER JOIN dbo.Items i ON po.ItemId = i.ItemId
INNER JOIN dbo.Inventory inv ON po.OrderId = inv.OrderId
LEFT JOIN dbo.Transfers t ON po.OrderId = t.OrderId
LEFT JOIN dbo.Waste w ON po.OrderId = w.OrderId
LEFT JOIN dbo.Usage u ON po.OrderId = u.OrderId
WHERE po.Date >= DATEADD(week, -4, GETDATE())
ORDER BY po.Date DESC, l.Location, i.ItemName;`;
    } else {
      mockContent = "This is a mock response. Please configure an API key (Azure OpenAI or OpenAI) to use real AI features.";
    }
  }
  
  return {
    id: "mock-" + Date.now(),
    created: Math.floor(Date.now() / 1000),
    model: "mock-model",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: mockContent,
        },
        finish_reason: "stop",
      }
    ],
    usage: {
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150,
    }
  };
}
