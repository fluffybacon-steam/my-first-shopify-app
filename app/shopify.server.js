import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.October25,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  future: {
    expiringOfflineAccessTokens: true,
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
  hooks: {
    afterAuth: async ({ session, admin }) => {
      // Ensure the SwiperCard MetaObject is defined
      await ensureSwiperCardDefinition(admin);
    },
  },
});

export default shopify;
export const apiVersion = ApiVersion.October25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;



//defined custom card object

const CREATE_DEFINITION_MUTATION = `
  mutation CreateMetaobjectDefinition($definition: MetaobjectDefinitionCreateInput!) {
    metaobjectDefinitionCreate(definition: $definition) {
      metaobjectDefinition { id type }
      userErrors { field message }
    }
  }
`;

const GET_DEFINITION_QUERY = `
  query GetDefinition($type: String!) {
    metaobjectDefinitionByType(type: $type) {
      id
    }
  }
`;

export async function ensureSwiperCardDefinition(admin) {
  // 1. Check if it already exists
  const checkResponse = await admin.graphql(GET_DEFINITION_QUERY, {
    variables: { type: "my_swiper_card" },
  });
  
  const checkData = await checkResponse.json();
  if (checkData.data.metaobjectDefinitionByType) {
    console.log("SwiperCard definition already exists.");
    return;
  }

  // 2. Create the definition if it doesn't exist
  const response = await admin.graphql(CREATE_DEFINITION_MUTATION, {
    variables: {
      definition: {
        name: "Swiper Card",
        type: "my_swiper_card",
        access: { storefront: "PUBLIC_READ" }, // Important for Liquid/Headless access
        fieldDefinitions: [
          { name: "Title", key: "title", type: "single_line_text_field" },
          { name: "Image", key: "image", type: "file_reference" },
          { name: "Link", key: "link", type: "url" }
        ]
      }
    }
  });

  const result = await response.json();
  if (result.data.metaobjectDefinitionCreate.userErrors.length > 0) {
    console.error("Error creating MetaObject:", result.data.metaobjectDefinitionCreate.userErrors);
  }
}
