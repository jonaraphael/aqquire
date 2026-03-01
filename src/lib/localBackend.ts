import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { CATEGORY_OPTIONS, VAULT_STATUSES } from '@/lib/constants';
import { useAuth } from '@/lib/auth';
import { analyzeWithOpenAi } from '@/lib/openaiLookup';

const STORAGE_KEY = 'aqquire.local.db.v1';
const MIN_FEED_PRICE = 1000;
const FEED_COMMIT_DEBOUNCE_MS = 10_000;

type Category = (typeof CATEGORY_OPTIONS)[number];
type VaultStatus = (typeof VAULT_STATUSES)[number];
type PaymentType = 'card' | 'bank';
type TrophyProgressType = 'count' | 'percentile' | 'binary';

interface Identity {
  tokenIdentifier: string;
  email?: string;
  name?: string;
  pictureUrl?: string;
}

interface PriceBreakdown {
  baseCost: number;
  shipping: number;
  serviceFee: number;
}

interface UserRecord {
  id: string;
  tokenIdentifier: string;
  createdAt: number;
  displayHandle: string;
  avatarUrl?: string;
  paymentCustomerId?: string;
  defaultPaymentMethodId?: string;
  defaultShippingAddressId?: string;
  lifetimeSpendSettled: number;
  spenderPercentile: number;
  tier: string;
  debugEnabled: boolean;
  followToken: string;
}

interface PaymentMethodRecord {
  id: string;
  userId: string;
  provider: string;
  providerPaymentMethodId: string;
  type: PaymentType;
  label: string;
  last4: string;
  isDefault: boolean;
  createdAt: number;
}

interface ShippingAddressRecord {
  id: string;
  userId: string;
  label: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
  createdAt: number;
}

interface VaultItemRecord {
  id: string;
  userId: string;
  status: VaultStatus;
  displayName: string;
  heroImageUrl: string;
  capturedImageFileId?: string;
  capturedImageUrl?: string;
  category: Category;
  priceEstimate: number;
  currency: string;
  supplierName?: string;
  supplierUrl?: string;
  sourceFeedItemId?: string;
  confidence?: number;
  uniqueFlag: boolean;
  shippingAddressId?: string;
  paymentMethodId?: string;
  debugPriceBreakdown?: PriceBreakdown;
  createdAt: number;
  updatedAt: number;
}

interface FeedItemRecord {
  id: string;
  displayName: string;
  heroImageUrl: string;
  category: Category;
  price: number;
  currency: string;
  primaryUserId?: string;
  primaryUserHandleSnapshot: string;
  primaryUserAvatarUrl?: string;
  associatedCount: number;
  createdAt: number;
  freshnessScore: number;
  sourceVaultItemId?: string;
  minPriceGateEnforced: boolean;
  brand?: string;
  supplierName?: string;
  supplierUrl?: string;
  uniqueFlag?: boolean;
}

interface FollowEdgeRecord {
  id: string;
  followerUserId: string;
  followeeUserId: string;
  createdAt: number;
}

interface TrophyDefinition {
  id: string;
  key: string;
  title: string;
  description: string;
  progressType: TrophyProgressType;
  targetNumber?: number;
  iconAsset: string;
}

interface PolicyVersionRecord {
  id: string;
  effectiveAt: number;
  percentFeeDefault: number;
  percentFeeMax: number;
  text: string;
}

interface VaultCommitLock {
  id: string;
  userId: string;
  feedItemId: string;
  committedAt: number;
}

interface Database {
  schemaVersion: 1;
  sequence: number;
  users: UserRecord[];
  paymentMethods: PaymentMethodRecord[];
  shippingAddresses: ShippingAddressRecord[];
  vaultItems: VaultItemRecord[];
  feedItems: FeedItemRecord[];
  followEdges: FollowEdgeRecord[];
  trophyDefinitions: TrophyDefinition[];
  policyVersions: PolicyVersionRecord[];
  vaultCommitLocks: VaultCommitLock[];
}

interface FeedSeedEntry {
  displayName: string;
  heroImageUrl: string;
  category: Category;
  price: number;
  currency: string;
  brand: string;
}

const TROPHY_DEFINITIONS = [
  {
    key: 'trend_setter',
    title: 'Trend Setter',
    description: 'Inspire one member to add your highlighted item to Vault.',
    progressType: 'count' as TrophyProgressType,
    targetNumber: 1,
    iconAsset: 'spark-crest',
  },
  {
    key: 'market_mover',
    title: 'Market Mover',
    description: 'Reach top 1% spending rank on AQQUIRE.',
    progressType: 'percentile' as TrophyProgressType,
    targetNumber: 1,
    iconAsset: 'market-crown',
  },
  {
    key: 'taste_certified',
    title: 'Taste Certified',
    description: 'Complete five successful AQQUIRE deliveries.',
    progressType: 'count' as TrophyProgressType,
    targetNumber: 5,
    iconAsset: 'taste-seal',
  },
  {
    key: 'delivery_dynamo',
    title: 'Delivery Dynamo',
    description: 'Receive shipped items at two distinct addresses.',
    progressType: 'count' as TrophyProgressType,
    targetNumber: 2,
    iconAsset: 'delivery-star',
  },
  {
    key: 'singular_find',
    title: 'Singular Find',
    description: 'AQQUIRE one item tagged as singular.',
    progressType: 'binary' as TrophyProgressType,
    targetNumber: 1,
    iconAsset: 'singular-gem',
  },
  {
    key: 'bank_patron',
    title: 'Bank Patron',
    description: 'Set a linked bank method as default payment.',
    progressType: 'binary' as TrophyProgressType,
    targetNumber: 1,
    iconAsset: 'bank-vault',
  },
  {
    key: 'high_roller',
    title: 'High Roller',
    description: 'Complete one AQQUIRE worth at least $10,000.',
    progressType: 'binary' as TrophyProgressType,
    targetNumber: 1,
    iconAsset: 'high-roller',
  },
  {
    key: 'vault_baron',
    title: 'Vault Baron',
    description: 'Reach $100,000 in settled lifetime spend.',
    progressType: 'count' as TrophyProgressType,
    targetNumber: 100000,
    iconAsset: 'vault-baron',
  },
  {
    key: 'icon_collector',
    title: 'Icon Collector',
    description: 'Deliver items from five distinct categories.',
    progressType: 'count' as TrophyProgressType,
    targetNumber: 5,
    iconAsset: 'icon-collector',
  },
  {
    key: 'brand_loyalist',
    title: 'Brand Loyalist',
    description: 'Deliver three items from the same brand.',
    progressType: 'count' as TrophyProgressType,
    targetNumber: 3,
    iconAsset: 'brand-loyalist',
  },
  {
    key: 'private_client',
    title: 'Private Client',
    description: 'Reach top 0.1% spending rank.',
    progressType: 'percentile' as TrophyProgressType,
    targetNumber: 0.1,
    iconAsset: 'private-client',
  },
] as const;

