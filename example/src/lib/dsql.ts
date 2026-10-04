import { PGlite } from "@electric-sql/pglite";
import { createMigrationRunner, getSerializedSchemaObjects } from "@dsqlbase/migration";
import { createClient } from "dsqlbase";
import { createPgLiteSession } from "dsqlbase/pglite";
import * as schema from "../../generated/dsqlbase/schema";

/**
 * The example is never deployed, so it runs on an in-memory PGlite database. Every process (and
 * every Vitest test file) gets its own empty database; call `migrate()` before using it.
 */
const session = createPgLiteSession(new PGlite("memory://"));

/**
 * Enforcing, as a request handler's client should be: a tenant table is reachable only through a client scoped to the
 * caller (`userDb`, `vendorDb`, `callerDb` in `./claims`), which fills the claims on writes and filters by them on reads.
 */
export const dsql = createClient({ session, schema });

/**
 * Unscoped, for reads meant to cross tenants: public search and product stats, and test setup. Inserting still needs
 * claims (`dsql.$identityClaims(...)`), since nothing else can fill them.
 */
export const dsqlUnscoped = createClient({ session, schema, tenancy: { enforce: false } });

export const migrate = async () => {
  const runner = createMigrationRunner(session);
  const definitions = getSerializedSchemaObjects(Object.values(schema));

  await runner.run(definitions, { asyncIndexes: false, allow: { destructive: true } });
};
