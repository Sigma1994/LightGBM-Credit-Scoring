import { Pool } from 'pg';
import type {
  CustomerSummary,
  Decision,
  FeatureVector,
  InferenceLogEntry,
  LedgerEvent,
} from '../src/shared/types.ts';
import { parseUtcMs } from './featureStore.ts';

export interface CustomerSeedMeta {
  customer_id: string;
  full_name: string;
  segment: CustomerSummary['segment'];
  suggested_anchor_time: string;
}

const SEED_CUSTOMERS: CustomerSeedMeta[] = [
  {
    customer_id: 'CUST-1042',
    full_name: 'Elena Rostova',
    segment: 'Prime Payroll',
    suggested_anchor_time: '2026-10-15T14:30:00Z',
  },
  {
    customer_id: 'CUST-2088',
    full_name: 'Marcus Vance',
    segment: 'High-Utilization',
    suggested_anchor_time: '2026-10-18T09:15:00Z',
  },
  {
    customer_id: 'CUST-3115',
    full_name: 'Priya Nair',
    segment: 'Thin-File Gig',
    suggested_anchor_time: '2026-10-20T18:00:00Z',
  },
  {
    customer_id: 'CUST-4290',
    full_name: 'David Morales',
    segment: 'Seasonal Merchant',
    suggested_anchor_time: '2026-10-25T11:45:00Z',
  },
  {
    customer_id: 'CUST-5019',
    full_name: 'Hannah Lindqvist',
    segment: 'Prime Payroll',
    suggested_anchor_time: '2026-11-02T16:20:00Z',
  },
];

