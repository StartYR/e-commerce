import { HttpError } from '../middleware/errors.js'

const DAY_MS = 24 * 60 * 60 * 1000
const REPORT_TIME_ZONE = '+08:00'
const MAX_DAYS = 31

function formatDate(epoch) {
  return new Date(epoch).toISOString().slice(0, 10)
}

function parseDate(date) {
  if (typeof date !== 'string' || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(date)) return NaN
  const epoch = Date.parse(`${date}T00:00:00Z`)
  return Number.isFinite(epoch) && formatDate(epoch) === date ? epoch : NaN
}

function reportRange(from, to) {
  if (from === undefined && to === undefined) {
    const today = Date.now() + 8 * 60 * 60 * 1000
    from = formatDate(today - 29 * DAY_MS)
    to = formatDate(today)
  }

  const first = parseDate(from)
  const last = parseDate(to)
  const endExclusive = last + DAY_MS
  if (!Number.isFinite(first) || !Number.isFinite(last) || first > last
    || endExclusive - first > MAX_DAYS * DAY_MS || endExclusive >= Date.UTC(10000, 0, 1)) {
    throw new HttpError(400, 'INVALID_STATS_RANGE', 'Select a valid date range of up to 31 days')
  }

  return { from, to, start: `${from} 00:00:00`, end: `${formatDate(endExclusive)} 00:00:00` }
}

export function createStatsService(pool) {
  return {
    async summarize(requestedFrom, requestedTo) {
      const { from, to, start, end } = reportRange(requestedFrom, requestedTo)
      const connection = await pool.getConnection()
      let reusable = false
      try {
        // 两个汇总共用 UTC+8 时区和同一读取快照。
        const [[{ timeZone }]] = await connection.query('SELECT @@session.time_zone AS timeZone')
        await connection.execute('SET SESSION time_zone = ?', [REPORT_TIME_ZONE])
        await connection.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ')
        await connection.query('START TRANSACTION READ ONLY')

        const [daily] = await connection.execute(`
          SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS date,
                 CAST(COUNT(*) AS CHAR) AS orderCount,
                 CAST(SUM(total_amount_cents) AS CHAR) AS amountCents
          FROM orders
          WHERE status = 'placed' AND created_at >= ? AND created_at < ?
          GROUP BY date
          ORDER BY date
        `, [start, end])
        const [products] = await connection.execute(`
          SELECT sales.product_id AS productId, p.name,
                 CAST(SUM(sales.quantity) AS CHAR) AS unitsSold,
                 CAST(SUM(CAST(sales.unit_price_cents AS DECIMAL(20, 0)) * sales.quantity) AS CHAR) AS amountCents
          FROM placed_order_items AS sales
          INNER JOIN products AS p ON p.id = sales.product_id
          WHERE sales.ordered_at >= ? AND sales.ordered_at < ?
          GROUP BY sales.product_id, p.name
          ORDER BY SUM(CAST(sales.unit_price_cents AS DECIMAL(20, 0)) * sales.quantity) DESC, sales.product_id
        `, [start, end])

        await connection.commit()
        await connection.execute('SET SESSION time_zone = ?', [timeZone])
        reusable = true
        return { from, to, timeZone: REPORT_TIME_ZONE, daily, products }
      } finally {
        if (reusable) connection.release()
        else connection.destroy()
      }
    },
  }
}
