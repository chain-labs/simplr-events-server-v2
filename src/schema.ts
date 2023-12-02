import { makeExecutableSchema } from "@graphql-tools/schema";
import { GraphQLContext } from "./context";

const typeDefinitions = /* GraphQL */ `
  type Query {
    users: [User!]!
    holders: [Holder!]!
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

  type Holder {
    id: ID!
    firstname: String!
    lastname: String!
    email: String!
    batchId: String!
    eventname: String!
    mailsent: Boolean!
    mailsentTimestamp: Int!
    messageId: String
    isClaimed: Boolean
    claimedTimestamp: Int
    claimTrx: String
    tokenId: String
    accountAddress: String
    isSubscribed: Boolean
    isRedeemed: Boolean
    redeemedTimestamp: Int
    daysEntered: Int!
    maxDaysEntry: Int!
    contractAddress: String!
    firstAllowedEntryDate: Int!
    lastAllowedEntryDate: Int!
  }
`;

const resolvers = {
  Query: {
    users: (parent: unknown, args: {}, context: GraphQLContext) => {
      console.log("users");
      return context.prisma.user.findMany();
    },
    holders: (parent: unknown, args: {}, context: GraphQLContext) => {
      console.log("Queried Holders");
      return context.prisma.holder.findMany();
    },
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

const schema = makeExecutableSchema({
  resolvers: [resolvers],
  typeDefs: [typeDefinitions],
});

export default schema;
