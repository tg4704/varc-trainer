// Shared request-body validation middleware built on zod schemas. Applied
// per-route (see server/lib/schemas.js for the actual schemas) - rejects
// malformed/oversized/wrong-typed input before it reaches route logic, DB
// queries, or (on the AI routes) an expensive model call.
//
// Unlike the auth *error*-message hardening (which deliberately stays
// generic to prevent user enumeration), validation errors here return the
// specific field + reason - that's normal form-UX, not a security leak; it
// just tells a caller "reasoningText: max 4000 characters", not anything
// about another user's account.
const { z } = require("zod");

function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const first = result.error.issues[0];
      const field = first.path.join(".");
      return res.status(400).json({ error: field ? `${field}: ${first.message}` : first.message });
    }
    req.body = result.data;
    next();
  };
}

module.exports = { validateBody, z };
