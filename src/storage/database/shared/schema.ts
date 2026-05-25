import { pgTable, foreignKey, uuid, text, boolean, integer, timestamp, serial, jsonb, bigint, unique } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const categories = pgTable("categories", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	name: text().notNull(),
	icon: text().default('Folder'),
	color: text().default('#888888'),
	parentId: uuid("parent_id"),
	isParent: boolean("is_parent").default(false),
	order: integer().default(0),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "categories_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const userPreferences = pgTable("user_preferences", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	key: text().notNull(),
	value: jsonb().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_preferences_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const workspaceSnapshots = pgTable("workspace_snapshots", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	kind: text().notNull(),
	label: text().default('').notNull(),
	reason: text().default('').notNull(),
	source: text().default('').notNull(),
	dayKey: text("day_key"),
	snapshotCreatedAt: timestamp("snapshot_created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	snapshotCreatedAtMs: bigint("snapshot_created_at_ms", { mode: "number" }).notNull(),
	counts: jsonb().notNull(),
	assessment: jsonb().notNull(),
	sectionNames: jsonb("section_names").default(sql`'[]'::jsonb`).notNull(),
	sampleCategoryNames: jsonb("sample_category_names").default(sql`'[]'::jsonb`).notNull(),
	sampleCardTitles: jsonb("sample_card_titles").default(sql`'[]'::jsonb`).notNull(),
	data: jsonb().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "workspace_snapshots_user_id_users_id_fk"
		}).onDelete("cascade"),
	unique("workspace_snapshots_user_kind_day_unique").on(table.userId, table.kind, table.dayKey),
]);

export const cards = pgTable("cards", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	categoryId: uuid("category_id").notNull(),
	url: text().notNull(),
	title: text().default(''),
	shortDesc: text("short_desc").default(''),
	fullDesc: text("full_desc").default(''),
	note: text().default(''),
	abbreviation: text().default(''),
	imageUrl: text("image_url").default(''),
	order: integer().default(0),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "cards_user_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.categoryId],
			foreignColumns: [categories.id],
			name: "cards_category_id_categories_id_fk"
		}).onDelete("cascade"),
]);

export const users = pgTable("users", {
	id: uuid().primaryKey().notNull(),
	email: text().notNull(),
	displayName: text("display_name").default(''),
	avatarUrl: text("avatar_url").default(''),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});
