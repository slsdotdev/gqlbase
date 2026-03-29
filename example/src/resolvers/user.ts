import { createQueryResolver, createResolver, defineResolvers } from "@middy-appsync/graphql";
import { isCognito } from "@middy-appsync/graphql/utils";
import { User } from "../../generated/models.typegen";

export const queryMe = createQueryResolver({
  fieldName: "me",
  resolve: async ({ identity }) => {
    if (!isCognito(identity)) {
      throw new Error("Unauthorized");
    }

    // In a real application, you would fetch the user from your database using the identity information.
    // For this example, we'll return a mock user object.
    return {
      id: identity.sub,
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
    } as User;
  },
});

const userFullName = createResolver({
  typeName: "User",
  fieldName: "fullName",
  resolve: async ({ source }) => {
    if (source.fullName) {
      return source.fullName;
    }

    return `${source.firstName} ${source.lastName}`;
  },
});

export default defineResolvers(queryMe, userFullName);
