export const BaseScalar = {
  DATE: "Date",
  DATE_TIME: "DateTime",
  TIME: "Time",
  TIMESTAMP: "Timestamp",
  BIG_INT: "BigInt",
  UUID: "UUID",
  URL: "URL",
  EMAIL_ADDRESS: "EmailAddress",
  PHONE_NUMBER: "PhoneNumber",
  IP_ADDRESS: "IPAddress",
  JSON: "JSON",
} as const;

export type BaseScalarName = (typeof BaseScalar)[keyof typeof BaseScalar];

export const isBaseScalar = (typeName: string): typeName is BaseScalarName => {
  return Object.values(BaseScalar).includes(typeName as BaseScalarName);
};
