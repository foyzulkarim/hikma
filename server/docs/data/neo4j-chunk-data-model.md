# Neo4j Chunk Data Model

This document defines the data model for storing code chunks and their relationships in Neo4j as part of the knowledge graph.

## Overview

The Neo4j chunk storage system creates a graph representation of code structure, enabling powerful relationship-based queries and analysis. Each code chunk becomes a node with rich metadata, connected to other chunks through typed relationships.

## Node Types

### Chunk Node

The primary node type representing a code chunk extracted from AST parsing.

**Label**: `Chunk`

**Properties**:
- `id` (string): Unique identifier for the Neo4j node
- `chunkId` (string): Reference to PostgreSQL DocumentChunk.id
- `documentId` (string): Reference to the parent document
- `projectId` (string): Project identifier for scoping
- `content` (string): The actual code content of the chunk
- `filePath` (string): Path to the source file
- `language` (string, optional): Programming language (e.g., 'typescript', 'python')
- `astNodeType` (string, optional): Type of AST node (class, function, method, etc.)
- `functionName` (string, optional): Name of the function if applicable
- `className` (string, optional): Name of the class if applicable
- `methodName` (string, optional): Name of the method if applicable
- `parameters` (string[], optional): Function/method parameters
- `returnType` (string, optional): Return type annotation
- `visibility` (string, optional): Access modifier (public, private, protected)
- `isStatic` (boolean): Whether the member is static
- `isAsync` (boolean): Whether the function is async
- `complexity` (number, optional): Cyclomatic complexity score
- `dependencies` (string[], optional): List of dependencies/imports
- `startLine` (number, optional): Starting line number in source file
- `endLine` (number, optional): Ending line number in source file
- `createdAt` (datetime): Timestamp when the chunk was created
- `updatedAt` (datetime): Timestamp when the chunk was last updated

**Example**:
```cypher
CREATE (c:Chunk {
  id: "chunk_123",
  chunkId: "doc_chunk_456",
  documentId: "doc_789",
  projectId: "proj_001",
  content: "function calculateTotal(items) { return items.reduce((sum, item) => sum + item.price, 0); }",
  filePath: "src/utils/calculator.ts",
  language: "typescript",
  astNodeType: "function",
  functionName: "calculateTotal",
  parameters: ["items"],
  returnType: "number",
  visibility: "public",
  isStatic: false,
  isAsync: false,
  complexity: 2,
  startLine: 15,
  endLine: 17,
  createdAt: datetime(),
  updatedAt: datetime()
})
```

## Relationship Types

Relationships capture the semantic connections between code chunks, enabling powerful traversal and analysis queries.

### CALLS

**Description**: Represents a function/method call relationship

**Direction**: `(caller:Chunk)-[:CALLS]->(callee:Chunk)`

**Properties**:
- `callType` (string): Type of call (direct, indirect, conditional)
- `lineNumber` (number): Line where the call occurs
- `confidence` (float): Confidence score of the relationship (0.0-1.0)

**Example**:
```cypher
(orderProcessor:Chunk)-[:CALLS {callType: "direct", lineNumber: 42, confidence: 1.0}]->(calculateTotal:Chunk)
```

### IMPORTS

**Description**: Represents import/require relationships between modules

**Direction**: `(importer:Chunk)-[:IMPORTS]->(imported:Chunk)`

**Properties**:
- `importType` (string): Type of import (default, named, namespace, dynamic)
- `alias` (string, optional): Import alias if used
- `isTypeOnly` (boolean): Whether it's a type-only import

**Example**:
```cypher
(userService:Chunk)-[:IMPORTS {importType: "named", alias: "calc", isTypeOnly: false}]->(calculator:Chunk)
```

### DEFINES

**Description**: Represents definition relationships (class defines method, interface defines property)

**Direction**: `(container:Chunk)-[:DEFINES]->(member:Chunk)`

**Properties**:
- `memberType` (string): Type of member (method, property, field)
- `accessLevel` (string): Access level (public, private, protected)

**Example**:
```cypher
(userClass:Chunk)-[:DEFINES {memberType: "method", accessLevel: "public"}]->(getUserMethod:Chunk)
```

### EXTENDS

**Description**: Represents class inheritance relationships

**Direction**: `(child:Chunk)-[:EXTENDS]->(parent:Chunk)`

