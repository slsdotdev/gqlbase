import { describe, expect, it } from "vitest";
import { camelCase, pascalCase, pluralize } from "./strings.js";

describe("format string", () => {
  describe("pascalCase", () => {
    it("should handle snake_case strings", () => {
      expect(pascalCase("user_name")).toBe("UserName");
      expect(pascalCase("first_name_last_name")).toBe("FirstNameLastName");
      expect(pascalCase("aws_api_gateway")).toBe("AwsApiGateway");
      expect(pascalCase("_private_field")).toBe("PrivateField");
    });
    it("should handle kebab-case strings", () => {
      expect(pascalCase("user-profile")).toBe("UserProfile");
      expect(pascalCase("aws-lambda-function")).toBe("AwsLambdaFunction");
      expect(pascalCase("graphql-schema")).toBe("GraphqlSchema");
      expect(pascalCase("-prefix-value")).toBe("PrefixValue");
    });
    it("should handle camelCase strings", () => {
      expect(pascalCase("userProfile")).toBe("UserProfile");
      expect(pascalCase("graphQLSchema")).toBe("GraphQLSchema");
      expect(pascalCase("awsAppSync")).toBe("AwsAppSync");
      expect(pascalCase("httpResponse")).toBe("HttpResponse");
    });
    it("should handle mixed format strings", () => {
      expect(pascalCase("User_profile-type")).toBe("UserProfileType");
      expect(pascalCase("AWS-lambda_FUNCTION")).toBe("AwsLambdaFunction");
      expect(pascalCase("graphQL_Api-endpoint")).toBe("GraphQLApiEndpoint");
      expect(pascalCase("REST_api-Gateway")).toBe("RestApiGateway");
    });
    it("should handle multiple string inputs", () => {
      expect(pascalCase("user", "profile", "data")).toBe("UserProfileData");
      expect(pascalCase("aws", "lambda", "function")).toBe("AwsLambdaFunction");
      expect(pascalCase("graphql", "schema", "type")).toBe("GraphqlSchemaType");
      expect(pascalCase("api_gateway", "rest-endpoint")).toBe("ApiGatewayRestEndpoint");
    });
    it("should handle edge cases", () => {
      expect(pascalCase("")).toBe("");
      expect(pascalCase("   ")).toBe("");
      expect(pascalCase("a")).toBe("A");
      expect(pascalCase("Z")).toBe("Z");
      expect(pascalCase("123_test")).toBe("123Test");
      expect(pascalCase("TEST_VALUE")).toBe("TestValue");
    });
  });
  describe("camelCase", () => {
    it("should handle snake_case strings", () => {
      expect(camelCase("user_name")).toBe("userName");
      expect(camelCase("first_name_last_name")).toBe("firstNameLastName");
      expect(camelCase("aws_api_gateway")).toBe("awsApiGateway");
      expect(camelCase("_private_field")).toBe("privateField");
    });

    it("should handle kebab-case strings", () => {
      expect(camelCase("user-profile")).toBe("userProfile");
      expect(camelCase("aws-lambda-function")).toBe("awsLambdaFunction");
      expect(camelCase("graphql-schema")).toBe("graphqlSchema");
      expect(camelCase("-prefix-value")).toBe("prefixValue");
    });

    it("should handle PascalCase strings", () => {
      expect(camelCase("UserProfile")).toBe("userProfile");
      expect(camelCase("GraphQLSchema")).toBe("graphQLSchema");
      expect(camelCase("AWS", "AppSync")).toBe("awsAppSync");
      expect(camelCase("HTTPresponse")).toBe("httpResponse");
    });

    it("should handle mixed format strings", () => {
      expect(camelCase("User_profile-type")).toBe("userProfileType");
      expect(camelCase("AWS-lambda_FUNCTION")).toBe("awsLambdaFunction");
      expect(camelCase("graphQL_Api-endpoint")).toBe("graphQLApiEndpoint");
      expect(camelCase("REST_api-Gateway")).toBe("restApiGateway");
    });

    it("should handle multiple string inputs", () => {
      expect(camelCase("user", "profile", "data")).toBe("userProfileData");
      expect(camelCase("aws", "lambda", "function")).toBe("awsLambdaFunction");
      expect(camelCase("graphql", "schema", "type")).toBe("graphqlSchemaType");
      expect(camelCase("api_gateway", "rest-endpoint")).toBe("apiGatewayRestEndpoint");
    });

    it("should handle edge cases", () => {
      expect(camelCase("")).toBe("");
      expect(camelCase("   ")).toBe("");
      expect(camelCase("a")).toBe("a");
      expect(camelCase("Z")).toBe("z");
      expect(camelCase("123_test")).toBe("123Test");
      expect(camelCase("TEST_VALUE")).toBe("testValue");
    });
  });

  describe("pluralize", () => {
    it("should correctly pluralize words ending in -us", () => {
      expect(pluralize("stimulus")).toBe("stimuli");
      expect(pluralize("alumnus")).toBe("alumni");
      expect(pluralize("focus")).toBe("foci");
      expect(pluralize("radius")).toBe("radii");
      expect(pluralize("virus")).toBe("viruses");
    });

    it("should correctly pluralize words ending in -um/-on", () => {
      expect(pluralize("datum")).toBe("data");
      expect(pluralize("criterion")).toBe("criteria");
      expect(pluralize("phenomenon")).toBe("phenomena");
      expect(pluralize("stratum")).toBe("strata");
    });

    it("should correctly pluralize words ending in -y", () => {
      expect(pluralize("story")).toBe("stories");
      expect(pluralize("fly")).toBe("flies");
      expect(pluralize("monkey")).toBe("monkeys");
    });

    it("should correctly pluralize words ending in -f/-fe", () => {
      expect(pluralize("life")).toBe("lives");
      expect(pluralize("wolf")).toBe("wolves");
      expect(pluralize("knife")).toBe("knives");
    });

    it("should correctly pluralize special cases", () => {
      expect(pluralize("person")).toBe("people");
      expect(pluralize("child")).toBe("children");
      expect(pluralize("man")).toBe("men");
      expect(pluralize("woman")).toBe("women");
      expect(pluralize("mouse")).toBe("mice");
    });

    it("should correctly pluralize words ending in -ch/-sh/-ss/-x", () => {
      expect(pluralize("watch")).toBe("watches");
      expect(pluralize("dish")).toBe("dishes");
      expect(pluralize("class")).toBe("classes");
      expect(pluralize("box")).toBe("boxes");
    });

    it("should return the same word when no plural rule matches", () => {
      expect(pluralize("data")).toBe("data");
      expect(pluralize("sheep")).toBe("sheep");
    });

    it("should correctly pluralize words ending in -as/-is", () => {
      expect(pluralize("alias")).toBe("aliases");
      expect(pluralize("gas")).toBe("gases");
      expect(pluralize("atlas")).toBe("atlases");
      expect(pluralize("iris")).toBe("irises");
    });

    it("should correctly pluralize words ending in -ix/-ex", () => {
      expect(pluralize("matrix")).toBe("matrices");
      expect(pluralize("index")).toBe("indices");
      expect(pluralize("vertex")).toBe("vertices");
      expect(pluralize("appendix")).toBe("appendices");
    });

    it("should correctly pluralize words with -emu pattern", () => {
      expect(pluralize("emu")).toBe("emus");
    });

    it("should correctly pluralize words ending in -o", () => {
      expect(pluralize("hero")).toBe("heroes");
      expect(pluralize("potato")).toBe("potatoes");
    });

    it("should correctly handle seraph/cherub cases", () => {
      expect(pluralize("seraph")).toBe("seraphim");
      expect(pluralize("cherub")).toBe("cherubim");
    });

    it("should correctly pluralize Latin/Greek terms ending in -a/-ae", () => {
      expect(pluralize("vertebra")).toBe("vertebrae");
      expect(pluralize("alga")).toBe("algae");
      expect(pluralize("alumna")).toBe("alumnae");
    });

    it("should correctly pluralize words ending in -ias/-las/-as/-am", () => {
      expect(pluralize("atlas")).toBe("atlases");
      expect(pluralize("villas")).toBe("villas");
      expect(pluralize("jam")).toBe("jams");
    });

    it("should correctly pluralize academic/scientific terms", () => {
      expect(pluralize("agenda")).toBe("agenda");
      expect(pluralize("bacterium")).toBe("bacteria");
      expect(pluralize("curriculum")).toBe("curricula");
      expect(pluralize("symposium")).toBe("symposia");
      expect(pluralize("ovum")).toBe("ova");
    });

    it("should correctly pluralize additional mouse/louse variants", () => {
      expect(pluralize("louse")).toBe("lice");
      expect(pluralize("titmouse")).toBe("titmice");
    });

    it("should correctly handle words ending in -eaux", () => {
      expect(pluralize("tableau")).toBe("tableaux");
      expect(pluralize("beau")).toBe("beaux");
    });

    it("should correctly handle the word thou", () => {
      expect(pluralize("thou")).toBe("you");
    });

    it("should handle singular strings", () => {
      expect(pluralize("user")).toBe("users");
      expect(pluralize("profile")).toBe("profiles");
    });

    it("should handle plural strings", () => {
      expect(pluralize("users")).toBe("users");
      expect(pluralize("profiles")).toBe("profiles");
    });
  });
});
