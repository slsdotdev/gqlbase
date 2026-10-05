import {
  createMutationResolver,
  createQueryResolver,
  defineResolvers,
} from "@middy-appsync/graphql";
import { vendorDb } from "../lib/claims";
import { withoutNulls } from "../lib/filter";
import { orderOf, pageOf, toConnection } from "../lib/connection";
import { validate } from "../lib/validation";
import { CreateOperatingScheduleInputSchema } from "../../generated/zod/schema.validators";

// OperatingSchedule is in the `vendor` scope: vendorId is a claim, never part of the API, and the vendor's client sets
// and filters it.
const listOperatingSchedules = createQueryResolver({
  fieldName: "listOperatingSchedules",
  resolve: async ({ args, identity }) => {
    const { first, offset, limit } = pageOf(args);
    const rows = await vendorDb(identity).operatingSchedules.findMany({
      where: withoutNulls(args.filter),
      orderBy: orderOf(args.orderBy),
      limit,
      offset,
    });

    return toConnection(rows, first, offset);
  },
});

const createOperatingSchedule = createMutationResolver({
  fieldName: "createOperatingSchedule",
  resolve: async ({ args, identity }) => {
    const input = validate(CreateOperatingScheduleInputSchema, args.input);

    return await vendorDb(identity).operatingSchedules.create({
      data: input,
      return: true as const,
    });
  },
});

export default defineResolvers(listOperatingSchedules, createOperatingSchedule);