**Properties**:
- `inheritanceType` (string): Type of inheritance (class, interface)

**Example**:
```cypher
(adminUser:Chunk)-[:EXTENDS {inheritanceType: "class"}]->(baseUser:Chunk)
```

### IMPLEMENTS

**Description**: Represents interface implementation relationships

**Direction**: `(implementer:Chunk)-[:IMPLEMENTS]->(interface:Chunk)`

**Properties**:
- `isPartial` (boolean): Whether implementation is partial

**Example**:
```cypher
(userService:Chunk)-[:IMPLEMENTS {isPartial: false}]->(userInterface:Chunk)
```

### USES

**Description**: Represents usage relationships (variable usage, type usage)

**Direction**: `(user:Chunk)-[:USES]->(used:Chunk)`

**Properties**:
- `usageType` (string): Type of usage (variable, type, constant)
- `frequency` (number): Number of times used

**Example**:
```cypher
(processOrder:Chunk)-[:USES {usageType: "variable", frequency: 3}]->(orderStatus:Chunk)
```

### CONTAINS

**Description**: Represents containment relationships (file contains class, class contains method)

**Direction**: `(container:Chunk)-[:CONTAINS]->(contained:Chunk)`

**Properties**:
- `containmentType` (string): Type of containment (file, class, namespace)
- `order` (number): Order within container

**Example**:
```cypher
(userFile:Chunk)-[:CONTAINS {containmentType: "file", order: 1}]->(userClass:Chunk)
```

### REFERENCES

**Description**: Represents general reference relationships

**Direction**: `(referencer:Chunk)-[:REFERENCES]->(referenced:Chunk)`

**Properties**:
- `referenceType` (string): Type of reference (comment, documentation, annotation)
- `context` (string): Context of the reference

**Example**:
```cypher
(docComment:Chunk)-[:REFERENCES {referenceType: "documentation", context: "@see"}]->(relatedFunction:Chunk)
```

### DEPENDS_ON

**Description**: Represents dependency relationships

**Direction**: `(dependent:Chunk)-[:DEPENDS_ON]->(dependency:Chunk)`

**Properties**:
- `dependencyType` (string): Type of dependency (compile-time, runtime, dev)
- `strength` (string): Strength of dependency (strong, weak, optional)

**Example**:
```cypher
(apiController:Chunk)-[:DEPENDS_ON {dependencyType: "runtime", strength: "strong"}]->(databaseService:Chunk)
```

### OVERRIDES

**Description**: Represents method override relationships

**Direction**: `(override:Chunk)-[:OVERRIDES]->(original:Chunk)`

**Properties**:
- `overrideType` (string): Type of override (method, property)

**Example**:
```cypher
(childMethod:Chunk)-[:OVERRIDES {overrideType: "method"}]->(parentMethod:Chunk)
```

### INHERITS_FROM

**Description**: Represents inheritance chain relationships

**Direction**: `(child:Chunk)-[:INHERITS_FROM]->(ancestor:Chunk)`

**Properties**:
- `distance` (number): Distance in inheritance chain
- `inheritanceType` (string): Type of inheritance

**Example**:
```cypher
(grandChild:Chunk)-[:INHERITS_FROM {distance: 2, inheritanceType: "class"}]->(grandParent:Chunk)
```

## Query Patterns

### Find All Functions Called by a Specific Function

```cypher
MATCH (caller:Chunk {functionName: "processOrder"})-[:CALLS]->(callee:Chunk)
RETURN callee.functionName, callee.filePath
```

### Find All Classes That Implement a Specific Interface

```cypher
MATCH (implementer:Chunk)-[:IMPLEMENTS]->(interface:Chunk {className: "UserInterface"})
RETURN implementer.className, implementer.filePath
```

### Find Dependency Chain for a Function

```cypher
MATCH path = (start:Chunk {functionName: "main"})-[:CALLS*1..5]->(end:Chunk)
RETURN path, length(path) as depth
ORDER BY depth
```

### Find All Methods in a Class

```cypher
MATCH (class:Chunk {astNodeType: "class", className: "UserService"})-[:DEFINES]->(method:Chunk {astNodeType: "method"})
RETURN method.methodName, method.visibility, method.parameters
```

### Find Circular Dependencies