const SEED_EVENTS: LedgerEvent[] = [
  { event_uuid: 'ev-1042-01', customer_id: 'CUST-1042', event_type: 'DEPOSIT', amount: 3400, event_time: '2026-08-10T09:00:00Z', channel: 'ACH', status: 'SETTLED' },
  { event_uuid: 'ev-1042-02', customer_id: 'CUST-1042', event_type: 'TRANSACTION', amount: 420, event_time: '2026-08-18T13:22:00Z', channel: 'CARD', status: 'SETTLED' },
  { event_uuid: 'ev-1042-03', customer_id: 'CUST-1042', event_type: 'REPAYMENT', amount: 650, event_time: '2026-08-29T10:05:00Z', channel: 'AUTOPAY', status: 'SETTLED' },
  { event_uuid: 'ev-1042-04', customer_id: 'CUST-1042', event_type: 'DEPOSIT', amount: 3450, event_time: '2026-09-10T09:02:00Z', channel: 'ACH', status: 'SETTLED' },
  { event_uuid: 'ev-1042-05', customer_id: 'CUST-1042', event_type: 'TRANSACTION', amount: 380, event_time: '2026-09-17T16:40:00Z', channel: 'CARD', status: 'SETTLED' },
  { event_uuid: 'ev-1042-06', customer_id: 'CUST-1042', event_type: 'REPAYMENT', amount: 650, event_time: '2026-09-29T10:00:00Z', channel: 'AUTOPAY', status: 'SETTLED' },
  { event_uuid: 'ev-1042-07', customer_id: 'CUST-1042', event_type: 'DEPOSIT', amount: 3400, event_time: '2026-10-10T09:00:00Z', channel: 'ACH', status: 'SETTLED' },
  { event_uuid: 'ev-1042-08', customer_id: 'CUST-1042', event_type: 'TRANSACTION', amount: 510, event_time: '2026-10-13T18:10:00Z', channel: 'CARD', status: 'SETTLED' },
  { event_uuid: 'ev-1042-09', customer_id: 'CUST-1042', event_type: 'TRANSACTION', amount: 2800, event_time: '2026-10-22T12:15:00Z', channel: 'WIRE', status: 'PENDING_EXCLUDED' },
  { event_uuid: 'ev-1042-10', customer_id: 'CUST-1042', event_type: 'TRANSACTION', amount: 1900, event_time: '2026-11-01T15:00:00Z', channel: 'CARD', status: 'PENDING_EXCLUDED' },

  { event_uuid: 'ev-2088-01', customer_id: 'CUST-2088', event_type: 'DEPOSIT', amount: 1400, event_time: '2026-09-02T08:30:00Z', channel: 'ACH', status: 'SETTLED' },
  { event_uuid: 'ev-2088-02', customer_id: 'CUST-2088', event_type: 'TRANSACTION', amount: 620, event_time: '2026-09-05T14:20:00Z', channel: 'CARD', status: 'SETTLED' },
  { event_uuid: 'ev-2088-03', customer_id: 'CUST-2088', event_type: 'TRANSACTION', amount: 540, event_time: '2026-09-12T19:10:00Z', channel: 'CARD', status: 'SETTLED' },
  { event_uuid: 'ev-2088-04', customer_id: 'CUST-2088', event_type: 'TRANSACTION', amount: 480, event_time: '2026-09-24T11:45:00Z', channel: 'WIRE', status: 'SETTLED' },
  { event_uuid: 'ev-2088-05', customer_id: 'CUST-2088', event_type: 'DEPOSIT', amount: 900, event_time: '2026-10-03T09:00:00Z', channel: 'ACH', status: 'SETTLED' },
  { event_uuid: 'ev-2088-06', customer_id: 'CUST-2088', event_type: 'TRANSACTION', amount: 810, event_time: '2026-10-14T20:05:00Z', channel: 'CARD', status: 'SETTLED' },
  { event_uuid: 'ev-2088-07', customer_id: 'CUST-2088', event_type: 'DEPOSIT', amount: 5200, event_time: '2026-10-25T10:00:00Z', channel: 'WIRE', status: 'PENDING_EXCLUDED' },
  { event_uuid: 'ev-2088-08', customer_id: 'CUST-2088', event_type: 'REPAYMENT', amount: 950, event_time: '2026-10-28T10:00:00Z', channel: 'AUTOPAY', status: 'PENDING_EXCLUDED' },
  { event_uuid: 'ev-2088-09', customer_id: 'CUST-2088', event_type: 'REPAYMENT', amount: 950, event_time: '2026-11-05T10:00:00Z', channel: 'AUTOPAY', status: 'PENDING_EXCLUDED' },

  { event_uuid: 'ev-3115-01', customer_id: 'CUST-3115', event_type: 'DEPOSIT', amount: 980, event_time: '2026-09-18T11:00:00Z', channel: 'ACH', status: 'SETTLED' },
  { event_uuid: 'ev-3115-02', customer_id: 'CUST-3115', event_type: 'TRANSACTION', amount: 310, event_time: '2026-09-22T15:30:00Z', channel: 'CARD', status: 'SETTLED' },
  { event_uuid: 'ev-3115-03', customer_id: 'CUST-3115', event_type: 'TRANSACTION', amount: 240, event_time: '2026-10-01T17:45:00Z', channel: 'CARD', status: 'SETTLED' },
  { event_uuid: 'ev-3115-04', customer_id: 'CUST-3115', event_type: 'DEPOSIT', amount: 1120, event_time: '2026-10-08T10:15:00Z', channel: 'ACH', status: 'SETTLED' },
  { event_uuid: 'ev-3115-05', customer_id: 'CUST-3115', event_type: 'REPAYMENT', amount: 280, event_time: '2026-10-12T09:00:00Z', channel: 'AUTOPAY', status: 'SETTLED' },
  { event_uuid: 'ev-3115-06', customer_id: 'CUST-3115', event_type: 'TRANSACTION', amount: 390, event_time: '2026-10-17T21:10:00Z', channel: 'CARD', status: 'SETTLED' },
  { event_uuid: 'ev-3115-07', customer_id: 'CUST-3115', event_type: 'REPAYMENT', amount: 400, event_time: '2026-11-04T09:00:00Z', channel: 'AUTOPAY', status: 'PENDING_EXCLUDED' },

  { event_uuid: 'ev-4290-01', customer_id: 'CUST-4290', event_type: 'TRANSACTION', amount: 185, event_time: '2026-10-11T13:00:00Z', channel: 'CARD', status: 'SETTLED' },
  { event_uuid: 'ev-4290-02', customer_id: 'CUST-4290', event_type: 'REPAYMENT', amount: 185, event_time: '2026-10-19T14:00:00Z', channel: 'AUTOPAY', status: 'SETTLED' },
  { event_uuid: 'ev-4290-03', customer_id: 'CUST-4290', event_type: 'DEPOSIT', amount: 4600, event_time: '2026-10-22T09:30:00Z', channel: 'WIRE', status: 'SETTLED' },
  { event_uuid: 'ev-4290-04', customer_id: 'CUST-4290', event_type: 'TRANSACTION', amount: 720, event_time: '2026-10-24T16:40:00Z', channel: 'CARD', status: 'SETTLED' },
  { event_uuid: 'ev-4290-05', customer_id: 'CUST-4290', event_type: 'TRANSACTION', amount: 1850, event_time: '2026-11-07T18:20:00Z', channel: 'WIRE', status: 'PENDING_EXCLUDED' },

  { event_uuid: 'ev-5019-01', customer_id: 'CUST-5019', event_type: 'DEPOSIT', amount: 4200, event_time: '2026-07-15T08:00:00Z', channel: 'ACH', status: 'SETTLED' },
  { event_uuid: 'ev-5019-02', customer_id: 'CUST-5019', event_type: 'TRANSACTION', amount: 520, event_time: '2026-07-24T12:30:00Z', channel: 'CARD', status: 'SETTLED' },
  { event_uuid: 'ev-5019-03', customer_id: 'CUST-5019', event_type: 'REPAYMENT', amount: 520, event_time: '2026-08-05T09:00:00Z', channel: 'AUTOPAY', status: 'SETTLED' },
  { event_uuid: 'ev-5019-04', customer_id: 'CUST-5019', event_type: 'DEPOSIT', amount: 4200, event_time: '2026-08-15T08:00:00Z', channel: 'ACH', status: 'SETTLED' },
  { event_uuid: 'ev-5019-05', customer_id: 'CUST-5019', event_type: 'TRANSACTION', amount: 610, event_time: '2026-09-04T15:10:00Z', channel: 'CARD', status: 'SETTLED' },
  { event_uuid: 'ev-5019-06', customer_id: 'CUST-5019', event_type: 'REPAYMENT', amount: 610, event_time: '2026-09-10T09:00:00Z', channel: 'AUTOPAY', status: 'SETTLED' },
  { event_uuid: 'ev-5019-07', customer_id: 'CUST-5019', event_type: 'DEPOSIT', amount: 4200, event_time: '2026-10-15T08:00:00Z', channel: 'ACH', status: 'SETTLED' },
  { event_uuid: 'ev-5019-08', customer_id: 'CUST-5019', event_type: 'REPAYMENT', amount: 740, event_time: '2026-10-28T09:00:00Z', channel: 'AUTOPAY', status: 'SETTLED' },
];

