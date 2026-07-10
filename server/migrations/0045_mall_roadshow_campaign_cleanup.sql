UPDATE mall_campaigns campaign
SET status = 'inactive',
    updated_at = now()
WHERE campaign.id = '0826bd10-ee84-4e1d-b90b-4cd94ce2cc23'
  AND campaign.campaign_type = 'fixed_price'
  AND campaign.status = 'active'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(campaign.rules->'items') = 'array' THEN campaign.rules->'items'
        ELSE '[]'::jsonb
      END
    ) AS item(value)
    WHERE (
      item.value->>'productId' = 'e69e6643-b792-4fee-b69e-96b882f83d92'
      OR item.value->>'sku' = 'WEB-1781263176096'
    )
      AND COALESCE(
        NULLIF(item.value->>'fixedPriceCents', '')::bigint,
        NULLIF(item.value->>'priceCents', '')::bigint,
        0
      ) = 5
      AND COALESCE(
        NULLIF(item.value->>'badgeText', ''),
        NULLIF(campaign.rules #>> '{badge,text}', ''),
        NULLIF(campaign.rules->>'badgeText', ''),
        ''
      ) = '一口价2'
  );
