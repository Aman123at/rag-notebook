import { sql, type SQL } from 'drizzle-orm';
import { customType, timestamp, uuid } from 'drizzle-orm/pg-core';

export const citext = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'citext';
  },
});

export function primaryUuid(name = 'id') {
  return uuid(name).primaryKey().defaultRandom();
}

export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
};

export function deletedAtColumn() {
  return timestamp('deleted_at', { withTimezone: true, mode: 'date' });
}

export function isNotDeleted(column: unknown): SQL {
  return sql`${column} IS NULL`;
}
