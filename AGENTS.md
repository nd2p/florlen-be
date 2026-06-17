# Backend Agent Guidelines

## Overview

This document defines guidelines and requirements for AI agents when working with the backend API. All endpoint modifications must follow these rules to ensure consistency, documentation, and code quality.

---

## Rule 1: Always Update Swagger Documentation

### When to apply:

- ✅ Creating a new endpoint
- ✅ Modifying an existing endpoint's parameters, request body, or response
- ✅ Adding new query parameters or headers
- ✅ Changing endpoint authentication requirements
- ✅ Adding new response codes or error scenarios

### How to apply:

1. Add or update JSDoc comments in the route file using `@swagger` tags
2. Include all OpenAPI 3.0 required fields:
   - `summary` — brief description
   - `tags` — endpoint category (e.g., [Auth], [Products], [Orders])
   - `parameters` or `requestBody` — input documentation
   - `responses` — all possible HTTP status codes and schemas
   - `security` — if endpoint requires authentication (bearerAuth)
3. Reference schemas from `src/config/swagger.js` using `$ref: '#/components/schemas/SchemaName'`
4. Add error schemas for non-2xx responses

### Example template:

```javascript
/**
 * @swagger
 * /api/resource/{id}:
 *   patch:
 *     summary: Update resource
 *     tags: [Resources]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               status: { type: string, enum: [active, inactive] }
 *     responses:
 *       200:
 *         description: Resource updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 resource: { $ref: '#/components/schemas/Resource' }
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Resource not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.patch('/:id', authenticate, update);
```

---

## Rule 2: Endpoint Naming & Structure Consistency

### HTTP Methods:

- `GET` — retrieve data (read-only, idempotent)
- `POST` — create new resource or trigger action
- `PATCH` — partial update of existing resource
- `PUT` — full replacement of resource (use sparingly)
- `DELETE` — delete or soft-delete resource

### URL Path Patterns:

```
GET    /api/resource              — list with pagination/filters
GET    /api/resource/:id          — get single resource
POST   /api/resource              — create new resource
PATCH  /api/resource/:id          — update resource
DELETE /api/resource/:id          — delete resource
POST   /api/resource/:id/action   — custom action on resource
```

### Query Parameters:

- `limit` — pagination size (default: 20)
- `cursor` — cursor for pagination (UUID or last ID)
- `offset` — alternative pagination (use cursor if possible)
- `sort` — sort field and direction (e.g., `created_at:desc`)
- Filter params — `type`, `status`, `tag`, `collection` etc. (lowercase, singular)

### Request Body Naming:

- Use `camelCase` in JSON
- Database columns use `snake_case` and are converted in service layer
- Optional fields should be documented

### Response Format:

```javascript
// Success responses (2xx)
{
  message: "Action completed successfully",
  resource: { /* object */ },
  // or for lists:
  resources: [ /* array */ ],
  pagination: { hasMore: boolean, nextCursor: string | null }
}

// Error responses (4xx, 5xx)
{
  message: "Human-readable error",
  status: 400,
  // optional: details or field errors
  errors: { fieldName: "Error message" }
}
```

---

## Rule 3: Controller Logic Standards

### Do's:

- ✅ Validate all inputs using middleware or explicit checks
- ✅ Check authentication & authorization early (`req.user`)
- ✅ Return appropriate HTTP status codes (201 for create, 400 for validation, 401 for auth, 403 for permission, 404 for not found)
- ✅ Use try-catch and log errors
- ✅ Return consistent response format
- ✅ Soft-delete instead of hard-delete when relevant (set `is_active: false`, `deleted_at: now()`)

### Don't's:

- ❌ Log sensitive data (passwords, tokens, emails in some contexts)
- ❌ Return stack traces to client (only in development)
- ❌ Expose internal error details
- ❌ Skip error handling
- ❌ Mix different response formats

### Example controller pattern:

```javascript
const updateResource = async (req, res) => {
  try {
    // 1. Auth check (already done by middleware, but explicit if needed)
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // 2. Authorization check
    if (req.user.profile.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden' });
    }

    // 3. Input validation
    const { id } = req.params;
    const updateData = {
      /* extract and validate */
    };

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    // 4. Call service
    const updated = await updateResourceService(id, updateData);

    // 5. Return response
    res.json({
      message: 'Resource updated successfully',
      resource: updated,
    });
  } catch (error) {
    console.error('Update error:', error);
    res.status(400).json({ message: error.message });
  }
};
```

---

## Rule 4: Service Layer Standards

### Do's:

- ✅ Handle Supabase errors gracefully
- ✅ Throw descriptive errors
- ✅ Use `supabaseAdmin` for all backend operations (bypass RLS)
- ✅ Select only needed columns to reduce payload
- ✅ Use pagination for list operations
- ✅ Implement soft-delete pattern

### Don't's:

