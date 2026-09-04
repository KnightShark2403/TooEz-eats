import type Database from 'better-sqlite3';
import { paise } from '../money';

export const DEMO_MERCHANT_ID = 'mrc_campuskitchen';

/**
 * Seeds one demo merchant (a campus cloud kitchen) with:
 *  - real guardrail policies the Risk Agent enforces,
 *  - three SKUs with true unit costs,
 *  - 14 days of hourly demand history anchored to the seed hour so the
 *    "demand is about to fall" signal is genuine whenever you seed,
 *  - organic full-price sales today (drives today's revenue + cannibalization checks),
 *  - two completed campaigns from earlier today (drives the daily discount budget),
 *  - prior offer outcomes at three price points (the learning loop's starting evidence).
 *
 * Nothing here is payment data. No payment is ever seeded as successful.
 */
export function seed(db: Database.Database) {
  const now = new Date();
  const seedHour = now.getHours();

  db.exec('BEGIN');
  try {
    db.prepare(
      `INSERT INTO merchants (id,name,owner_name,vertical,timezone) VALUES (?,?,?,?,?)`
    ).run(DEMO_MERCHANT_ID, 'Campus Kitchen — Block C',
      process.env.TOOEZ_MERCHANT_OWNER || 'Vetri', 'cloud_kitchen', 'Asia/Kolkata');

    db.prepare(
      `INSERT INTO policies (merchant_id,min_margin_pct,max_discount_pct,daily_discount_budget_paise,
        max_campaign_exposure_paise,max_active_campaigns,cannibalization_window_min,require_merchant_approval)
       VALUES (?,?,?,?,?,?,?,?)`
    ).run(DEMO_MERCHANT_ID, 22.0, 35.0, paise(2500), paise(1200), 3, 45, 1);

    const insProduct = db.prepare(
      `INSERT INTO products (id,merchant_id,sku,name,category,list_price_paise,cogs_paise,perishable,shelf_life_min,stock_units,produced_at)
       VALUES (@id,@m,@sku,@name,@cat,@list,@cogs,@per,@shelf,@stock,@produced)`
    );

    const producedAt = new Date(now.getTime() - 95 * 60_000).toISOString();
    const products = [
      { id: 'prd_wrapcombo', sku: 'WRAP-COMBO', name: 'Chicken Wrap + Fries Combo', cat: 'combo',
        list: paise(149), cogs: paise(82), per: 1, shelf: 240, stock: 14, produced: producedAt },
      { id: 'prd_paneerroll', sku: 'PANEER-ROLL', name: 'Paneer Kathi Roll', cat: 'mains',
        list: paise(129), cogs: paise(68), per: 1, shelf: 210, stock: 9, produced: producedAt },
      { id: 'prd_coldbrew', sku: 'COLD-BREW', name: 'Cold Brew 250ml', cat: 'beverage',
        list: paise(99), cogs: paise(34), per: 0, shelf: 600, stock: 22, produced: producedAt },
    ];
    for (const p of products) insProduct.run({ m: DEMO_MERCHANT_ID, ...p });

    // ---- Demand history -------------------------------------------------
    // A campus kitchen curve, rotated so the rush peaked TWO HOURS BEFORE the
    // seed hour. "Now" therefore sits on the downslope with stock left over —
    // which is exactly the situation TooEz exists to catch, and it makes the
    // Detection Agent's "demand is falling" signal a true reading of history
    // rather than a staged one. Fourteen days, mild deterministic noise.
    const insDemand = db.prepare(
      `INSERT INTO demand_history (product_id,day_offset,hour_of_day,units_sold) VALUES (?,?,?,?)`
    );
    // shape[k] = relative demand k hours after the peak hour
    const shape = [1.00, 0.42, 0.26, 0.18, 0.12, 0.10, 0.14, 0.22, 0.30, 0.34,
                   0.28, 0.20, 0.16, 0.12, 0.10, 0.08, 0.10, 0.18, 0.34, 0.62,
                   0.80, 0.88, 0.94, 0.98];
    const peaks: Record<string, number> = { prd_wrapcombo: 8, prd_paneerroll: 6, prd_coldbrew: 5 };
    const peakHour = (seedHour - 2 + 24) % 24;
    for (const p of products) {
      for (let day = 1; day <= 14; day++) {
        for (let h = 0; h < 24; h++) {
          const k = (h - peakHour + 24) % 24;
          const noise = 0.82 + ((day * 7 + h * 13 + p.sku.length) % 37) / 100; // deterministic 0.82..1.18
          const units = Math.max(0, Math.round(peaks[p.id] * shape[k] * noise));
          insDemand.run(p.id, day, h, units);
        }
      }
    }

    // ---- Organic (full-price) sales today -------------------------------
    const insSale = db.prepare(
      `INSERT INTO organic_sales (merchant_id,product_id,units,unit_price_paise,sold_at) VALUES (?,?,?,?,?)`
    );
    const minsAgo = (m: number) => new Date(now.getTime() - m * 60_000).toISOString().replace('T', ' ').slice(0, 19);
    // Wrap combo: sold through the lunch peak, but nothing in the last 45 min -> no cannibalization risk.
    insSale.run(DEMO_MERCHANT_ID, 'prd_wrapcombo', 9, paise(149), minsAgo(190));
    insSale.run(DEMO_MERCHANT_ID, 'prd_wrapcombo', 6, paise(149), minsAgo(120));
    insSale.run(DEMO_MERCHANT_ID, 'prd_wrapcombo', 2, paise(149), minsAgo(64));
    // Paneer roll: still selling at full price RIGHT NOW -> discounting it would cannibalize.
    insSale.run(DEMO_MERCHANT_ID, 'prd_paneerroll', 3, paise(129), minsAgo(22));
    insSale.run(DEMO_MERCHANT_ID, 'prd_paneerroll', 2, paise(129), minsAgo(9));
    insSale.run(DEMO_MERCHANT_ID, 'prd_coldbrew', 11, paise(99), minsAgo(150));
    insSale.run(DEMO_MERCHANT_ID, 'prd_coldbrew', 4, paise(99), minsAgo(70));

    // ---- Two completed campaigns from earlier today ---------------------
    // These consume part of the daily discount budget, so the Risk Agent's
    // budget check is evaluating a real, non-zero balance during the demo.
    const mkPastCampaign = (
      cid: string, oid: string, ofid: string, pid: string, price: number, list: number,
      units: number, sold: number, impressions: number, minsBack: number
    ) => {
      db.prepare(
        `INSERT INTO opportunities (id,merchant_id,product_id,detected_at,window_minutes,stock_units,
          baseline_units,expected_waste,sell_through_pct,demand_trend,demand_index,value_at_risk_paise,status,rationale,signals_json)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      ).run(oid, DEMO_MERCHANT_ID, pid, minsAgo(minsBack), 30, units, 1.4, units - 1.4, 41.0,
        'FALLING', 0.35, price * units, 'PROCESSED', 'Historical campaign (seeded).', '{}');
      db.prepare(
        `INSERT INTO offers (id,opportunity_id,attempt,offer_price_paise,bundle_label,discount_pct,
          expected_conversions,expected_revenue_paise,expected_margin_paise,margin_pct,units_offered,strategy,reasoning)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
      ).run(ofid, oid, 1, price, 'Historical', ((list - price) / list) * 100, sold, price * sold, 0, 0,
        units, 'LEARNED', 'Historical campaign (seeded).');
      db.prepare(
        `INSERT INTO campaigns (id,merchant_id,opportunity_id,offer_id,product_id,status,price_paise,
          units_offered,units_sold,impressions,revenue_paise,discount_cost_paise,expires_at,approved_by,approved_at,created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      ).run(cid, DEMO_MERCHANT_ID, oid, ofid, pid, 'COMPLETED', price, units, sold, impressions,
        price * sold, (list - price) * sold, minsAgo(minsBack - 30), 'merchant@demo', minsAgo(minsBack),
        minsAgo(minsBack));
    };
    // ₹1,650 of today's ₹2,500 discount budget already spent.
    mkPastCampaign('cmp_seed1', 'opp_seed1', 'off_seed1', 'prd_wrapcombo', paise(109), paise(149), 14, 14, 155, 205);
    mkPastCampaign('cmp_seed2', 'opp_seed2', 'off_seed2', 'prd_coldbrew', paise(79), paise(99), 20, 19, 140, 140);
    // 14*40 = 560 + 19*20 = 380  => 940 paise-rupees... top up with a third small one
    mkPastCampaign('cmp_seed3', 'opp_seed3', 'off_seed3', 'prd_paneerroll', paise(99), paise(129), 24, 23, 180, 100);
    // 23*30 = 690  =>  total 560+380+690 = ₹1,630 spent today.

    // ---- Prior offer outcomes: the learning loop's evidence base ---------
    const insOutcome = db.prepare(
      `INSERT INTO offer_outcomes (merchant_id,product_id,price_paise,discount_bucket,impressions,conversions,revenue_paise,discount_cost_paise)
       VALUES (?,?,?,?,?,?,?,?)`
    );
    // Deliberately non-monotonic: ₹99 converted WORSE than ₹109 on this SKU.
    insOutcome.run(DEMO_MERCHANT_ID, 'prd_wrapcombo', paise(119), 20, 120, 7, paise(119) * 7, paise(30) * 7);
    insOutcome.run(DEMO_MERCHANT_ID, 'prd_wrapcombo', paise(109), 25, 155, 14, paise(109) * 14, paise(40) * 14);
    insOutcome.run(DEMO_MERCHANT_ID, 'prd_wrapcombo', paise(99), 35, 140, 6, paise(99) * 6, paise(50) * 6);
    insOutcome.run(DEMO_MERCHANT_ID, 'prd_coldbrew', paise(79), 20, 140, 19, paise(79) * 19, paise(20) * 19);
    insOutcome.run(DEMO_MERCHANT_ID, 'prd_paneerroll', paise(99), 25, 180, 23, paise(99) * 23, paise(30) * 23);

    db.prepare(
      `INSERT INTO audit_log (merchant_id,actor,action,severity,summary,detail_json)
       VALUES (?,?,?,?,?,?)`
    ).run(DEMO_MERCHANT_ID, 'SYSTEM', 'SEED', 'info',
      'Demo merchant provisioned with 14 days of demand history and 3 prior campaigns.',
      JSON.stringify({ seedHour, products: products.length }));

    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}