const POLICY_TEXT = `AQQUIRE Policy\n\nPricing. You authorize AQQUIRE to charge you our cost plus shipping and handling plus a service fee. The default service fee is 15% of cost.\n\nFee Changes. You agree AQQUIRE may change the service fee at any time, including increasing it up to 100% of cost, with or without notice. The fee in effect at the time you tap AQQUIRE IT will apply.\n\nAuthorization to Charge. By using AQQUIRE and selecting AQQUIRE IT, you authorize AQQUIRE to charge the payment method on file for all amounts due, including applicable taxes, shipping, handling, service fees, and adjustments.\n\nAvailability and Substitutions. Items may be limited, discontinued, mispriced, delayed, or unavailable. You authorize AQQUIRE to cancel, obtain an equivalent item, or request your confirmation, at our sole discretion.\n\nNo Guarantees; Refunds. AQQUIRE does not guarantee delivery dates, third-party representations, condition, or fitness for any purpose. If AQQUIRE cannot deliver an item you paid for, AQQUIRE will refund the charges actually collected for that item, and that refund will be your exclusive remedy.\n\nLimitation of Liability. To the maximum extent permitted by law, AQQUIRE will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages. AQQUIRE's total liability for any claim will not exceed the amounts you paid to AQQUIRE for the specific item giving rise to the claim.\n\nDisputes. You agree to binding arbitration on an individual basis and waive any right to participate in a class action where permitted by law.\n\nTermination. AQQUIRE may suspend or terminate access at any time, for any reason or no reason.\n\nChanges. AQQUIRE may update these terms at any time. Continued use means you accept the updated terms.`;

const FEED_SEED: FeedSeedEntry[] = [
  {
    displayName: 'Crocodile Top Handle',
    heroImageUrl:
      'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?auto=format&fit=crop&w=1200&q=80',
    category: 'Handbags',
    price: 6200,
    currency: 'USD',
    brand: 'Maison Aureline',
  },
  {
    displayName: 'Perpetual Rose Gold Chronograph',
    heroImageUrl:
      'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?auto=format&fit=crop&w=1200&q=80',
    category: 'Timepieces',
    price: 15800,
    currency: 'USD',
    brand: 'Atelier Meridian',
  },
  {
    displayName: 'Grand Touring Coupe Reservation',
    heroImageUrl:
      'https://images.unsplash.com/photo-1542362567-b07e54358753?auto=format&fit=crop&w=1200&q=80',
    category: 'Automobiles',
    price: 242000,
    currency: 'USD',
    brand: 'Sovereign Motors',
  },
  {
    displayName: 'Sapphire Riviera Necklace',
    heroImageUrl:
      'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=1200&q=80',
    category: 'Jewelry',
    price: 11800,
    currency: 'USD',
    brand: 'Seraphine',
  },
  {
    displayName: 'Signed Modernist Lithograph',
    heroImageUrl:
      'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=1200&q=80',
    category: 'Art',
    price: 7200,
    currency: 'USD',
    brand: 'Galerie Nova',
  },
  {
    displayName: 'Hand-Stitched Calfskin Loafers',
    heroImageUrl:
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=80',
    category: 'Footwear',
    price: 1800,
    currency: 'USD',
    brand: 'Valenor',
  },
  {
    displayName: 'Cashmere Longline Coat',
    heroImageUrl:
      'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1200&q=80',
    category: 'Outerwear',
    price: 3200,
    currency: 'USD',
    brand: 'Noire Atelier',
  },
  {
    displayName: 'Marble Halo Floor Lamp',
    heroImageUrl:
      'https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=1200&q=80',
    category: 'Home',
    price: 2900,
    currency: 'USD',
    brand: 'Studio Lumen',
  },
  {
    displayName: 'Titanium Flagship Foldable',
    heroImageUrl:
      'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=1200&q=80',
    category: 'Tech',
    price: 2200,
    currency: 'USD',
    brand: 'Onyx Systems',
  },
  {
    displayName: 'Mediterranean Grand Suite Week',
    heroImageUrl:
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
    category: 'Travel',
    price: 9100,
    currency: 'USD',
    brand: 'Aurelia Voyages',
  },
  {
    displayName: 'Chef Table Midnight Seating',
    heroImageUrl:
      'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1200&q=80',
    category: 'Experiences',
    price: 1250,
    currency: 'USD',
    brand: 'Private Passage',
  },
  {
    displayName: 'Collector Edition Fountain Pen',
    heroImageUrl:
      'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=1200&q=80',
    category: 'Other',
    price: 1350,
    currency: 'USD',
    brand: 'Arc Signature',
  },
];


function freshDatabase(): Database {
  return {
    schemaVersion: 1,
    sequence: 0,
    users: [],
    paymentMethods: [],
    shippingAddresses: [],
    vaultItems: [],
    feedItems: [],
    followEdges: [],
    trophyDefinitions: [],
    policyVersions: [],
    vaultCommitLocks: [],
  };
}

