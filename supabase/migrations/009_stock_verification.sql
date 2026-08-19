-- 009_stock_verification.sql

CREATE TABLE IF NOT EXISTS ps_stock_master (
    ps_ref_no SERIAL PRIMARY KEY,
    rec_no INTEGER,
    details VARCHAR(250),
    frm_no INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE ps_stock_master ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS ps_stock_child (
    ps_id SERIAL PRIMARY KEY,
    ps_ref_no INTEGER REFERENCES ps_stock_master(ps_ref_no) ON DELETE CASCADE,
    rec_no INTEGER,
    prd_code INTEGER REFERENCES product(ref_no),
    bar_ref_id INTEGER,
    supp_code INTEGER,
    tag_rate NUMERIC(18,2) DEFAULT 0,
    frm_no INTEGER REFERENCES company(frm_code),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE ps_stock_child ENABLE ROW LEVEL SECURITY;
