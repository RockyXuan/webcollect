import { relations } from "drizzle-orm/relations";
import { users, categories, userPreferences, cards } from "./schema";

export const categoriesRelations = relations(categories, ({one, many}) => ({
	user: one(users, {
		fields: [categories.userId],
		references: [users.id]
	}),
	cards: many(cards),
}));

export const usersRelations = relations(users, ({many}) => ({
	categories: many(categories),
	userPreferences: many(userPreferences),
	cards: many(cards),
}));

export const userPreferencesRelations = relations(userPreferences, ({one}) => ({
	user: one(users, {
		fields: [userPreferences.userId],
		references: [users.id]
	}),
}));

export const cardsRelations = relations(cards, ({one}) => ({
	user: one(users, {
		fields: [cards.userId],
		references: [users.id]
	}),
	category: one(categories, {
		fields: [cards.categoryId],
		references: [categories.id]
	}),
}));