function cloneDatabase(db: Database): Database {
  const structured = (globalThis as { structuredClone?: <T>(value: T) => T }).structuredClone;
  if (structured) {
    return structured(db);
  }
  return JSON.parse(JSON.stringify(db)) as Database;
}

function parseDatabase(raw: string | null): Database {
  if (!raw) return freshDatabase();
  try {
    const parsed = JSON.parse(raw) as Partial<Database>;
    if (parsed.schemaVersion !== 1) return freshDatabase();
    return {
      schemaVersion: 1,
      sequence: typeof parsed.sequence === 'number' ? parsed.sequence : 0,
      users: Array.isArray(parsed.users) ? parsed.users : [],
      paymentMethods: Array.isArray(parsed.paymentMethods) ? parsed.paymentMethods : [],
      shippingAddresses: Array.isArray(parsed.shippingAddresses) ? parsed.shippingAddresses : [],
      vaultItems: Array.isArray(parsed.vaultItems) ? parsed.vaultItems : [],
      feedItems: Array.isArray(parsed.feedItems) ? parsed.feedItems : [],
      followEdges: Array.isArray(parsed.followEdges) ? parsed.followEdges : [],
      trophyDefinitions: Array.isArray(parsed.trophyDefinitions) ? parsed.trophyDefinitions : [],
      policyVersions: Array.isArray(parsed.policyVersions) ? parsed.policyVersions : [],
      vaultCommitLocks: Array.isArray(parsed.vaultCommitLocks) ? parsed.vaultCommitLocks : [],
    };
  } catch {
    return freshDatabase();
  }
}

function loadDatabaseFromStorage(): Database {
  if (typeof window === 'undefined') {
    return freshDatabase();
  }
  return parseDatabase(window.localStorage.getItem(STORAGE_KEY));
}

let databaseState: Database = loadDatabaseFromStorage();
const listeners = new Set<() => void>();
let storageListenerInitialized = false;

function initializeStorageListener() {
  if (storageListenerInitialized || typeof window === 'undefined') {
    return;
  }

  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return;
    databaseState = parseDatabase(event.newValue);
    for (const listener of listeners) {
      listener();
    }
  });

  storageListenerInitialized = true;
}

initializeStorageListener();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return databaseState;
}

function persistDatabase(next: Database) {
  databaseState = next;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  for (const listener of listeners) {
    listener();
  }
}

function mutateDatabase<T>(mutator: (draft: Database) => T): T {
  const draft = cloneDatabase(databaseState);
  const result = mutator(draft);
  persistDatabase(draft);
  return result;
}

function createId(db: Database, prefix: string) {
  db.sequence += 1;
  return `${prefix}_${db.sequence.toString(36)}`;
}

function percentileToTier(percentile: number) {
  if (percentile <= 0.1) return 'Private Client';
  if (percentile <= 1) return 'Icon Tier';
  if (percentile <= 5) return 'Velvet Tier';
  if (percentile <= 20) return 'Obsidian Tier';
  return 'Pearl Tier';
}

function handleFromIdentity(identity: Identity) {
  if (identity.email) {
    const local = identity.email.split('@')[0]?.toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (local && local.length >= 3) return `@${local.slice(0, 18)}`;
  }
  if (identity.name) {
    const clean = identity.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (clean.length >= 3) return `@${clean.slice(0, 18)}`;
  }
  return `@member_${Math.floor(Math.random() * 9_999_999)
    .toString()
    .padStart(7, '0')}`;
}

function newFollowToken() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    const segment = () => crypto.randomUUID().replace(/-/g, '');
    return `${segment()}${segment()}`;
  }
  const fallback = () => Math.random().toString(16).slice(2, 18);
  return `${fallback()}${fallback()}`;
}

function useIdentity(): Identity | null {
  const { user } = useAuth();

  return useMemo(() => {
    if (!user) return null;

    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();

    return {
      tokenIdentifier: user.id,
      email: user.email || undefined,
      name: fullName || undefined,
      pictureUrl: user.profilePictureUrl || undefined,
    };
  }, [user]);
}

function getViewerOrNull(db: Database, tokenIdentifier: string) {
  return db.users.find((row) => row.tokenIdentifier === tokenIdentifier) ?? null;
}

function requireViewer(db: Database, identity: Identity): UserRecord {
  const viewer = getViewerOrNull(db, identity.tokenIdentifier);
  if (!viewer) {
    throw new Error('User not initialized');
  }
  return viewer;
}

function ensureViewerInDatabase(db: Database, identity: Identity) {
  const existing = getViewerOrNull(db, identity.tokenIdentifier);
  if (existing) {
    return existing.id;
  }

  const initialPercentile = Number((Math.random() * 45 + 1).toFixed(1));
  const userId = createId(db, 'usr');

  db.users.push({
    id: userId,
    tokenIdentifier: identity.tokenIdentifier,
    createdAt: Date.now(),
    displayHandle: handleFromIdentity(identity),
    avatarUrl: identity.pictureUrl,
    paymentCustomerId: undefined,
    defaultPaymentMethodId: undefined,
    defaultShippingAddressId: undefined,
    lifetimeSpendSettled: 0,
    spenderPercentile: initialPercentile,
    tier: percentileToTier(initialPercentile),
    debugEnabled: false,
    followToken: newFollowToken(),
  });

  return userId;
}

