import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { MongoClient, MongoServerError, type Collection } from 'mongodb';
import { z } from 'zod';
import { type AppState, type Group, round, groupInWorkspace, walletAddress } from '../../app/model';
import { updateGroup } from '../../app/domain';
import { changeMainnetContribution, isMainnetAction } from '../../app/mainnet-contribution';
import { createGroupSchema } from '../../app/group-input';
import { indiaDate, processAutoPay } from '../../app/autopay';

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export type Identity = AppState['user'];
type StoredGroup = Group & { processed?: string[] };
type GroupDocument = { _id: string; version: number; group: StoredGroup; createdAt: Date };
type SessionDocument = { _id: string; userId: string; expiresAt: Date };
type OwnerDocument = { _id: string; groups: number };

const identifier = z.string().min(1).max(200);
const requestSchema = z.object({ action: z.string(), requestId: z.string().uuid().optional() }).passthrough();

export class SamitiStore {
  readonly groups: Collection<GroupDocument>;
  readonly sessions: Collection<SessionDocument>;
  private owners: Collection<OwnerDocument>;
  private walletChallenges: Collection<{ _id: string; expiresAt: Date }>;

  constructor(readonly client: MongoClient, readonly databaseName: string) {
    const db = client.db(databaseName);
    this.groups = db.collection<GroupDocument>('samiti_groups');
    this.sessions = db.collection<SessionDocument>('samiti_guest_sessions');
    this.owners = db.collection<OwnerDocument>('samiti_owners');
    this.walletChallenges = db.collection('samiti_wallet_challenges');
  }

  async initialize() {
    await this.client.db(this.databaseName).command({ ping: 1 });
    await this.groups.createIndex({ 'group.invite': 1 }, { unique: true });
    await this.groups.createIndex({ 'group.owner': 1 });
    await this.groups.createIndex({ 'group.members.id': 1 });
    await this.groups.createIndex({ 'group.visibility': 1 });
    await this.sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    await this.walletChallenges.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  }

