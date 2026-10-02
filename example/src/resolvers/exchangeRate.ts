import { createQueryResolver, defineResolvers } from "@middy-appsync/graphql";
import { pageOf, toConnection } from "../lib/connection";

// ExchangeRate is @clientOnly: nothing is stored, the resolver provides the data.
const RATES = [
  { id: "0b6a1d4e-0000-4000-8000-000000000001", currency: "EUR", rate: 1 },
  { id: "0b6a1d4e-0000-4000-8000-000000000002", currency: "GBP", rate: 0.85 },
  { id: "0b6a1d4e-0000-4000-8000-000000000003", currency: "USD", rate: 1.08 },
];

const getExchangeRate = createQueryResolver({
  fieldName: "getExchangeRate",
  resolve: async ({ args }) => {
    return RATES.find((rate) => rate.id === args.id) ?? null;
  },
});

const listExchangeRates = createQueryResolver({
  fieldName: "listExchangeRates",
  resolve: async ({ args }) => {
    const { first, offset, limit } = pageOf(args);

    return toConnection(RATES.slice(offset, offset + limit), first, offset);
  },
});

export default defineResolvers(getExchangeRate, listExchangeRates);