function seedInitialDataInDatabase(db: Database, identity: Identity, force = false) {
  const viewerId = ensureViewerInDatabase(db, identity);
  const viewer = db.users.find((row) => row.id === viewerId);

  if (!viewer) {
    throw new Error('Call ensureViewer before seeding data');
  }

  if (force || db.trophyDefinitions.length === 0) {
    db.trophyDefinitions = TROPHY_DEFINITIONS.map((trophy) => ({
      id: createId(db, 'trpdef'),
      key: trophy.key,
      title: trophy.title,
      description: trophy.description,
      progressType: trophy.progressType,
      targetNumber: trophy.targetNumber,
      iconAsset: trophy.iconAsset,
    }));
  }

  if (force || db.policyVersions.length === 0) {
    db.policyVersions = [
      {
        id: createId(db, 'pol'),
        effectiveAt: Date.now(),
        percentFeeDefault: 15,
        percentFeeMax: 100,
        text: POLICY_TEXT,
      },
    ];
  }

  if (force || db.feedItems.length === 0) {
    db.feedItems = [];
    const now = Date.now();

    FEED_SEED.forEach((entry, index) => {
      db.feedItems.push({
        id: createId(db, 'feed'),
        displayName: entry.displayName,
        heroImageUrl: entry.heroImageUrl,
        category: entry.category,
        price: Math.max(entry.price, MIN_FEED_PRICE),
        currency: entry.currency,
        primaryUserId: viewer.id,
        primaryUserHandleSnapshot: viewer.displayHandle,
        primaryUserAvatarUrl: viewer.avatarUrl,
        associatedCount: 1,
        createdAt: now - index * 35_000,
        freshnessScore: now - index * 35_000,
        sourceVaultItemId: undefined,
        minPriceGateEnforced: true,
        brand: entry.brand,
        supplierName: 'Private Source',
        supplierUrl: 'https://aqquire.example/source',
        uniqueFlag: index % 8 === 0,
      });
    });
  }

  return {
    categoriesSeeded: CATEGORY_OPTIONS.length,
    feedCount: db.feedItems.length,
    trophiesCount: db.trophyDefinitions.length,
  };
}

export interface ViewerContext {
  user: UserRecord;
  defaultPaymentMethod: PaymentMethodRecord | null;
  defaultShippingAddress: ShippingAddressRecord | null;
  paymentMethods: PaymentMethodRecord[];
  addresses: ShippingAddressRecord[];
}

interface FeedDebugInfo {
  supplierName?: string;
  supplierUrl?: string;
  uniqueFlag?: boolean;
}

export interface FeedListItem {
  _id: string;
  displayName: string;
  heroImageUrl: string;
  category: Category;
  price: number;
  currency: string;
  whoHandle: string;
  whoAvatarUrl?: string;
  associatedCount: number;
  stamp: 'AQQUIRE';
  debug: FeedDebugInfo | null;
}

export interface FeedListResult {
  items: FeedListItem[];
  nextCursor: number | null;
  hasMore: boolean;
}

interface FeedQueryArgs {
  categories: Category[];
  limit?: number;
  cursor?: number;
  debug?: boolean;
}

function listFeedInDatabase(db: Database, identity: Identity, args: FeedQueryArgs): FeedListResult {
  const viewer = requireViewer(db, identity);
  const debugMode = !!args.debug && viewer.debugEnabled;

  const all = [...db.feedItems].sort((a, b) => b.freshnessScore - a.freshnessScore);
  const allowed = new Set(args.categories);
  const filtered = all.filter((item) => item.price >= MIN_FEED_PRICE && allowed.has(item.category));

  const limit = Math.max(1, Math.min(args.limit ?? 12, 24));
  const cursor = Math.max(0, args.cursor ?? 0);
  const page = filtered.slice(cursor, cursor + limit);

  return {
    items: page.map((item) => ({
      _id: item.id,
      displayName: item.displayName,
      heroImageUrl: item.heroImageUrl,
      category: item.category,
      price: item.price,
      currency: item.currency,
      whoHandle: item.primaryUserHandleSnapshot,
      whoAvatarUrl: item.primaryUserAvatarUrl,
      associatedCount: item.associatedCount,
      stamp: 'AQQUIRE',
      debug: debugMode
        ? {
            supplierName: item.supplierName,
            supplierUrl: item.supplierUrl,
            uniqueFlag: item.uniqueFlag,
          }
        : null,
    })),
    nextCursor: cursor + limit < filtered.length ? cursor + limit : null,
    hasMore: cursor + limit < filtered.length,
  };
}

interface CommitFeedArgs {
  feedItemId: string;
  interaction: 'swipe';
}

interface VaultDuplicateKey {
  sourceFeedItemId?: string;
  displayName: string;
  category: Category;
  priceEstimate: number;
  currency: string;
}

function normalizeLabel(value: string) {
  return value.trim().toLowerCase();
}

function findDuplicateVaultItem(db: Database, userId: string, key: VaultDuplicateKey) {
  return db.vaultItems.find((item) => {
    if (item.userId !== userId) return false;

    if (key.sourceFeedItemId && item.sourceFeedItemId === key.sourceFeedItemId) {
      return true;
    }

    return (
      normalizeLabel(item.displayName) === normalizeLabel(key.displayName) &&
      item.category === key.category &&
      Math.round(item.priceEstimate) === Math.round(key.priceEstimate) &&
      item.currency.toUpperCase() === key.currency.toUpperCase()
    );
  });
}

