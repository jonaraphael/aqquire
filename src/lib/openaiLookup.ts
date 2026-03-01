import { CATEGORY_OPTIONS } from '@/lib/constants';

type Category = (typeof CATEGORY_OPTIONS)[number];

interface TargetDetection {
  canonicalName: string;
  category: Category;
  confidence: number;
  brandHints: string[];
  keyAttributes: string[];
  searchQuery: string;
}

interface PriceEstimateLookup {
  displayName?: string;
  priceEstimate?: number;
  currency?: string;
  priceConfidence?: number;
}

interface OnlineLookup {
  displayName: string;
  heroImageUrl?: string;
  heroImageAlternates?: string[];
  heroImageSource?: string;
  heroImageQuality?: string;
  priceEstimate?: number;
  currency?: string;
  supplierName?: string;
  supplierUrl?: string;
  priceSourceUrl?: string;
  purchasable?: boolean;
  priceConfidence?: number;
  uniqueFlag?: boolean;
}

export interface OpenAiLookupResult {
  displayName: string;
  heroImageUrl: string;
  capturedImageUrl: string;
  category: Category;
  priceEstimate: number;
  currency: string;
  supplierName?: string;
  supplierUrl?: string;
  uniqueFlag: boolean;
  confidence: number;
  canonicalName: string;
  brandHints: string[];
  keyAttributes: string[];
  alternates: string[];
}

export interface OpenAiLookupStageUpdate {
  stage: 'target' | 'price' | 'purchase';
  displayName?: string;
  category?: Category;
  confidence?: number;
  canonicalName?: string;
  brandHints?: string[];
  keyAttributes?: string[];
  priceEstimate?: number;
  currency?: string;
  supplierName?: string;
  supplierUrl?: string;
  heroImageUrl?: string;
}

interface ResponsesPayload {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
}

type ReasoningEffort = 'low' | 'medium' | 'high';

function getOpenAiApiKey() {
  return import.meta.env.VITE_OPENAI_API_KEY || import.meta.env.OPENAI_API_KEY;
}

function normalizeReasoningEffort(input: string | undefined, fallback: ReasoningEffort): ReasoningEffort {
  const value = (input ?? '').trim().toLowerCase();
  if (value === 'low' || value === 'medium' || value === 'high') {
    return value;
  }
  return fallback;
}

function normalizeCategory(input: string | undefined): Category {
  if (!input) return 'Other';
  const matched = CATEGORY_OPTIONS.find((entry) => entry.toLowerCase() === input.trim().toLowerCase());
  return matched ?? 'Other';
}

function normalizeCurrencyCode(input: string | undefined): string | undefined {
  if (!input) return undefined;
  const code = input.trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(code)) return code;
  return undefined;
}