export class CreditRepository {
  private pool: Pool | null = null;
  private backend: 'postgres' | 'memory_fallback' = 'memory_fallback';
  private storageNote = 'Embedded presentation store (DATABASE_URL not configured).';
  public readonly maxPoolConnections = 20;

  // In-memory presentation fallback store
  private readonly memCustomers = new Map<string, CustomerSeedMeta>();
  private readonly memLedger: LedgerEvent[] = [];
  private readonly memSeenUuids = new Set<string>();
  private readonly memInferenceLogs: InferenceLogEntry[] = [];

  public async init(seedLogsBuilder: (repo: CreditRepository) => Promise<InferenceLogEntry[]>): Promise<void> {
    const databaseUrl = (process.env.DATABASE_URL || '').trim();
    const allowFallback = process.env.ALLOW_MEMORY_FALLBACK !== 'false';

    if (databaseUrl) {
      const candidatePool = new Pool({
        connectionString: databaseUrl,
        max: this.maxPoolConnections,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 2_500,
      });

      try {
        await candidatePool.query('SELECT 1');
        this.pool = candidatePool;
        this.backend = 'postgres';
        this.storageNote = 'PostgreSQL connection pool active (DATABASE_URL).';
        await this.ensurePostgresSchemaAndSeed(seedLogsBuilder);
        return;
      } catch (err) {
        await candidatePool.end().catch(() => undefined);
        const reason = (err as Error).message;
        if (!allowFallback) {
          throw new Error(`PostgreSQL connection failed and ALLOW_MEMORY_FALLBACK=false: ${reason}`);
        }
        console.warn(`PostgreSQL unavailable (${reason}); falling back to embedded presentation store.`);
        this.storageNote = `Presentation fallback active (Postgres unreachable: ${reason}).`;
      }
    }

    // Initialize embedded presentation fallback
    this.backend = 'memory_fallback';
    for (const c of SEED_CUSTOMERS) {
      this.memCustomers.set(c.customer_id, c);
    }
    for (const ev of SEED_EVENTS) {
      if (!this.memSeenUuids.has(ev.event_uuid)) {
        this.memSeenUuids.add(ev.event_uuid);
        this.memLedger.push(ev);
      }
    }
    const seededLogs = await seedLogsBuilder(this);
    this.memInferenceLogs.push(...seededLogs);
  }