function commitFeedItemToVaultInDatabase(db: Database, identity: Identity, args: CommitFeedArgs) {
  const viewer = requireViewer(db, identity);
  const feedItem = db.feedItems.find((item) => item.id === args.feedItemId);

  if (!feedItem) {
    throw new Error('Feed item not found');
  }
  if (feedItem.price < MIN_FEED_PRICE) {
    throw new Error('Feed price gate violation');
  }

  const now = Date.now();

  const recentLock = db.vaultCommitLocks.find(
    (lock) => lock.userId === viewer.id && lock.feedItemId === feedItem.id && now - lock.committedAt < FEED_COMMIT_DEBOUNCE_MS,
  );

  if (recentLock) {
    return {
      created: false,
      reason: 'debounced',
    };
  }

  db.vaultCommitLocks.push({
    id: createId(db, 'vlock'),
    userId: viewer.id,
    feedItemId: feedItem.id,
    committedAt: now,
  });

  const recentPending = db.vaultItems.find(
    (item) =>
      item.userId === viewer.id &&
      item.sourceFeedItemId === feedItem.id &&
      item.status === 'pending' &&
      now - item.createdAt < FEED_COMMIT_DEBOUNCE_MS,
  );

  if (recentPending) {
    return {
      created: false,
      reason: 'existing_pending',
      vaultItemId: recentPending.id,
    };
  }

  const duplicate = findDuplicateVaultItem(db, viewer.id, {
    sourceFeedItemId: feedItem.id,
    displayName: feedItem.displayName,
    category: feedItem.category,
    priceEstimate: feedItem.price,
    currency: feedItem.currency,
  });

  if (duplicate) {
    return {
      created: false,
      reason: 'duplicate',
      vaultItemId: duplicate.id,
    };
  }

  const vaultItemId = createId(db, 'vlt');

  db.vaultItems.push({
    id: vaultItemId,
    userId: viewer.id,
    status: 'pending',
    displayName: feedItem.displayName,
    heroImageUrl: feedItem.heroImageUrl,
    capturedImageFileId: undefined,
    capturedImageUrl: undefined,
    category: feedItem.category,
    priceEstimate: feedItem.price,
    currency: feedItem.currency,
    supplierName: feedItem.supplierName,
    supplierUrl: feedItem.supplierUrl,
    sourceFeedItemId: feedItem.id,
    confidence: undefined,
    uniqueFlag: feedItem.uniqueFlag ?? false,
    shippingAddressId: viewer.defaultShippingAddressId,
    paymentMethodId: viewer.defaultPaymentMethodId,
    debugPriceBreakdown: {
      baseCost: Number((feedItem.price * 0.78).toFixed(2)),
      shipping: Number((feedItem.price * 0.03).toFixed(2)),
      serviceFee: Number((feedItem.price * 0.19).toFixed(2)),
    },
    createdAt: now,
    updatedAt: now,
  });

  feedItem.primaryUserId = viewer.id;
  feedItem.primaryUserHandleSnapshot = viewer.displayHandle;
  feedItem.primaryUserAvatarUrl = viewer.avatarUrl;
  feedItem.associatedCount = Math.max(feedItem.associatedCount, 0) + 1;

  return {
    created: true,
    interaction: args.interaction,
    vaultItemId,
  };
}

interface FollowByTokenArgs {
  followToken: string;
}

function followByTokenInDatabase(db: Database, identity: Identity, args: FollowByTokenArgs) {
  const viewer = requireViewer(db, identity);
  const followee = db.users.find((user) => user.followToken === args.followToken);

  if (!followee) {
    throw new Error('Follow token not recognized');
  }

  if (followee.id === viewer.id) {
    return { followed: false, reason: 'self' as const };
  }

  const existing = db.followEdges.find(
    (edge) => edge.followerUserId === viewer.id && edge.followeeUserId === followee.id,
  );

  if (existing) {
    return {
      followed: false,
      reason: 'already_following' as const,
      handle: followee.displayHandle,
    };
  }

  db.followEdges.push({
    id: createId(db, 'fedge'),
    followerUserId: viewer.id,
    followeeUserId: followee.id,
    createdAt: Date.now(),
  });

  return {
    followed: true,
    handle: followee.displayHandle,
  };
}

interface VaultListItem {
  _id: string;
  status: VaultStatus;
  displayName: string;
  heroImageUrl: string;
  priceEstimate: number;
  currency: string;
  category: Category;
  createdAt: number;
  canCancel: boolean;
  debug: {
    supplierName?: string;
    supplierUrl?: string;
    confidence?: number;
    priceBreakdown?: PriceBreakdown;
  } | null;
}

function listVaultInDatabase(db: Database, identity: Identity, debug: boolean | undefined): VaultListItem[] {
  const viewer = requireViewer(db, identity);
  const debugMode = !!debug && viewer.debugEnabled;

  return db.vaultItems
    .filter((item) => item.userId === viewer.id)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((item) => ({
      _id: item.id,
      status: item.status,
      displayName: item.displayName,
      heroImageUrl: item.heroImageUrl,
      priceEstimate: item.priceEstimate,
      currency: item.currency,
      category: item.category,
      createdAt: item.createdAt,
      canCancel: item.status === 'pending',
      debug: debugMode
        ? {
            supplierName: item.supplierName,
            supplierUrl: item.supplierUrl,
            confidence: item.confidence,
            priceBreakdown: item.debugPriceBreakdown,
          }
        : null,
    }));
}

function cancelPendingVaultItemInDatabase(db: Database, identity: Identity, vaultItemId: string) {
  const viewer = requireViewer(db, identity);
  const item = db.vaultItems.find((entry) => entry.id === vaultItemId);

  if (!item || item.userId !== viewer.id) {
    throw new Error('Vault item not found');
  }

  if (item.status !== 'pending') {
    return { canceled: false, reason: 'not_pending' as const };
  }

  item.status = 'canceled';
  item.updatedAt = Date.now();

  return { canceled: true };
}

interface ProfileResult {
  displayHandle: string;
  avatarUrl?: string;
  spenderPercentile: number;
  tier: string;
  followToken: string;
  followUri: string;
  lifetimeSpendSettled: number;
  debugEnabled: boolean;
  defaultPaymentMethod: PaymentMethodRecord | null;
  defaultShippingAddress: ShippingAddressRecord | null;
  vaultSetupComplete: boolean;
}

function profileInDatabase(db: Database, identity: Identity): ProfileResult {
  const viewer = requireViewer(db, identity);

  const defaultPaymentMethod = viewer.defaultPaymentMethodId
    ? db.paymentMethods.find((item) => item.id === viewer.defaultPaymentMethodId) ?? null
    : null;

  const defaultShippingAddress = viewer.defaultShippingAddressId
    ? db.shippingAddresses.find((item) => item.id === viewer.defaultShippingAddressId) ?? null
    : null;

  return {
    displayHandle: viewer.displayHandle,
    avatarUrl: viewer.avatarUrl,
    spenderPercentile: viewer.spenderPercentile,
    tier: viewer.tier,
    followToken: viewer.followToken,
    followUri: `aqquire://follow/${viewer.followToken}`,
    lifetimeSpendSettled: viewer.lifetimeSpendSettled,
    debugEnabled: viewer.debugEnabled,
    defaultPaymentMethod,
    defaultShippingAddress,
    vaultSetupComplete: !!viewer.defaultPaymentMethodId && !!viewer.defaultShippingAddressId,
  };
}

