import {
  createMutationResolver,
  createQueryResolver,
  defineResolvers,
} from "@middy-appsync/graphql";
import { dsql } from "../lib/dsql";
import { vendorClaims } from "../lib/claims";
import { allOf, withoutNulls } from "../lib/filter";
import { orderOf, pageOf, toConnection } from "../lib/connection";
import { validate } from "../lib/validation";
import { CreateOperatingScheduleInputSchema } from "../../generated/zod/schema.validators";

type OperatingScheduleWhere = NonNullable<
  Parameters<typeof dsql.operatingSchedules.findMany>[0]["where"]
>;

// OperatingSchedule is in the `vendor` scope: vendorId is a claim, never part of the API.
const listOperatingSchedules = createQueryResolver({
  fieldName: "listOperatingSchedules",
  resolve: async ({ args, identity }) => {
    const { first, offset, limit } = pageOf(args);
    const rows = await dsql.operatingSchedules.findMany({
      where: allOf<OperatingScheduleWhere>(vendorClaims(identity), withoutNulls(args.filter)),
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
    const now = new Date().toISOString();

    return await dsql.operatingSchedules.create({
      data: { ...input, ...vendorClaims(identity), createdAt: now, updatedAt: now },
      return: true as const,
    });
  },
});

export default defineResolvers(listOperatingSchedules, createOperatingSchedule);