  private async ensurePostgresSchemaAndSeed(
    seedLogsBuilder: (repo: CreditRepository) => Promise<InferenceLogEntry[]>
  ): Promise<void> {
    if (!this.pool) return;

    await this.pool.query(`
      CREATE SCHEMA IF NOT EXISTS raw;
      CREATE SCHEMA IF NOT EXISTS ops;

      CREATE TABLE IF NOT EXISTS raw.customers (
        customer_id TEXT PRIMARY KEY,
        full_name TEXT NOT NULL,
        segment TEXT NOT NULL,
        suggested_anchor_time TIMESTAMPTZ NOT NULL
      );

      CREATE TABLE IF NOT EXISTS raw.ledger_events (
        event_uuid TEXT PRIMARY KEY,
        customer_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        amount DOUBLE PRECISION NOT NULL,
        event_time TIMESTAMPTZ NOT NULL,
        channel TEXT NOT NULL DEFAULT 'ACH',
        status TEXT NOT NULL DEFAULT 'SETTLED'
      );

      CREATE INDEX IF NOT EXISTS idx_ledger_customer_time
        ON raw.ledger_events (customer_id, event_time);

      CREATE TABLE IF NOT EXISTS ops.inference_logs (
        request_id UUID PRIMARY KEY,
        customer_id TEXT NOT NULL,
        as_of_time TIMESTAMPTZ NOT NULL,
        scored_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        model_version TEXT NOT NULL,
        contract_version TEXT NOT NULL,
        calibrated_probability DOUBLE PRECISION NOT NULL,
        decision TEXT NOT NULL,
        latency_ms DOUBLE PRECISION NOT NULL,
        features_json JSONB NOT NULL,
        audit_status TEXT NOT NULL DEFAULT 'COMMITTED'
      );

      CREATE INDEX IF NOT EXISTS idx_inference_logs_scored_at
        ON ops.inference_logs (scored_at DESC);
      CREATE INDEX IF NOT EXISTS idx_inference_logs_customer_scored
        ON ops.inference_logs (customer_id, scored_at DESC);
    `);

    for (const c of SEED_CUSTOMERS) {
      await this.pool.query(
        `INSERT INTO raw.customers (customer_id, full_name, segment, suggested_anchor_time)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (customer_id) DO NOTHING`,
        [c.customer_id, c.full_name, c.segment, c.suggested_anchor_time]
      );
    }

    for (const ev of SEED_EVENTS) {
      await this.pool.query(
        `INSERT INTO raw.ledger_events (event_uuid, customer_id, event_type, amount, event_time, channel, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (event_uuid) DO NOTHING`,
        [ev.event_uuid, ev.customer_id, ev.event_type, ev.amount, ev.event_time, ev.channel, ev.status]
      );
    }

    const { rows } = await this.pool.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM ops.inference_logs');
    if (Number(rows[0]?.count ?? 0) === 0) {
      const seededLogs = await seedLogsBuilder(this);
      for (const log of seededLogs) {
        await this.insertInferenceLog(log);
      }
    }
  }