interface PolicyResult {
  effectiveAt: number;
  percentFeeDefault: number;
  percentFeeMax: number;
  text: string;
}

function policyInDatabase(db: Database): PolicyResult {
  if (db.policyVersions.length === 0) {
    return {
      effectiveAt: Date.now(),
      percentFeeDefault: 15,
      percentFeeMax: 100,
      text: POLICY_TEXT,
    };
  }

  return [...db.policyVersions]
    .sort((a, b) => b.effectiveAt - a.effectiveAt)
    .map((row) => ({
      effectiveAt: row.effectiveAt,
      percentFeeDefault: row.percentFeeDefault,
      percentFeeMax: row.percentFeeMax,
      text: row.text,
    }))[0];
}

interface TrophyResultItem {
  key: string;
  title: string;
  description: string;
  progressType: TrophyProgressType;
  progressCurrent: number;
  progressTarget?: number;
  unlocked: boolean;
  iconAsset: string;
}

interface TrophyCaseResult {
  trophies: TrophyResultItem[];
  debugReadout: {
    trendSetterCount: number;
    successfulCount: number;
    distinctAddresses: number;
    settledSpend: number;
    categoryDelivered: number;
    spenderPercentile: number;
  } | null;
}

function trophyCaseInDatabase(db: Database, identity: Identity, debug: boolean | undefined): TrophyCaseResult {
  const viewer = requireViewer(db, identity);
  const debugMode = !!debug && viewer.debugEnabled;

  const items = db.vaultItems.filter((item) => item.userId === viewer.id);

  const settledStatuses = new Set<VaultStatus>(['ordered', 'shipped', 'delivered']);
  const deliveredOrShipped = items.filter((item) => item.status === 'shipped' || item.status === 'delivered');
  const successful = items.filter((item) => settledStatuses.has(item.status));

  const distinctAddresses = new Set(
    deliveredOrShipped.map((item) => item.shippingAddressId).filter((value): value is string => !!value),
  ).size;

  const uniqueFound = items.some((item) => item.uniqueFlag);
  const highRoller = items.some((item) => settledStatuses.has(item.status) && item.priceEstimate >= 10_000);
  const settledSpend = successful.reduce((sum, item) => sum + item.priceEstimate, viewer.lifetimeSpendSettled);

  const categoryDelivered = new Set(items.filter((item) => item.status === 'delivered').map((item) => item.category)).size;

  const sourceFeedIds = new Set(items.map((item) => item.sourceFeedItemId).filter((id): id is string => !!id));

  const trendSetterCount = db.vaultItems.filter(
    (item) => item.userId !== viewer.id && item.status === 'pending' && !!item.sourceFeedItemId && sourceFeedIds.has(item.sourceFeedItemId),
  ).length;

  const byBrand = new Map<string, number>();
  for (const item of items) {
    if (!item.sourceFeedItemId || item.status !== 'delivered') continue;
    const source = db.feedItems.find((feedItem) => feedItem.id === item.sourceFeedItemId);
    const brand = source?.brand;
    if (!brand) continue;
    byBrand.set(brand, (byBrand.get(brand) ?? 0) + 1);
  }

  const brandLoyalist = Array.from(byBrand.values()).some((count) => count >= 3);

  const payment = viewer.defaultPaymentMethodId
    ? db.paymentMethods.find((item) => item.id === viewer.defaultPaymentMethodId) ?? null
    : null;

  const trophies = TROPHY_DEFINITIONS.map((definition, index) => {
    let progressCurrent = 0;
    let progressTarget = definition.targetNumber ?? undefined;
    let unlocked = false;

    switch (definition.key) {
      case 'trend_setter': {
        progressCurrent = Math.min(trendSetterCount, 1);
        unlocked = trendSetterCount >= 1;
        break;
      }
      case 'market_mover': {
        progressCurrent = Number(viewer.spenderPercentile.toFixed(3));
        progressTarget = 1;
        unlocked = viewer.spenderPercentile <= 1;
        break;
      }
      case 'taste_certified': {
        progressCurrent = successful.length;
        progressTarget = 5;
        unlocked = successful.length >= 5;
        break;
      }
      case 'delivery_dynamo': {
        progressCurrent = distinctAddresses;
        progressTarget = 2;
        unlocked = distinctAddresses >= 2;
        break;
      }
      case 'singular_find': {
        progressCurrent = uniqueFound ? 1 : 0;
        progressTarget = 1;
        unlocked = uniqueFound;
        break;
      }
      case 'bank_patron': {
        progressCurrent = payment?.type === 'bank' ? 1 : 0;
        progressTarget = 1;
        unlocked = payment?.type === 'bank';
        break;
      }
      case 'high_roller': {
        progressCurrent = highRoller ? 1 : 0;
        progressTarget = 1;
        unlocked = highRoller;
        break;
      }
      case 'vault_baron': {
        progressCurrent = Number(settledSpend.toFixed(2));
        progressTarget = 100000;
        unlocked = settledSpend >= 100000;
        break;
      }
      case 'icon_collector': {
        progressCurrent = categoryDelivered;
        progressTarget = 5;
        unlocked = categoryDelivered >= 5;
        break;
      }
      case 'brand_loyalist': {
        progressCurrent = brandLoyalist ? 1 : 0;
        progressTarget = 1;
        unlocked = brandLoyalist;
        break;
      }
      case 'private_client': {
        progressCurrent = Number(viewer.spenderPercentile.toFixed(3));
        progressTarget = 0.1;
        unlocked = viewer.spenderPercentile <= 0.1;
        break;
      }
      default:
        break;
    }

    const qaUnlocked = debugMode && index % 3 === 0;

    return {
      key: definition.key,
      title: definition.title,
      description: definition.description,
      progressType: definition.progressType,
      progressCurrent,
      progressTarget,
      unlocked: qaUnlocked || unlocked,
      iconAsset: definition.iconAsset,
    };
  });

  return {
    trophies,
    debugReadout: debugMode
      ? {
          trendSetterCount,
          successfulCount: successful.length,
          distinctAddresses,
          settledSpend,
          categoryDelivered,
          spenderPercentile: viewer.spenderPercentile,
        }
      : null,
  };
}

