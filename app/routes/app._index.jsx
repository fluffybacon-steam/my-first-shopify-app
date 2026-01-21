import { useEffect } from "react";
import { useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "generateCard") {
    // 1. Define the card data
    const cardData = {
      image: "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_600x600.png",
      title: "New Summer Collection",
      copy: "Discover our latest high-performance snowboards and gear.",
      backgroundColor: "#f4f4f4",
      fontColor: "#202223",
    };

    try {
      // 2. Get the Shop ID
      const shopQuery = await admin.graphql(`query { shop { id } }`);
      const shopData = await shopQuery.json();
      console.log("Shop data:", shopData);
      const shopId = shopData.data.shop.id;
      console.log("Shop ID:", shopId);

      // 3. Mutation to save the metafield
      const mutation = `
        mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) {
            metafields {
              id
              namespace
              key
              value
            }
            userErrors {
              field
              message
            }
          }
        }
      `;

      const variables = {
        metafields: [
          {
            ownerId: shopId,
            namespace: "my-swiper-slider",
            key: "slider_card",
            type: "json",
            value: JSON.stringify(cardData),
          },
        ],
      };

      console.log("Sending mutation with variables:", variables);

      const response = await admin.graphql(mutation, { variables });

      const responseJson = await response.json();
      console.log("Metafield Save Response:", JSON.stringify(responseJson, null, 2));
      
      // Check for user errors first
      if (responseJson.errors) {
        console.error("GraphQL errors:", responseJson.errors);
        throw new Error(responseJson.errors[0].message);
      }
      
      if (responseJson.data?.metafieldsSet?.userErrors?.length > 0) {
        console.error("Metafield user errors:", responseJson.data.metafieldsSet.userErrors);
        throw new Error(responseJson.data.metafieldsSet.userErrors[0].message);
      }
      
      // Get the saved metafield value from the correct location
      const savedMetafield = responseJson.data?.metafieldsSet?.metafields?.[0];
      const savedCardValue = savedMetafield?.value;

      return { 
        card: savedCardValue ? JSON.parse(savedCardValue) : cardData // Fallback to original cardData
      };
    } catch (error) {
      console.error("Error saving metafield:", error);
      // Return error state
      return {
        error: error.message || "Failed to save card"
      };
    }
  }

  return null;
};

export default function Index() {
  const fetcher = useFetcher();
  const shopify = useAppBridge();
  
  const isLoading = ["loading", "submitting"].includes(fetcher.state) && fetcher.formMethod === "POST";
  const isCardLoading = isLoading && fetcher.formData?.get("intent") === "generateCard";

  const generateCard = () => fetcher.submit({ intent: "generateCard" }, { method: "POST" });
  
  useEffect(() => {
    if (fetcher.data?.card) {
      shopify.toast.show("Card saved to Shopify");
    }
    if (fetcher.data?.error) {
      shopify.toast.show(`Error: ${fetcher.data.error}`, { error: true });
    }
  }, [fetcher.data, shopify]);

  return (
    <s-page heading="My Swiper Slider Admin">
      <s-section heading="Congrats on your new app 🎉">
        <s-paragraph>
          Use this tool to generate and save cards to your Shopify store metafields.
        </s-paragraph>
      </s-section>

      <s-section heading="Create a Slider Card">
        <s-paragraph>
          Click the button below to generate a card object and save it under the 
          <strong> my-swiper-slider</strong> namespace.
        </s-paragraph>
        <s-stack direction="inline" gap="base">
          <s-button
            onClick={generateCard}
            {...(isCardLoading ? { loading: true } : {})}
          >
            Generate & Save Card
          </s-button>
        </s-stack>

        {fetcher.data?.error && (
          <s-box
            padding="base"
            borderWidth="base"
            borderRadius="base"
            background="critical-subdued"
            marginBlockStart="base"
          >
            <s-text variant="bodyMd" tone="critical">
              Error: {fetcher.data.error}
            </s-text>
          </s-box>
        )}

        {fetcher.data?.card && (
          <s-box
            padding="base"
            borderWidth="base"
            borderRadius="base"
            background="subdued"
            marginBlockStart="base"
          >
            <s-text variant="headingMd">Last Generated JSON:</s-text>
            <pre style={{ margin: "10px 0 0 0", fontSize: "12px" }}>
              <code>{JSON.stringify(fetcher.data.card, null, 2)}</code>
            </pre>
          </s-box>
        )}
      </s-section>

      <s-section slot="aside" heading="Metafield Details">
        <s-paragraph>
          <s-text>Namespace: </s-text><code>my-swiper-slider</code>
        </s-paragraph>
        <s-paragraph>
          <s-text>Key: </s-text><code>slider_card</code>
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};