  public getStorageInfo(): {
    backend: 'postgres' | 'memory_fallback';
    note: string;
    activeConnections: number;
    maxConnections: number;
  } {
    if (this.backend === 'postgres' && this.pool) {
      return {
        backend: 'postgres',
        note: this.storageNote,
        activeConnections: Math.max(1, this.pool.totalCount - this.pool.idleCount),
        maxConnections: this.maxPoolConnections,
      };
    }
    return {
      backend: 'memory_fallback',
      note: this.storageNote,
      activeConnections: 1,
      maxConnections: this.maxPoolConnections,
    };
  }

  public async customerExists(customerId: string): Promise<boolean> {
    if (this.backend === 'postgres' && this.pool) {
      const res = await this.pool.query(
        `SELECT 1 FROM raw.customers WHERE customer_id = $1
         UNION ALL
         SELECT 1 FROM raw.ledger_events WHERE customer_id = $1
         LIMIT 1`,
        [customerId]
      );
      return res.rowCount !== null && res.rowCount > 0;
    }
    return this.memCustomers.has(customerId);
  }

  public async getCustomerSuggestedAnchor(customerId: string): Promise<string | null> {
    if (this.backend === 'postgres' && this.pool) {
      const res = await this.pool.query<{ suggested_anchor_time: Date | string }>(
        'SELECT suggested_anchor_time FROM raw.customers WHERE customer_id = $1 LIMIT 1',
        [customerId]
      );
      const val = res.rows[0]?.suggested_anchor_time;
      return val ? new Date(val).toISOString() : null;
    }
    return this.memCustomers.get(customerId)?.suggested_anchor_time ?? null;
  }

  public async listCustomers(): Promise<CustomerSummary[]> {
    if (this.backend === 'postgres' && this.pool) {
      const custRes = await this.pool.query<{
        customer_id: string;
        full_name: string;
        segment: CustomerSummary['segment'];
        suggested_anchor_time: Date | string;
      }>(
        `SELECT customer_id, full_name, segment, suggested_anchor_time
         FROM raw.customers
         ORDER BY customer_id ASC`
      );

      const aggRes = await this.pool.query<{
        customer_id: string;
        first_event_time: Date | string;
        last_event_time: Date | string;
        total_events: string;
        settled_balance_net: string;
      }>(
        `SELECT
           customer_id,
           MIN(event_time) AS first_event_time,
           MAX(event_time) AS last_event_time,
           COUNT(*)::text AS total_events,
           COALESCE(SUM(
             CASE
               WHEN event_type = 'DEPOSIT' THEN amount
               WHEN event_type = 'REPAYMENT' THEN amount
               WHEN event_type = 'TRANSACTION' THEN -amount
               ELSE 0
             END
           ), 0)::text AS settled_balance_net
         FROM raw.ledger_events
         GROUP BY customer_id`
      );

      const aggMap = new Map(aggRes.rows.map((r) => [r.customer_id, r]));

      return custRes.rows.map((c) => {
        const agg = aggMap.get(c.customer_id);
        const anchorIso = new Date(c.suggested_anchor_time).toISOString();
        return {
          customer_id: c.customer_id,
          full_name: c.full_name,
          segment: c.segment,
          suggested_anchor_time: anchorIso,
          first_event_time: agg ? new Date(agg.first_event_time).toISOString() : anchorIso,
          last_event_time: agg ? new Date(agg.last_event_time).toISOString() : anchorIso,
          total_events: agg ? Number(agg.total_events) : 0,
          settled_balance_net: agg ? Math.round(Number(agg.settled_balance_net) * 100) / 100 : 0,
        };
      });
    }

    const summaries: CustomerSummary[] = [];
    for (const [id, meta] of this.memCustomers.entries()) {
      const evs = await this.getCustomerEvents(id);
      let net = 0;
      for (const e of evs) {
        if (e.event_type === 'DEPOSIT' || e.event_type === 'REPAYMENT') net += e.amount;
        else if (e.event_type === 'TRANSACTION') net -= e.amount;
      }
      summaries.push({
        ...meta,
        first_event_time: evs[0]?.event_time ?? meta.suggested_anchor_time,
        last_event_time: evs[evs.length - 1]?.event_time ?? meta.suggested_anchor_time,
        total_events: evs.length,
        settled_balance_net: Math.round(net * 100) / 100,
      });
    }
    return summaries;
  }

