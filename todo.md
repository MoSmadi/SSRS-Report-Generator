# Report Builder TODO

## Core Features

- [x] Natural language input form for report requests
- [x] LLM integration to infer metrics/dimensions/filters from user input
- [x] Preview panel showing inferred metrics, dimensions, and filters
- [x] Data source discovery and selection (discover existing shared DS items)
- [ ] Create new data source option if needed
- [x] SQL generation from natural language + data source
- [x] Preview generated SQL query
- [x] Fetch and display resulting fields from metadata
- [x] Publish functionality to generate render link
- [x] Display published report link to user

## Backend (tRPC Procedures)

- [x] `report.inferFromNaturalLanguage` - Parse natural language and extract metrics/dimensions/filters
- [x] `report.discoverDataSources` - List available shared data sources
- [x] `report.generateSQL` - Generate SQL from natural language + selected data source
- [x] `report.getFieldMetadata` - Fetch field information from data source
- [x] `report.publishReport` - Save report and generate render link

## Frontend UI

- [x] Single-page report builder interface
- [x] Natural language input textarea
- [x] Inferred metrics/dimensions/filters preview section
- [x] Data source selector (dropdown or list)
- [ ] Option to create new data source
- [x] SQL preview panel
- [x] Fields/metadata preview table
- [x] Publish button with success feedback
- [x] Render link display and copy functionality

## Database Schema

- [x] `reports` table - Store generated reports with metadata
- [x] `dataSources` table - Store shared data source references

## Integration Points

- [x] LLM API for natural language processing
- [x] Data source metadata API
- [x] SQL generation logic
- [x] Report publishing/rendering service

## Testing & Deployment

- [ ] Test natural language parsing with various inputs
- [ ] Test data source discovery
- [ ] Test SQL generation accuracy
- [ ] Test end-to-end workflow
- [x] Deploy and verify all features work