interface SaveVaultSetupArgs {
  paymentType: PaymentType;
  paymentLabel: string;
  paymentLast4: string;
  addressLabel: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

function saveVaultSetupInDatabase(db: Database, identity: Identity, args: SaveVaultSetupArgs) {
  const viewer = requireViewer(db, identity);

  const createdAt = Date.now();

  const addressId = createId(db, 'addr');
  db.shippingAddresses.push({
    id: addressId,
    userId: viewer.id,
    label: args.addressLabel,
    line1: args.line1,
    line2: args.line2,
    city: args.city,
    state: args.state,
    postalCode: args.postalCode,
    country: args.country,
    isDefault: true,
    createdAt,
  });

  const paymentMethodId = createId(db, 'pay');
  db.paymentMethods.push({
    id: paymentMethodId,
    userId: viewer.id,
    provider: 'stripe',
    providerPaymentMethodId: `pm_demo_${Math.floor(Math.random() * 1_000_000_000)}`,
    type: args.paymentType,
    label: args.paymentLabel,
    last4: args.paymentLast4,
    isDefault: true,
    createdAt,
  });

  for (const method of db.paymentMethods) {
    if (method.userId === viewer.id && method.id !== paymentMethodId && method.isDefault) {
      method.isDefault = false;
    }
  }

  for (const address of db.shippingAddresses) {
    if (address.userId === viewer.id && address.id !== addressId && address.isDefault) {
      address.isDefault = false;
    }
  }

  viewer.defaultPaymentMethodId = paymentMethodId;
  viewer.defaultShippingAddressId = addressId;
  viewer.paymentCustomerId = viewer.paymentCustomerId ?? `cus_demo_${viewer.id}`;

  return { paymentMethodId, addressId };
}

function rotateFollowTokenInDatabase(db: Database, identity: Identity) {
  const viewer = requireViewer(db, identity);
  const token = newFollowToken();
  viewer.followToken = token;
  return token;
}

function setDebugEnabledInDatabase(db: Database, identity: Identity, enabled: boolean) {
  const viewer = requireViewer(db, identity);
  viewer.debugEnabled = enabled;
  return enabled;
}

export interface CaptureResult {
  displayName: string;
  heroImageUrl: string;
  capturedImageUrl?: string;
  category: Category;
  priceEstimate: number;
  currency: string;
  supplierName?: string;
  supplierUrl?: string;
  uniqueFlag: boolean;
  confidence?: number;
  canonicalName: string;
  brandHints: string[];
  keyAttributes: string[];
  alternates: string[];
  debugPriceBreakdown?: PriceBreakdown;
}

interface AqquireItArgs {
  displayName: string;
  heroImageUrl: string;
  capturedImageUrl?: string;
  category: Category;
  priceEstimate: number;
  currency: string;
  supplierName?: string;
  supplierUrl?: string;
  uniqueFlag: boolean;
  confidence?: number;
  debugPriceBreakdown?: PriceBreakdown;
}

function aqquireItInDatabase(db: Database, identity: Identity, args: AqquireItArgs) {
  const viewer = requireViewer(db, identity);
  const createdAt = Date.now();

  const duplicate = findDuplicateVaultItem(db, viewer.id, {
    displayName: args.displayName,
    category: args.category,
    priceEstimate: args.priceEstimate,
    currency: args.currency,
  });

  if (duplicate) {
    return {
      vaultItemId: duplicate.id,
      toast: 'Already in Vault',
      created: false,
    };
  }

  const vaultItemId = createId(db, 'vlt');
  db.vaultItems.push({
    id: vaultItemId,
    userId: viewer.id,
    status: 'pending',
    displayName: args.displayName,
    heroImageUrl: args.heroImageUrl,
    capturedImageFileId: undefined,
    capturedImageUrl: args.capturedImageUrl,
    category: args.category,
    priceEstimate: args.priceEstimate,
    currency: args.currency,
    supplierName: args.supplierName,
    supplierUrl: args.supplierUrl,
    sourceFeedItemId: undefined,
    confidence: args.confidence,
    uniqueFlag: args.uniqueFlag,
    shippingAddressId: viewer.defaultShippingAddressId,
    paymentMethodId: viewer.defaultPaymentMethodId,
    debugPriceBreakdown: args.debugPriceBreakdown,
    createdAt,
    updatedAt: createdAt,
  });

  if (args.priceEstimate >= MIN_FEED_PRICE) {
    db.feedItems.push({
      id: createId(db, 'feed'),
      displayName: args.displayName,
      heroImageUrl: args.heroImageUrl,
      category: args.category,
      price: args.priceEstimate,
      currency: args.currency,
      primaryUserId: viewer.id,
      primaryUserHandleSnapshot: viewer.displayHandle,
      primaryUserAvatarUrl: viewer.avatarUrl,
      associatedCount: 1,
      createdAt,
      freshnessScore: createdAt,
      sourceVaultItemId: vaultItemId,
      minPriceGateEnforced: true,
      brand: undefined,
      supplierName: args.supplierName,
      supplierUrl: args.supplierUrl,
      uniqueFlag: args.uniqueFlag,
    });
  }

  return {
    vaultItemId,
    toast: 'In Vault',
    created: true,
  };
}

interface CheckoutArgs {
  successUrl: string;
  cancelUrl: string;
}

function createVaultSetupCheckoutLocally(args: CheckoutArgs) {
  const configuredUrl = import.meta.env.VITE_STRIPE_SETUP_URL;
  if (configuredUrl) {
    return {
      url: configuredUrl,
      sessionId: `local_${Date.now()}`,
      publishableKey: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? null,
      successUrl: args.successUrl,
      cancelUrl: args.cancelUrl,
    };
  }

  throw new Error('Stripe setup unavailable without backend configuration');
}

function useDatabaseSnapshot() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useEnsureViewer() {
  const identity = useIdentity();

  return useCallback(async () => {
    if (!identity) {
      throw new Error('Not authenticated');
    }

    return mutateDatabase((db) => ensureViewerInDatabase(db, identity));
  }, [identity]);
}

export function useSeedInitialData() {
  const identity = useIdentity();

  return useCallback(
    async (args: { force?: boolean }) => {
      if (!identity) {
        throw new Error('Not authenticated');
      }

      return mutateDatabase((db) => seedInitialDataInDatabase(db, identity, !!args.force));
    },
    [identity],
  );
}

export function useViewerContext() {
  const db = useDatabaseSnapshot();
  const identity = useIdentity();

  return useMemo<ViewerContext | undefined>(() => {
    if (!identity) return undefined;
    const user = getViewerOrNull(db, identity.tokenIdentifier);
    if (!user) return undefined;

    const defaultPaymentMethod = user.defaultPaymentMethodId
      ? db.paymentMethods.find((entry) => entry.id === user.defaultPaymentMethodId) ?? null
      : null;

    const defaultShippingAddress = user.defaultShippingAddressId
      ? db.shippingAddresses.find((entry) => entry.id === user.defaultShippingAddressId) ?? null
      : null;

    return {
      user,
      defaultPaymentMethod,
      defaultShippingAddress,
      paymentMethods: db.paymentMethods.filter((entry) => entry.userId === user.id),
      addresses: db.shippingAddresses.filter((entry) => entry.userId === user.id),
    };
  }, [db, identity]);
}

export function useSetDebugEnabled() {
  const identity = useIdentity();

  return useCallback(
    async (args: { enabled: boolean }) => {
      if (!identity) {
        throw new Error('Not authenticated');
      }

      return mutateDatabase((db) => setDebugEnabledInDatabase(db, identity, args.enabled));
    },
    [identity],
  );
}

export function useListFeed(args: FeedQueryArgs) {
  const db = useDatabaseSnapshot();
  const identity = useIdentity();

  return useMemo<FeedListResult | undefined>(() => {
    if (!identity) return undefined;
    return listFeedInDatabase(db, identity, args);
  }, [db, identity, args]);
}

export function useCommitFeedItemToVault() {
  const identity = useIdentity();

  return useCallback(
    async (args: CommitFeedArgs) => {
      if (!identity) {
        throw new Error('Not authenticated');
      }

      return mutateDatabase((db) => commitFeedItemToVaultInDatabase(db, identity, args));
    },
    [identity],
  );
}

export function useFollowByToken() {
  const identity = useIdentity();

  return useCallback(
    async (args: FollowByTokenArgs) => {
      if (!identity) {
        throw new Error('Not authenticated');
      }

      return mutateDatabase((db) => followByTokenInDatabase(db, identity, args));
    },
    [identity],
  );
}

export function useVaultProfile() {
  const db = useDatabaseSnapshot();
  const identity = useIdentity();

  return useMemo<ProfileResult | undefined>(() => {
    if (!identity) return undefined;
    return profileInDatabase(db, identity);
  }, [db, identity]);
}

export function useListVault(args: { debug?: boolean }) {
  const db = useDatabaseSnapshot();
  const identity = useIdentity();

  return useMemo<VaultListItem[] | undefined>(() => {
    if (!identity) return undefined;
    return listVaultInDatabase(db, identity, args.debug);
  }, [db, identity, args.debug]);
}

export function useTrophyCase(args: { debug?: boolean }) {
  const db = useDatabaseSnapshot();
  const identity = useIdentity();

  return useMemo<TrophyCaseResult | undefined>(() => {
    if (!identity) return undefined;
    return trophyCaseInDatabase(db, identity, args.debug);
  }, [db, identity, args.debug]);
}

export function useCancelPendingVaultItem() {
  const identity = useIdentity();

  return useCallback(
    async (args: { vaultItemId: string }) => {
      if (!identity) {
        throw new Error('Not authenticated');
      }

      return mutateDatabase((db) => cancelPendingVaultItemInDatabase(db, identity, args.vaultItemId));
    },
    [identity],
  );
}

export function usePolicy() {
  const db = useDatabaseSnapshot();

  return useMemo(() => policyInDatabase(db), [db]);
}

export function useSaveVaultSetup() {
  const identity = useIdentity();

  return useCallback(
    async (args: SaveVaultSetupArgs) => {
      if (!identity) {
        throw new Error('Not authenticated');
      }

      return mutateDatabase((db) => saveVaultSetupInDatabase(db, identity, args));
    },
    [identity],
  );
}

export function useRotateFollowToken() {
  const identity = useIdentity();

  return useCallback(async () => {
    if (!identity) {
      throw new Error('Not authenticated');
    }

    return mutateDatabase((db) => rotateFollowTokenInDatabase(db, identity));
  }, [identity]);
}

export function useAnalyzeCapture() {
  return useCallback(async (args: { imageDataUrl: string }) => {
    const result = await analyzeWithOpenAi(args.imageDataUrl);
    return {
      ok: true,
      result: {
        ...result,
        debugPriceBreakdown: {
          baseCost: Number((result.priceEstimate * 0.78).toFixed(2)),
          shipping: Number((result.priceEstimate * 0.03).toFixed(2)),
          serviceFee: Number((result.priceEstimate * 0.19).toFixed(2)),
        },
      },
    };
  }, []);
}

export function useCreateVaultSetupCheckout() {
  return useCallback(async (args: CheckoutArgs) => {
    return createVaultSetupCheckoutLocally(args);
  }, []);
}

export function useAqquireIt() {
  const identity = useIdentity();

  return useCallback(
    async (args: AqquireItArgs) => {
      if (!identity) {
        throw new Error('Not authenticated');
      }

      return mutateDatabase((db) => aqquireItInDatabase(db, identity, args));
    },
    [identity],
  );
}
