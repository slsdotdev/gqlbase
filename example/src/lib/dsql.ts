import { PGlite } from "@electric-sql/pglite";
import { createMigrationRunner, getSerializedSchemaObjects } from "@dsqlbase/migration";
import { createClient } from "dsqlbase";
import { createPgLiteSession } from "dsqlbase/pglite";
import * as schema from "../../generated/dsqlbase.schema";

/**
 * The example is never deployed, so it runs on an in-memory PGlite database. Every process (and
 * every Vitest test file) gets its own empty database; call `migrate()` before using it.
 */
const session = createPgLiteSession(new PGlite("memory://"));

export const dsql = createClient({ session, schema });

export const migrate = async () => {
  const runner = createMigrationRunner(session);
  const definitions = getSerializedSchemaObjects(Object.values(schema));

  await runner.run(definitions, { asyncIndexes: false, destructive: true, safeOperations: true });
};
