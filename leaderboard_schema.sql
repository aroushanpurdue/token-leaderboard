-- COMPLETE FRESH SCHEMA - Token Holder Leaderboard
-- Run this in Supabase SQL Editor

-- Clean slate - remove old tables if they exist
DROP TABLE IF EXISTS holder_baseline CASCADE;
DROP TABLE IF EXISTS holder_leaderboard CASCADE;
DROP TABLE IF EXISTS holder_balances CASCADE;
DROP TABLE IF EXISTS holder_baselines CASCADE;
DROP TABLE IF EXISTS leaderboard_snapshots CASCADE;
DROP FUNCTION IF EXISTS batch_upsert_holder_balances CASCADE;
DROP FUNCTION IF EXISTS reset_holder_baselines CASCADE;
DROP FUNCTION IF EXISTS get_live_leaderboard CASCADE;

-- Table 1: Current holder balances
CREATE TABLE holder_balances (
    wallet_address VARCHAR(42) PRIMARY KEY,
    current_balance NUMERIC(78, 18) NOT NULL,
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Table 2: Baseline snapshot
CREATE TABLE holder_baselines (
    wallet_address VARCHAR(42) PRIMARY KEY,
    baseline_balance NUMERIC(78, 18) NOT NULL,
    baseline_date TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_balances_balance ON holder_balances(current_balance DESC);
CREATE INDEX idx_baselines_balance ON holder_baselines(baseline_balance DESC);

-- RLS Enable
ALTER TABLE holder_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE holder_baselines ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "public_read_balances" ON holder_balances FOR SELECT TO public USING (true);
CREATE POLICY "public_write_balances" ON holder_balances FOR ALL TO public USING (true);
CREATE POLICY "public_read_baselines" ON holder_baselines FOR SELECT TO public USING (true);
CREATE POLICY "public_write_baselines" ON holder_baselines FOR ALL TO public USING (true);

-- Function 1: Batch insert holders
CREATE OR REPLACE FUNCTION batch_upsert_holder_balances(p_holders JSONB)
RETURNS INTEGER AS $$
DECLARE
    rows_affected INTEGER;
BEGIN
    INSERT INTO holder_balances (wallet_address, current_balance, last_updated)
    SELECT 
        (value->>'address')::VARCHAR(42),
        (value->>'balance')::NUMERIC(78, 18),
        NOW()
    FROM jsonb_array_elements(p_holders)
    ON CONFLICT (wallet_address) 
    DO UPDATE SET 
        current_balance = EXCLUDED.current_balance,
        last_updated = NOW();
    
    GET DIAGNOSTICS rows_affected = ROW_COUNT;
    RETURN rows_affected;
END;
$$ LANGUAGE plpgsql;

-- Function 2: Reset baseline
CREATE OR REPLACE FUNCTION reset_holder_baselines()
RETURNS INTEGER AS $$
DECLARE
    rows_affected INTEGER;
BEGIN
    TRUNCATE TABLE holder_baselines;
    
    INSERT INTO holder_baselines (wallet_address, baseline_balance, baseline_date)
    SELECT wallet_address, current_balance, NOW()
    FROM holder_balances;
    
    GET DIAGNOSTICS rows_affected = ROW_COUNT;
    RETURN rows_affected;
END;
$$ LANGUAGE plpgsql;

-- Function 3: Get leaderboard
CREATE OR REPLACE FUNCTION get_live_leaderboard(limit_count INTEGER DEFAULT 100)
RETURNS TABLE (
    wallet_address VARCHAR(42),
    current_balance NUMERIC(78, 18),
    baseline_balance NUMERIC(78, 18),
    score NUMERIC(78, 18),
    rank BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH scored AS (
        SELECT 
            hb.wallet_address,
            hb.current_balance,
            COALESCE(bl.baseline_balance, 0) as baseline_balance,
            (hb.current_balance - COALESCE(bl.baseline_balance, 0)) as calc_score
        FROM holder_balances hb
        LEFT JOIN holder_baselines bl ON hb.wallet_address = bl.wallet_address
    ),
    ranked AS (
        SELECT 
            s.*,
            ROW_NUMBER() OVER (ORDER BY s.calc_score DESC) as r
        FROM scored s
        WHERE ABS(s.calc_score) >= 100
    )
    SELECT 
        ranked.wallet_address,
        ranked.current_balance,
        ranked.baseline_balance,
        ranked.calc_score as score,
        ranked.r as rank
    FROM ranked
    ORDER BY ranked.r
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE holder_balances IS 'Current token balances for all holders';
COMMENT ON TABLE holder_baselines IS 'Baseline snapshot - when admin resets, scores calculated from here';
COMMENT ON FUNCTION batch_upsert_holder_balances IS 'Efficiently updates balances for multiple holders';
COMMENT ON FUNCTION reset_holder_baselines IS 'Resets baseline to current balances - all scores become 0';
COMMENT ON FUNCTION get_live_leaderboard IS 'Returns top N holders with scores >= 100';