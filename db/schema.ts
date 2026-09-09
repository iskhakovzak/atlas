import {sqliteTable,text,integer} from 'drizzle-orm/sqlite-core';
export const accounts=sqliteTable('market_accounts',{userId:text('user_id').primaryKey(),name:text('name').notNull(),state:text('state').notNull(),revision:integer('revision').notNull().default(0),createdAt:integer('created_at').notNull(),updatedAt:integer('updated_at').notNull()});
export const limits=sqliteTable('market_rate_limits',{key:text('key').primaryKey(),count:integer('count').notNull(),expiresAt:integer('expires_at').notNull()});