  async consumeWalletChallenge(nonce: string) {
    try {
      await this.walletChallenges.insertOne({ _id: nonce, expiresAt: new Date(Date.now() + 300000) });
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) {
        throw new ApiError(409, 'This wallet challenge was already used.');
      }
      throw error;
    }
  }

  async guest(cookie: string | undefined) {
    const token = cookie?.match(/(?:^|;\s*)samiti_demo=([a-f0-9]{64})(?:;|$)/)?.[1];
    if (token) {
      const saved = await this.sessions.findOne({
        _id: createHash('sha256').update(token).digest('hex'), expiresAt: { $gt: new Date() },
      });
      if (saved) return { identity: { id: saved.userId, name: 'Demo member', authenticated: false }, token: null };
    }
    const next = randomBytes(32).toString('hex');
    const userId = `guest-${randomUUID()}`;
    await this.sessions.insertOne({
      _id: createHash('sha256').update(next).digest('hex'), userId,
      expiresAt: new Date(Date.now() + 30 * 86400000),
    });
    return { identity: { id: userId, name: 'Demo member', authenticated: false }, token: next };
  }

  async state(identity: Identity): Promise<AppState> {
    const joined = await this.groups.find({ 'group.members.id': identity.id }).sort({ createdAt: 1, _id: 1 }).toArray();
    const demo = !walletAddress(identity.id);
    const discoverable = identity.authenticated
      ? await this.groups.find({ 'group.visibility': 'public', 'group.demo': demo ? { $ne: false } : false }).limit(100).toArray()
      : [];
    return {
      user: identity,
      groups: joined.filter(({ group }) => groupInWorkspace(group, identity.id)).map(({ group }) => {
        const { processed: _processed, ...visible } = group;
        visible.autoPay = group.autoPay?.[identity.id] ? { [identity.id]: group.autoPay[identity.id] } : {};
        visible.contributionIntents = group.contributionIntents?.[identity.id]
          ? { [identity.id]: group.contributionIntents[identity.id] } : {};
        return visible;
      }),
      publicGroups: discoverable.map(({ group }) => ({
        id: group.id, name: group.name, description: group.description, monthly: group.monthly,
        count: group.members.length, color: group.color, icon: group.icon,
      })),
    };
  }

  private document(group: Group): GroupDocument {
    return { _id: group.id, group, version: 0, createdAt: new Date(group.created) };
  }

  private requireAccount(identity: Identity) {
    if (!identity.authenticated) throw new ApiError(401, 'Sign in to create or join a Samiti.');
  }

  async action(identity: Identity, body: unknown) {
    const input = requestSchema.parse(body);
    const requestId = input.action === 'bootstrap' ? input.requestId : z.string().uuid().parse(input.requestId);
    switch (input.action) {
      case 'bootstrap': {
        // Empty accounts stay empty. Sample fixtures are confined to tests.
        break;
      }
      case 'create': {
        const data = createGroupSchema.parse(input);
        if (!identity.authenticated && data.visibility !== 'private') {
          throw new ApiError(403, 'Demo Samitis are personal and private. Create an account to share a circle.');
        }
        const groupId = requestId!;
        const demo = !walletAddress(identity.id);
        if (round(data.monthly) !== data.monthly) throw new ApiError(400, 'Use up to 2 decimals for contributions.');
        await this.client.withSession(session => session.withTransaction(async () => {
          const existing = await this.groups.findOne({ _id: groupId }, { session });
          if (existing) {
            if (existing.group.owner !== identity.id) throw new ApiError(409, 'Request identifier is already in use.');
            return;
          }
          const count = await this.owners.findOneAndUpdate({ _id: identity.id }, { $inc: { groups: 1 } }, {
            upsert: true, returnDocument: 'after', session,
          });
          if (!count || count.groups > 25) throw new ApiError(400, 'You can create up to 25 Samitis.');
          const group: Group = {
            ...data, wallet: '', id: groupId, owner: identity.id, invite: randomUUID().replace(/-/g, '').toUpperCase(),
            demo, guestOnly: !identity.authenticated, members: [{ id: identity.id, name: identity.name, saved: 0, interest: 0 }],
            loans: [], activity: [], created: new Date().toISOString(),
          };
          await this.groups.insertOne(this.document(group), { session });
        }));
        break;
      }
      case 'join': {
        this.requireAccount(identity);
        const filter = input.publicId
          ? { _id: identifier.parse(input.publicId), 'group.visibility': 'public' }
          : { 'group.invite': z.string().min(1).max(40).parse(input.code).trim().toUpperCase() };
        const row = await this.groups.findOne(filter);
        if (!row) throw new ApiError(404, 'Invite code or public Samiti not found.');
        if (row.group.guestOnly) throw new ApiError(403, 'This Samiti belongs to a personal demo.');
        await this.mutate(row._id, group => {
          if (!groupInWorkspace(group, identity.id)) throw new ApiError(403, 'This Samiti belongs to a different workspace.');
          if (group.members.some(member => member.id === identity.id)) return false;
          if (group.members.length >= 100) throw new ApiError(400, 'This Samiti has reached its 100-member limit.');
          group.members.push({ id: identity.id, name: identity.name, saved: 0, interest: 0 });
          group.activity.unshift({ id: randomUUID(), member: identity.name, label: 'Joined the Samiti', amount: 0, type: 'joined', at: new Date().toISOString() });
          return true;
        });
        break;
      }
      default: {
        const groupId = identifier.parse(input.groupId);
        await this.mutate(groupId, async group => {
          if (!groupInWorkspace(group, identity.id) || !group.members.some(member => member.id === identity.id)) throw new ApiError(403, 'You are not a member of this Samiti.');
          if (group.processed?.includes(requestId!)) return false;
          try {
            if (isMainnetAction(input.action)) await changeMainnetContribution(group, identity.id, input.action, input);
            else updateGroup(group, identity.id, input.action, input);
          }
          catch (error) { throw new ApiError(400, error instanceof Error ? error.message : 'Unable to save this change.'); }
          group.processed = [...(group.processed ?? []).slice(-999), requestId!];
          group.activity = group.activity.slice(0, 1000);
          return true;
        });
      }
    }
    return this.state(identity);
  }

  private async mutate(id: string, change: (group: StoredGroup) => boolean | Promise<boolean>) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const row = await this.groups.findOne({ _id: id });
      if (!row) throw new ApiError(404, 'Samiti not found.');
      if (!await change(row.group)) return;
      const saved = await this.groups.updateOne({ _id: id, version: row.version }, {
        $set: { group: row.group }, $inc: { version: 1 },
      });
      if (saved.modifiedCount === 1) return;
    }
    throw new ApiError(409, 'Another member updated this Samiti. Refresh and try again.');
  }

  async runAutoPay() {
    const now = new Date();
    // Plans use member IDs as keys. Inspect bounded documents rather than exposing plan maps.
    const cursor = this.groups.find({ 'group.demo': true, 'group.autoPay': { $exists: true } });
    let scanned = 0;
    let updated = 0;
    let contributions = 0;
    for await (const row of cursor) {
      const plans = Object.values(row.group.autoPay ?? {});
      if (!plans.some(plan => plan.status === 'active' && plan.nextDate <= indiaDate(now))) continue;
      if (scanned >= 100) break;
      scanned++;
      let result = { changed: false, contributions: 0 };
      await this.mutate(row._id, group => {
        result = processAutoPay(group, now);
        return result.changed;
      });
      if (result.changed) { updated++; contributions += result.contributions; }
    }
    return { mode: 'demo', scanned, updated, contributions, checkedAt: now.toISOString() };
  }
}