function normalizeWebUrl(input: string | undefined): string | undefined {
  if (!input) return undefined;
  const value = input.trim();
  if (!/^https?:\/\//i.test(value)) return undefined;

  try {
    return new URL(value).toString();
  } catch {
    return undefined;
  }
}

function normalizePriceValue(input: unknown): number | undefined {
  if (typeof input === 'number' && Number.isFinite(input) && input > 0) {
    return input;
  }

  if (typeof input === 'string') {
    const cleaned = input.replace(/[^0-9.]/g, '');
    if (!cleaned) return undefined;
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return undefined;
}

function parseJsonFromText<T>(raw: string): T | null {
  const trimmed = raw.trim();

  const direct = () => {
    try {
      return JSON.parse(trimmed) as T;
    } catch {
      return null;
    }
  };

  const maybeDirect = direct();
  if (maybeDirect) return maybeDirect;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]+?)\s*```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1]) as T;
    } catch {
      return null;
    }
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    try {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1)) as T;
    } catch {
      return null;
    }
  }

  return null;
}

function responseText(payload: ResponsesPayload): string {
  if (typeof payload.output_text === 'string' && payload.output_text.trim().length > 0) {
    return payload.output_text;
  }

  const chunks: string[] = [];
  for (const entry of payload.output ?? []) {
    for (const content of entry.content ?? []) {
      if (content.type === 'output_text' || content.type === 'text') {
        if (typeof content.text === 'string') {
          chunks.push(content.text);
        }
      }
    }
  }
  return chunks.join('\n').trim();
}

async function callResponsesApi(body: Record<string, unknown>): Promise<ResponsesPayload> {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    throw new Error(
      'OpenAI key missing. Set VITE_OPENAI_API_KEY (or OPENAI_API_KEY), then restart the dev server.',
    );
  }

  const request = async (payload: Record<string, unknown>) =>
    fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

  const response = await request(body);

  if (response.ok) {
    return (await response.json()) as ResponsesPayload;
  }

  const detail = await response.text();
  const reasoningRejected =
    typeof body.reasoning !== 'undefined' &&
    /reasoning/i.test(detail) &&
    /(unknown|invalid|unsupported)/i.test(detail);

  if (reasoningRejected) {
    const retryBody = { ...body };
    delete retryBody.reasoning;

    const retry = await request(retryBody);
    if (retry.ok) {
      return (await retry.json()) as ResponsesPayload;
    }
    const retryDetail = await retry.text();
    throw new Error(`OpenAI request failed (${retry.status}) after reasoning fallback: ${retryDetail}`);
  }

  throw new Error(`OpenAI request failed (${response.status}): ${detail}`);
}

async function detectPrimaryTarget(imageDataUrl: string): Promise<TargetDetection> {
  const model = import.meta.env.VITE_OPENAI_VISION_MODEL || 'gpt-5.2';
  const reasoningEffort = normalizeReasoningEffort(import.meta.env.VITE_OPENAI_VISION_REASONING_EFFORT, 'high');
  const payload = await callResponsesApi({
    model,
    reasoning: { effort: reasoningEffort },
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text:
              'Identify the single most prominent primary purchasable object in this image. Ignore people, background, and packaging unless packaging is clearly the product itself. ' +
              'Reason carefully about shape, materials, logo cues, and scale before deciding. Return strict JSON only with keys: canonicalName, category, confidence, brandHints, keyAttributes, searchQuery. ' +
              `category must be one of: ${CATEGORY_OPTIONS.join(', ')}.`,
          },
          {
            type: 'input_image',
            image_url: imageDataUrl,
            detail: 'high',
          },
        ],
      },
    ],
  });

  const text = responseText(payload);
  const parsed = parseJsonFromText<Partial<TargetDetection>>(text);
  if (!parsed) {
    throw new Error('Failed to parse OpenAI target detection response');
  }

  return {
    canonicalName: String(parsed.canonicalName ?? 'Curated Luxury Selection').slice(0, 120),
    category: normalizeCategory(parsed.category),
    confidence: Math.max(0, Math.min(1, Number(parsed.confidence ?? 0.5))),
    brandHints: Array.isArray(parsed.brandHints) ? parsed.brandHints.map((item) => String(item)) : [],
    keyAttributes: Array.isArray(parsed.keyAttributes) ? parsed.keyAttributes.map((item) => String(item)) : [],
    searchQuery: String(parsed.searchQuery ?? parsed.canonicalName ?? 'luxury product'),
  };
}

async function estimateNewPrice(target: TargetDetection): Promise<PriceEstimateLookup> {
  const model = import.meta.env.VITE_OPENAI_SEARCH_MODEL || 'gpt-5.2';
  const reasoningEffort = normalizeReasoningEffort(import.meta.env.VITE_OPENAI_SEARCH_REASONING_EFFORT, 'medium');
  const payload = await callResponsesApi({
    model,
    reasoning: { effort: reasoningEffort },
    tools: [{ type: 'web_search_preview' }],
    input: `Use web search to estimate the current new-market price for this item:
- canonicalName: "${target.canonicalName}"
- category: "${target.category}"
- searchQuery: "${target.searchQuery}"

Return strict JSON only with keys:
displayName, priceEstimate, currency, priceConfidence.

Rules:
- priceEstimate should reflect what a buyer should expect to pay new today.
- Include shipping/tax only if that is the only visible price and state confidence accordingly.
- currency must be a 3-letter ISO code.
- priceConfidence must be 0-1 and reflect certainty that the estimate is current and exact.
- If no reliable estimate exists, return priceEstimate: null.`,
  });

  const text = responseText(payload);
  const parsed = parseJsonFromText<Partial<PriceEstimateLookup>>(text);
  if (!parsed) {
    throw new Error('Failed to parse OpenAI price estimate response');
  }

  return {
    displayName: parsed.displayName ? String(parsed.displayName) : undefined,
    priceEstimate: normalizePriceValue(parsed.priceEstimate),
    currency: normalizeCurrencyCode(parsed.currency ? String(parsed.currency) : undefined) ?? 'USD',
    priceConfidence:
      typeof parsed.priceConfidence === 'number' && Number.isFinite(parsed.priceConfidence)
        ? Math.max(0, Math.min(1, parsed.priceConfidence))
        : undefined,
  };
}

async function lookupPurchaseOffer(target: TargetDetection, estimated: PriceEstimateLookup): Promise<OnlineLookup> {
  const model = import.meta.env.VITE_OPENAI_SEARCH_MODEL || 'gpt-5.2';
  const reasoningEffort = normalizeReasoningEffort(import.meta.env.VITE_OPENAI_SEARCH_REASONING_EFFORT, 'high');
  const payload = await callResponsesApi({
    model,
    reasoning: { effort: reasoningEffort },
    tools: [{ type: 'web_search_preview' }],
    input: `Use web search to find a current purchasable listing for this item:
- canonicalName: "${target.canonicalName}"
- category: "${target.category}"
- searchQuery: "${target.searchQuery}"
- estimatedPrice: ${typeof estimated.priceEstimate === 'number' ? estimated.priceEstimate : 'null'}
- estimatedCurrency: "${estimated.currency ?? 'USD'}"

Return strict JSON only with keys:
displayName, heroImageUrl, heroImageAlternates, heroImageSource, heroImageQuality, supplierName, supplierUrl, priceSourceUrl, priceEstimate, currency, purchasable, priceConfidence, uniqueFlag.

Rules:
- supplierUrl must be a direct listing/product detail page for this exact item.
- For category "Automobiles", supplierUrl may be a dealer inventory page or manufacturer order/reservation page.
- priceEstimate must exactly match the currently listed purchase price shown on priceSourceUrl.
- If no valid purchasable listing with visible price exists, return supplierUrl: null, priceEstimate: null, purchasable: false.
- Prefer official manufacturer stores first, then authorized retailers.
- heroImageUrl must be a direct premium marketing image URL, not a thumbnail.
- Prefer official manufacturer source material for heroImageUrl when possible.
- heroImageAlternates may include up to 3 additional direct image URLs.
- currency must be a 3-letter ISO code.
- priceConfidence must be 0-1 and reflect confidence in exactness/currentness.`,
  });

  const text = responseText(payload);
  const parsed = parseJsonFromText<Partial<OnlineLookup>>(text);
  if (!parsed) {
    throw new Error('Failed to parse OpenAI purchase lookup response');
  }

  return {
    displayName: parsed.displayName ? String(parsed.displayName) : target.canonicalName,
    heroImageUrl: parsed.heroImageUrl ? String(parsed.heroImageUrl) : undefined,
    heroImageAlternates: Array.isArray(parsed.heroImageAlternates)
      ? parsed.heroImageAlternates.map((item) => String(item))
      : undefined,
    heroImageSource: parsed.heroImageSource ? String(parsed.heroImageSource) : undefined,
    heroImageQuality: parsed.heroImageQuality ? String(parsed.heroImageQuality) : undefined,
    priceEstimate: normalizePriceValue(parsed.priceEstimate),
    currency: normalizeCurrencyCode(parsed.currency ? String(parsed.currency) : undefined) ?? estimated.currency ?? 'USD',
    supplierName: parsed.supplierName ? String(parsed.supplierName) : undefined,
    supplierUrl: normalizeWebUrl(parsed.supplierUrl ? String(parsed.supplierUrl) : undefined),
    priceSourceUrl: normalizeWebUrl(parsed.priceSourceUrl ? String(parsed.priceSourceUrl) : undefined),
    purchasable: typeof parsed.purchasable === 'boolean' ? parsed.purchasable : undefined,
    priceConfidence:
      typeof parsed.priceConfidence === 'number' && Number.isFinite(parsed.priceConfidence)
        ? Math.max(0, Math.min(1, parsed.priceConfidence))
        : estimated.priceConfidence,
    uniqueFlag: typeof parsed.uniqueFlag === 'boolean' ? parsed.uniqueFlag : undefined,
  };
}

function normalizeImageUrl(candidate: string | undefined): string | null {
  if (!candidate) return null;
  if (!/^https?:\/\//i.test(candidate)) return null;

  try {
    const url = new URL(candidate);
    const widthParam = url.searchParams.get('w') ?? url.searchParams.get('width');
    const heightParam = url.searchParams.get('h') ?? url.searchParams.get('height');

    if (widthParam && Number(widthParam) > 0 && Number(widthParam) < 1600) {
      url.searchParams.set(url.searchParams.has('w') ? 'w' : 'width', '2200');
    }
    if (heightParam && Number(heightParam) > 0 && Number(heightParam) < 1600) {
      url.searchParams.set(url.searchParams.has('h') ? 'h' : 'height', '2200');
    }
    if (url.searchParams.has('q')) {
      url.searchParams.set('q', '90');
    }
    return url.toString();
  } catch {
    return candidate;
  }
}

function chooseMarketingImageUrl(online: OnlineLookup): string | null {
  const candidates = [online.heroImageUrl, ...(online.heroImageAlternates ?? [])]
    .map((item) => normalizeImageUrl(item))
    .filter((item): item is string => !!item);

  if (candidates.length === 0) return null;

  const preferred = candidates.find((url) => !/thumb|thumbnail|small|icon/i.test(url));
  return preferred ?? candidates[0];
}

function resolvedImageUrl(online: OnlineLookup, capturedImageUrl: string): string {
  const candidate = chooseMarketingImageUrl(online);
  if (candidate) {
    return candidate;
  }
  return capturedImageUrl;
}

function requirePurchasableOffer(online: OnlineLookup) {
  const supplierUrl = normalizeWebUrl(online.priceSourceUrl || online.supplierUrl);
  const priceEstimate = typeof online.priceEstimate === 'number' && Number.isFinite(online.priceEstimate) ? online.priceEstimate : null;

  if (!supplierUrl || priceEstimate === null || priceEstimate <= 0) {
    throw new Error('Unable to verify a purchasable listing with a reliable current price. Try another capture.');
  }

  return {
    supplierUrl,
    priceEstimate: Math.round(priceEstimate),
  };
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Unable to decode image payload'));
    image.src = dataUrl;
  });
}

async function optimizeDataUrlForVision(imageDataUrl: string): Promise<string> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return imageDataUrl;
  }

  if (imageDataUrl.length <= 4_800_000) {
    return imageDataUrl;
  }

  try {
    const image = await loadImage(imageDataUrl);
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    if (width === 0 || height === 0) {
      return imageDataUrl;
    }

    const maxDimension = 1600;
    const scale = Math.min(1, maxDimension / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(width * scale));
    canvas.height = Math.max(1, Math.floor(height * scale));

    const context = canvas.getContext('2d');
    if (!context) {
      return imageDataUrl;
    }

    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.84);
  } catch {
    return imageDataUrl;
  }
}

export async function analyzeWithOpenAiStaged(
  imageDataUrl: string,
  onStage?: (update: OpenAiLookupStageUpdate) => void | Promise<void>,
): Promise<OpenAiLookupResult> {
  const normalizedDataUrl = await optimizeDataUrlForVision(imageDataUrl);

  const target = await detectPrimaryTarget(normalizedDataUrl);
  await onStage?.({
    stage: 'target',
    displayName: target.canonicalName,
    category: target.category,
    confidence: target.confidence,
    canonicalName: target.canonicalName,
    brandHints: target.brandHints,
    keyAttributes: target.keyAttributes,
  });

  const estimated = await estimateNewPrice(target);
  const estimatedPrice =
    typeof estimated.priceEstimate === 'number' && Number.isFinite(estimated.priceEstimate)
      ? Math.round(estimated.priceEstimate)
      : undefined;
  const estimatedCurrency = estimated.currency || 'USD';
  const estimatedDisplayName = estimated.displayName || target.canonicalName;
  await onStage?.({
    stage: 'price',
    displayName: estimatedDisplayName,
    priceEstimate: estimatedPrice,
    currency: estimatedCurrency,
  });

  const online = await lookupPurchaseOffer(target, estimated);
  const purchasableOffer = requirePurchasableOffer(online);
  const resolvedHeroImageUrl = resolvedImageUrl(online, normalizedDataUrl);
  await onStage?.({
    stage: 'purchase',
    displayName: online.displayName || estimatedDisplayName,
    priceEstimate: purchasableOffer.priceEstimate,
    currency: online.currency || estimatedCurrency,
    supplierName: online.supplierName,
    supplierUrl: purchasableOffer.supplierUrl,
    heroImageUrl: resolvedHeroImageUrl,
  });

  return {
    displayName: online.displayName || estimatedDisplayName,
    heroImageUrl: resolvedHeroImageUrl,
    capturedImageUrl: normalizedDataUrl,
    category: target.category,
    priceEstimate: purchasableOffer.priceEstimate,
    currency: online.currency || estimatedCurrency,
    supplierName: online.supplierName,
    supplierUrl: purchasableOffer.supplierUrl,
    uniqueFlag: online.uniqueFlag ?? false,
    confidence: target.confidence,
    canonicalName: target.canonicalName,
    brandHints: target.brandHints,
    keyAttributes: target.keyAttributes,
    alternates: [],
  };
}

export async function analyzeWithOpenAi(imageDataUrl: string): Promise<OpenAiLookupResult> {
  return analyzeWithOpenAiStaged(imageDataUrl);
}
