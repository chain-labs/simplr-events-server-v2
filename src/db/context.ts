const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

export type GraphQLContext = {
  prisma: typeof PrismaClient;
};

export function createContext(): GraphQLContext {
  return { prisma };
}