- ❌ Expose raw Supabase errors to client
- ❌ Use `supabaseAnon` in backend (it respects RLS which may be too restrictive)
- ❌ Select `*` unless necessary
- ❌ Forget to handle errors

### Example service pattern:

```javascript
const updateResource = async (id, updateData) => {
  const { data, error } = await supabaseAdmin
    .from('resources')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};

const listResources = async ({ cursor, limit = 20, type }) => {
  let query = supabaseAdmin
    .from('resources')
    .select('id, name, type, created_at')
    .order('created_at', { ascending: false })
    .limit(Number(limit) + 1);

  if (type) query = query.eq('type', type);
  if (cursor) query = query.lt('id', cursor);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const hasMore = data.length > limit;
  if (hasMore) data.pop();

  return {
    resources: data,
    hasMore,
    nextCursor: hasMore ? data[data.length - 1].id : null,
  };
};
```

---

## Rule 5: Testing Endpoints

### After creating/modifying an endpoint:

1. ✅ Verify Swagger documentation is complete and accurate
2. ✅ Test the endpoint manually (curl, Postman, or Swagger UI)
3. ✅ Test with valid auth token (if protected)
4. ✅ Test with invalid/missing token (if protected)
5. ✅ Test with invalid input (400 response)
6. ✅ Test with unauthorized user (403 response)
7. ✅ Test success cases (200/201 response)
8. ✅ Verify response format matches documentation

### Quick curl test examples:

```bash
# GET list
curl http://localhost:3001/api/products?limit=10

# GET single
curl http://localhost:3001/api/products/uuid-here

# POST with auth
curl -X POST http://localhost:3001/api/products \
  -H "Authorization: Bearer token-here" \
  -H "Content-Type: application/json" \
  -d '{"name":"Product","sku":"SKU-001"}'

# PATCH with auth
curl -X PATCH http://localhost:3001/api/products/uuid-here \
  -H "Authorization: Bearer token-here" \
  -H "Content-Type: application/json" \
  -d '{"name":"Updated"}'

# DELETE with auth
curl -X DELETE http://localhost:3001/api/products/uuid-here \
  -H "Authorization: Bearer token-here"
```

---

## Rule 6: File Organization

### Route structure:

- `src/routes/[module].routes.js` — route definitions with Swagger annotations
- `src/controllers/[module].controller.js` — request handlers
- `src/services/[module].service.js` — database & business logic

### New module checklist:

1. ✅ Create `src/routes/[module].routes.js` with Swagger
2. ✅ Create `src/controllers/[module].controller.js`
3. ✅ Create `src/services/[module].service.js`
4. ✅ Import route in `src/server.js`: `app.use('/api/[module]', require('./routes/[module].routes'))`
5. ✅ Add schemas to `src/config/swagger.js` if new types are needed
6. ✅ Test all endpoints

---

## Rule 7: Common Response Codes

| Code | Scenario                                   |
| ---- | ------------------------------------------ |
| 200  | ✅ Successful GET, PATCH, PUT, DELETE      |
| 201  | ✅ Successful POST (resource created)      |
| 400  | ❌ Validation error, invalid input         |
| 401  | ❌ Missing or invalid authentication       |
| 403  | ❌ Valid auth but insufficient permissions |
| 404  | ❌ Resource not found                      |
| 409  | ❌ Conflict (e.g., duplicate unique field) |
| 422  | ❌ Unprocessable entity (semantic error)   |
| 500  | ❌ Unexpected server error                 |

---

## Checklist for Every Endpoint Change

- [ ] Route handler implemented in controller
- [ ] Service layer method created/updated
- [ ] Swagger documentation added/updated
- [ ] All HTTP methods documented (`get`, `post`, `patch`, `delete`)
- [ ] All query parameters documented
- [ ] Request body schema documented
- [ ] All response codes (2xx, 4xx) documented
- [ ] `security` field present if endpoint requires auth
- [ ] References to schemas use correct `$ref` syntax
- [ ] Error responses use `Error` schema from swagger config
- [ ] Endpoint tested with curl or Swagger UI
- [ ] Response format matches documentation
- [ ] Authorization checks in place (if applicable)
- [ ] Soft-delete used instead of hard-delete (for most resources)

---

## Schema Updates

When adding a new resource type, update `src/config/swagger.js`:

```javascript
// In components.schemas
YourResource: {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    status: { type: 'string', enum: ['active', 'inactive'] },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' },
    deleted_at: { type: 'string', format: 'date-time', nullable: true },
  },
}
```

---

## References

- Swagger/OpenAPI 3.0: https://swagger.io/specification/
- HTTP Status Codes: https://httpwg.org/specs/rfc7231.html#status.codes
- JSON API Standard (reference): https://jsonapi.org/
- Project routes: `src/routes/*.routes.js`
- API docs: `http://localhost:3001/api-docs`
