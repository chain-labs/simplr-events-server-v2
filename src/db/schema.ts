import { makeExecutableSchema } from "@graphql-tools/schema";
import type { GraphQLContext } from "./context";

const typeDefinitions = /* GraphQL */ `
  type Query {
    users: [User!]!
  }

  type Mutation {
    addUser(email: String!, address: String!): User!
  }

  type User {
    userID: String!
    email: String!
    address: String!
    claimedNFTs: [String!]
  }
`;

const resolvers = {
  Query: {
    users: (parent: unknown, args: {}, context: GraphQLContext) =>
      context.prisma.user.findMany(),
  },

  Mutation: {
    addUser: async (
      parent: unknown,
      args: { email: string; address: string },
      context: GraphQLContext
    ) => {
      const user = await context.prisma.user.create({
        data: {
          email: args.email,
          address: args.address,
          claimedNFTs: [],
        },
      });

      return user;
    },
  },
};

export const schema = makeExecutableSchema({
  resolvers: [resolvers],
  typeDefs: [typeDefinitions],
});