  public async getCustomerEvents(customerId: string): Promise<LedgerEvent[]> {
    if (this.backend === 'postgres' && this.pool) {
      const res = await this.pool.query<{
        event_uuid: string;
        customer_id: string;
        event_type: LedgerEvent['event_type'];
        amount: number;
        event_time: Date | string;
        channel: LedgerEvent['channel'];
        status: LedgerEvent['status'];
      }>(
        `SELECT event_uuid, customer_id, event_type, amount, event_time, channel, status
         FROM raw.ledger_events
         WHERE customer_id = $1
         ORDER BY event_time ASC`,
        [customerId]
      );
      return res.rows.map((r) => ({
        event_uuid: r.event_uuid,
        customer_id: r.customer_id,
        event_type: r.event_type,
        amount: Number(r.amount),
        event_time: new Date(r.event_time).toISOString(),
        channel: r.channel ?? 'ACH',
        status: r.status ?? 'SETTLED',
      }));
    }

    return this.memLedger
      .filter((e) => e.customer_id === customerId)
      .sort((a, b) => parseUtcMs(a.event_time) - parseUtcMs(b.event_time));
  }

  public async insertInferenceLog(entry: InferenceLogEntry): Promise<void> {
    if (this.backend === 'postgres' && this.pool) {
      await this.pool.query(
        `INSERT INTO ops.inference_logs (
          request_id, customer_id, as_of_time, scored_at, model_version, contract_version,
          calibrated_probability, decision, latency_ms, features_json, audit_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11)`,
        [
          entry.request_id,
          entry.customer_id,
          entry.as_of_time,
          entry.scored_at,
          entry.model_version,
          entry.contract_version,
          entry.calibrated_probability,
          entry.decision,
          entry.latency_ms,
          JSON.stringify(entry.features_json),
          entry.audit_status,
        ]
      );
      return;
    }

    this.memInferenceLogs.unshift(entry);
  }

  public async getInferenceLogs(limit = 100): Promise<InferenceLogEntry[]> {
    const safeLimit = Math.min(500, Math.max(1, limit));
    if (this.backend === 'postgres' && this.pool) {
      const res = await this.pool.query<{
        request_id: string;
        customer_id: string;
        as_of_time: Date | string;
        scored_at: Date | string;
        model_version: string;
        contract_version: string;
        calibrated_probability: number;
        decision: Decision;
        latency_ms: number;
        features_json: FeatureVector;
        audit_status: 'COMMITTED' | 'FAILED';
      }>(
        `SELECT request_id, customer_id, as_of_time, scored_at, model_version, contract_version,
                calibrated_probability, decision, latency_ms, features_json, audit_status
         FROM ops.inference_logs
         ORDER BY scored_at DESC
         LIMIT $1`,
        [safeLimit]
      );

      return res.rows.map((r) => ({
        request_id: r.request_id,
        customer_id: r.customer_id,
        as_of_time: new Date(r.as_of_time).toISOString(),
        scored_at: new Date(r.scored_at).toISOString(),
        model_version: r.model_version,
        contract_version: r.contract_version,
        calibrated_probability: Number(r.calibrated_probability),
        decision: r.decision,
        latency_ms: Number(r.latency_ms),
        features_json: r.features_json,
        audit_status: r.audit_status,
      }));
    }

    return this.memInferenceLogs.slice(0, safeLimit);
  }
}