```cypher
MATCH path = (a:Chunk)-[:DEPENDS_ON*2..10]->(a)
WHERE length(path) > 2
RETURN path, length(path) as cycleLength
ORDER BY cycleLength
```

### Find Most Called Functions

```cypher
MATCH (caller:Chunk)-[:CALLS]->(callee:Chunk)
RETURN callee.functionName, callee.filePath, count(*) as callCount
ORDER BY callCount DESC
LIMIT 10
```

### Find Orphaned Functions (No Incoming Calls)

```cypher
MATCH (func:Chunk {astNodeType: "function"})
WHERE NOT (func)<-[:CALLS]-()
RETURN func.functionName, func.filePath
```

### Find Complex Functions with High Dependency Count

```cypher
MATCH (func:Chunk {astNodeType: "function"})-[:CALLS]->(dep:Chunk)
WITH func, count(dep) as depCount
WHERE func.complexity > 5 AND depCount > 3
RETURN func.functionName, func.complexity, depCount, func.filePath
ORDER BY func.complexity DESC, depCount DESC
```

## Indexing Strategy

To optimize query performance, create the following indexes:

```cypher
// Primary identifiers
CREATE INDEX chunk_id FOR (c:Chunk) ON (c.id);
CREATE INDEX chunk_chunk_id FOR (c:Chunk) ON (c.chunkId);
CREATE INDEX chunk_document_id FOR (c:Chunk) ON (c.documentId);
CREATE INDEX chunk_project_id FOR (c:Chunk) ON (c.projectId);

// Common query patterns
CREATE INDEX chunk_file_path FOR (c:Chunk) ON (c.filePath);
CREATE INDEX chunk_ast_node_type FOR (c:Chunk) ON (c.astNodeType);
CREATE INDEX chunk_function_name FOR (c:Chunk) ON (c.functionName);
CREATE INDEX chunk_class_name FOR (c:Chunk) ON (c.className);
CREATE INDEX chunk_language FOR (c:Chunk) ON (c.language);

// Composite indexes for common filter combinations
CREATE INDEX chunk_project_file FOR (c:Chunk) ON (c.projectId, c.filePath);
CREATE INDEX chunk_project_type FOR (c:Chunk) ON (c.projectId, c.astNodeType);
```

## Constraints

Ensure data integrity with constraints:

```cypher
// Unique constraints
CREATE CONSTRAINT chunk_id_unique FOR (c:Chunk) REQUIRE c.id IS UNIQUE;
CREATE CONSTRAINT chunk_chunk_id_unique FOR (c:Chunk) REQUIRE c.chunkId IS UNIQUE;

// Existence constraints
CREATE CONSTRAINT chunk_required_fields FOR (c:Chunk) REQUIRE c.chunkId IS NOT NULL;
CREATE CONSTRAINT chunk_document_required FOR (c:Chunk) REQUIRE c.documentId IS NOT NULL;
CREATE CONSTRAINT chunk_project_required FOR (c:Chunk) REQUIRE c.projectId IS NOT NULL;
```

## Migration Strategy

When implementing this data model:

1. **Phase 1**: Create chunk nodes from existing PostgreSQL data
2. **Phase 2**: Establish basic relationships (CALLS, IMPORTS, DEFINES)
3. **Phase 3**: Add advanced relationships (EXTENDS, IMPLEMENTS, OVERRIDES)
4. **Phase 4**: Optimize with indexes and constraints
5. **Phase 5**: Implement relationship inference algorithms

## Performance Considerations

- **Batch Operations**: Use batch operations for bulk chunk creation
- **Relationship Inference**: Build relationships incrementally to avoid memory issues
- **Query Optimization**: Use EXPLAIN to optimize complex traversal queries
- **Memory Management**: Monitor heap usage during large graph operations
- **Partitioning**: Consider partitioning by project for large codebases

## Integration with PostgreSQL

The Neo4j chunk storage complements PostgreSQL:

- **PostgreSQL**: Stores chunk content, embeddings, and metadata
- **Neo4j**: Stores chunk relationships and enables graph traversal
- **Synchronization**: Maintain consistency between both systems
- **Querying**: Use both systems for different query patterns

This dual-storage approach provides the benefits of both relational and graph databases for comprehensive code analysis and retrieval.